const lsDB = JSON.parse(localStorage.getItem('Nimo_store_v10') || '{}');
const NIMO_CONFIG = window.NIMO_CONFIG || {};
const GAME_BASE_URL = (NIMO_CONFIG.gameBaseUrl || '').replace(/\/+$/, '');
const NIMO_BASE_TITLE = document.title;
const NIMO_BASE_URL = location.pathname;

function getGamePath(gameId) {
  if (GAME_BASE_URL) {
    return `${GAME_BASE_URL}/games/${gameId}/index.html`;
  }
  return `./games/${gameId}/index.html`;
}

function normalizeGameSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getGameSlug(game) {
  if (!game) return '';
  if (typeof game === 'string') return normalizeGameSlug(game);
  return game.slug || normalizeGameSlug(game.n);
}

function getGameBySlug(slug) {
  if (!slug) return null;
  const normalized = normalizeGameSlug(slug);
  return G_DATA.find(g => normalizeGameSlug(g.n) === normalized || normalizeGameSlug(g.slug || '') === normalized) || null;
}

function resolveGameIdentifier(value) {
  if (!value) return null;
  if (typeof value === 'object' && value.id) {
    return value;
  }
  const byId = G_DATA.find(g => g.id === value);
  if (byId) return byId;
  return getGameBySlug(value);
}

function getGameIdFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('game');
}

function getGameUrl(gameOrSlug) {
  if (!gameOrSlug) return NIMO_BASE_URL;
  const slug = typeof gameOrSlug === 'object' ? getGameSlug(gameOrSlug) : getGameSlug(gameOrSlug);
  return `${location.pathname}?game=${encodeURIComponent(slug)}`;
}

function setPageTitle(game) {
  document.title = game ? `${game.n} | Play on Nimo Games` : NIMO_BASE_TITLE;
}

function updateGameHistory(gameId, opts = {}) {
  const game = resolveGameIdentifier(gameId);
  const url = getGameUrl(game);
  const state = { gameId: game ? game.id : null, gameSlug: game ? getGameSlug(game) : null };
  if (opts.replace) {
    history.replaceState(state, '', url);
  } else if (opts.push) {
    history.pushState(state, '', url);
  }
  setPageTitle(game);
}

function isSameOriginUrl(url) {
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return false;
  }
}

function sLS() {
  localStorage.setItem('Nimo_store_v10', JSON.stringify(lsDB));
}

function steamAssetUrl(id, file) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/${file}`;
}

function steamAssetUrlFallback(id, file) {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/${file}`;
}

function ensureGameAssets(game) {
  if (!game || !game.id) return;
  if (!game.img) game.img = steamAssetUrl(game.id, 'library_600x900.jpg');
  if (!game.bg) game.bg = steamAssetUrl(game.id, 'library_hero.jpg');
  if (!game.path) game.path = getGamePath(game.id);
}

function parsePortedInfo(game) {
  const raw = (game && game.dev) ? game.dev.trim() : '';
  const explicitPorted = game && game.ported;
  const explicitPortedBy = game && game.portedBy;

  if (explicitPortedBy) {
    return { baseDev: '', porter: explicitPortedBy.trim(), isPorted: true };
  }

  const match = raw.match(/^(.*?)\s*,\s*Ported by\s*(.+)$/i);
  if (match) {
    return { baseDev: match[1].trim(), porter: match[2].trim(), isPorted: true };
  }

  if (explicitPorted) {
    return { baseDev: '', porter: raw, isPorted: true };
  }

  return { baseDev: raw, porter: '', isPorted: false };
}

function buildDeveloperString(base, porter) {
  const cleanBase = (base || '').trim() || 'Unknown';
  const cleanPorter = (porter || '').trim();
  return cleanPorter ? `${cleanBase} | Ported by ${cleanPorter}` : cleanBase;
}

function getDeveloperLabel(game) {
  const info = parsePortedInfo(game);
  if (info.isPorted) {
    const base = game.devBase || info.baseDev || '';
    if (base) return buildDeveloperString(base, info.porter);
    if (info.porter) return `Ported by ${info.porter}`;
    return 'Ported';
  }
  return game.devBase || info.baseDev || 'Unknown';
}

