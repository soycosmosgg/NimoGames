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
  const activeVisitorsDisplay = document.getElementById('active-visitors');
  const todayPeakDisplay = document.getElementById('today-peak');
  const weeklyViewsDisplay = document.getElementById('weekly-views');
  const chartTotalDisplay = document.getElementById('chart-total');
  const chart = document.getElementById('views-chart');
  const statsStatus = document.getElementById('stats-status');
  const adminSecretStorageKey = 'nimo-games-admin-secret';
  const adminLanguageStorageKey = 'nimo-games-admin-language';
  const numberFormat = new Intl.NumberFormat('es-ES');
  const dayFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' });
  const translations = {
    es: {
      gateLabel: 'Acceso al panel de administración',
      homeLabel: 'Nimo Games, página principal',
      brandLabel: 'Nimo Games',
      eyebrow: 'Administración',
      title: 'Iniciar sesión',
      description: 'Introduce tu clave para continuar.',
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
      expiredSecret: 'La clave dejó de ser válida. Desbloquea el panel de nuevo.',
      verifyFailed: 'No se pudo verificar la clave.'
    },
    en: {
      gateLabel: 'Admin panel sign in',
      homeLabel: 'Nimo Games, home page',
      brandLabel: 'Nimo Games',
      eyebrow: 'Administration',
      title: 'Sign in',
      description: 'Enter your key to continue.',
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
      expiredSecret: 'The key is no longer valid. Sign in again.',
      verifyFailed: 'Could not verify the key.'
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
    document.title = currentLanguage === 'en' ? 'Admin panel | Nimo Games' : 'Panel de administración | Nimo Games';
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
    const response = await fetch('/api/admin/stats', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      cache: 'no-store'
    });
    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch {
      if (response.status === 404) {
        throw new Error('Las estadísticas aún no están disponibles en este servidor. Despliégalo con Pages Functions habilitado.');
      }
      throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`);
    }

    if (!response.ok) {
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
    if (!stats || !Number.isSafeInteger(stats.activeVisitors) || stats.activeVisitors < 0 ||
        !Number.isSafeInteger(stats.todayPeakVisitors) || stats.todayPeakVisitors < 0 ||
        !Array.isArray(stats.last7Days) || stats.last7Days.length !== 7 ||
        stats.last7Days.some(day =>
          !day || typeof day.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.day) ||
          !Number.isSafeInteger(day.pageViews) || day.pageViews < 0
        )) {
      throw new Error('El servidor devolvió estadísticas con un formato no válido.');
    }
  }

  function renderChart(days) {
    const maximum = Math.max(1, ...days.map(day => day.pageViews));
    const total = days.reduce((sum, day) => sum + day.pageViews, 0);
    chart.replaceChildren();

    days.forEach(day => {
      const date = new Date(`${day.day}T00:00:00Z`);
      const column = document.createElement('div');
      column.className = 'admin-chart-day';
      column.dataset.today = String(day.day === days[days.length - 1].day);
      column.setAttribute('aria-label', `${dayFormat.format(date)}: ${numberFormat.format(day.pageViews)} visualizaciones`);

      const value = document.createElement('span');
      value.className = 'admin-chart-value';
      value.textContent = numberFormat.format(day.pageViews);

      const track = document.createElement('div');
      track.className = 'admin-chart-track';
      track.setAttribute('aria-hidden', 'true');

      const bar = document.createElement('div');
      bar.className = 'admin-chart-bar';
      bar.style.setProperty('--bar-height', `${Math.max(day.pageViews === 0 ? 2 : 8, day.pageViews / maximum * 100)}%`);
      track.append(bar);

      const label = document.createElement('span');
      label.className = 'admin-chart-label';
      label.textContent = dayFormat.format(date).replace('.', '');

      column.append(value, track, label);
      chart.append(column);
    });

    chart.setAttribute('aria-label', `Visualizaciones de los últimos siete días: ${numberFormat.format(total)} en total.`);
    chartTotalDisplay.textContent = numberFormat.format(total);
    weeklyViewsDisplay.textContent = numberFormat.format(total);
  }

  function renderStats(stats) {
    validateStats(stats);
    activeVisitorsDisplay.textContent = numberFormat.format(stats.activeVisitors);
    todayPeakDisplay.textContent = numberFormat.format(stats.todayPeakVisitors);
    renderChart(stats.last7Days);
  }

  function lockPanel(message = '') {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
    activeSecret = '';
    try {
      window.localStorage.removeItem(adminSecretStorageKey);
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
