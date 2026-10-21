(() => {
  const loginForm = document.getElementById('admin-login-form');
  const languageSelect = document.getElementById('admin-language');
  const secretInput = document.getElementById('admin-secret');
  const secretToggle = document.getElementById('admin-secret-toggle');
  const unlockButton = document.getElementById('admin-unlock');
  const loginStatus = document.getElementById('admin-login-status');
  const gate = document.getElementById('admin-gate');
  const dashboard = document.getElementById('admin-dashboard');
  const logoutButton = document.getElementById('admin-logout');
  const identityDisplay = document.getElementById('admin-identity');
  const activeVisitorsDisplay = document.getElementById('active-visitors');
  const todayPeakDisplay = document.getElementById('today-peak');
  const weeklyViewsDisplay = document.getElementById('weekly-views');
  const chartTotalDisplay = document.getElementById('chart-total');
  const peakChartTotalDisplay = document.getElementById('peak-chart-total');
  const chart = document.getElementById('views-chart');
  const peakChart = document.getElementById('peak-visitors-chart');
  const statsStatus = document.getElementById('stats-status');
  const popularGameImage = document.getElementById('popular-game-image');
  const popularGameTitle = document.getElementById('popular-game-title');
  const popularGameViews = document.getElementById('popular-game-views');
  const miniViewsChart = document.getElementById('mini-views-chart');
  const locationChart = document.getElementById('location-chart');
  const locationTotal = document.getElementById('location-total');
  const locationLegend = document.getElementById('location-legend');
  const currentGamesDisplay = document.getElementById('current-games');
  const browserStatsChart = document.getElementById('browser-stats-chart');
  const deviceStatsChart = document.getElementById('device-stats-chart');
  const catalogGames = Array.isArray(window.NIMO_GAMES) ? window.NIMO_GAMES : [];
  const adminSecretStorageKey = 'nimo-games-admin-secret';
  const adminIdentityStorageKey = 'nimo-games-admin-identity';
  const adminLanguageStorageKey = 'nimo-games-admin-language';
  const numberFormat = new Intl.NumberFormat('es-ES');
  const dayFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' });
  const locationColors = [
    '#60a5fa', '#34d399', '#fbbf24', '#f87171',
    '#a78bfa', '#22d3ee', '#fb7185', '#a3e635', '#94a3b8'
  ];
  const translations = {
    es: {
      gateLabel: 'Acceso al panel de administración',
      homeLabel: 'Nimo Games, página principal',
      brandLabel: 'Nimo Games',
      eyebrow: 'Administración',
      title: 'Iniciar sesión',
      description: 'Introduce la clave de Arb o Miticraft89 para continuar.',
      secretLabel: 'Clave de administrador',
      showSecret: 'Mostrar clave',
      hideSecret: 'Ocultar clave',
      submit: 'Acceder al panel',
      asideKicker: 'NIMO GAMES · ADMIN',
      asideTitle: 'Todo el control.<br>En un solo lugar.',
      asideDescription: 'Gestiona la actividad y las herramientas de tu sitio.',
      languageLabel: 'Seleccionar idioma',
      checking: 'Verificando clave…',
      invalidSecret: 'La clave de administrador no es válida.',
      unavailable: 'Las estadísticas aún no están disponibles en este servidor. Despliégalo con Pages Functions habilitado.',
      invalidResponse: 'El servidor devolvió una respuesta no válida',
      serviceUnavailable: 'El servicio de administración no está configurado. Revisa la base de datos y ADMIN_SECRET en Pages.',
      statsUnavailable: 'No se pudieron cargar las estadísticas',
      invalidStats: 'El servidor devolvió estadísticas con un formato no válido.',
      rateLimited: 'Has alcanzado el límite de intentos. Inténtalo de nuevo en',
      expiredSecret: 'La clave dejó de ser válida. Desbloquea el panel de nuevo.',
      verifyFailed: 'No se pudo verificar la clave.',
      sessionDetails: 'Sesiones anónimas activas',
      noSessionDetails: 'No hay detalles disponibles.',
      unknownLocation: 'Ubicación desconocida',
      unknownCountry: 'País desconocido',
      noDimensionData: 'Aún no hay datos para mostrar.'
    },
    en: {
      gateLabel: 'Admin panel sign in',
      homeLabel: 'Nimo Games, home page',
      brandLabel: 'Nimo Games',
      eyebrow: 'Administration',
      title: 'Sign in',
      description: 'Enter Arb or Miticraft89’s key to continue.',
      secretLabel: 'Admin key',
      showSecret: 'Show key',
      hideSecret: 'Hide key',
      submit: 'Access the panel',
      asideKicker: 'NIMO GAMES · ADMIN',
      asideTitle: 'Everything in control.<br>All in one place.',
      asideDescription: 'Manage your site activity and tools.',
      languageLabel: 'Select language',
      checking: 'Verifying key…',
      invalidSecret: 'The admin key is invalid.',
      unavailable: 'Statistics are not available on this server yet. Deploy with Pages Functions enabled.',
      invalidResponse: 'The server returned an invalid response',
      serviceUnavailable: 'The admin service is not configured. Check the database and ADMIN_SECRET in Pages.',
      statsUnavailable: 'Could not load statistics',
      invalidStats: 'The server returned statistics in an invalid format.',
      rateLimited: 'Too many attempts. Try again in',
      expiredSecret: 'The key is no longer valid. Sign in again.',
      verifyFailed: 'Could not verify the key.',
      sessionDetails: 'Anonymous active sessions',
      noSessionDetails: 'No details available.',
      unknownLocation: 'Unknown location',
      unknownCountry: 'Unknown country',
      noDimensionData: 'There is no data to display yet.'
    }
  };
  let currentLanguage = 'es';
  let lastLoginMessage = '';
  let refreshTimer = null;
  let activeSecret = '';
  let refreshInProgress = false;

  function setLoginStatus(message) {
    lastLoginMessage = message;
    const text = translations[currentLanguage];
    let translatedMessage = message;
    if (currentLanguage === 'en') {
      const exactMessages = {
        'Verificando clave…': text.checking,
        'La clave de administrador no es válida.': text.invalidSecret,
        'Las estadísticas aún no están disponibles en este servidor. Despliégalo con Pages Functions habilitado.': text.unavailable,
        'El servidor devolvió estadísticas con un formato no válido.': text.invalidStats,
        'El servicio de administración no está configurado. Revisa la base de datos y ADMIN_SECRET en Pages.': text.serviceUnavailable,
        'No se pudo verificar la clave.': text.verifyFailed,
        'La clave dejó de ser válida. Desbloquea el panel de nuevo.': text.expiredSecret
      };
      translatedMessage = exactMessages[message] || message
        .replace(/^El servidor devolvió una respuesta no válida/, text.invalidResponse)
        .replace(/^No se pudieron cargar las estadísticas/, text.statsUnavailable);
    }
    loginStatus.textContent = translatedMessage;
  }

  function setLanguage(language) {
    currentLanguage = translations[language] ? language : 'es';
    const text = translations[currentLanguage];
    document.documentElement.lang = currentLanguage;
    document.title = 'Analytics | Nimo Games';
    document.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = text[element.dataset.i18n];
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      element.setAttribute('aria-label', text[element.dataset.i18nAriaLabel]);
    });
    document.getElementById('unlock-title').textContent = text.title;
    document.getElementById('admin-aside-title').innerHTML = text.asideTitle;
    document.querySelector('.admin-gate-language').setAttribute('aria-label', text.languageLabel);
    languageSelect.setAttribute('aria-label', text.languageLabel);
    secretToggle.setAttribute('aria-label', secretInput.type === 'password' ? text.showSecret : text.hideSecret);
    setLoginStatus(lastLoginMessage);
  }

  function showStatsStatus(message, isError = false) {
    statsStatus.textContent = message;
    statsStatus.dataset.error = String(isError);
  }

  async function requestStats(secret) {
    const languageText = translations[currentLanguage];
    const response = await fetch('/api/admin/stats', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      cache: 'no-store'
    });
    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      if (response.status === 404) {
        throw new Error('Las estadísticas aún no están disponibles en este servidor. Despliégalo con Pages Functions habilitado.');
      }
      throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterSeconds = Number(result.retryAfterSeconds);
        const remainingTime = Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0
          ? ` ${languageText.rateLimited} ${Math.ceil(retryAfterSeconds / 60)} min.`
          : result.error || languageText.rateLimited;
        throw new Error(remainingTime);
      }
      if (response.status === 401) {
        const error = new Error('La clave de administrador no es válida.');
        error.name = 'UnauthorizedError';
        throw error;
      }
      if (response.status === 503) {
        throw new Error('El servicio de administración no está configurado. Revisa la base de datos y ADMIN_SECRET en Pages.');
      }
      throw new Error(result.error || `No se pudieron cargar las estadísticas (HTTP ${response.status}).`);
    }

    return result;
  }

  function validateStats(stats) {
    if (!stats || !['Arb', 'Miticraft89'].includes(stats.adminIdentity) ||
        !Number.isSafeInteger(stats.activeVisitors) || stats.activeVisitors < 0 ||
        !Number.isSafeInteger(stats.todayPeakVisitors) || stats.todayPeakVisitors < 0 ||
        !Array.isArray(stats.locations) || stats.locations.length > 8 ||
        stats.locations.some(location =>
          !location || typeof location.city !== 'string' || typeof location.country !== 'string' ||
          !Number.isSafeInteger(location.count) || location.count < 1
        ) ||
        !Number.isSafeInteger(stats.otherLocationsCount) || stats.otherLocationsCount < 0 ||
        stats.locations.reduce((count, location) => count + location.count, stats.otherLocationsCount) !== stats.activeVisitors ||
        !Array.isArray(stats.activeGames) ||
        stats.activeGames.some(game =>
          !game || typeof game.id !== 'string' || !catalogGames.some(item => item.id === game.id) ||
          !Number.isSafeInteger(game.players) || game.players < 1 || game.players > stats.activeVisitors ||
          !Number.isFinite(game.percentage) || game.percentage < 0 || game.percentage > 100 ||
          !Array.isArray(game.sessions) || game.sessions.length !== game.players ||
          game.sessions.some(session =>
            !session || typeof session.city !== 'string' || typeof session.country !== 'string' ||
            typeof session.browser !== 'string' || typeof session.device !== 'string'
          )
        ) ||
        !Array.isArray(stats.browserStats) || stats.browserStats.some(item =>
          !item || typeof item.name !== 'string' || !Number.isSafeInteger(item.pageViews) || item.pageViews < 0
        ) ||
        !Array.isArray(stats.deviceStats) || stats.deviceStats.some(item =>
          !item || typeof item.name !== 'string' || !Number.isSafeInteger(item.pageViews) || item.pageViews < 0
        ) ||
        !Array.isArray(stats.last7Days) || stats.last7Days.length !== 7 ||
        stats.last7Days.some(day =>
          !day || typeof day.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.day) ||
          !Number.isSafeInteger(day.pageViews) || day.pageViews < 0
        ) ||
        !Array.isArray(stats.last7DaysPeakVisitors) || stats.last7DaysPeakVisitors.length !== 7 ||
        stats.last7DaysPeakVisitors.some(day =>
          !day || typeof day.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.day) ||
          !Number.isSafeInteger(day.peakVisitors) || day.peakVisitors < 0
        ) ||
        !Array.isArray(stats.last7DaysGameLaunches) || stats.last7DaysGameLaunches.length !== 7 ||
        stats.last7DaysGameLaunches.some(day =>
          !day || typeof day.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.day) ||
          !Number.isSafeInteger(day.gameLaunches) || day.gameLaunches < 0
        ) ||
        (stats.popularGame !== null && (
          !stats.popularGame || typeof stats.popularGame.id !== 'string' ||
          !Number.isSafeInteger(stats.popularGame.gameLaunches) || stats.popularGame.gameLaunches < 0 ||
          !catalogGames.some(game => game.id === stats.popularGame.id)
        ))) {
      throw new Error('El servidor devolvió estadísticas con un formato no válido.');
    }
  }

  function renderChart(days, chartElement, valueKey, gradientId) {
    const values = days.map(day => day[valueKey]);
    const maximum = Math.max(...values);
    const scaleMaximum = Math.max(1, maximum);
    chartElement.replaceChildren();
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    const left = 12;
    const right = 660;
    const top = 12;
    const bottom = 164;
    const axisMaximum = Math.max(4, Math.ceil(scaleMaximum / 4) * 4);
    const points = days.map((day, index) => ({
      x: left + index * (right - left) / Math.max(1, days.length - 1),
      y: bottom - day[valueKey] / axisMaximum * (bottom - top)
    }));
    svg.setAttribute('viewBox', '0 0 720 204');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const definitions = document.createElementNS(namespace, 'defs');
    const gradient = document.createElementNS(namespace, 'linearGradient');
    gradient.id = gradientId;
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', '0');
    gradient.setAttribute('x2', '0');
    gradient.setAttribute('y2', '1');
    const topStop = document.createElementNS(namespace, 'stop');
    topStop.setAttribute('offset', '0%');
    topStop.setAttribute('stop-color', '#60a5fa');
    topStop.setAttribute('stop-opacity', '.22');
    const bottomStop = document.createElementNS(namespace, 'stop');
    bottomStop.setAttribute('offset', '100%');
    bottomStop.setAttribute('stop-color', '#60a5fa');
    bottomStop.setAttribute('stop-opacity', '0');
    gradient.append(topStop, bottomStop);
    definitions.append(gradient);
    svg.append(definitions);

    for (let index = 0; index <= 4; index += 1) {
      const y = top + index * (bottom - top) / 4;
      const value = axisMaximum * (4 - index) / 4;
      const line = document.createElementNS(namespace, 'line');
      line.setAttribute('x1', String(left));
      line.setAttribute('x2', String(right));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      line.setAttribute('class', 'admin-chart-gridline');
      svg.append(line);

      const label = document.createElementNS(namespace, 'text');
      label.setAttribute('x', '672');
      label.setAttribute('y', String(y + 3));
      label.setAttribute('class', 'admin-chart-axis-label');
      label.textContent = numberFormat.format(value);
      svg.append(label);
    }

    const linePath = points.map((point, index) =>
      `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    ).join(' ');
    const area = document.createElementNS(namespace, 'path');
    area.setAttribute('d', `${linePath} L${right} ${bottom} L${left} ${bottom} Z`);
    area.setAttribute('class', 'admin-chart-area');
    area.style.fill = `url(#${gradientId})`;
    svg.append(area);
    const line = document.createElementNS(namespace, 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('class', 'admin-chart-line');
    svg.append(line);

    points.forEach((point, index) => {
      const dot = document.createElementNS(namespace, 'circle');
      dot.setAttribute('cx', String(point.x));
      dot.setAttribute('cy', String(point.y));
      dot.setAttribute('r', '3');
      dot.setAttribute('class', 'admin-chart-point');
      const title = document.createElementNS(namespace, 'title');
      const date = new Date(`${days[index].day}T00:00:00Z`);
      title.textContent = `${dayFormat.format(date)}: ${numberFormat.format(days[index][valueKey])}`;
      dot.append(title);
      svg.append(dot);

      const label = document.createElementNS(namespace, 'text');
      label.setAttribute('x', String(point.x));
      label.setAttribute('y', '192');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'admin-chart-day-label');
      label.textContent = dayFormat.format(date).replace('.', '');
      svg.append(label);
    });
    chartElement.append(svg);
    return maximum;
  }

  function renderViewsChart(days) {
    const total = days.reduce((sum, day) => sum + day.pageViews, 0);
    renderChart(days, chart, 'pageViews', 'analytics-area-gradient-views');
    chart.setAttribute('aria-label', `Visualizaciones de los últimos siete días: ${numberFormat.format(total)} en total.`);
    chartTotalDisplay.textContent = numberFormat.format(total);
    weeklyViewsDisplay.textContent = numberFormat.format(total);
  }

  function renderPeakVisitorsChart(days) {
    renderChart(days, peakChart, 'peakVisitors', 'analytics-area-gradient-peak');
    const todayPeak = days[days.length - 1].peakVisitors;
    peakChart.setAttribute(
      'aria-label',
      `Pico diario de sesiones simultáneas de los últimos siete días. Hoy: ${numberFormat.format(todayPeak)}.`
    );
    peakChartTotalDisplay.textContent = numberFormat.format(todayPeak);
  }

  function renderMiniChart(days) {
    if (!miniViewsChart) return;
    const maximum = Math.max(1, ...days.map(day => day.gameLaunches));
    const total = days.reduce((sum, day) => sum + day.gameLaunches, 0);
    miniViewsChart.replaceChildren();

    days.forEach(day => {
      const date = new Date(`${day.day}T00:00:00Z`);
      const column = document.createElement('div');
      column.className = 'admin-mini-chart-day';
      column.setAttribute('aria-label', `${dayFormat.format(date)}: ${numberFormat.format(day.gameLaunches)} aperturas`);

      const bar = document.createElement('span');
      bar.className = 'admin-mini-chart-bar';
      bar.style.setProperty('--mini-bar-height', `${day.gameLaunches === 0 ? 0 : Math.max(8, (day.gameLaunches / maximum) * 100)}%`);

      const label = document.createElement('span');
      label.className = 'admin-mini-chart-label';
      label.textContent = dayFormat.format(date).replace('.', '');

      column.append(bar, label);
      miniViewsChart.append(column);
    });
    miniViewsChart.setAttribute('aria-label', `Aperturas de juegos de los últimos siete días: ${numberFormat.format(total)} en total.`);
    if (total === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'admin-mini-chart-empty';
      emptyState.textContent = 'Sin aperturas registradas esta semana';
      miniViewsChart.replaceChildren(emptyState);
    }
  }

  function renderPopularGame(popularGame) {
    if (!popularGameImage || !popularGameTitle || !popularGameViews) return;
    if (!popularGame) {
      popularGameImage.hidden = true;
      popularGameTitle.textContent = 'Sin datos de hoy';
      popularGameViews.textContent = 'Todavía no hay aperturas registradas';
      return;
    }

    const game = catalogGames.find(item => item.id === popularGame.id);
    if (!game) throw new Error('El juego más abierto no existe en el catálogo.');
    popularGameImage.src = game.hero;
    popularGameImage.alt = `Imagen de ${game.title}`;
    popularGameImage.hidden = false;
    popularGameTitle.textContent = game.title;
    popularGameViews.textContent = `${numberFormat.format(popularGame.gameLaunches)} aperturas`;
  }

  function renderLocations(locations, otherLocationsCount, total) {
    locationTotal.textContent = numberFormat.format(total);
    locationLegend.replaceChildren();
    if (total === 0) {
      locationChart.style.background = 'conic-gradient(#373a41 0deg 360deg)';
      locationChart.setAttribute('aria-label', 'No hay visitantes activos para mostrar por ubicación.');
      const emptyState = document.createElement('li');
      emptyState.className = 'admin-location-empty';
      emptyState.textContent = 'No hay visitantes activos en este momento.';
      locationLegend.append(emptyState);
      return;
    }

    const rows = locations.map(location => ({
      name: location.city,
      country: location.country,
      count: location.count
    }));
    if (otherLocationsCount > 0) {
      rows.push({
        name: currentLanguage === 'en' ? 'Other locations' : 'Otras ubicaciones',
        country: '',
        count: otherLocationsCount
      });
    }

    let offset = 0;
    const segments = rows.map((row, index) => {
      const start = offset / total * 360;
      offset += row.count;
      const end = offset / total * 360;
      const color = locationColors[index % locationColors.length];
      const percent = row.count / total * 100;
      const countryLabel = row.country ? `, ${row.country}` : '';
      const item = document.createElement('li');
      item.className = 'admin-location-item';

      const name = document.createElement('span');
      name.className = 'admin-location-name';
      const swatch = document.createElement('span');
      swatch.className = 'admin-location-swatch';
      swatch.style.backgroundColor = color;
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = `${row.name}${countryLabel}`;
      name.append(swatch, label);

      const count = document.createElement('span');
      count.className = 'admin-location-count';
      count.textContent = numberFormat.format(row.count);
      const percentage = document.createElement('span');
      percentage.className = 'admin-location-percent';
      percentage.textContent = `${new Intl.NumberFormat(currentLanguage, {
        maximumFractionDigits: 1
      }).format(percent)}%`;
      item.append(name, count, percentage);
      locationLegend.append(item);
      return `${color} ${start}deg ${end}deg`;
    });
    locationChart.style.background = `conic-gradient(${segments.join(', ')})`;
    locationChart.setAttribute(
      'aria-label',
      rows.map(row => `${row.name}: ${numberFormat.format(row.count)} de ${numberFormat.format(total)} sesiones`).join('; ')
    );
  }

  function renderCurrentGames(activeGames) {
    currentGamesDisplay.replaceChildren();
    if (activeGames.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'admin-current-games-empty';
      emptyState.textContent = currentLanguage === 'en'
        ? 'No active sessions are playing a game right now.'
        : 'No hay sesiones activas jugando en este momento.';
      currentGamesDisplay.append(emptyState);
      return;
    }

    activeGames.forEach(activeGame => {
      const game = catalogGames.find(item => item.id === activeGame.id);
      const card = document.createElement('details');
      card.className = 'admin-current-game';

      const summary = document.createElement('summary');
      const image = document.createElement('img');
      image.className = 'admin-current-game-image';
      image.src = game.hero;
      image.alt = '';
      image.loading = 'lazy';

      const copy = document.createElement('div');
      copy.className = 'admin-current-game-copy';
      const title = document.createElement('h3');
      title.textContent = game.title;
      const players = document.createElement('p');
      const playerLabel = currentLanguage === 'en'
        ? (activeGame.players === 1 ? 'session' : 'sessions')
        : (activeGame.players === 1 ? 'sesión' : 'sesiones');
      players.textContent = `${numberFormat.format(activeGame.players)} ${playerLabel}`;
      copy.append(title, players);

      const percentage = document.createElement('strong');
      percentage.className = 'admin-current-game-share';
      const formattedPercentage = new Intl.NumberFormat(currentLanguage, {
        maximumFractionDigits: 1
      }).format(activeGame.percentage);
      percentage.textContent = `${formattedPercentage}%`;
      percentage.setAttribute(
        'aria-label',
        currentLanguage === 'en'
          ? `${formattedPercentage}% of active sessions`
          : `${formattedPercentage}% de las sesiones activas`
      );
      summary.append(image, copy, percentage);
      card.append(summary);

      const sessionSection = document.createElement('div');
      sessionSection.className = 'admin-game-sessions';
      const sessionHeading = document.createElement('h4');
      sessionHeading.textContent = `${translations[currentLanguage].sessionDetails} (${numberFormat.format(activeGame.sessions.length)})`;
      sessionSection.append(sessionHeading);
      if (activeGame.sessions.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = translations[currentLanguage].noSessionDetails;
        sessionSection.append(empty);
      } else {
        const sessionList = document.createElement('ul');
        activeGame.sessions.forEach((session, index) => {
          const item = document.createElement('li');
          const location = session.city || translations[currentLanguage].unknownLocation;
          const country = session.country || translations[currentLanguage].unknownCountry;
          const sessionLabel = currentLanguage === 'en' ? 'Session' : 'Sesión';
          item.textContent = `${sessionLabel} ${index + 1} · ${location}, ${country} · ${session.device} · ${session.browser}`;
          sessionList.append(item);
        });
        sessionSection.append(sessionList);
      }
      card.append(sessionSection);
      currentGamesDisplay.append(card);
    });
  }

  function renderDimensionChart(element, rows) {
    if (!element) return;
    element.replaceChildren();
    const total = rows.reduce((sum, row) => sum + row.pageViews, 0);
    if (total === 0) {
      const empty = document.createElement('p');
      empty.className = 'admin-breakdown-empty';
      empty.textContent = translations[currentLanguage].noDimensionData;
      element.append(empty);
      return;
    }

    const maximum = Math.max(...rows.map(row => row.pageViews));
    rows.forEach(row => {
      const item = document.createElement('div');
      item.className = 'admin-breakdown-row';
      const heading = document.createElement('div');
      heading.className = 'admin-breakdown-heading';
      const name = document.createElement('span');
      name.textContent = row.name;
      const value = document.createElement('span');
      const percentage = new Intl.NumberFormat(currentLanguage, { maximumFractionDigits: 1 })
        .format(row.pageViews / total * 100);
      value.textContent = `${numberFormat.format(row.pageViews)} · ${percentage}%`;
      heading.append(name, value);
      const track = document.createElement('div');
      track.className = 'admin-breakdown-track';
      const bar = document.createElement('span');
      bar.style.width = `${row.pageViews / maximum * 100}%`;
      track.append(bar);
      item.append(heading, track);
      element.append(item);
    });
  }

  function renderStats(stats) {
    validateStats(stats);
    identityDisplay.textContent = stats.adminIdentity;
    try {
      window.localStorage.setItem(adminIdentityStorageKey, stats.adminIdentity);
    } catch (error) {
      console.error('[admin-dashboard] Could not save the admin identity in this browser.', error);
    }
    activeVisitorsDisplay.textContent = numberFormat.format(stats.activeVisitors);
    todayPeakDisplay.textContent = numberFormat.format(stats.todayPeakVisitors);
    renderLocations(stats.locations, stats.otherLocationsCount, stats.activeVisitors);
    renderCurrentGames(stats.activeGames);
    renderDimensionChart(browserStatsChart, stats.browserStats);
    renderDimensionChart(deviceStatsChart, stats.deviceStats);
    renderViewsChart(stats.last7Days);
    renderPeakVisitorsChart(stats.last7DaysPeakVisitors);
    renderMiniChart(stats.last7DaysGameLaunches);
    renderPopularGame(stats.popularGame);
  }

  function lockPanel(message = '') {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
    activeSecret = '';
    try {
      window.localStorage.removeItem(adminSecretStorageKey);
      window.localStorage.removeItem(adminIdentityStorageKey);
    } catch (error) {
      console.error('[admin-dashboard] Could not remove the saved admin secret.', error);
      message = `${message}${message ? ' ' : ''}No se pudo borrar la clave guardada en este navegador.`;
    }
    dashboard.hidden = true;
    gate.hidden = false;
    secretInput.value = '';
    setLoginStatus(message);
    secretInput.focus();
  }

  async function refreshStats() {
    if (!activeSecret || refreshInProgress) return;
    refreshInProgress = true;

    try {
      const stats = await requestStats(activeSecret);
      renderStats(stats);
      showStatsStatus(`Actualizado a las ${new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date())}.`);
    } catch (error) {
      console.error('[admin-dashboard] Failed to refresh statistics.', error);
      if (error instanceof Error && error.name === 'UnauthorizedError') {
        lockPanel('La clave dejó de ser válida. Desbloquea el panel de nuevo.');
        return;
      }
      showStatsStatus(error instanceof Error ? error.message : 'No se pudieron actualizar las estadísticas.', true);
    } finally {
      refreshInProgress = false;
    }
  }

  async function unlock(secret, isInitialAttempt = false) {
    unlockButton.disabled = true;
    setLoginStatus('Verificando clave…');

    try {
      const stats = await requestStats(secret);
      renderStats(stats);
      activeSecret = secret;
      gate.hidden = true;
      dashboard.hidden = false;
      setLoginStatus('');

      let storageWarning = '';
      try {
        window.localStorage.setItem(adminSecretStorageKey, secret);
      } catch (error) {
        console.error('[admin-dashboard] Could not save the admin secret in this browser.', error);
        storageWarning = 'Panel desbloqueado. No se pudo recordar la clave en este navegador.';
      }

      showStatsStatus(storageWarning || `Actualizado a las ${new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date())}.`, Boolean(storageWarning));
      window.clearInterval(refreshTimer);
      refreshTimer = window.setInterval(refreshStats, 30000);
    } catch (error) {
      console.error('[admin-dashboard] Could not unlock the admin panel.', error);
      if (error instanceof Error && error.name === 'UnauthorizedError') {
        try {
          window.localStorage.removeItem(adminSecretStorageKey);
          window.localStorage.removeItem(adminIdentityStorageKey);
        } catch (storageError) {
          console.error('[admin-dashboard] Could not remove the rejected admin secret.', storageError);
        }
        setLoginStatus(error.message);
      } else {
        setLoginStatus(error instanceof Error ? error.message : 'No se pudo verificar la clave.');
      }
      if (!isInitialAttempt) secretInput.focus();
    } finally {
      unlockButton.disabled = false;
    }
  }

  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    unlock(secretInput.value);
  });

  secretToggle.addEventListener('click', () => {
    const isVisible = secretInput.type === 'text';
    secretInput.type = isVisible ? 'password' : 'text';
    secretToggle.setAttribute('aria-pressed', String(!isVisible));
    const text = translations[currentLanguage];
    secretToggle.setAttribute('aria-label', isVisible ? text.showSecret : text.hideSecret);
    secretInput.focus();
  });

  languageSelect.addEventListener('change', () => {
    setLanguage(languageSelect.value);
    try {
      window.localStorage.setItem(adminLanguageStorageKey, currentLanguage);
    } catch (error) {
      console.error('[admin-dashboard] Could not save the language preference.', error);
    }
  });

  logoutButton.addEventListener('click', () => {
    lockPanel();
  });

  try {
    secretInput.value = window.localStorage.getItem(adminSecretStorageKey) || '';
  } catch (error) {
    console.error('[admin-dashboard] Could not load the saved admin secret.', error);
    setLoginStatus('No se pudo acceder a la clave guardada. Introdúcela para desbloquear el panel.');
  }
  try {
    const savedLanguage = window.localStorage.getItem(adminLanguageStorageKey);
    if (savedLanguage && translations[savedLanguage]) languageSelect.value = savedLanguage;
  } catch (error) {
    console.error('[admin-dashboard] Could not load the saved language preference.', error);
  }
  setLanguage(languageSelect.value);
})();
