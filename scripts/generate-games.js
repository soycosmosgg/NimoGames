const fs = require('node:fs');
const path = require('node:path');

const rootDirectory = path.resolve(__dirname, '..');
const gamesDirectory = path.join(rootDirectory, 'games');
const outputFile = path.join(rootDirectory, 'assets', 'js', 'games.js');

function parseAttributes(tag) {
  const attributes = {};
  const attributePattern = /([^\s=<>/"'`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;

  while ((match = attributePattern.exec(tag))) {
    const name = match[1].toLowerCase();
    if (name === 'script' || name === 'meta') continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }

  return attributes;
}

function decodeHtmlEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity, code) => {
    if (code[0] === '#') {
      const hexadecimal = code[1].toLowerCase() === 'x';
      const numericValue = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(numericValue) ? String.fromCodePoint(numericValue) : entity;
    }

    return {
      amp: '&',
      apos: "'",
      gt: '>',
      lt: '<',
      quot: '"'
    }[code.toLowerCase()];
  });
}

function readCatalogOverrides(gameDirectory) {
  const file = path.join(gameDirectory, 'catalog.json');
  if (!fs.existsSync(file)) return {};

  const overrides = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error(`${file} must contain a JSON object.`);
  }
  if (overrides.title !== undefined &&
      (typeof overrides.title !== 'string' || overrides.title.trim() === '')) {
    throw new Error(`${file}: title must be a non-empty string.`);
  }
  if (overrides.meta !== undefined && typeof overrides.meta !== 'string') {
    throw new Error(`${file}: meta must be a string.`);
  }
  if (overrides.cdnBase !== undefined && typeof overrides.cdnBase !== 'string') {
    throw new Error(`${file}: cdnBase must be a string.`);
  }
  if (overrides.cdnProbe !== undefined && typeof overrides.cdnProbe !== 'string') {
    throw new Error(`${file}: cdnProbe must be a string.`);
  }
  if (overrides.cdnProviders !== undefined &&
      (!Array.isArray(overrides.cdnProviders) ||
        overrides.cdnProviders.some(provider => typeof provider !== 'string' || !provider))) {
    throw new Error(`${file}: cdnProviders must be an array of non-empty strings.`);
  }
  if (overrides.cdnProvidersExact !== undefined &&
      typeof overrides.cdnProvidersExact !== 'boolean') {
    throw new Error(`${file}: cdnProvidersExact must be a boolean.`);
  }
  if (overrides.exclude !== undefined && typeof overrides.exclude !== 'boolean') {
    throw new Error(`${file}: exclude must be a boolean.`);
  }
  if (overrides.sandbox !== undefined &&
      (!Array.isArray(overrides.sandbox) ||
        overrides.sandbox.some(permission => typeof permission !== 'string' || !permission))) {
    throw new Error(`${file}: sandbox must be an array of non-empty strings.`);
  }

  const unsupportedKeys = Object.keys(overrides).filter(
    key => ![
      'title',
      'meta',
      'cdnBase',
      'cdnProbe',
      'cdnProviders',
      'cdnProvidersExact',
      'exclude',
      'sandbox'
    ].includes(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new Error(`${file}: unsupported properties: ${unsupportedKeys.join(', ')}.`);
  }

  return overrides;
}

function readGame(gameId) {
  const gameDirectory = path.join(gamesDirectory, gameId);
  const indexFile = path.join(gameDirectory, 'index.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error(`Game folder "${gameId}" must contain index.html.`);
  }

  const overrides = readCatalogOverrides(gameDirectory);
  if (overrides.exclude) return null;

  const html = fs.readFileSync(indexFile, 'utf8');
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  if (!titleMatch) throw new Error(`${indexFile} must contain a <title>.`);

  const sdkTag = html.match(/<script\b[^>]*\bsrc\s*=\s*(["'])[^"']*nimo-sdk\.js[^"']*\1[^>]*>/i)?.[0];
  const sdkAttributes = sdkTag ? parseAttributes(sdkTag) : {};
  if (sdkAttributes['data-game-id'] && sdkAttributes['data-game-id'] !== gameId) {
    throw new Error(
      `${indexFile}: data-game-id "${sdkAttributes['data-game-id']}" does not match folder "${gameId}".`
    );
  }
  const cdnBase = overrides.cdnBase ?? sdkAttributes['data-base'];
  const cdnProbe = overrides.cdnProbe ?? sdkAttributes['data-probe'];
  if (Boolean(cdnBase) !== Boolean(cdnProbe)) {
    throw new Error(`${indexFile}: Nimo SDK data-base and data-probe must be set together.`);
  }

  const title = overrides.title ||
    sdkAttributes['data-game-title'] ||
    decodeHtmlEntities(titleMatch[1].replace(/<[^>]*>/g, '').trim())
      .replace(/\s*\|\s*Nimo Games\s*$/i, '')
      .trim();
  if (!title) throw new Error(`${indexFile} must provide a non-empty game title.`);

  const game = {
    id: gameId,
    title
  };

  if (cdnBase) {
    game.cdnBase = cdnBase;
    game.cdnProbe = cdnProbe;
  }
  const cdnProviders = overrides.cdnProviders ??
    (sdkAttributes['data-providers']?.split(',').map(provider => provider.trim()).filter(Boolean));
  if (cdnProviders) {
    game.cdnProviders = cdnProviders
      .map(provider => provider.trim())
      .filter(Boolean);
  }
  if (overrides.cdnProvidersExact ?? (sdkAttributes['data-providers-exact'] === 'true')) {
    game.cdnProvidersExact = true;
  }
  if (overrides.meta !== undefined) game.meta = overrides.meta;
  if (overrides.sandbox !== undefined) game.sandbox = overrides.sandbox;

  const artworkBase = `https://cdn-ngames.pages.dev/images/${gameId}`;
  return {
    ...game,
    hero: `${artworkBase}/hero.webp`,
    portrait: `${artworkBase}/portrait.webp`,
    logo: `${artworkBase}/logo.webp`,
    playUrl: `games/${gameId}/index.html`
  };
}

function generateCatalog() {
  const gameIds = fs.readdirSync(gamesDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(gameId => fs.existsSync(path.join(gamesDirectory, gameId, 'index.html')))
    .sort((first, second) => first.localeCompare(second, 'en', { numeric: true }));
  const games = [];

  for (const gameId of gameIds) {
    if (!/^\d+$/.test(gameId)) {
      throw new Error(`Game folder "${gameId}" must use a numeric ID.`);
    }

    const game = readGame(gameId);
    if (game) games.push(game);
  }

  if (games.length === 0) throw new Error('No games were found to add to the catalog.');

  const contents = `// Generated by scripts/generate-games.js. Do not edit by hand.\nwindow.NIMO_GAMES = ${JSON.stringify(games, null, 2)};\n`
    .replace(/\n/g, '\r\n');
  const previousContents = fs.existsSync(outputFile)
    ? fs.readFileSync(outputFile, 'utf8')
    : null;

  if (contents !== previousContents) fs.writeFileSync(outputFile, contents);
  console.log(`Generated game catalog with ${games.length} games.`);
}

try {
  generateCatalog();
} catch (error) {
  console.error(`[game-catalog] ${error.message}`);
  process.exitCode = 1;
}
