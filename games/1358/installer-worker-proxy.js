const source = new URL(self.location.href).searchParams.get('source');
if (!source) {
  throw new Error('The GTA2 installer worker source URL is missing.');
}

const sourceUrl = new URL(source);
const supportedCdnHosts = new Set([
  'cdn.jsdelivr.net',
  'fastly.jsdelivr.net',
  'gcore.jsdelivr.net'
]);
const isJsDelivrWorker =
  supportedCdnHosts.has(sourceUrl.hostname) &&
  sourceUrl.pathname === '/gh/M1sterMo/gta2@main/installer-worker.js';
const isRawGithackWorker =
  sourceUrl.hostname === 'raw.githack.com' &&
  sourceUrl.pathname === '/M1sterMo/gta2/main/installer-worker.js';
if (!isJsDelivrWorker && !isRawGithackWorker) {
  throw new Error('The GTA2 installer worker URL is not supported.');
}

const queuedMessages = [];
const queueMessage = event => queuedMessages.push(event);
self.onmessage = queueMessage;

try {
  await import(sourceUrl.href);
  const installerHandler = self.onmessage;
  if (typeof installerHandler !== 'function' || installerHandler === queueMessage) {
    throw new Error('The GTA2 installer worker did not register its message handler.');
  }

  self.onmessage = event => installerHandler.call(self, event);
  queuedMessages.splice(0).forEach(event => installerHandler.call(self, event));
} catch (error) {
  const installer = queuedMessages.find(event => event.data?.installer)?.data.installer;
  const transfer = installer instanceof ArrayBuffer ? [installer] : [];
  self.postMessage({
    type: 'error',
    message: `Could not initialize the GTA2 installer worker: ${error.message || String(error)}`,
    installer
  }, transfer);
}
