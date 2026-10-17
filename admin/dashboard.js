(() => {
  const loginForm = document.getElementById('admin-login-form');
  const secretInput = document.getElementById('admin-secret');
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
  const numberFormat = new Intl.NumberFormat('es-ES');
  const dayFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' });
  let refreshTimer = null;
  let activeSecret = '';
  let refreshInProgress = false;

  function setLoginStatus(message) {
    loginStatus.textContent = message;
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

  logoutButton.addEventListener('click', () => {
    lockPanel();
  });

  try {
    secretInput.value = window.localStorage.getItem(adminSecretStorageKey) || '';
  } catch (error) {
    console.error('[admin-dashboard] Could not load the saved admin secret.', error);
    setLoginStatus('No se pudo acceder a la clave guardada. Introdúcela para desbloquear el panel.');
  }
})();
