const MAX_REQUEST_LENGTH = 8192;
const MAX_MESSAGE_LENGTH = 250;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function matchesAdminSecret(suppliedSecret, configuredSecret) {
  const encoder = new TextEncoder();
  const [suppliedDigest, configuredDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(suppliedSecret)),
    crypto.subtle.digest('SHA-256', encoder.encode(configuredSecret))
  ]);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  const configuredBytes = new Uint8Array(configuredDigest);
  let difference = 0;

  for (let index = 0; index < configuredBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ configuredBytes[index];
  }

  return difference === 0;
}

export async function onRequestGet({ env }) {
  if (!env.VISITORS_DB) {
    return jsonResponse({ error: 'The messages database is not configured.' }, 503);
  }

  try {
    const row = await env.VISITORS_DB.prepare(
      'SELECT message, updated_at FROM site_messages WHERE id = 1'
    ).first();
    if (!row || typeof row.message !== 'string') {
      throw new Error('The message row has not been initialized.');
    }
    if (row.message.length > MAX_MESSAGE_LENGTH || !Number.isSafeInteger(row.updated_at)) {
      throw new Error('The saved message has an invalid format.');
    }

    return jsonResponse({ message: row.message, updatedAt: row.updated_at });
  } catch (error) {
    console.error('[messages] Failed to read the current message.', error);
    return jsonResponse({ error: 'Unable to read the current message.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.VISITORS_DB) {
    return jsonResponse({ error: 'The messages database is not configured.' }, 503);
  }
  if (!env.ADMIN_SECRET) {
    return jsonResponse({ error: 'The messages admin secret is not configured.' }, 503);
  }
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Requests must come from this site.' }, 403);
  }

  const authorization = request.headers.get('authorization') || '';
  if (authorization.length > 512 || !authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Invalid admin secret.' }, 401);
  }
  const suppliedSecret = authorization.slice('Bearer '.length);
  if (!await matchesAdminSecret(suppliedSecret, env.ADMIN_SECRET)) {
    return jsonResponse({ error: 'Invalid admin secret.' }, 401);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonResponse({ error: 'Expected an application/json request.' }, 415);
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_LENGTH) {
    return jsonResponse({ error: 'Request body is too large.' }, 413);
  }

  let body;
  try {
    body = await request.text();
  } catch {
    return jsonResponse({ error: 'Unable to read request body.' }, 400);
  }
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_LENGTH) {
    return jsonResponse({ error: 'Request body is too large.' }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  if (!payload || typeof payload.message !== 'string') {
    return jsonResponse({ error: 'A message is required.' }, 400);
  }
  const message = payload.message.trim();
  if (message.length === 0 || message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse({
      error: `The message must contain 1-${MAX_MESSAGE_LENGTH} characters.`
    }, 400);
  }

  const updatedAt = Date.now();
  try {
    await env.VISITORS_DB.prepare(`
      INSERT INTO site_messages (id, message, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        message = excluded.message,
        updated_at = excluded.updated_at
    `).bind(message, updatedAt).run();

    return jsonResponse({ message, updatedAt });
  } catch (error) {
    console.error('[messages] Failed to save the current message.', error);
    return jsonResponse({ error: 'Unable to save the current message.' }, 500);
  }
}
