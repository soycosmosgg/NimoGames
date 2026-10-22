(() => {
  function showLoadError(error) {
    console.error('[Nimo Games] Could not load VC Web.', error);
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = 'No se pudo cargar Grand Theft Auto: Vice City. Inténtalo de nuevo más tarde.';
    Object.assign(message.style, {
      color: '#fff',
      font: '16px system-ui, sans-serif',
      margin: '2rem',
      textAlign: 'center'
    });
    (document.body || document.documentElement).appendChild(message);
  }

  const base = window.NIMO_CDN_BASE;
  if (!base) {
    showLoadError(new Error('The VC Web CDN base was not initialized.'));
    return;
  }

  const assetRoots = ['/assets/', '/vc-assets/', '/vcsky/'];
  const originalFetch = window.fetch;

  function resolveGameAsset(input) {
    const inputUrl = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    if (typeof inputUrl !== 'string') return null;

    const url = new URL(inputUrl, window.location.href);
    if (
      url.origin !== window.location.origin ||
      !assetRoots.some(root => url.pathname.startsWith(root))
    ) {
      return null;
    }

    return new URL(`${url.pathname.slice(1)}${url.search}${url.hash}`, base).href;
  }

  window.fetch = (input, init) => {
    const resolvedUrl = resolveGameAsset(input);
    if (!resolvedUrl) return originalFetch.call(window, input, init);
    const request = input instanceof Request ? new Request(resolvedUrl, input) : resolvedUrl;
    return originalFetch.call(window, request, init);
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    const resolvedUrl = resolveGameAsset(url);
    return originalXhrOpen.call(this, method, resolvedUrl || url, ...args);
  };

  const scriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
  if (scriptSrc?.get && scriptSrc.set) {
    Object.defineProperty(HTMLScriptElement.prototype, 'src', {
      configurable: scriptSrc.configurable,
      enumerable: scriptSrc.enumerable,
      get: scriptSrc.get,
      set(value) {
        scriptSrc.set.call(this, resolveGameAsset(value) || value);
      }
    });
  }

  async function loadGame() {
    const themeUrl = new URL('assets/home-theme.css?v=8', base);
    const themeResponse = await originalFetch.call(window, themeUrl);
    if (!themeResponse.ok) {
      throw new Error(`VC Web theme stylesheet returned HTTP ${themeResponse.status}`);
    }
    const themeCss = await themeResponse.text();
    const assetBase = new URL('assets/', base).href;
    const adjustedThemeCss = themeCss.replace(
      /url\(\s*(["']?)\/assets\//g,
      (_, quote) => `url(${quote}${assetBase}`
    );
    const themeStyle = document.createElement('style');
    themeStyle.textContent = adjustedThemeCss;
    document.head.appendChild(themeStyle);

    if (window.location.pathname === '/games/1351/index.html') {
      window.history.replaceState(
        window.history.state,
        '',
        `/games/1351/${window.location.search}${window.location.hash}`
      );
    }

    const appUrl = new URL('assets/index-DRp2kxJe.js?v=4', base);
    const appResponse = await originalFetch.call(window, appUrl);
    if (!appResponse.ok) {
      throw new Error(`VC Web application bundle returned HTTP ${appResponse.status}`);
    }
    const appSource = await appResponse.text();
    const routeBase = 'history:yu("/")';
    if (!appSource.includes(routeBase)) {
      throw new Error('VC Web router base could not be adapted to the Nimo Games path.');
    }
    const adaptedSource = appSource.replace(routeBase, 'history:yu("/games/1351/")');
    const appModuleUrl = URL.createObjectURL(
      new Blob([adaptedSource], { type: 'text/javascript' })
    );
    try {
      await import(appModuleUrl);
    } finally {
      URL.revokeObjectURL(appModuleUrl);
    }
  }

  loadGame().catch(showLoadError);
})();
