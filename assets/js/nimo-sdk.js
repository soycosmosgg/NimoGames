(() => {
  const PROBE_BYTES = 16384;
  const PROBE_TIMEOUT_MS = 900;
  const RESULT_CACHE_TTL_MS = 5 * 60 * 1000;
  const RESULT_CACHE_VERSION = 7;
  const CDN_NAMES = {
    jsdelivr: 'jsDelivr',
    'jsdelivr-fastly': 'jsDelivr Fastly edge',
    'jsdelivr-gcore': 'jsDelivr Gcore edge',
    rawcdn: 'raw.githack CDN'
  };

  function getCdnBases(jsDelivrBase, providerFilter, includeRawcdn = true) {
    const match = jsDelivrBase.match(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/@]+)@([^/]+)(\/.*)?$/
    );
    if (!match) return null;

    const [, owner, repo, ref, path = '/'] = match;
    const jsdelivrPath = `/gh/${owner}/${repo}@${ref}${path}`;
    const cdnBases = [
      { provider: 'jsdelivr', base: `https://cdn.jsdelivr.net${jsdelivrPath}` },
      { provider: 'jsdelivr-fastly', base: `https://fastly.jsdelivr.net${jsdelivrPath}` },
      { provider: 'jsdelivr-gcore', base: `https://gcore.jsdelivr.net${jsdelivrPath}` },
      { provider: 'rawcdn', base: `https://raw.githack.com/${owner}/${repo}/${ref}${path}` }
    ];
    const selectedProviders = providerFilter
      ? [...new Set(includeRawcdn ? [...providerFilter, 'rawcdn'] : providerFilter)]
      : null;
    return selectedProviders
      ? cdnBases.filter(({ provider }) => selectedProviders.includes(provider))
      : cdnBases;
  }

  async function measureCdnProbe(url, provider, signal) {
    const startedAt = performance.now();
    const response = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}` }
    });
    if (!response.ok) throw new Error(`${provider} probe returned HTTP ${response.status}`);

    let bytes = 0;
    if (!response.body || !response.body.getReader) {
      throw new Error(`${provider} does not support bounded probe streaming`);
    }
    const reader = response.body.getReader();
    try {
      while (bytes < PROBE_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += Math.min(value.byteLength, PROBE_BYTES - bytes);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }

    if (bytes === 0) throw new Error(`${provider} probe returned an empty response`);
    const elapsedMs = Math.max(1, performance.now() - startedAt);
    return { provider, megabitsPerSecond: (bytes * 8) / (elapsedMs * 1000) };
  }

  function getResultCacheKey(game) {
    return `nimo-sdk:cdn:${game.id}:${game.cdnBase}:${game.cdnProbe}`;
  }

  function readCachedResult(game, providers) {
    try {
      const raw = sessionStorage.getItem(getResultCacheKey(game));
      if (!raw) return null;
      const cached = JSON.parse(raw);
      const validProviders = new Set(providers);
      if (
        cached.version !== RESULT_CACHE_VERSION ||
        cached.expiresAt <= Date.now() ||
        !validProviders.has(cached.winner) ||
        !Array.isArray(cached.probes) ||
        !cached.failures ||
        typeof cached.failures !== 'object' ||
        !cached.probes.some(probe =>
          probe.provider === cached.winner &&
          validProviders.has(probe.provider) &&
          Number.isFinite(probe.megabitsPerSecond) &&
          probe.megabitsPerSecond >= 0
        )
      ) {
        sessionStorage.removeItem(getResultCacheKey(game));
        return null;
      }
      return {
        ...cached,
        probes: cached.probes.filter(probe => validProviders.has(probe.provider)),
        failures: Object.fromEntries(
          Object.entries(cached.failures).filter(([provider]) => validProviders.has(provider))
        )
      };
    } catch (error) {
      console.warn('[Nimo SDK] Could not access the CDN result cache; testing providers again.', error);
      return null;
    }
  }

  function writeCachedResult(game, winner, probes, failures) {
    try {
      sessionStorage.setItem(getResultCacheKey(game), JSON.stringify({
        version: RESULT_CACHE_VERSION,
        expiresAt: Date.now() + RESULT_CACHE_TTL_MS,
        winner,
        probes,
        failures
      }));
    } catch (error) {
      console.warn('[Nimo SDK] Could not save the CDN result cache.', error);
    }
  }

  function logCdnReport(
    game,
    winner,
    successfulProbes,
    failedProbeStatuses,
    cached = false,
    selectedStatus = 'FASTEST'
  ) {
    const speedReport = successfulProbes.map(probe => ({
      name: CDN_NAMES[probe.provider],
      speed: `${probe.megabitsPerSecond.toFixed(1)} Mbps`,
      status: cached ? 'CACHED' : 'AVAILABLE',
      selected: probe.provider === winner
    }));
    Object.entries(failedProbeStatuses).forEach(([provider, status]) => {
      speedReport.push({
        name: CDN_NAMES[provider],
        speed: '—',
        status: cached ? 'CACHED' : status.toUpperCase(),
        selected: false
      });
    });
    speedReport.sort((a, b) => {
      const firstSpeed = Number.parseFloat(a.speed);
      const secondSpeed = Number.parseFloat(b.speed);
      return (Number.isFinite(secondSpeed) ? secondSpeed : -1) -
        (Number.isFinite(firstSpeed) ? firstSpeed : -1);
    });

    console.log(
      `%c NIMO SDK  %c CDN PERFORMANCE${cached ? ' · CACHED' : ''}  %c ${game.title} `,
      'background:#0866d8;color:#fff;font:700 11px/1.8 system-ui,sans-serif;padding:3px 8px;border-radius:4px',
      'color:#a8b5c7;font:600 11px/1.8 system-ui,sans-serif',
      'background:#334155;color:#fff;font:700 11px/1.8 system-ui,sans-serif;padding:3px 7px;border-radius:4px'
    );
    const selectedProbe = successfulProbes.find(probe => probe.provider === winner);
    console.log(
      `%c${selectedStatus === 'IN USE' ? 'ACTIVE CDN' : 'FASTEST CDN'}  %c${CDN_NAMES[winner] || winner}  %c${selectedProbe ? `${selectedProbe.megabitsPerSecond.toFixed(1)} Mbps` : 'speed unavailable'}`,
      'color:#526173;font:600 11px/2 system-ui,sans-serif',
      'color:#0866d8;font:700 12px/2 system-ui,sans-serif',
      'color:#0866d8;font:700 12px/2 system-ui,sans-serif'
    );
    const mono = 'font:11px/1.9 Consolas,monospace;padding:1px 4px;';
    console.log(
      `%c${'CDN'.padEnd(30)}%c${'SPEED'.padEnd(14)}%cSTATUS`,
      `${mono}color:#fff;background:#263445;font-weight:700`,
      `${mono}color:#fff;background:#263445;font-weight:700`,
      `${mono}color:#fff;background:#263445;font-weight:700`
    );
    speedReport.forEach(row => {
      const marker = row.selected ? '* ' : '  ';
      const rowStyle = row.selected
        ? `${mono}color:#0759bd;background:#eaf2ff;font-weight:700`
        : row.speed === '—'
          ? `${mono}color:#667085;background:#f3f4f6`
          : `${mono}color:#344054;background:#f8fafc`;
      console.log(
        `%c${(marker + row.name).padEnd(30)}%c${row.speed.padEnd(14)}%c${row.selected ? selectedStatus : row.status}`,
        rowStyle,
        rowStyle,
        rowStyle
      );
    });
  }

  async function getGameLaunchUrl(game) {
    const launchUrl = new URL(game.playUrl, window.location.href);
    if (!game.cdnBase || !game.cdnProbe) return launchUrl.href;

    const cdnBases = getCdnBases(game.cdnBase, game.cdnProviders, !game.cdnProvidersExact);
    if (!cdnBases) {
      console.error(`[Nimo SDK] Could not resolve CDN base URL for ${game.title}; using the configured base.`);
      return launchUrl.href;
    }

    const cached = readCachedResult(game, cdnBases.map(({ provider }) => provider));
    if (cached) {
      launchUrl.searchParams.set('nimoCdn', cached.winner);
      logCdnReport(game, cached.winner, cached.probes, cached.failures, true);
      return launchUrl.href;
    }

    const controllers = cdnBases.map(() => new AbortController());
    const probeUrls = cdnBases.map(({ provider, base }) => ({
      provider,
      url: new URL(game.cdnProbe, base).href
    }));
    const timeout = window.setTimeout(() => {
      controllers.forEach(controller => controller.abort());
    }, PROBE_TIMEOUT_MS);

    const probes = probeUrls.map((probe, index) =>
      measureCdnProbe(probe.url, probe.provider, controllers[index].signal)
    );
    const comparison = Promise.allSettled(probes);

    try {
      const firstAvailable = await Promise.any(probes);
      launchUrl.searchParams.set('nimoCdn', firstAvailable.provider);

      comparison.then(results => {
        const successfulProbes = results
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);
        const failedProbeStatuses = new Map();
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            failedProbeStatuses.set(
              probeUrls[index].provider,
              result.reason && result.reason.name === 'AbortError' ? 'timed out' : 'unavailable'
            );
          }
        });

        successfulProbes.sort((a, b) => b.megabitsPerSecond - a.megabitsPerSecond);
        const fastest = successfulProbes[0];
        const failures = Object.fromEntries(failedProbeStatuses);
        writeCachedResult(game, fastest.provider, successfulProbes, failures);
        logCdnReport(game, fastest.provider, successfulProbes, failures);
      }).catch(error => {
        console.error(`[Nimo SDK] Could not finish the CDN comparison for ${game.title}.`, error);
      }).finally(() => {
        window.clearTimeout(timeout);
        controllers.forEach(controller => controller.abort());
      });
      return launchUrl.href;
    } catch (error) {
      console.error(`[Nimo SDK] CDN comparison failed for ${game.title}; using jsDelivr.`, error);
      launchUrl.searchParams.set('nimoCdn', 'jsdelivr');
      window.clearTimeout(timeout);
      controllers.forEach(controller => controller.abort());
    }

    return launchUrl.href;
  }

  window.NimoSDK = Object.freeze({ getGameLaunchUrl });

  const script = document.currentScript;
  const originalBase = script && script.dataset.base;
  if (!originalBase) return;

  function setDocumentBase(baseUrl) {
    let baseElement = document.querySelector('base');
    if (!baseElement) {
      baseElement = document.createElement('base');
      document.head.insertBefore(baseElement, document.head.firstChild);
    }
    baseElement.href = baseUrl;
  }

  const pageProviders = script.dataset.providers
    ? script.dataset.providers.split(',').map(provider => provider.trim())
    : null;
  const availableBases = getCdnBases(
    originalBase,
    pageProviders,
    script.dataset.providersExact !== 'true'
  );
  if (!availableBases || availableBases.length === 0) {
    console.error('[Nimo SDK] Could not resolve the GitHub CDN base URL.');
    window.NIMO_CDN_BASE = originalBase;
    window.NIMO_CDN_PROVIDER = 'jsdelivr';
    setDocumentBase(originalBase);
    return;
  }

  const requestedProvider = new URLSearchParams(location.search).get('nimoCdn');
  const parentSelectedProvider = availableBases.some(cdn => cdn.provider === requestedProvider);
  const provider = parentSelectedProvider
    ? requestedProvider
    : availableBases[0].provider;
  const selectedBase = availableBases.find(cdn => cdn.provider === provider).base;

  window.NIMO_CDN_BASES = Object.freeze(
    (availableBases || []).map(({ provider, base }) =>
      Object.freeze({ provider, base })
    )
  );
  window.NIMO_CDN_BASE = selectedBase;
  window.NIMO_CDN_PROVIDER = provider;
  if (script.dataset.probe) {
    const game = {
      id: script.dataset.gameId || document.title,
      title: document.title,
      cdnBase: originalBase,
      cdnProbe: script.dataset.probe
    };
    if (!parentSelectedProvider) {
      const cached = readCachedResult(game, (availableBases || []).map(({ provider }) => provider));
      if (cached) {
        logCdnReport(game, provider, cached.probes, cached.failures, true, 'IN USE');
      } else {
        const controllers = (availableBases || []).map(() => new AbortController());
        const timeout = window.setTimeout(
          () => controllers.forEach(controller => controller.abort()),
          PROBE_TIMEOUT_MS
        );
        Promise.allSettled((availableBases || []).map((cdn, index) =>
          measureCdnProbe(
            new URL(script.dataset.probe, cdn.base).href,
            cdn.provider,
            controllers[index].signal
          )
        )).then(results => {
          const successfulProbes = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
          const failures = Object.fromEntries(results.flatMap((result, index) =>
            result.status === 'rejected'
              ? [[availableBases[index].provider,
                result.reason && result.reason.name === 'AbortError' ? 'timed out' : 'unavailable']]
              : []
          ));
          if (successfulProbes.length) {
            logCdnReport(game, provider, successfulProbes, failures, false, 'IN USE');
          } else {
            console.error(`[Nimo SDK] CDN speed tests failed for ${game.title}.`);
          }
        }).finally(() => {
          window.clearTimeout(timeout);
          controllers.forEach(controller => controller.abort());
        });
      }
    }
  } else {
    console.info(`[Nimo SDK] ${document.title}: ${CDN_NAMES[provider]} selected for game assets.`);
  }
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = new URL(window.NIMO_CDN_BASE).origin;
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);
  setDocumentBase(window.NIMO_CDN_BASE);
})();

