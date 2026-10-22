(() => {
  const NativeWorker = window.Worker;

  window.Worker = class NimoWorker extends NativeWorker {
    constructor(scriptURL, options) {
      const workerUrl = new URL(scriptURL, document.baseURI);
      if (workerUrl.pathname.endsWith('/installer-worker.js')) {
        const proxyUrl = new URL('/games/1358/installer-worker-proxy.js', location.origin);
        proxyUrl.searchParams.set('source', workerUrl.href);
        super(proxyUrl, options);
        return;
      }

      super(scriptURL, options);
    }
  };
})();