function msToTm(s) {
  if (!s) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function tsToDt(t) {
  if (!t) return 'Never';
  const d = Date.now() - t;
  if (d < 86400000) return 'Today';
  if (d < 172800000) return 'Yesterday';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPlaytimeHover(secs) {
  if (!secs) return '00d:00h:00m';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${d.toString().padStart(2, '0')}d:${h.toString().padStart(2, '0')}h:${m.toString().padStart(2, '0')}m`;
}

window.addEventListener('load', () => {
  showLegalPopupIfNeeded();

  document.getElementById('app-wrap').style.opacity = '1';
  if (typeof G_DATA !== 'undefined') {
    dodeLayout();
    const deepLinkGameSlug = getGameIdFromUrl();
    if (deepLinkGameSlug) {
      const deepGame = getGameBySlug(deepLinkGameSlug);
      if (deepGame) {
        opMdl(deepGame.id, { pushHistory: false });
      } else {
        history.replaceState({ gameId: null, gameSlug: null }, '', NIMO_BASE_URL);
      }
    }
  }

  // Ensure top dock visibility on load (only for Nimo tab)
  const td = document.querySelector('.top-dock');
  if (td) {
    const nimoView = document.getElementById('v-Nimo');
    // set initial state after a tick to allow transitions
    setTimeout(() => {
      if (nimoView && nimoView.classList.contains('active')) {
        td.classList.remove('td-hidden');
        td.classList.add('td-visible');
        td.setAttribute('aria-hidden', 'false');
      } else {
        td.classList.remove('td-visible');
        td.classList.add('td-hidden');
        td.setAttribute('aria-hidden', 'true');
      }
    }, 20);
  }

  // Setup listeners to guard show/hide behavior
  try { setupTopDockListeners(); } catch (e) { console.warn('TopDock listeners setup failed', e); }

  // Attach settings button handler
  const settingsBtn = document.getElementById('top-settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => showPopup('p-settings'));
  const saveBtn = document.getElementById('settings-save');
  const removeBtn = document.getElementById('settings-remove');
  if (saveBtn) saveBtn.addEventListener('click', saveHiddenSiteSettings);
  if (removeBtn) removeBtn.addEventListener('click', removeHiddenSiteSettings);
  // populate modal with existing config
  populateSettingsModal();
  // favicon preview handler
  const faviconIn = document.getElementById('settings-favicon');
  if (faviconIn) faviconIn.addEventListener('input', () => {
    const p = document.getElementById('favicon-preview');
    if (!p) return;
    const v = (faviconIn.value || '').trim();
    if (v) { p.src = v; p.style.display = 'inline-block'; } else { p.src = ''; p.style.display = 'none'; }
  });

});

let heroArr = [];
let hIdx = 0;
let heroInterval;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyPicks() {
  if (typeof G_DATA === 'undefined' || !Array.isArray(G_DATA) || G_DATA.length === 0) {
    return [];
  }

  const key = `nimo_daily_picks_${getTodayKey()}`;
  const cached = localStorage.getItem(key);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        const resolved = parsed
          .map(id => G_DATA.find(g => g && g.id === id))
          .filter(Boolean);

        if (resolved.length > 0) {
          return resolved;
        }
      }
    } catch (e) {
      console.warn('[getDailyPicks] Failed to parse cached daily picks:', e);
    }
  }

  const pool = [...G_DATA].filter(Boolean);
  const picked = [];

  while (pool.length > 0 && picked.length < 4) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }

  localStorage.setItem(key, JSON.stringify(picked.map(g => g.id)));
  return picked;
}

function dodeLayout() {
  if (typeof G_DATA === 'undefined') return;

  G_DATA.forEach(ensureGameAssets);
  heroArr = [];
  const playedKeys = Object.keys(lsDB).filter(k => lsDB[k] && lsDB[k].t > 0).sort((a, b) => lsDB[b].l - lsDB[a].l);

  if (playedKeys.length > 0) {
    const lastPlayed = G_DATA.find(x => x.id === playedKeys[0]);
    if (lastPlayed) {
      heroArr.push({ ...lastPlayed, tag: 'RESUME', sub: msToTm(lsDB[lastPlayed.id].t) + ' Played' });
    }
  }

  const rnd = [...G_DATA].sort(() => 0.5 - Math.random()).slice(0, 3);
  rnd.forEach(r => {
    if (!heroArr.find(x => x.id === r.id)) {
      const tagsStr = (r.tags && Array.isArray(r.tags)) ? r.tags.join(' • ') : 'Game';
      heroArr.push({ ...r, tag: 'FEATURED', sub: tagsStr });
    }
  });

  rendertheBanner();
  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    hIdx = (hIdx + 1) % heroArr.length;
    rendertheBanner();
  }, 6000);

  const libHtml = G_DATA.map(g => makethecard(g, 'v')).join('');
  const recHtml = [...G_DATA].sort(() => 0.5 - Math.random()).slice(0, 10).map(g => makethecard(g, 'h')).join('');
  const dailyPicks = getDailyPicks();
  const dayHtml = dailyPicks.map(g => makethecard(g, 'h')).join('');
  const trndHtml = [...G_DATA].sort(() => 0.5 - Math.random()).slice(0, 4).map(g => makethecard(g, 'h')).join('');

  document.getElementById('g-recom-track').innerHTML = recHtml + recHtml;
  document.getElementById('g-day').innerHTML = dayHtml;
  document.getElementById('g-trnd').innerHTML = trndHtml;
  document.getElementById('g-lib').innerHTML = libHtml;

  rfrTrk();
}

function rendertheBanner() {
  if (!heroArr.length) return;
  const g = heroArr[hIdx];
  document.getElementById('hc-tag').innerText = g.tag;
  document.getElementById('hc-title').innerText = g.n;
  document.getElementById('hc-time').innerText = g.sub;
  document.getElementById('hc-dev').innerText = getDeveloperLabel(g);

  const imgEl = document.getElementById('hc-img');
  imgEl.style.opacity = 0;
  setTimeout(() => {
    imgEl.src = g.bg;
    imgEl.style.opacity = 0.8;
  }, 300);

  document.getElementById('hc-box').onclick = () => opMdl(g.id);
}

function makethecard(g, type) {
  ensureGameAssets(g);
  const playTimeStr = formatPlaytimeHover(lsDB[g.id] ? lsDB[g.id].t : 0);
  const timeHTML = `<div class="c-time-hover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>Time Played: ${playTimeStr}</div>`;
  const img = type === 'h' ? g.bg : g.img;
  const fallbackSrc = steamAssetUrlFallback(g.id, type === 'h' ? 'library_hero.jpg' : 'library_600x900.jpg');
  const devLabel = getDeveloperLabel(g);
  const tagsStr = (g.tags && Array.isArray(g.tags)) ? g.tags.join(' ') : '';
  const searchData = (g.n + ' ' + tagsStr + ' ' + devLabel).toLowerCase();
  return `<div class="c-${type}" onclick="opMdl('${g.id}')" data-search="${searchData}"><img src="${img}" onerror="console.error('[img error]', this.src, 'fallback->', '${fallbackSrc}'); this.onerror=null; this.src='${fallbackSrc}';"><div class="c-inf"><h3>${g.n}</h3><span>${devLabel}</span>${timeHTML}</div></div>`;
}

function filterLib() {
  const query = document.getElementById('lib-search').value.toLowerCase();
  document.querySelectorAll('#g-lib .c-v').forEach(c => {
    const text = c.getAttribute('data-search');
    c.style.display = text.includes(query) ? 'block' : 'none';
  });
}

function chgTab(v) {
  if (v === 'Nimo') {
    clsGm();
    clsMdl();
    showTopDock();
  } else {
    // If a game is currently open (iframe view or n-game overlay), close it before switching tabs
    try {
      const nGame = document.getElementById('n-game');
      const gameLayer = document.getElementById('game-layer');
      const isNGameVisible = nGame && (nGame.style.display === 'flex' || window.getComputedStyle(nGame).display === 'flex');
      const isGameLayerVisible = gameLayer && (gameLayer.style.display === 'block' || window.getComputedStyle(gameLayer).display === 'block');
      if (isNGameVisible || isGameLayerVisible || (gmWin && !gmWin.closed)) {
        try { clsGm(); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore DOM errors */ }
    hideTopDock();
  }
  document.querySelectorAll('.d-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(s => s.classList.remove('active'));
  document.getElementById('b-' + v).classList.add('active');
  document.getElementById('v-' + v).classList.add('active');
}

// Top dock controls: show/hide with animation
function showTopDock() {
  const td = document.querySelector('.top-dock');
  if (!td) return;
  td.classList.remove('td-hidden');
  td.classList.add('td-visible');
  // also set inline styles to override any CSS cascade issues
  td.style.pointerEvents = 'auto';
  td.style.opacity = '1';
  // keep horizontal centering (translateX) when applying vertical animation
  td.style.transform = 'translateX(-50%) translateY(0) scale(1)';
  td.setAttribute('aria-hidden', 'false');
}

function hideTopDock() {
  const td = document.querySelector('.top-dock');
  if (!td) return;
  td.classList.remove('td-visible');
  td.classList.add('td-hidden');
  // set inline styles for immediate effect and animation
  td.style.pointerEvents = 'none';
  td.style.opacity = '0';
  // keep horizontal centering (translateX) when applying vertical animation
  td.style.transform = 'translateX(-50%) translateY(-8px) scale(0.98)';
  td.setAttribute('aria-hidden', 'true');
}

// Attach explicit listeners to tab buttons and game cards to ensure dock toggles
function setupTopDockListeners() {
  const bLib = document.getElementById('b-lib');
  const bNimo = document.getElementById('b-Nimo');
  if (bLib) bLib.addEventListener('click', () => { try { hideTopDock(); } catch(e){} });
  if (bNimo) bNimo.addEventListener('click', () => { try { showTopDock(); } catch(e){} });

  // Delegate clicks on game cards to hide the dock (cards open modal via onclick too)
  document.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.c-h, .c-v');
    if (card) {
      try { hideTopDock(); } catch (e) {}
    }
  });
}

function showPopup(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  setTimeout(() => el.classList.add('show'), 10);
}

function hidePopup(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => { el.style.display = 'none'; }, 300);
}

function closePopupClick(e) {
  if (e.target.classList.contains('popup-wrap') && e.target.id !== 'p-legal-block') {
    hidePopup(e.target.id);
  }
}

function checkLegalScroll(el) {
  if (Math.ceil(el.scrollHeight - el.scrollTop) <= el.clientHeight + 10) {
    document.getElementById('btn-legal-accept').disabled = false;
  }
}

function acceptLegal() {
  localStorage.setItem('Nimo_legal_accepted', 'true');
  hidePopup('p-legal-block');
}

function showLegalPopupIfNeeded() {
  if (!localStorage.getItem('Nimo_legal_accepted')) {
    showPopup('p-legal-block');
  }
}

if (document.readyState !== 'loading') {
  showLegalPopupIfNeeded();
} else {
  document.addEventListener('DOMContentLoaded', showLegalPopupIfNeeded);
}

let cxG = null;
let modalLoadStatusTimer = null;

function showModalLoadStatus() {
  const status = document.getElementById('modal-load-status');
  if (!status) return;
  clearTimeout(modalLoadStatusTimer);
  status.style.display = 'flex';
  status.classList.remove('is-hidden', 'is-done');
  status.classList.add('is-visible');
  status.innerHTML = `
    <span class="modal-load-icon">
      <svg class="modal-load-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2"></circle>
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      </svg>
    </span>
    <span class="modal-load-copy">
      <strong>Loading game data</strong>
      <small>Fetching description, achievements, and requirements...</small>
    </span>
  `;
}

function completeModalLoadStatus() {
  const status = document.getElementById('modal-load-status');
  if (!status) return;
  status.classList.remove('is-hidden');
  status.classList.add('is-visible', 'is-done');
  status.innerHTML = `
    <span class="modal-load-icon">
      <svg class="modal-load-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M5 12.5L10 17.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </span>
    <span class="modal-load-copy">
      <strong>Loaded</strong>
      <small>Description, achievements, and requirements are ready.</small>
    </span>
  `;
  clearTimeout(modalLoadStatusTimer);
  modalLoadStatusTimer = setTimeout(() => {
    hideModalLoadStatus();
  }, 1600);
}

function hideModalLoadStatus() {
  const status = document.getElementById('modal-load-status');
  if (!status) return;
  status.classList.remove('is-visible');
  status.classList.add('is-hidden');
  clearTimeout(modalLoadStatusTimer);
  modalLoadStatusTimer = setTimeout(() => {
    status.style.display = 'none';
    status.classList.remove('is-hidden', 'is-done');
  }, 320);
}

function opMdl(idOrSlug, opts = {}) {
  // hide top dock when opening a game modal (per UX request)
  try { hideTopDock(); } catch (e) { /* ignore */ }
  const resolvedGame = resolveGameIdentifier(idOrSlug);
  if (!resolvedGame) {
    console.warn('[opMdl] Game not found:', idOrSlug);
    return;
  }
  cxG = resolvedGame;
  const d = lsDB[cxG.id] || { t: 0, l: null };

  ensureGameAssets(cxG);
  const mdlBg = document.getElementById('mdl-bg');
  const bgAmb = document.getElementById('bg-amb');
  const mdlPost = document.getElementById('mdl-post');
  mdlBg.onerror = () => { console.error('[mdl-bg onerror]', cxG.id, mdlBg.src); mdlBg.onerror = null; mdlBg.src = steamAssetUrlFallback(cxG.id, 'library_hero.jpg'); };
  bgAmb.onerror = () => { console.error('[bg-amb onerror]', cxG.id, bgAmb.src); bgAmb.onerror = null; bgAmb.src = steamAssetUrlFallback(cxG.id, 'library_hero.jpg'); };
  mdlPost.onerror = () => { console.error('[mdl-post onerror]', cxG.id, mdlPost.src); mdlPost.onerror = null; mdlPost.src = steamAssetUrlFallback(cxG.id, 'library_600x900.jpg'); };
  mdlBg.src = cxG.bg;
  bgAmb.src = cxG.bg;
  mdlPost.src = cxG.img;
  document.getElementById('mdl-t').innerText = cxG.n;
  const info = parsePortedInfo(cxG);
  if (!info.isPorted && info.baseDev) {
    cxG.devBase = info.baseDev;
  }
  document.getElementById('mdl-d').innerText = getDeveloperLabel(cxG);
  const descText = decodeHtmlEntities(cxG.desc || (cxG.tags && Array.isArray(cxG.tags) ? cxG.tags.join(' • ') : ''));
  document.getElementById('mdl-dc').innerText = descText;
  document.getElementById('mdl-tm').innerText = msToTm(d.t);
  document.getElementById('mdl-lp').innerText = tsToDt(d.l);
  document.getElementById('mdl-ac').innerText = cxG.achievementCount ?? 'N/A';
  document.getElementById('mdl-tg').innerHTML = (cxG.tags && Array.isArray(cxG.tags)) ? cxG.tags.map(t => `<div class="m-tg">${t}</div>`).join('') : '';
  setSteamRequirementFields('m', cxG.steamReq ? cxG.steamReq.minimum : emptySteamRequirements());
  setSteamRequirementFields('r', cxG.steamReq ? cxG.steamReq.recommended : emptySteamRequirements());

  const buyBtn = document.getElementById('mdl-buy');
  const storeUrl = getSteamStoreUrl(cxG);
  if (storeUrl) {
    buyBtn.style.display = 'flex';
    buyBtn.onclick = () => window.open(storeUrl, '_blank');
  } else {
    buyBtn.style.display = 'none';
    buyBtn.onclick = null;
  }

  if (opts.replaceHistory === true) {
    updateGameHistory(cxG, { replace: true });
  } else if (opts.pushHistory !== false) {
    updateGameHistory(cxG, { push: true });
  } else {
    setPageTitle(cxG);
  }

  showModalLoadStatus();

  // Fetch Steam data and update asynchronously
  (async () => {
    try {
      await loadSteamDetails(cxG);
      document.getElementById('mdl-d').innerText = getDeveloperLabel(cxG);
      document.getElementById('hc-dev').innerText = getDeveloperLabel(cxG);
      const descText = decodeHtmlEntities(cxG.desc || (cxG.tags && Array.isArray(cxG.tags) ? cxG.tags.join(' • ') : ''));
      document.getElementById('mdl-dc').innerText = descText;
      if (cxG.tags && cxG.tags.length > 0) {
        document.getElementById('mdl-tg').innerHTML = cxG.tags.map(t => `<div class="m-tg">${t}</div>`).join('');
      }
      setSteamRequirementFields('m', cxG.steamReq ? cxG.steamReq.minimum : emptySteamRequirements());
      setSteamRequirementFields('r', cxG.steamReq ? cxG.steamReq.recommended : emptySteamRequirements());
    } finally {
      completeModalLoadStatus();
    }
  })();

  const m = document.getElementById('modal-ui');
  m.style.display = 'block';
  setTimeout(() => { m.style.opacity = '1'; }, 10);
}

function clsMdl(restoreTopDock = true, updateHistory = true) {
  hideModalLoadStatus();
  const m = document.getElementById('modal-ui');
  m.style.opacity = '0';
  setTimeout(() => { m.style.display = 'none'; }, 500);
  if (updateHistory) {
    updateGameHistory(null, { replace: true });
  }
  // restore top dock if still on Nimo view (only if explicitly requested)
  if (restoreTopDock) {
    setTimeout(() => {
      const nimoView = document.getElementById('v-Nimo');
      if (nimoView && nimoView.classList.contains('active')) showTopDock();
    }, 520);
  }
}

function getSteamStoreUrl(game) {
  if (!game) return null;
  if (game.buyUrl) return game.buyUrl;
  if (game.id) return `https://store.steampowered.com/app/${game.id}/`;
  return null;
}

async function fetchSteamStorePage(appId) {
  const storeUrl = `https://store.steampowered.com/app/${appId}/`;
  // client-side cache: store fetched page HTML for 24h to avoid repeated proxy usage
  try {
    const cacheKey = `steam_page_cache_${appId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached && cached.ts && (Date.now() - cached.ts) < 1000 * 60 * 60 * 24) {
      return cached.html;
    }
  } catch (e) {
    // ignore cache errors
  }

  // Reduced proxy list: prefer AllOrigins then Codetabs. Removed known-bad services.
  const proxyList = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(storeUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(storeUrl)}`
  ];

  for (const url of proxyList) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!resp.ok) continue;
      const html = await resp.text();
      if (html && html.length > 0) {
        try { localStorage.setItem(`steam_page_cache_${appId}`, JSON.stringify({ ts: Date.now(), html })); } catch (e) {}
        return html;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

function decodeHtmlEntities(value) {
  if (!value || typeof value !== 'string') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function emptySteamRequirements() {
  return { os: 'N/A', cpu: 'N/A', ram: 'N/A', gpu: 'N/A' };
}

function parseSteamRequirements(raw) {
  if (!raw) return null;
  let html = raw;
  if (typeof raw === 'object') {
    html = raw.value || raw.minimum || raw.recommended || '';
  }
  html = decodeHtmlEntities(String(html));
  html = html.replace(/<br\s*\/?/gi, '\n');
  html = html.replace(/<\/li>/gi, '\n');
  const text = html.replace(/<[^>]+>/g, '').replace(/\r\n?/g, '\n').trim();
  const rawLines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (/^[^:]+:$/.test(line) && i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      if (!/^[^:]+:$/.test(nextLine)) {
        lines.push(`${line} ${nextLine}`);
        i += 1;
        continue;
      }
    }
    lines.push(line);
  }

  const req = emptySteamRequirements();
  lines.forEach(line => {
    const parts = line.split(':');
    if (parts.length < 2) return;
    const key = parts[0].trim().toLowerCase();
    const value = parts.slice(1).join(':').trim();
    if (!value) return;
    if (key.includes('os')) req.os = value;
    else if (key.includes('processor') || key.includes('cpu')) req.cpu = value;
    else if (key.includes('memory') || key.includes('ram')) req.ram = value;
    else if (key.includes('graphics') || key.includes('gpu') || key.includes('video')) req.gpu = value;
  });
  return req;
}

function isSteamRequirementsEmpty(req) {
  if (!req || typeof req !== 'object') return true;
  return (!req.os || req.os === 'N/A')
    && (!req.cpu || req.cpu === 'N/A')
    && (!req.ram || req.ram === 'N/A')
    && (!req.gpu || req.gpu === 'N/A');
}

function parseSteamRequirementsFromStorePage(html) {
  if (!html || typeof html !== 'string') return null;

  const extractSection = (label) => {
    const patterns = [
      `<strong[^>]*>\\s*${label}\\s*:?\\s*<\\/strong>\\s*:?(?:<br\\s*\\/?>(?:\\s*)?)?(<ul[\\s\\S]*?<\\/ul>)`,
      `${label}\\s*:?\\s*(?:<br\\s*\\/?>(?:\\s*)?)?(<ul[\\s\\S]*?<\\/ul>)`
    ];
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      const match = html.match(regex);
      if (match) return match[1];
    }
    return null;
  };

  const minimumHtml = extractSection('Minimum');
  const recommendedHtml = extractSection('Recommended');

  return {
    minimum: parseSteamRequirements(minimumHtml ? `<strong>Minimum:</strong>${minimumHtml}</ul>` : null),
    recommended: parseSteamRequirements(recommendedHtml ? `<strong>Recommended:</strong>${recommendedHtml}</ul>` : null)
  };
}

function setSteamRequirementFields(prefix, req) {
  const data = req || emptySteamRequirements();
  document.getElementById(`q${prefix}-os`).innerText = data.os || 'N/A';
  document.getElementById(`q${prefix}-cpu`).innerText = data.cpu || 'N/A';
  document.getElementById(`q${prefix}-ram`).innerText = data.ram || 'N/A';
  document.getElementById(`q${prefix}-gpu`).innerText = data.gpu || 'N/A';
}

function parseSteamPageDescription(html) {
  if (!html) return null;
  const descMatch = html.match(/<div[^>]*class=["']game_description_snippet["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!descMatch) return null;
  const raw = descMatch[1]
    .replace(/<br\s*\/?/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  return decodeHtmlEntities(raw) || null;
}

function applyAchievementCount(game, count) {
  if (!game) return;
  const parsedCount = Number(count);
  if (!Number.isFinite(parsedCount)) {
    game.achievementCount = null;
    const acEl = document.getElementById('mdl-ac');
    if (acEl) acEl.innerText = 'N/A';
    return;
  }

  game.achievementCount = parsedCount;
  const acEl = document.getElementById('mdl-ac');
  if (acEl) acEl.innerText = String(parsedCount);
}

async function fetchSteamAppDetails(appId) {
  const steamApiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
  // client-side cache for API responses (24h)
  try {
    const cacheKey = `steam_api_cache_${appId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached && cached.ts && (Date.now() - cached.ts) < 1000 * 60 * 60 * 24) {
      return cached.data;
    }
  } catch (e) { }

  // Prefer AllOrigins first, then Codetabs. Removed unstable proxies.
  const apiUrls = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(steamApiUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(steamApiUrl)}`
  ];

  for (const proxyUrl of apiUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!resp.ok) continue;

      let json = await resp.json();
      if (json.contents) json = JSON.parse(json.contents);
      if (!json || !json[appId] || !json[appId].success) continue;
      try { localStorage.setItem(`steam_api_cache_${appId}`, JSON.stringify({ ts: Date.now(), data: json[appId].data })); } catch (e) {}
      return json[appId].data;
    } catch (e) {
      continue;
    }
  }
  return null;
}

function updateSteamModalFields(game) {
  document.getElementById('mdl-d').innerText = getDeveloperLabel(game);
  document.getElementById('hc-dev').innerText = getDeveloperLabel(game);
  const descText = decodeHtmlEntities(game.desc || (game.tags && Array.isArray(game.tags) ? game.tags.join(' • ') : ''));
  document.getElementById('mdl-dc').innerText = descText;
  if (game.tags && game.tags.length > 0) {
    document.getElementById('mdl-tg').innerHTML = game.tags.map(t => `<div class="m-tg">${t}</div>`).join('');
  }
  setSteamRequirementFields('m', game.steamReq ? game.steamReq.minimum : emptySteamRequirements());
  setSteamRequirementFields('r', game.steamReq ? game.steamReq.recommended : emptySteamRequirements());
}

async function loadSteamDetails(game) {
  if (!game || !game.id) return null;
  if (game._steamLoading) return game._steamPromise || null;
  ensureGameAssets(game);

  const appId = game.id.toString();
  game._steamLoading = true;
  
  game._steamPromise = (async () => {
    let pageReqs = null;
    const pagePromise = fetchSteamStorePage(appId)
      .then(pageHtml => {
        if (!pageHtml) return null;
        const pageDesc = parseSteamPageDescription(pageHtml);
        if (pageDesc) {
          game.desc = pageDesc;
        }
        pageReqs = parseSteamRequirementsFromStorePage(pageHtml);
        if (!game.steamReq) {
          game.steamReq = {
            minimum: (pageReqs && pageReqs.minimum) || emptySteamRequirements(),
            recommended: (pageReqs && pageReqs.recommended) || emptySteamRequirements()
          };
        } else {
          game.steamReq = {
            minimum: !isSteamRequirementsEmpty(game.steamReq.minimum) ? game.steamReq.minimum : (pageReqs && pageReqs.minimum) || emptySteamRequirements(),
            recommended: !isSteamRequirementsEmpty(game.steamReq.recommended) ? game.steamReq.recommended : (pageReqs && pageReqs.recommended) || emptySteamRequirements()
          };
        }
        updateSteamModalFields(game);
        return pageHtml;
      })
      .catch(e => {
        return null;
      });

    const apiPromise = fetchSteamAppDetails(appId)
      .then(data => {
        if (!data) return null;
        const dev = Array.isArray(data.developers)
          ? data.developers.join(', ')
          : (data.developer || null);
        const shortDesc = data.short_description || null;
        const name = data.name || null;

        if (dev) {
          game.devBase = dev;
        }
        if (!game.desc || game.desc.length < 30) {
          if (shortDesc) game.desc = shortDesc;
        }
        if (name && !game.n) game.n = name;
        if (data.achievements?.total != null) {
          applyAchievementCount(game, data.achievements.total);
        }
        const apiReqs = {
          minimum: parseSteamRequirements(data.pc_requirements?.minimum || data.pc_requirements?.minimum?.value || null),
          recommended: parseSteamRequirements(data.pc_requirements?.recommended || data.pc_requirements?.recommended?.value || null)
        };
        game.steamReq = {
          minimum: apiReqs.minimum && !isSteamRequirementsEmpty(apiReqs.minimum) ? apiReqs.minimum : (pageReqs && pageReqs.minimum) || emptySteamRequirements(),
          recommended: apiReqs.recommended && !isSteamRequirementsEmpty(apiReqs.recommended) ? apiReqs.recommended : (pageReqs && pageReqs.recommended) || emptySteamRequirements()
        };
        updateSteamModalFields(game);
        return data;
      })
      .catch(e => {
        return null;
      });

    const [pageHtml, data] = await Promise.all([pagePromise, apiPromise]);
    if (data) {
      return { devBase: game.devBase, desc: game.desc, name: game.n, tags: game.tags };
    }

    if (!game.steamReq) {
      game.steamReq = {
        minimum: (pageReqs && pageReqs.minimum) || emptySteamRequirements(),
        recommended: (pageReqs && pageReqs.recommended) || emptySteamRequirements()
      };
    }

    if (!game.desc && game.tags && game.tags.length > 0) {
      game.desc = game.tags.join(' • ');
    }

    updateSteamModalFields(game);
    console.warn(`✗ All Steam details attempts failed for app ${appId}. Using page fallback:`, pageReqs);
    return { devBase: game.devBase, desc: game.desc, name: game.n, tags: game.tags };
  })();

  return await game._steamPromise;
}

function goToStore() {
  const url = getSteamStoreUrl(cxG);
  if (!url) return;
  window.open(url, '_blank');
}

function getHiddenTitle() {
  const locale = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  return locale.startsWith('es') ? 'Inicio - Classroom' : 'Home - Classroom';
}

function getGameIframeWindow() {
  const iframe = document.getElementById('gF');
  if (!iframe || !iframe.contentWindow) return null;
  try {
    iframe.contentWindow.location.href;
    return iframe.contentWindow;
  } catch {
    return null;
  }
}

function collectGameAudioContexts(win) {
  const contexts = new Set();
  if (!win || typeof win !== 'object') return contexts;

  const seen = new WeakSet();

  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (typeof value.suspend === 'function' && typeof value.resume === 'function' && typeof value.state === 'string') {
      contexts.add(value);
    }

    try {
      Object.keys(value).forEach((key) => visit(value[key]));
    } catch {
      // Ignore traversal errors for non-enumerable or restricted objects.
    }
  };

  visit(win);
  return contexts;
}

function getPhaserSoundManagers(win) {
  const managers = new Set();
  if (!win || typeof win !== 'object') return managers;

  const addSound = (sound) => {
    if (sound && typeof sound === 'object') managers.add(sound);
  };

  try {
    const pool = win.Phaser?.Display?.Canvas?.CanvasPool?.pool;
    if (pool && typeof pool === 'object') {
      Object.values(pool).forEach((canvas) => {
        const game = canvas?.parent?.game;
        addSound(game?.sound);
      });
    }
  } catch {
    // Ignore Phaser traversal errors.
  }

  addSound(win.game?.sound);
  addSound(win.Phaser?.Game?.prototype?.sound);
  return managers;
}

function pauseGameAudio() {
  const win = getGameIframeWindow();
  if (!win) return;

  const state = {
    media: [],
    contexts: [],
    soundManagers: []
  };

  try {
    const doc = win.document;
    if (doc) {
      doc.querySelectorAll('audio, video').forEach((media) => {
        if (!media.paused) {
          state.media.push(media);
          media.pause();
        }
      });
    }
  } catch {
    // Ignore cross-origin iframe access errors.
  }

  getPhaserSoundManagers(win).forEach((sound) => {
    try {
      const masterMuteNode = sound.masterMuteNode;
      const originalMute = sound.mute;
      const originalGain = masterMuteNode && masterMuteNode.gain ? masterMuteNode.gain.value : null;
      state.soundManagers.push({ sound, originalMute, originalGain });
      sound.mute = true;
      if (masterMuteNode && masterMuteNode.gain) {
        masterMuteNode.gain.value = 0;
      }
    } catch {
      // Ignore Phaser sound mute failures.
    }
  });

  collectGameAudioContexts(win).forEach((context) => {
    if (context.state !== 'suspended') {
      state.contexts.push(context);
      try {
        context.suspend();
      } catch {
        // Ignore suspend failures.
      }
    }
  });

  if (!state.media.length && !state.contexts.length && !state.soundManagers.length) return;

  pauseGameAudio.state = state;
}

async function resumeGameAudio() {
  const state = pauseGameAudio.state;
  if (!state) return;

  const resumePromises = [];

  state.media.forEach((media) => {
    try {
      resumePromises.push(Promise.resolve(media.play()).catch(() => {}));
    } catch {
      // Ignore play failures.
    }
  });

  state.soundManagers.forEach(({ sound, originalMute, originalGain }) => {
    try {
      sound.mute = originalMute;
      if (sound.masterMuteNode && sound.masterMuteNode.gain) {
        sound.masterMuteNode.gain.value = originalGain ?? 1;
      }
    } catch {
      // Ignore Phaser sound restore failures.
    }
  });

  state.contexts.forEach((context) => {
    if (context && typeof context.resume === 'function') {
      resumePromises.push(Promise.resolve(context.resume()).catch(() => {}));
    }
  });

  if (!resumePromises.length) {
    pauseGameAudio.state = null;
    return;
  }

  await Promise.allSettled(resumePromises);
  pauseGameAudio.state = null;
}

function handleGameAudioVisibility() {
  if (document.hidden || !document.hasFocus()) {
    pauseGameAudio();
  } else {
    resumeGameAudio();
  }
}

function startGameAudioVisibilityMonitor() {
  handleGameAudioVisibility();
  if (startGameAudioVisibilityMonitor.interval) return;
  startGameAudioVisibilityMonitor.interval = setInterval(() => {
    handleGameAudioVisibility();
  }, 1000);
}

function updatePageBadge() {
  const iconLinks = Array.from(document.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon']"));
  const cfg = getHiddenSiteConfig();
  const hiddenTitle = cfg?.title || 'Inicio - Classroom';
  const hiddenIcon = cfg?.favicon || 'https://ssl.gstatic.com/classroom/favicon.png';
  const currentTitle = document.title;
  const defaultTitle = updatePageBadge.defaultTitle || currentTitle;
  const defaultHrefs = updatePageBadge.defaultHrefs || iconLinks.map((link) => link.href);
  if (!updatePageBadge.defaultTitle) updatePageBadge.defaultTitle = defaultTitle;
  if (!updatePageBadge.defaultHrefs) updatePageBadge.defaultHrefs = defaultHrefs;

  if (document.hidden || !document.hasFocus()) {
    if (currentTitle !== hiddenTitle) {
      updatePageBadge.lastVisibleTitle = currentTitle;
    }
    document.title = hiddenTitle;
    iconLinks.forEach((link) => {
      link.href = hiddenIcon;
    });
  } else {
    if (currentTitle !== hiddenTitle) {
      updatePageBadge.lastVisibleTitle = currentTitle;
    }
    document.title = updatePageBadge.lastVisibleTitle || updatePageBadge.defaultTitle;
    iconLinks.forEach((link, index) => {
      const originalHref = updatePageBadge.defaultHrefs[index];
      if (originalHref) link.href = originalHref;
    });
  }
}

// --- Hidden site settings helpers ---
function getHiddenSiteConfig() {
  try {
    const raw = localStorage.getItem('Nimo_hidden_site');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setHiddenSiteConfig(cfg) {
  try { localStorage.setItem('Nimo_hidden_site', JSON.stringify(cfg)); } catch (e) { console.warn('Failed to save hidden site config', e); }
}

function removeHiddenSiteSettings() {
  localStorage.removeItem('Nimo_hidden_site');
  populateSettingsModal();
  document.getElementById('settings-msg').innerText = 'Configuration removed.';
}

function populateSettingsModal() {
  const cfg = getHiddenSiteConfig();
  const titleIn = document.getElementById('settings-title');
  const favIn = document.getElementById('settings-favicon');
  const favPrev = document.getElementById('favicon-preview');
  if (!titleIn) return;
  if (cfg) {
    titleIn.value = cfg.title || '';
    if (favIn) favIn.value = cfg.favicon || '';
    if (favPrev) {
      if (cfg.favicon) { favPrev.src = cfg.favicon; favPrev.style.display = 'inline-block'; } else { favPrev.src = ''; favPrev.style.display = 'none'; }
    }
  } else {
    titleIn.value = 'Inicio - Classroom';
    if (favIn) favIn.value = 'https://ssl.gstatic.com/classroom/favicon.png';
    if (favPrev) { favPrev.src = 'https://ssl.gstatic.com/classroom/favicon.png'; favPrev.style.display = 'inline-block'; }
  }
}

async function saveHiddenSiteSettings() {
  const titleIn = document.getElementById('settings-title');
  const msg = document.getElementById('settings-msg');
  if (!titleIn) return;
  const manualTitle = (titleIn && titleIn.value) ? titleIn.value.trim() : '';
  const manualFavicon = (document.getElementById('settings-favicon') && document.getElementById('settings-favicon').value) ? document.getElementById('settings-favicon').value.trim() : '';
  if (!manualTitle && !manualFavicon) {
    if (msg) msg.innerText = 'Enter a manual title or favicon URL to save.';
    return;
  }

  const cfg = { title: manualTitle, favicon: manualFavicon };
  setHiddenSiteConfig(cfg);
  populateSettingsModal();
  if (msg) msg.innerText = 'Saved. Will be used when the tab is hidden.';
}

window.addEventListener('visibilitychange', () => {
  updatePageBadge();
  handleGameAudioVisibility();
});
window.addEventListener('focus', () => {
  updatePageBadge();
  handleGameAudioVisibility();
});
window.addEventListener('blur', () => {
  updatePageBadge();
  handleGameAudioVisibility();
});
window.addEventListener('pagehide', handleGameAudioVisibility);
window.addEventListener('pageshow', handleGameAudioVisibility);
window.addEventListener('popstate', (event) => {
  const stateGameSlug = event.state && event.state.gameSlug ? event.state.gameSlug : getGameIdFromUrl();
  if (stateGameSlug) {
    const game = getGameBySlug(stateGameSlug);
    if (game) {
      opMdl(game.id, { pushHistory: false });
      return;
    }
  }
  clsMdl(false, false);
});

startGameAudioVisibilityMonitor();

let gmWin = null;
let gmId = null;
let gInt = null;
let gSs = 0;

function try2launch() {
  if (!cxG) {
    console.warn('[try2launch] No game selected; skipping launch.');
    return;
  }
  if (gmWin && !gmWin.closed) {
    clsGm();
  }
  rnLdInt();
}

function tglV(v) {
  if (v === 'h') {
    document.getElementById('app-wrap').style.display = 'block';
    document.querySelector('.dock-wrap').style.display = 'flex';
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('bg-amb').style.display = 'block';
  } else {
    document.getElementById('app-wrap').style.display = 'none';
    document.querySelector('.dock-wrap').style.display = 'none';
    document.getElementById('game-layer').style.display = 'block';
    document.getElementById('bg-amb').style.display = 'none';
  }
}

function clsGm(e) {
  if (e) e.stopPropagation();
  document.getElementById('n-game').style.display = 'none';
  document.getElementById('gF').src = '';
  if (gmWin) gmWin.closed = true;
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  if (document.exitPointerLock) document.exitPointerLock();
  if (navigator.keyboard) navigator.keyboard.unlock();
  showTopDock();
  tglV('h');
}

function mnLk() {
  if (!document.fullscreenElement) {
    document.body.requestFullscreen().then(() => {
      if (navigator.keyboard) navigator.keyboard.lock(['Escape']);
    }).catch(() => {});
  }
  document.body.requestPointerLock();
}

let aZc = 3;
let aZi = null;
let aZd = false;
let aCc = 3;
let aCi = null;
let aCd = false;

window.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'z') {
    if (!aZd && document.getElementById('game-layer').style.display === 'block') {
      const d = document.getElementById('tD');
      aZd = true;
      aZc = 3;
      d.innerText = aZc;
      d.style.top = '20px';
      aZi = setInterval(() => {
        aZc -= 1;
        if (aZc > 0) d.innerText = aZc;
        else {
          clearInterval(aZi);
          d.style.top = '-100px';
          if (!document.fullscreenElement) {
            document.body.requestFullscreen().then(() => {
              if (navigator.keyboard) navigator.keyboard.lock(['Escape']);
            }).catch(() => {});
          }
          document.body.requestPointerLock();
        }
      }, 1000);
    }
  }
  if (e.altKey && e.key.toLowerCase() === 'c') {
    if (!aCd && document.getElementById('game-layer').style.display === 'block') {
      const d = document.getElementById('eD');
      aCd = true;
      aCc = 3;
      d.innerText = aCc;
      d.style.top = '20px';
      aCi = setInterval(() => {
        aCc -= 1;
        if (aCc > 0) d.innerText = aCc;
        else {
          clearInterval(aCi);
          d.style.top = '-100px';
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
          if (document.exitPointerLock) document.exitPointerLock();
          if (navigator.keyboard) navigator.keyboard.unlock();
        }
      }, 1000);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 'z' || e.key === 'Alt') {
    aZd = false;
    clearInterval(aZi);
    const td = document.getElementById('tD');
    if (td) td.style.top = '-100px';
  }
  if (e.key.toLowerCase() === 'c' || e.key === 'Alt') {
    aCd = false;
    clearInterval(aCi);
    const ed = document.getElementById('eD');
    if (ed) ed.style.top = '-100px';
  }
});

function rnLdInt() {
  hidePopup('p-launch-choice');
  rnLd();
}

function rnLdExt() {
  hidePopup('p-launch-choice');
  clsMdl(false);
  const gameId = cxG.id;
  const tU = cxG.path || getGamePath(gameId);
  gmWin = window.open(tU, '_blank');
  trStart(cxG.id);
}

function rnLd() {
  clsMdl(false);
  const gameId = cxG.id;
  const tU = cxG.path || getGamePath(gameId);
  const shouldUseCoiSw = !GAME_BASE_URL || isSameOriginUrl(GAME_BASE_URL);
  const f = document.getElementById('gF');
  const s = document.getElementById('bS');
  const bt = document.getElementById('bS-t');
  const lo = document.getElementById('lO');

  if (bt) bt.innerText = 'Loading ' + cxG.n + '...';
  if (s) {
    s.style.display = 'flex';
    s.style.opacity = '1';
  }
  if (lo) lo.style.display = 'none';
  document.getElementById('n-game-title').innerText = cxG.n;
  document.getElementById('n-game').style.display = 'flex';
  hideTopDock();
  tglV('g');
  gmWin = { closed: false, close() { clsGm(); } };

  // Attach load/error listeners before setting src.
  if (f) {
    f.onload = () => {
      if (s) {
        s.style.opacity = '0';
        setTimeout(() => { s.style.display = 'none'; }, 300);
      }
      f.onload = null;
    };
    f.onerror = () => {
      console.warn('[rnLd] iframe load error for', tU);
      if (s) {
        s.style.opacity = '0';
        setTimeout(() => { s.style.display = 'none'; }, 300);
      }
    };
  }

  // Try to register the game's COI service worker using an absolute URL
  (async function registerAndLoadIframe() {
    const swUrl = `${location.origin}/games/${gameId}/coi-serviceworker.min.js`;
    let swControlled = false;

    if (shouldUseCoiSw && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      try {
        const reg = await navigator.serviceWorker.register(swUrl, { scope: `/games/${gameId}/` });

        swControlled = await new Promise(res => {
          if (navigator.serviceWorker.controller) return res(true);
          const onChange = () => { navigator.serviceWorker.removeEventListener('controllerchange', onChange); res(true); };
          navigator.serviceWorker.addEventListener('controllerchange', onChange);
          setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', onChange); res(false); }, 1500);
        });
      } catch (err) {
        console.warn('[rnLd] Failed to register game COI service worker:', err);
      }
    } else if (!shouldUseCoiSw) {
      // External CDN used, skip local COI service worker registration.
    } else {
      // ServiceWorker unavailable or insecure context, skip registration.
    }

    if (f) {
      f.src = tU;
    }

    setTimeout(() => {
      if (s && s.style.display !== 'none') {
        s.style.opacity = '0';
        setTimeout(() => { s.style.display = 'none'; }, 300);
      }
    }, 4000);
  })();

  trStart(cxG.id);
}

function trStart(id) {
  if (gInt) clearInterval(gInt);
  gmId = id;

  if (!lsDB[id]) lsDB[id] = { t: 0, l: Date.now() };
  lsDB[id].l = Date.now();
  sLS();

  gSs = lsDB[id].t;
  rfrTrk();

  gInt = setInterval(() => {
    if (gmWin && !gmWin.closed) {
      gSs += 1;
      if (gSs % 5 === 0) {
        lsDB[id].t = gSs;
        lsDB[id].l = Date.now();
        sLS();
      }
    } else {
      clearInterval(gInt);
      lsDB[id].t = gSs;
      lsDB[id].l = Date.now();
      sLS();
      gmWin = null;
      gmId = null;
      gInt = null;
      rfrTrk();
      dodeLayout();
    }
  }, 1000);
}

function rfrTrk() {
  const widg = document.getElementById('tk');
  if (gmWin && gmId) {
    const g = G_DATA.find(x => x.id === gmId);
    if (g) {
      document.getElementById('tk-img').src = g.img;
      document.getElementById('tk-lbl').innerText = 'Playing Now';
      document.getElementById('tk-lbl').style.color = '#fff';
      document.getElementById('tk-nm').innerText = g.n;
      const btn = document.getElementById('tk-btn');
      btn.className = 'tw-btn quit';
      btn.innerText = 'Quit Game';
      widg.style.display = 'flex';
      return;
    }
  }

  const playedKeys = Object.keys(lsDB).filter(k => lsDB[k].t > 0);
  if (playedKeys.length > 0) {
    const bId = playedKeys.sort((a, b) => lsDB[b].l - lsDB[a].l)[0];
    const g = G_DATA.find(x => x.id === bId);
    if (g) {
      document.getElementById('tk-img').src = g.img;
      document.getElementById('tk-lbl').innerText = 'Last Played';
      document.getElementById('tk-lbl').style.color = '#a1a1a6';
      document.getElementById('tk-nm').innerText = g.n;
      const btn = document.getElementById('tk-btn');
      btn.className = 'tw-btn';
      btn.innerText = 'Launch';
      widg.style.display = 'flex';
      return;
    }
  }

  widg.style.display = 'none';
}

function tkAction() {
  if (gmWin && !gmWin.closed) {
    gmWin.close();
    return;
  }
  const playedKeys = Object.keys(lsDB).filter(k => lsDB[k].t > 0);
  if (playedKeys.length > 0) {
    const bId = playedKeys.sort((a, b) => lsDB[b].l - lsDB[a].l)[0];
    cxG = G_DATA.find(x => x.id === bId);
    try2launch();
  }
}