(() => {
  const script = document.currentScript;
  if (!script || script.dataset.loading !== 'true') return;

  const overlayId = 'nimo-game-loading';
  const candidateSelector = [
    '#loader',
    '#status',
    '#statusDiv',
    '#unity-loading-bar',
    '#loading-overlay',
    '#loading-screen',
    '#loadingScreen',
    '#loading',
    '#msg',
    '.loader'
  ].join(',');
  const progressSelector = [
    'progress',
    '[role="progressbar"][aria-valuenow]',
    '#status',
    '#statusTextDiv',
    '#loading-percent',
    '#loading-text',
    '#loading-status',
    '#loading-transfer',
    '#msg',
    '#percentage',
    '.loading-percent'
  ].join(',');

  const style = document.createElement('style');
  style.textContent = `
    #${overlayId} {
      position: fixed;
      z-index: 2147483647;
      inset: 0;
      display: grid;
      place-items: center;
      background: #000;
      color: #fff;
      opacity: 1;
      transition: opacity 240ms ease;
      pointer-events: none;
    }
    #${overlayId}.nimo-game-loading--hidden {
      opacity: 0;
    }
    #${overlayId} .nimo-game-loading__content {
      display: flex;
      width: min(420px, 82vw);
      flex-direction: column;
      align-items: center;
      gap: 28px;
    }
    #${overlayId} img {
      display: block;
      width: min(200px, 46vw);
      height: auto;
      object-fit: contain;
      image-rendering: auto;
    }
    #${overlayId} .nimo-game-loading__progress {
      position: relative;
      display: flex;
      width: min(360px, 76vw);
      align-items: center;
    }
    #${overlayId} .nimo-game-loading__track {
      height: 16px;
      width: 100%;
      flex: 0 0 auto;
      overflow: hidden;
      background: #363636;
      border-radius: 3px;
    }
    #${overlayId} .nimo-game-loading__fill {
      width: 0;
      height: 100%;
      background: #fff;
      border-radius: inherit;
      transition: width 180ms ease-out;
    }
    #${overlayId} .nimo-game-loading__percent {
      position: absolute;
      left: calc(100% + 16px);
      min-width: 38px;
      color: #fff;
      font: 500 13px/1 system-ui, sans-serif;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    @media (prefers-reduced-motion: reduce) {
      #${overlayId},
      #${overlayId} .nimo-game-loading__fill {
        transition: none;
      }
    }
  `;
  document.head.appendChild(style);

  function start() {
    if (document.getElementById(overlayId)) return;

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', 'Cargando juego');
    overlay.innerHTML = `
      <div class="nimo-game-loading__content">
        <img src="https://cdn-ngames.pages.dev/images/app/logo.webp" alt="Nimo Games">
        <div class="nimo-game-loading__progress">
          <div class="nimo-game-loading__track" role="progressbar"
            aria-label="Progreso de carga" aria-valuemin="0"
            aria-valuemax="100" aria-valuenow="0">
            <div class="nimo-game-loading__fill"></div>
          </div>
          <span class="nimo-game-loading__percent">0%</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const fill = overlay.querySelector('.nimo-game-loading__fill');
    const track = overlay.querySelector('.nimo-game-loading__track');
    const percentLabel = overlay.querySelector('.nimo-game-loading__percent');
    const beganAt = performance.now();
    const observedLoaders = new Set();
    let finished = false;
    let lastPercent = 0;

    function isVisible(element) {
      const styles = getComputedStyle(element);
      return styles.display !== 'none' && styles.visibility !== 'hidden' &&
        Number(styles.opacity) !== 0 && element.getClientRects().length > 0;
    }

    function isLoadingElement(element) {
      if (!isVisible(element)) return false;
      return !(element.matches('#msg') && !element.textContent.trim());
    }

    function readProgress() {
      let reported = null;
      for (const element of document.querySelectorAll(progressSelector)) {
        if (overlay.contains(element) || !isVisible(element)) continue;
        const value = Number(element.value);
        const max = Number(element.max);
        const rawAriaValue = element.getAttribute('aria-valuenow');
        const rawAriaMax = element.getAttribute('aria-valuemax');
        const ariaValue = rawAriaValue === null ? NaN : Number(rawAriaValue);
        const ariaMax = rawAriaMax === null ? 100 : Number(rawAriaMax);
        if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
          reported = Math.floor(Math.max(0, Math.min(1, value / max)) * 100);
          break;
        }
        if (Number.isFinite(ariaValue) && Number.isFinite(ariaMax) && ariaMax > 0) {
          reported = Math.floor(Math.max(0, Math.min(1, ariaValue / ariaMax)) * 100);
          break;
        }
        const match = element.textContent.match(/(?:^|\D)(\d{1,3})\s*%/);
        if (match) {
          reported = Math.min(100, Number(match[1]));
          break;
        }
      }

      if (reported !== null) return reported;

      const bars = document.querySelectorAll(
        '#unity-progress-bar-full, #barfill, #progress-fill, #data-fill, ' +
        '#wasm-fill, #assets-fill, #bar'
      );
      for (const bar of bars) {
        if (overlay.contains(bar) || !isVisible(bar)) continue;
        const width = bar.getBoundingClientRect().width;
        const parentWidth = bar.parentElement.getBoundingClientRect().width;
        if (parentWidth > 0) {
          return Math.floor(Math.max(0, Math.min(1, width / parentWidth)) * 100);
        }
      }

      const elapsedSeconds = (performance.now() - beganAt) / 1000;
      return Math.min(95, Math.floor(95 * (1 - Math.exp(-elapsedSeconds / 18))));
    }

    function hide() {
      if (finished) return;
      finished = true;
      fill.style.width = '100%';
      percentLabel.textContent = '100%';
      track.setAttribute('aria-valuenow', '100');
      setTimeout(() => {
        overlay.classList.add('nimo-game-loading--hidden');
        setTimeout(() => {
          overlay.remove();
          style.remove();
        }, 260);
      }, 120);
    }

    function update() {
      if (finished) return;

      for (const loader of document.querySelectorAll(candidateSelector)) {
        if (loader !== overlay && isLoadingElement(loader)) observedLoaders.add(loader);
      }

      const percent = Math.max(lastPercent, readProgress());
      lastPercent = percent;
      fill.style.width = `${percent}%`;
      percentLabel.textContent = `${percent}%`;
      track.setAttribute('aria-valuenow', String(percent));

      const loaderFinished = observedLoaders.size > 0 &&
        [...observedLoaders].every(loader => !loader.isConnected || !isLoadingElement(loader));
      const iframeLoaded = [...document.querySelectorAll('iframe')].some(frame => {
        return frame.dataset.nimoLoaded === 'true';
      });
      if (loaderFinished || iframeLoaded) {
        hide();
        return;
      }

      setTimeout(update, 200);
    }

    for (const frame of document.querySelectorAll('iframe')) {
      frame.addEventListener('load', () => {
        frame.dataset.nimoLoaded = 'true';
      }, { once: true });
    }

    window.addEventListener('load', () => {
      if (observedLoaders.size === 0 && !document.querySelector('iframe')) {
        setTimeout(() => {
          if (!finished && observedLoaders.size === 0) hide();
        }, 2500);
      }
    }, { once: true });

    update();
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
