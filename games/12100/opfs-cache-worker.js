const CACHE_DIR = "_gta3_asset_cache_v1";
const ARCHIVE_FILE = "game.zip";
const META_FILE = "meta.json";
const MAX_RETRIES = 12;
const STATE_RECOVERY_RETRIES = 4;

function postProgress(data) {
  self.postMessage({ type: "progress", ...data });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStaleStateError(err) {
  const text = String(err?.stack || err?.message || err || "");
  return (
    err?.name === "InvalidStateError" ||
    /state cached in an interface object.*changed since it was read from disk/i.test(text) ||
    /state.*changed since.*read from disk/i.test(text)
  );
}

async function withFreshHandleRetry(fn, attempts = STATE_RECOVERY_RETRIES) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isStaleStateError(err) || attempt >= attempts - 1) throw err;
      postProgress({
        phase: "repairing-storage",
        attempt: attempt + 1,
        maxRetries: attempts,
      });
      await sleep(120 * (attempt + 1));
    }
  }
  throw lastError || new Error("OPFS operation failed.");
}

async function getCacheDir(create = false) {
  return withFreshHandleRetry(async () => {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(CACHE_DIR, { create });
  });
}

async function getArchiveSize() {
  return withFreshHandleRetry(async () => {
    try {
      const dir = await getCacheDir(false);
      const handle = await dir.getFileHandle(ARCHIVE_FILE);
      return (await handle.getFile()).size;
    } catch (err) {
      if (isStaleStateError(err)) throw err;
      return 0;
    }
  });
}

async function getArchiveFileSnapshot() {
  return withFreshHandleRetry(async () => {
    const dir = await getCacheDir(false);
    const handle = await dir.getFileHandle(ARCHIVE_FILE);
    return handle.getFile();
  });
}

function hasSignature(bytes, signature) {
  outer: for (let i = 0; i <= bytes.length - signature.length; i++) {
    for (let j = 0; j < signature.length; j++) {
      if (bytes[i + j] !== signature[j]) continue outer;
    }
    return true;
  }
  return false;
}

function invalidArchiveError(message) {
  const error = new Error(message);
  error.invalidArchive = true;
  return error;
}

async function assertArchiveLooksLikeZip() {
  const file = await getArchiveFileSnapshot();
  if (!file || file.size < 22) {
    throw invalidArchiveError("Downloaded archive is too small to be a valid ZIP.");
  }

  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const startsLikeZip =
    (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) ||
    (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x05 && head[3] === 0x06) ||
    (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x07 && head[3] === 0x08);
  if (!startsLikeZip) {
    throw invalidArchiveError("Asset proxy returned non-ZIP data. The cached response will be discarded.");
  }

  const tailStart = Math.max(0, file.size - 131072);
  const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
  const hasEndRecord =
    hasSignature(tail, [0x50, 0x4b, 0x05, 0x06]) ||
    hasSignature(tail, [0x50, 0x4b, 0x06, 0x06]);
  if (!hasEndRecord) {
    throw invalidArchiveError("Downloaded ZIP is incomplete or truncated (end record not found).");
  }

  return file.size;
}

async function readMeta() {
  return withFreshHandleRetry(async () => {
    try {
      const dir = await getCacheDir(false);
      const handle = await dir.getFileHandle(META_FILE);
      return JSON.parse(await (await handle.getFile()).text());
    } catch (err) {
      if (isStaleStateError(err)) throw err;
      return null;
    }
  });
}

async function writeMeta(meta) {
  return withFreshHandleRetry(async () => {
    const dir = await getCacheDir(true);
    const handle = await dir.getFileHandle(META_FILE, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(JSON.stringify(meta));
      await writable.close();
    } catch (err) {
      try { await writable.abort?.(); } catch {}
      try { await writable.close(); } catch {}
      throw err;
    }
  });
}

// Never remove/recreate CACHE_DIR while a browser tab/worker may still hold a
// handle to it. Removing the directory is what triggers Chromium's
// "state cached in an interface object ... changed since it was read from disk"
// error. Reset only the files inside the stable directory instead.
async function resetCacheFiles() {
  return withFreshHandleRetry(async () => {
    const dir = await getCacheDir(true);
    for (const name of [ARCHIVE_FILE, META_FILE]) {
      try {
        await dir.removeEntry(name);
      } catch (err) {
        if (isStaleStateError(err)) throw err;
      }
    }
  });
}

async function resetArchiveOnly() {
  return withFreshHandleRetry(async () => {
    const dir = await getCacheDir(true);
    try {
      await dir.removeEntry(ARCHIVE_FILE);
    } catch (err) {
      if (isStaleStateError(err)) throw err;
    }
  });
}

