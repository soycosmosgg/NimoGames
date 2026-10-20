(() => {
  const games = window.NIMO_GAMES;
  const visitorCountDisplay = document.getElementById('visitor-count');
  const ambientLayer = document.getElementById('ambient-layer');
  const recentRow = document.getElementById('recent-row');
  const clockDisplay = document.getElementById('clock-display');
  const gamePlayer = document.getElementById('game-player');
  const gameFrame = document.getElementById('game-frame');
  const gameAdminMessage = document.getElementById('game-admin-message');
  const gameAdminAvatar = document.getElementById('game-admin-avatar');
  const gameAdminMessageText = document.getElementById('game-admin-message-text');
  const siteAvatarImage = document.getElementById('site-avatar-image');
  const closeGameButton = document.getElementById('game-player-close');
  const gameVersionPicker = document.getElementById('game-version-picker');
  const gameVersionCancelButton = document.getElementById('game-version-cancel');
  const gameVersionButtons = document.querySelectorAll('[data-game-version]');
  const openLibraryButton = document.getElementById('open-library-button');
  const connectionStatusButton = document.getElementById('connection-status-button');
  const libraryView = document.getElementById('library-view');
  const librarySearchInput = document.getElementById('library-search-input');
  const clearLibrarySearchButton = document.getElementById('clear-library-search');
  const closeLibraryButton = document.getElementById('close-library-button');
  const libraryGameGrid = document.getElementById('library-game-grid');
  const libraryEmptyState = document.getElementById('library-empty-state');
  const libraryResultCount = document.getElementById('library-result-count');
  const librarySectionTitle = document.getElementById('library-section-title');
  const allGamesCount = document.getElementById('all-games-count');
  const recentGamesCount = document.getElementById('recent-games-count');
  const avatarMessage = document.getElementById('avatar-message');
  const avatarMessageAnnouncement = document.getElementById('avatar-message-announcement');
  const libraryFilterButtons = document.querySelectorAll('.library-filter');

  if (!Array.isArray(games) || !visitorCountDisplay || !recentRow || !clockDisplay || !gamePlayer || !gameFrame ||
      !gameAdminMessage || !gameAdminAvatar || !gameAdminMessageText || !siteAvatarImage || !closeGameButton ||
      !gameVersionPicker || !gameVersionCancelButton || gameVersionButtons.length === 0 ||
      !openLibraryButton || !connectionStatusButton || !libraryView || !librarySearchInput || !closeLibraryButton ||
      !libraryGameGrid || !avatarMessage || !avatarMessageAnnouncement) {
    console.error('No se pudo inicializar Nimo Games: faltan datos o elementos requeridos.');
    return;
  }

  const catalogGames = games.slice();
  const libraryGames = games.slice().sort((first, second) =>
    first.title.localeCompare(second.title, 'es', { sensitivity: 'base', numeric: true })
  );
  const libraryGameNumbers = new Map(
    libraryGames.map((game, index) => [game.id, libraryGames.length - index])
  );
  const recentGamesStorageKey = 'nimo-games-recently-played';
  const avatarGreetingStorageKey = 'nimo-games-visited';
  const seenLiveMessageStorageKey = 'nimo-games-seen-live-message';
  const seenAbuseEventStorageKey = 'nimo-games-seen-abuse-event';
  const visitorSessionStorageKey = 'nimo-games-visitor-session-id';
  const pendingGameLaunches = new Map();
  let currentMessageUpdatedAt = null;
  let messageTypingTimer = null;
  let messageHideTimer = null;
  let gameAdminMessageHideTimer = null;
  let messageRefreshInProgress = false;
  let messageLoadErrorReported = false;
  let currentAbuseEventId = null;
  let abuseEventOverlay = null;
  let abuseEventTimer = null;
  let armedGameId = null;
  let recentGameIds = loadRecentGameIds();
  let homeGames = [];
  let activeLibraryFilter = 'all';
  let focusBeforeLibrary = null;
  let reopenLibraryAfterGame = false;
  let libraryLaunchGameId = null;
  let libraryTransitionTimer = null;
  let libraryTransitionId = 0;
  let gameTransitionTimer = null;
  let gameTransitionId = 0;
  let gameIsClosing = false;
  let visitorSessionId = null;
  let visitorUpdateInProgress = false;
  let visitorUpdatePending = false;
  let activeGameId = null;
  let pendingVersionSelection = null;
  const homeGameLimit = 5;
  const greetingVisibleDurationMs = 30000;
  const liveMessageVisibleDurationMs = 10000;
  const liveMessageRefreshIntervalMs = 30000;
  const adminAvatars = {
    Arb: 'https://avatars.githubusercontent.com/u/233341890?v=4',
    Miticraft89: 'https://avatars.githubusercontent.com/u/120197668?v=4'
  };
  const defaultGreetingMessages = {
    firstVisit: [
      'Hi! I hope you like the page!',
      'Welcome! Enjoy exploring!',
      'Hey there! Have fun!',
      "Hello! Glad you're here!",
      'Welcome to the page!'
    ],
    returning: [
      'Hello again!!!',
      'Welcome back!',
      'Nice to see you again!',
      "You're back! Enjoy your visit!",
      'Hey again!'
    ]
  };
  const networkConnection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  function loadRecentGameIds() {
    try {
      const storedRecentGames = window.localStorage.getItem(recentGamesStorageKey);
      if (!storedRecentGames) return [];

      const parsedRecentGames = JSON.parse(storedRecentGames);
      if (!Array.isArray(parsedRecentGames)) {
        throw new TypeError('El historial guardado no tiene el formato esperado.');
      }

      return Array.from(new Set(
        parsedRecentGames.filter(id =>
          typeof id === 'string' && catalogGames.some(game => game.id === id)
        )
      ));
    } catch (error) {
      console.error('No se pudo cargar el historial de juegos guardado.', error);
      return [];
    }
  }

  function saveRecentGameIds() {
    try {
      window.localStorage.setItem(recentGamesStorageKey, JSON.stringify(recentGameIds));
    } catch (error) {
      console.error('No se pudo guardar el historial de juegos.', error);
    }
  }

  function shuffleGames(gameList) {
    const shuffledGames = gameList.slice();
    for (let index = shuffledGames.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledGames[index], shuffledGames[randomIndex]] = [shuffledGames[randomIndex], shuffledGames[index]];
    }
    return shuffledGames;
  }

  function buildHomeGames() {
    const playedGames = recentGameIds
      .map(id => catalogGames.find(game => game.id === id))
      .filter(Boolean)
      .slice(0, homeGameLimit);
    const playedIds = new Set(playedGames.map(game => game.id));
    const randomGames = shuffleGames(catalogGames.filter(game => !playedIds.has(game.id)));
    return [...playedGames, ...randomGames].slice(0, homeGameLimit);
  }

  function showEntryGreeting() {
    let isReturningVisitor = false;
    try {
      isReturningVisitor = window.localStorage.getItem(avatarGreetingStorageKey) === 'true';
      window.localStorage.setItem(avatarGreetingStorageKey, 'true');
    } catch (error) {
      console.error('Could not save the visit state for avatar greetings.', error);
    }

    const greetings = isReturningVisitor
      ? defaultGreetingMessages.returning
      : defaultGreetingMessages.firstVisit;
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    renderAvatarMessage(greeting);
  }

  function hideAvatarMessage() {
    avatarMessage.classList.remove('is-visible');
    avatarMessage.setAttribute('aria-hidden', 'true');
    avatarMessage.removeAttribute('data-sender');
    siteAvatarImage.src = adminAvatars.Arb;
    messageHideTimer = null;
  }

  function hideGameAdminMessage() {
    gameAdminMessage.classList.remove('is-visible');
    gameAdminMessage.setAttribute('aria-hidden', 'true');
    gameAdminMessageHideTimer = null;
  }

  function renderGameAdminMessage(message, sender) {
    window.clearTimeout(gameAdminMessageHideTimer);
    gameAdminMessage.dataset.sender = sender;
    gameAdminAvatar.src = adminAvatars[sender];
    gameAdminAvatar.alt = `Avatar de ${sender}`;
    gameAdminMessageText.textContent = message;
    gameAdminMessage.setAttribute('aria-hidden', 'false');
    gameAdminMessage.classList.add('is-visible');
    gameAdminMessageHideTimer = window.setTimeout(hideGameAdminMessage, liveMessageVisibleDurationMs);
  }

  function renderAvatarMessage(message, visibleDurationMs = greetingVisibleDurationMs, sender = 'Arb') {
    window.clearInterval(messageTypingTimer);
    window.clearTimeout(messageHideTimer);
    avatarMessage.dataset.sender = sender;
    siteAvatarImage.src = adminAvatars[sender];
    avatarMessageAnnouncement.textContent = message;
    avatarMessage.textContent = '';

    const startMessage = () => {
      avatarMessage.classList.add('is-visible');
      avatarMessage.setAttribute('aria-hidden', 'false');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        avatarMessage.textContent = message;
        messageHideTimer = window.setTimeout(hideAvatarMessage, visibleDurationMs);
        return;
      }

      let characterIndex = 0;
      messageTypingTimer = window.setInterval(() => {
        avatarMessage.textContent += message[characterIndex];
        characterIndex += 1;
        if (characterIndex >= message.length) {
          window.clearInterval(messageTypingTimer);
          messageTypingTimer = null;
          messageHideTimer = window.setTimeout(hideAvatarMessage, visibleDurationMs);
        }
      }, 45);
    };

    if (avatarMessage.classList.contains('is-visible')) {
      startMessage();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(startMessage);
    });
  }

  async function refreshAvatarMessage() {
    if (document.hidden || messageRefreshInProgress) return;
    messageRefreshInProgress = true;
    try {
      const response = await fetch('/api/messages', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}.`);
      }
      if (typeof payload.message !== 'string' || payload.message.length > 250 ||
          !['Arb', 'Miticraft89'].includes(payload.sender) ||
          !Number.isSafeInteger(payload.updatedAt) || payload.updatedAt < 0) {
        throw new Error('The live message response has an invalid format.');
      }

      messageLoadErrorReported = false;
      if (payload.event !== null && payload.event !== undefined) {
        const event = payload.event;
        if (!['number-rain', 'game-invite', 'jumpscare'].includes(event.eventType) ||
            !['Arb', 'Miticraft89'].includes(event.sender) ||
            !Number.isSafeInteger(event.createdAt) || event.createdAt < 0 ||
            (event.eventType === 'game-invite' &&
              (typeof event.gameId !== 'string' || !catalogGames.some(game => game.id === event.gameId)))) {
          throw new Error('The live event response has an invalid format.');
        }
        if (currentAbuseEventId === null) {
          currentAbuseEventId = event.createdAt;
        } else if (event.createdAt > currentAbuseEventId &&
            Date.now() - event.createdAt < liveMessageVisibleDurationMs * 6 &&
            !hasSeenAbuseEvent(event.createdAt)) {
          currentAbuseEventId = event.createdAt;
          rememberAbuseEvent(event.createdAt);
          showAbuseEvent(event);
        } else {
          currentAbuseEventId = Math.max(currentAbuseEventId || 0, event.createdAt);
        }
      }

      if (payload.updatedAt !== currentMessageUpdatedAt) {
        currentMessageUpdatedAt = payload.updatedAt;
        if (payload.message && !hasSeenLiveMessage(payload.updatedAt)) {
          rememberLiveMessage(payload.updatedAt);
          if (gamePlayer.classList.contains('is-open')) {
            renderGameAdminMessage(payload.message, payload.sender);
          } else {
            renderAvatarMessage(payload.message, liveMessageVisibleDurationMs, payload.sender);
          }
        }
      }
    } catch (error) {
      if (!messageLoadErrorReported) {
        console.error('[Nimo Games] Could not load the current live message.', error);
        messageLoadErrorReported = true;
      }
    } finally {
      messageRefreshInProgress = false;
    }
  }

  function hasSeenLiveMessage(updatedAt) {
    try {
      return window.sessionStorage.getItem(seenLiveMessageStorageKey) === String(updatedAt);
    } catch (error) {
      console.error('Could not check whether this tab has shown the live message.', error);
      return false;
    }
  }

  function rememberLiveMessage(updatedAt) {
    try {
      window.sessionStorage.setItem(seenLiveMessageStorageKey, String(updatedAt));
    } catch (error) {
      console.error('Could not remember that this tab showed the live message.', error);
    }
  }

  function hasSeenAbuseEvent(createdAt) {
    try {
      return window.sessionStorage.getItem(seenAbuseEventStorageKey) === String(createdAt);
    } catch (error) {
      console.error('Could not check whether this tab has shown the live event.', error);
      return false;
    }
  }

  function rememberAbuseEvent(createdAt) {
    try {
      window.sessionStorage.setItem(seenAbuseEventStorageKey, String(createdAt));
    } catch (error) {
      console.error('Could not remember that this tab showed the live event.', error);
    }
  }

  function hideAbuseEvent() {
    window.clearTimeout(abuseEventTimer);
    abuseEventTimer = null;
    abuseEventOverlay?.remove();
    abuseEventOverlay = null;
  }

  function showAbuseEvent(event) {
    if (event.eventType === 'game-invite') {
      showOptionalGameInvitation(event.gameId);
      return;
    }

    hideAbuseEvent();
    if (event.eventType === 'jumpscare') {
      showJumpscare();
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'abuse-event-rain';
    overlay.setAttribute('aria-hidden', 'true');
    const symbol = '67';
    const positions = Array.from({ length: 42 }, (_, index) => ({
      column: Math.floor(index / 6),
      phase: index % 6
    }));
    for (let index = positions.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
    }
    for (let index = 0; index < 42; index += 1) {
      const item = document.createElement('span');
      item.className = 'abuse-event-rain-item';
      item.textContent = symbol;
      const { column, phase } = positions[index];
      const duration = 3.4 + Math.random() * 2.2;
      const horizontalJitter = (Math.random() * 2 - 1) * 1.5;
      const startHeight = 5 + phase * 12 + Math.random() * 10;
      item.style.left = `${2 + column * 14 + horizontalJitter}%`;
      item.style.top = `${-startHeight}vh`;
      item.style.setProperty('--fall-x-one', `${(Math.random() * 2 - 1) * 2}vw`);
      item.style.setProperty('--fall-x-two', `${(Math.random() * 2 - 1) * 4}vw`);
      item.style.setProperty('--fall-x-three', `${(Math.random() * 2 - 1) * 2}vw`);
      item.style.setProperty('--rain-duration', `${duration}s`);
      item.style.animationDelay = `${Math.random() * 2.4}s`;
      overlay.appendChild(item);
    }
    document.body.appendChild(overlay);
    abuseEventOverlay = overlay;
    abuseEventTimer = window.setTimeout(() => {
      overlay.remove();
      abuseEventOverlay = null;
      abuseEventTimer = null;
    }, liveMessageVisibleDurationMs);
  }

  function showJumpscare() {
    const overlay = document.createElement('div');
    overlay.className = 'abuse-event-jumpscare';
    overlay.setAttribute('aria-hidden', 'true');
    const backdrop = document.createElement('div');
    backdrop.className = 'abuse-event-jumpscare-backdrop';
    const image = document.createElement('img');
    image.className = 'abuse-event-jumpscare-image';
    image.src = 'https://cdn-ngames.pages.dev/images/app/jumpscare.webp';
    image.alt = '';
    overlay.append(backdrop, image);
    document.body.appendChild(overlay);
    abuseEventOverlay = overlay;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = prefersReducedMotion ? 6000 : 11000;
    abuseEventTimer = window.setTimeout(() => {
      overlay.remove();
      abuseEventOverlay = null;
      abuseEventTimer = null;
    }, duration);
  }

  function showOptionalGameInvitation(gameId) {
    const game = catalogGames.find(entry => entry.id === gameId);
    if (!game) return;

    const dialog = document.createElement('section');
    dialog.className = 'abuse-event-invitation';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'abuse-event-title');
    const heading = document.createElement('h2');
    heading.id = 'abuse-event-title';
    heading.textContent = '¿Te apuntas a otro juego?';
    const description = document.createElement('p');
    description.textContent = `¿Te apetece unirte a una partida de ${game.title}? Tú decides.`;
    const previouslyFocused = document.activeElement;
    const actions = document.createElement('div');
    actions.className = 'abuse-event-actions';
    const joinButton = document.createElement('button');
    joinButton.type = 'button';
    joinButton.className = 'abuse-event-join';
    joinButton.textContent = `Jugar a ${game.title}`;
    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'abuse-event-dismiss';
    dismissButton.textContent = 'No, gracias';
    actions.append(joinButton, dismissButton);
    dialog.append(heading, description, actions);
    document.body.appendChild(dialog);
    abuseEventOverlay = dialog;

    const dismiss = () => {
      hideAbuseEvent();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
      document.removeEventListener('keydown', handleInvitationKeydown);
    };
    const handleInvitationKeydown = event => {
      if (event.key === 'Escape') dismiss();
      if (event.key === 'Tab') {
        const focusable = [joinButton, dismissButton];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    dismissButton.addEventListener('click', dismiss, { once: true });
    document.addEventListener('keydown', handleInvitationKeydown);
    joinButton.addEventListener('click', () => {
      document.removeEventListener('keydown', handleInvitationKeydown);
      hideAbuseEvent();
      if (gamePlayer.classList.contains('is-open')) {
        closeGame();
        window.setTimeout(() => openGame(game), 600);
      } else {
        openGame(game);
      }
    }, { once: true });
    abuseEventTimer = window.setTimeout(dismiss, 15000);
    joinButton.focus();
  }

  function initializeAvatarMessages() {
    showEntryGreeting();
    refreshAvatarMessage();
    window.setInterval(refreshAvatarMessage, liveMessageRefreshIntervalMs);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshAvatarMessage();
    });
  }

  function updateConnectionStatus() {
    const online = navigator.onLine;
    const connectionType = networkConnection && networkConnection.effectiveType;
    const downlink = networkConnection && networkConnection.downlink;
    let signalLevel = online ? 3 : 0;
    let signalDescription = online ? 'Conectado' : 'Sin conexión';

    if (online && networkConnection) {
      if (connectionType === 'slow-2g' || connectionType === '2g' || downlink < 0.5) {
        signalLevel = 1;
        signalDescription = 'Conexión lenta';
      } else if (connectionType === '3g' || downlink < 2) {
        signalLevel = 2;
        signalDescription = 'Conexión media';
      } else if (connectionType === '4g' || typeof downlink === 'number') {
        signalLevel = 3;
        signalDescription = 'Conexión buena';
      } else {
        signalDescription = 'Conectado; calidad no disponible';
      }
    } else if (online) {
      signalDescription = 'Conectado; intensidad no disponible';
    }

    const icon = connectionStatusButton.querySelector('.connection-icon');
    icon.dataset.level = String(signalLevel);
    connectionStatusButton.classList.toggle('is-offline', !online);
    connectionStatusButton.setAttribute('aria-label', signalDescription);
    connectionStatusButton.title = signalDescription;
  }

  function getVisitorSessionId() {
    try {
      let sessionId = window.sessionStorage.getItem(visitorSessionStorageKey);
      if (sessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        return sessionId;
      }

      sessionId = window.crypto.randomUUID();
      window.sessionStorage.setItem(visitorSessionStorageKey, sessionId);
      return sessionId;
    } catch (error) {
      console.error('No se pudo iniciar el contador de visitantes.', error);
      visitorCountDisplay.textContent = '—';
      return null;
    }
  }

  async function updateVisitorCount(sessionId, pageView = false) {
    if (visitorUpdateInProgress) {
      visitorUpdatePending = true;
      return;
    }
    visitorUpdateInProgress = true;
    const launches = Object.fromEntries(pendingGameLaunches);
    pendingGameLaunches.clear();

    try {
      const response = await window.fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pageView, gameId: activeGameId, gameLaunches: launches }),
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error(`El contador de visitantes respondió con HTTP ${response.status}.`);
      }

      const result = await response.json();
      if (!Number.isSafeInteger(result.count) || result.count < 0) {
        throw new TypeError('El contador de visitantes devolvió una respuesta no válida.');
      }
      visitorCountDisplay.textContent = new Intl.NumberFormat('es-ES').format(result.count);
    } catch (error) {
      Object.entries(launches).forEach(([gameId, count]) => {
        pendingGameLaunches.set(gameId, (pendingGameLaunches.get(gameId) || 0) + count);
      });
      console.error('No se pudo actualizar el contador de visitantes.', error);
      visitorCountDisplay.textContent = '—';
    } finally {
      visitorUpdateInProgress = false;
      if (visitorUpdatePending) {
        visitorUpdatePending = false;
        updateVisitorCount(sessionId);
      }
    }
  }

  function queueGameLaunch(gameId) {
    pendingGameLaunches.set(gameId, (pendingGameLaunches.get(gameId) || 0) + 1);
  }

  function sendPendingGameLaunchesOnPageHide() {
    if (!visitorSessionId) return;
    const body = JSON.stringify({
      sessionId: visitorSessionId,
      gameId: null,
      gameLaunches: Object.fromEntries(pendingGameLaunches)
    });
    const queued = new Blob([body], { type: 'application/json' });
    if (window.navigator.sendBeacon('/api/visitors', queued)) {
      pendingGameLaunches.clear();
      activeGameId = null;
    }
  }

  function startVisitorCounter() {
    visitorSessionId = getVisitorSessionId();
    if (!visitorSessionId) return;

    updateVisitorCount(visitorSessionId, true);
    window.setInterval(() => updateVisitorCount(visitorSessionId), 60000);
    window.addEventListener('pagehide', sendPendingGameLaunchesOnPageHide);
  }

  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    clockDisplay.textContent = `${hours}:${minutes} ${period}`;
    clockDisplay.dateTime = now.toISOString();
  }

  function updateAmbient(imageUrl) {
    if (!ambientLayer) return;
    ambientLayer.style.opacity = '0.3';
    window.setTimeout(() => {
      ambientLayer.style.backgroundImage = `url("${imageUrl}")`;
      ambientLayer.style.opacity = '0.65';
    }, 150);
  }

  function openGame(game, fromLibrary = false, selectedVersion = null) {
    if (!game.playUrl || gamePlayer.classList.contains('is-open') || gameIsClosing) return;
    if (game.id === '945360' && !selectedVersion) {
      pendingVersionSelection = { game, fromLibrary };
      gameVersionPicker.hidden = false;
      gameVersionButtons[0].focus();
      return;
    }
    if (selectedVersion) game = { ...game, ...selectedVersion };
    activeGameId = game.id;
    queueGameLaunch(game.id);
    if (visitorSessionId) updateVisitorCount(visitorSessionId);
    recentGameIds = [game.id, ...recentGameIds.filter(id => id !== game.id)];
    saveRecentGameIds();
    homeGames = buildHomeGames();
    armedGameId = null;
    recentGamesCount.textContent = String(recentGameIds.length);
    renderCarousel();
    reopenLibraryAfterGame = fromLibrary;
    libraryLaunchGameId = fromLibrary ? game.id : null;
    const transitionId = ++gameTransitionId;
    gameFrame.title = game.title;
    gamePlayer.setAttribute('aria-label', game.title);
    gamePlayer.setAttribute('aria-hidden', 'false');
    gamePlayer.classList.add('is-open');
    window.NimoSDK.getGameLaunchUrl(game).then(launchUrl => {
      if (transitionId !== gameTransitionId || gameIsClosing) return;
      gameFrame.src = launchUrl;
    }).catch(error => {
      console.error(`[Nimo SDK] Could not prepare ${game.title} launch.`, error);
      if (transitionId === gameTransitionId && !gameIsClosing) {
        gameFrame.src = game.playUrl;
      }
    });
    window.requestAnimationFrame(() => {
      if (transitionId !== gameTransitionId) return;
      gamePlayer.classList.add('is-visible');
      gameTransitionTimer = window.setTimeout(() => {
        if (transitionId !== gameTransitionId) return;
        gamePlayer.classList.add('is-playing');
        closeGameButton.focus();
        gameTransitionTimer = null;
      }, 280);
    });
  }

  function closeGameVersionPicker(restoreLibrary = false) {
    if (gameVersionPicker.hidden) return;
    const wasOpenedFromLibrary = pendingVersionSelection && pendingVersionSelection.fromLibrary;
    pendingVersionSelection = null;
    gameVersionPicker.hidden = true;
    if (restoreLibrary && wasOpenedFromLibrary) openLibrary(false);
  }

  gameVersionButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (!pendingVersionSelection) return;
      const { game, fromLibrary } = pendingVersionSelection;
      const selectedVersion = button.dataset.gameVersion === 'legacy'
        ? {
            playUrl: 'games/945360/legacy.html',
            cdnBase: 'https://cdn.jsdelivr.net/gh/retrodotgg/wasmports@main/amongus/',
            cdnProbe: 'Build/AmongUSWebPortByTSProllyFinalBuild9.data.unityweb',
            cdnProviders: ['rawcdn']
          }
        : { playUrl: 'games/945360/index.html' };
      pendingVersionSelection = null;
      gameVersionPicker.hidden = true;
      openGame(game, fromLibrary, selectedVersion);
    });
  });

  gameVersionCancelButton.addEventListener('click', () => closeGameVersionPicker(true));
  gameVersionPicker.addEventListener('click', event => {
    if (event.target === gameVersionPicker) closeGameVersionPicker(true);
  });

  function closeGame() {
    if (!gamePlayer.classList.contains('is-open') || gameIsClosing) return;
    gameIsClosing = true;
    activeGameId = null;
    if (visitorSessionId) updateVisitorCount(visitorSessionId);
    window.clearTimeout(gameAdminMessageHideTimer);
    hideGameAdminMessage();
    const transitionId = ++gameTransitionId;
    window.clearTimeout(gameTransitionTimer);
    gameTransitionTimer = null;
    gamePlayer.classList.remove('is-playing');
    gameTransitionTimer = window.setTimeout(() => {
      if (transitionId !== gameTransitionId) return;
      gamePlayer.classList.remove('is-visible');
      gameTransitionTimer = window.setTimeout(() => {
        if (transitionId !== gameTransitionId) return;
        gamePlayer.classList.remove('is-open');
        gamePlayer.setAttribute('aria-hidden', 'true');
        gameFrame.src = 'about:blank';
        gameIsClosing = false;
        gameTransitionTimer = null;
        if (reopenLibraryAfterGame) {
          reopenLibraryAfterGame = false;
          openLibrary(false);
          window.requestAnimationFrame(() => {
            const launchCard = libraryGameGrid.querySelector(`[data-game-id="${CSS.escape(libraryLaunchGameId)}"]`);
            if (launchCard) launchCard.focus();
            libraryLaunchGameId = null;
          });
        } else {
          recentRow.focus();
        }
      }, 280);
    }, 280);
  }

  function normalizeSearch(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  }

  function getFilteredGames() {
    const query = normalizeSearch(librarySearchInput.value.trim());
    return libraryGames.filter(game => {
      const matchesQuery = normalizeSearch(game.title).includes(query);
      const matchesFilter = activeLibraryFilter === 'all' || recentGameIds.includes(game.id);
      return matchesQuery && matchesFilter;
    });
  }

  function renderLibrary() {
    const filteredGames = getFilteredGames();
    const recentCount = recentGameIds.length;
    allGamesCount.textContent = String(games.length);
    recentGamesCount.textContent = String(recentCount);
    libraryResultCount.textContent = `${filteredGames.length} ${filteredGames.length === 1 ? 'juego' : 'juegos'}`;
    librarySectionTitle.textContent = activeLibraryFilter === 'recent' ? 'Jugados recientemente' : 'Biblioteca';
    clearLibrarySearchButton.hidden = librarySearchInput.value.length === 0;
    libraryGameGrid.replaceChildren();
    libraryEmptyState.hidden = filteredGames.length !== 0;

    filteredGames.forEach(game => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'library-game-card';
      card.dataset.gameId = game.id;
      card.setAttribute('aria-label', `Jugar ${game.title}`);

      const art = document.createElement('img');
      art.className = 'library-game-art';
      art.src = game.portrait;
      art.alt = '';
      art.loading = 'lazy';
      art.onerror = () => {
        if (art.dataset.triedHero) {
          art.removeAttribute('src');
          return;
        }
        art.dataset.triedHero = 'true';
        art.src = game.hero;
      };

      const title = document.createElement('span');
      title.className = 'library-game-name';
      title.textContent = String(libraryGameNumbers.get(game.id));
      card.append(art, title);

      card.addEventListener('click', () => {
        closeLibrary(false);
        openGame(game, true);
      });
      libraryGameGrid.append(card);
    });
  }

  function renderFeaturedGames() {
    const featuredCards = document.querySelectorAll('[data-featured-game]');
    Array.from(featuredCards).forEach((card, index) => {
      const game = catalogGames[catalogGames.length - 1 - index];
      if (!game) {
        card.hidden = true;
        return;
      }

      const title = card.querySelector('.news-body h2');
      if (!title) return;
      title.textContent = game.title;
      card.style.backgroundImage = `linear-gradient(180deg, rgba(0, 0, 0, .12), rgba(0, 0, 0, .35)), url("${game.hero || game.portrait}")`;
      card.style.backgroundPosition = 'center';
      card.style.backgroundSize = 'cover';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Jugar ${game.title}`);
      card.addEventListener('click', () => openGame(game));
      card.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openGame(game);
      });
    });
  }

  function openLibrary(shouldFocusSearch = true) {
    window.clearTimeout(libraryTransitionTimer);
    const transitionId = ++libraryTransitionId;
    if (shouldFocusSearch) focusBeforeLibrary = document.activeElement;
    const triggerRect = openLibraryButton.getBoundingClientRect();
    libraryView.style.setProperty('--library-origin-x', `${triggerRect.left + triggerRect.width / 2}px`);
    libraryView.style.setProperty('--library-origin-y', `${triggerRect.top + triggerRect.height / 2}px`);
    libraryView.hidden = false;
    libraryView.setAttribute('aria-hidden', 'false');
    renderLibrary();
    window.requestAnimationFrame(() => {
      if (transitionId !== libraryTransitionId) return;
      libraryView.classList.add('is-visible');
      if (shouldFocusSearch) librarySearchInput.focus();
    });
  }

  function closeLibrary(shouldRestoreFocus = true) {
    if (libraryView.hidden) return;
    window.clearTimeout(libraryTransitionTimer);
    const transitionId = ++libraryTransitionId;
    libraryView.classList.remove('is-visible');
    libraryView.setAttribute('aria-hidden', 'true');
    libraryTransitionTimer = window.setTimeout(() => {
      if (transitionId !== libraryTransitionId) return;
      libraryView.hidden = true;
      if (shouldRestoreFocus && focusBeforeLibrary instanceof HTMLElement) focusBeforeLibrary.focus();
      libraryTransitionTimer = null;
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520);
  }

  function renderCarousel(previousRects = null) {
    recentRow.replaceChildren();
    const selectedGame = homeGames[0];
    if (!selectedGame) return;
    updateAmbient(selectedGame.hero);

    homeGames.slice(0, homeGameLimit).forEach((game, index) => {
      const selected = index === 0;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `game-card ${selected ? 'is-hero' : 'is-mini'}`;
      card.dataset.gameId = game.id;
      card.setAttribute('aria-label', selected ? `${game.title}, destacado` : `Seleccionar ${game.title}`);

      if (selected) {
        const group = document.createElement('div');
        group.className = 'hero-card-group';

        const art = document.createElement('div');
        art.className = 'hero-art';
        art.style.backgroundImage = `url("${game.hero}")`;
        card.append(art);

        const gradient = document.createElement('span');
        gradient.className = 'hero-gradient';
        card.append(gradient);

        if (game.logo) {
          const logo = document.createElement('img');
          logo.className = 'hero-logo';
          logo.src = game.logo;
          logo.alt = '';
          logo.onerror = () => {
            logo.remove();
            if (!card.querySelector('.hero-meta.game-name')) {
              const name = document.createElement('span');
              name.className = 'hero-meta game-name';
              name.textContent = game.title;
              card.append(name);
            }
          };
          card.append(logo);
        } else {
          const name = document.createElement('span');
          name.className = 'hero-meta game-name';
          name.textContent = game.title;
          card.append(name);
        }

        const details = document.createElement('div');
        details.className = 'hero-details';
        const title = document.createElement('h2');
        title.className = 'hero-title';
        title.textContent = game.title;
        const playtime = document.createElement('p');
        playtime.className = 'hero-playtime';
        const icon = document.createElement('span');
        icon.className = 'hero-playtime-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '▶';
        playtime.append(icon, document.createTextNode(
          armedGameId === game.id && game.playUrl ? 'PULSA OTRA VEZ PARA JUGAR' : (game.meta || 'JUGAR AHORA')
        ));
        details.append(title, playtime);
        group.append(card, details);
        recentRow.append(group);
      } else {
        const art = document.createElement('div');
        art.className = 'mini-art';
        art.style.backgroundImage = `url("${game.portrait}")`;
        card.append(art);
        recentRow.append(card);
      }

      card.addEventListener('click', () => {
        if (!selected) {
          promoteGame(game, true);
        } else if (armedGameId !== game.id) {
          armedGameId = game.id;
          renderCarousel();
        } else {
          openGame(game);
        }
      });
    });

    if (previousRects && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      recentRow.querySelectorAll('.game-card').forEach(card => {
        const previousRect = previousRects.get(card.dataset.gameId);
        const currentRect = card.getBoundingClientRect();
        if (!previousRect || !currentRect.width || !currentRect.height) return;
        const translateX = previousRect.left - currentRect.left;
        const translateY = previousRect.top - currentRect.top;
        const scaleX = previousRect.width / currentRect.width;
        const scaleY = previousRect.height / currentRect.height;
        if (translateX === 0 && translateY === 0 && scaleX === 1 && scaleY === 1) return;
        card.animate(
          [
            { transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})` },
            { transform: 'translate(0, 0) scale(1, 1)' }
          ],
          { duration: 460, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
      });
    }
  }

  function promoteGame(game, armForLaunch) {
    const previousCards = recentRow.querySelectorAll('.game-card');
    const previousRects = new Map(
      Array.from(previousCards, card => [card.dataset.gameId, card.getBoundingClientRect()])
    );
    const gameIndex = homeGames.findIndex(candidate => candidate.id === game.id);
    if (gameIndex < 0) return;
    if (gameIndex > 0) homeGames.unshift(...homeGames.splice(gameIndex, 1));
    armedGameId = armForLaunch ? game.id : null;
    renderCarousel(previousRects);
    recentRow.scrollTo({ left: 0, behavior: 'smooth' });
  }

  closeGameButton.addEventListener('click', closeGame);
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  if (networkConnection && typeof networkConnection.addEventListener === 'function') {
    networkConnection.addEventListener('change', updateConnectionStatus);
  }
  openLibraryButton.addEventListener('click', () => openLibrary());
  closeLibraryButton.addEventListener('click', () => closeLibrary());
  librarySearchInput.addEventListener('input', renderLibrary);
  clearLibrarySearchButton.addEventListener('click', () => {
    librarySearchInput.value = '';
    renderLibrary();
    librarySearchInput.focus();
  });

  libraryFilterButtons.forEach(button => {
    button.addEventListener('click', () => {
      activeLibraryFilter = button.dataset.libraryFilter;
      libraryFilterButtons.forEach(filter => {
        const selected = filter === button;
        filter.classList.toggle('active', selected);
        filter.setAttribute('aria-pressed', String(selected));
      });
      renderLibrary();
    });
  });

  librarySearchInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const [firstResult] = getFilteredGames();
    if (firstResult) {
      closeLibrary(false);
      openGame(firstResult, true);
    }
  });

  window.addEventListener('keydown', event => {
    if (!gameVersionPicker.hidden) {
      if (event.key === 'Escape') closeGameVersionPicker(true);
    } else if (event.key === 'Escape' && gamePlayer.classList.contains('is-open')) {
      closeGame();
    } else if (event.key === 'Escape' && !libraryView.hidden) {
      closeLibrary();
    } else if (event.key === '/' && libraryView.hidden && !gamePlayer.classList.contains('is-open')) {
      event.preventDefault();
      openLibrary();
    } else if (event.key === 'ArrowRight' && homeGames.length > 1 && !gamePlayer.classList.contains('is-open') && libraryView.hidden) {
      promoteGame(homeGames[1], false);
    }
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(item => {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
    });
  });

  updateClock();
  updateConnectionStatus();
  initializeAvatarMessages();
  window.setInterval(updateClock, 30000);
  renderFeaturedGames();
  homeGames = buildHomeGames();
  recentGamesCount.textContent = String(recentGameIds.length);
  renderCarousel();
  startVisitorCounter();
})();
