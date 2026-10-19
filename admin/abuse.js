(() => {
  const identityDisplay = document.getElementById('admin-identity');
  const status = document.getElementById('abuse-status');
  const numberRainButton = document.getElementById('start-number-rain');
  const gameInviteButton = document.getElementById('send-game-invite');
  const gameSelect = document.getElementById('event-game');
  const adminSecretStorageKey = 'nimo-games-admin-secret';
  const adminIdentityStorageKey = 'nimo-games-admin-identity';
  const games = Array.isArray(window.NIMO_GAMES) ? window.NIMO_GAMES : [];
  let adminSecret = '';

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = String(isError);
  }

  function readSavedSession() {
    try {
      adminSecret = window.localStorage.getItem(adminSecretStorageKey) || '';
      identityDisplay.textContent = window.localStorage.getItem(adminIdentityStorageKey) || '';
      if (!adminSecret) {
        showStatus('La sesión de administrador no está disponible. Vuelve al panel e introduce la clave.', true);
      }
    } catch (error) {
      console.error('[admin-abuse] Could not load the saved admin session.', error);
      showStatus('No se pudo acceder a la sesión de administrador. Vuelve al panel e introduce la clave.', true);
    }
  }

  function populateGames() {
    if (games.length === 0) {
      showStatus('No se pudo cargar el catálogo de juegos.', true);
      gameInviteButton.disabled = true;
      return;
    }
    const fragment = document.createDocumentFragment();
    games.forEach(game => {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.title;
      fragment.appendChild(option);
    });
    gameSelect.appendChild(fragment);
  }

  async function publishEvent(eventType, gameId = null) {
    if (!adminSecret) {
      showStatus('Inicia sesión de nuevo en el panel para lanzar un evento.', true);
      return;
    }
    numberRainButton.disabled = true;
    gameInviteButton.disabled = true;
    showStatus('Publicando evento…');
    try {
      const response = await fetch('/api/admin/abuse', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventType, gameId }),
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          adminSecret = '';
          try {
            window.localStorage.removeItem(adminSecretStorageKey);
            window.localStorage.removeItem(adminIdentityStorageKey);
          } catch (storageError) {
            console.error('[admin-abuse] Could not clear the rejected admin session.', storageError);
          }
          identityDisplay.textContent = '';
          throw new Error('La clave de administrador ya no es válida. Vuelve al panel e inicia sesión.');
        }
        throw new Error(result.error || `La solicitud falló (HTTP ${response.status}).`);
      }
      if (!Number.isSafeInteger(result.createdAt) || result.eventType !== eventType) {
        throw new Error('El servidor devolvió una respuesta de evento no válida.');
      }
      showStatus(
        eventType === 'number-rain'
          ? 'Lluvia de 67 publicada. Los visitantes la verán durante 10 segundos.'
          : 'Invitación publicada. Cada visitante puede abrir el juego o rechazarla.'
      );
    } catch (error) {
      console.error('[admin-abuse] Failed to publish a live event.', error);
      showStatus(error instanceof Error ? error.message : 'No se pudo publicar el evento.', true);
    } finally {
      numberRainButton.disabled = false;
      gameInviteButton.disabled = false;
    }
  }

  numberRainButton.addEventListener('click', () => publishEvent('number-rain'));
  gameInviteButton.addEventListener('click', () =>
    publishEvent('game-invite', gameSelect.value)
  );
  populateGames();
  readSavedSession();
})();