async function openArchiveWritable(offset = 0) {
  return withFreshHandleRetry(async () => {
    const dir = await getCacheDir(true);
    const handle = await dir.getFileHandle(ARCHIVE_FILE, { create: true });
    if (offset > 0) {
      const writable = await handle.createWritable({ keepExistingData: true });
      await writable.seek(offset);
      return writable;
    }
    return handle.createWritable();
  });
}

async function copyStreamToOPFS(stream, writable, loadedStart, total, phase, resumeFrom = 0) {
  if (!stream) throw new Error("Download response has no readable body.");
  const reader = stream.getReader();
  let loaded = loadedStart;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    await writable.write(value);
    loaded += value.byteLength;
    postProgress({ phase, loaded, total, resumed: phase === "resuming", resumeFrom });
  }
  return loaded;
}

async function getRemoteSize(url) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow", cache: "no-store" });
    if (!response.ok) return 0;
    return Number(response.headers.get("content-length") || 0);
  } catch {
    return 0;
  }
}

async function cacheLocalFile(file, cacheVersion = "") {
  await resetCacheFiles();
  const writable = await openArchiveWritable(0);
  try {
    const loaded = await copyStreamToOPFS(file.stream(), writable, 0, file.size || 0, "caching-local");
    await writable.close();
    const verifiedSize = await assertArchiveLooksLikeZip();
    await writeMeta({
      complete: true,
      source: "local",
      name: file.name || "game.zip",
      size: verifiedSize || loaded,
      cacheVersion,
      savedAt: new Date().toISOString(),
    });
    self.postMessage({ type: "done", size: verifiedSize || loaded, resumed: false, verified: true });
  } catch (err) {
    try { await writable.abort?.(); } catch {}
    try { await writable.close(); } catch {}
    throw err;
  }
}

function retryDelay(attempt) {
  return Math.min(15000, 1500 * Math.pow(1.55, Math.max(0, attempt - 1)));
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchDownload(url, existing) {
  const headers = existing > 0 ? { Range: "bytes=" + existing + "-" } : undefined;
  const response = await fetch(url, { headers, redirect: "follow", cache: "no-store" });
  if (!response.ok && response.status !== 206) {
    const err = new Error("Download failed: HTTP " + response.status);
    err.httpStatus = response.status;
    throw err;
  }
  return response;
}

async function cacheRemoteUrl(url, cacheVersion = "") {
  const oldMeta = await readMeta();
  let total = 0;
  const sameSource =
    oldMeta?.source === "remote" &&
    oldMeta?.url === url &&
    String(oldMeta?.cacheVersion || "") === String(cacheVersion || "");

  if (sameSource && !oldMeta.complete) {
    total = Number(oldMeta.total || 0);
  } else if (sameSource && oldMeta?.complete) {
    const existingComplete = await getArchiveSize();
    if (existingComplete > 0 && (!oldMeta.size || existingComplete === Number(oldMeta.size))) {
      try {
        await assertArchiveLooksLikeZip();
        self.postMessage({ type: "done", size: existingComplete, resumed: true, reused: true, verified: true });
        return;
      } catch {
        await resetCacheFiles();
      }
    } else {
      await resetCacheFiles();
    }
  } else {
    await resetCacheFiles();
  }

  if (!total) total = await getRemoteSize(url);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let existing = await getArchiveSize();

    if (total && existing >= total && existing > 0) {
      const verifiedSize = await assertArchiveLooksLikeZip();
      await writeMeta({
        complete: true,
        source: "remote",
        url,
        size: verifiedSize || existing,
        total,
        cacheVersion,
        savedAt: new Date().toISOString(),
      });
      self.postMessage({ type: "done", size: verifiedSize || existing, resumed: true, verified: true });
      return;
    }

    await writeMeta({
      complete: false,
      source: "remote",
      url,
      size: existing,
      total,
      cacheVersion,
      savedAt: new Date().toISOString(),
    });

    let writable = null;
    try {
      writable = await openArchiveWritable(existing);
      let response = await fetchDownload(url, existing);
      let phase = "downloading";
      let resumeFrom = 0;

      if (existing > 0) {
        if (response.status === 206) {
          phase = "resuming";
          resumeFrom = existing;
          postProgress({
            phase: "resuming",
            loaded: existing,
            total,
            resumed: true,
            resumeFrom,
          });
        } else {
          // Server did not honor Range. Close the old stream, replace only the
          // archive file, then reacquire a completely fresh handle.
          try { await writable.abort?.(); } catch {}
          try { await writable.close(); } catch {}
          writable = null;
          await resetArchiveOnly();
          existing = 0;
          writable = await openArchiveWritable(0);
          response = await fetchDownload(url, 0);
        }
      }

      if (!total) {
        const headerTotal = Number(response.headers.get("content-length") || 0);
        if (response.status === 206) {
          const range = response.headers.get("content-range") || "";
          const match = /\/([0-9]+)$/.exec(range);
          total = match ? Number(match[1]) : headerTotal + existing;
        } else {
          total = headerTotal;
        }
      }

      const loaded = await copyStreamToOPFS(
        response.body,
        writable,
        existing,
        total,
        phase,
        resumeFrom
      );
      await writable.close();
      writable = null;

      const finalSize = await getArchiveSize();
      if (total && finalSize !== total) {
        throw new Error("Downloaded ZIP size mismatch: got " + finalSize + ", expected " + total);
      }

      const verifiedSize = await assertArchiveLooksLikeZip();

      await writeMeta({
        complete: true,
        source: "remote",
        url,
        size: verifiedSize || finalSize || loaded,
        total: total || verifiedSize || finalSize || loaded,
        cacheVersion,
        savedAt: new Date().toISOString(),
      });

      self.postMessage({
        type: "done",
        size: verifiedSize || finalSize || loaded,
        resumed: resumeFrom > 0,
        verified: true,
      });
      return;
    } catch (err) {
      if (writable) {
        try { await writable.abort?.(); } catch {}
        try { await writable.close(); } catch {}
      }

      if (err?.invalidArchive) {
        // Never resume from bytes that are known to be HTML/corrupt. A later
        // successful Range response must not be appended to a bad prefix.
        await resetArchiveOnly().catch(() => {});
        try {
          await writeMeta({
            complete: false,
            source: "remote",
            url,
            size: 0,
            total: 0,
            cacheVersion,
            savedAt: new Date().toISOString(),
          });
        } catch {}
        const canRetryBadArchive = attempt < MAX_RETRIES;
        if (!canRetryBadArchive) throw err;
        const retryInMs = Math.min(5000, 700 * (attempt + 1));
        postProgress({
          phase: "invalid-archive",
          loaded: 0,
          total: 0,
          retryInMs,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          message: err.message,
        });
        await sleep(retryInMs);
        continue;
      }

      // A stale FileSystemHandle can happen if an older tab was still using the
      // previous build. Reacquire every handle and continue from the bytes that
      // remain on disk instead of failing the whole install.
      if (isStaleStateError(err)) {
        const retryInMs = 180 * (attempt + 1);
        postProgress({
          phase: "repairing-storage",
          loaded: await getArchiveSize().catch(() => 0),
          total,
          retryInMs,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
        });
        await sleep(retryInMs);
        continue;
      }

      const partialSize = await getArchiveSize();
      try {
        await writeMeta({
          complete: false,
          source: "remote",
          url,
          size: partialSize,
          total,
          cacheVersion,
          savedAt: new Date().toISOString(),
        });
      } catch (metaErr) {
        if (!isStaleStateError(metaErr)) throw metaErr;
      }

      const status = Number(err?.httpStatus || 0);
      const canRetry = attempt < MAX_RETRIES && (!status || retryableStatus(status));
      if (!canRetry) throw err;

      const retryInMs = retryDelay(attempt + 1);
      postProgress({
        phase: "retrying",
        loaded: partialSize,
        total,
        retryInMs,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
      });
      await sleep(retryInMs);
    }
  }

  throw new Error("GTA III archive download exhausted all retry attempts.");
}

async function runWithStateRecovery(task) {
  let lastError = null;
  for (let attempt = 0; attempt < STATE_RECOVERY_RETRIES; attempt++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (!isStaleStateError(err) || attempt >= STATE_RECOVERY_RETRIES - 1) throw err;
      postProgress({
        phase: "repairing-storage",
        attempt: attempt + 1,
        maxRetries: STATE_RECOVERY_RETRIES,
      });
      await sleep(200 * (attempt + 1));
    }
  }
  throw lastError;
}

self.onmessage = async (event) => {
  try {
    const msg = event.data || {};
    if (msg.type === "cache-file") {
      await runWithStateRecovery(() => cacheLocalFile(msg.file, msg.cacheVersion || ""));
      return;
    }
    if (msg.type === "cache-url") {
      await runWithStateRecovery(() => cacheRemoteUrl(msg.url, msg.cacheVersion || ""));
      return;
    }
    throw new Error("Unknown OPFS worker request: " + msg.type);
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err?.stack || err?.message || String(err),
    });
  }
};
