(() => {
  const form = document.getElementById('message-form');
  const messageInput = document.getElementById('message');
  const messageCount = document.getElementById('message-count');
  const sendButton = document.getElementById('send-message');
  const status = document.getElementById('status');
  const identityDisplay = document.getElementById('admin-identity');
  const chatEmpty = document.getElementById('admin-chat-empty');
  const chatBubble = document.getElementById('admin-chat-bubble');
  const chatSender = document.getElementById('admin-chat-sender');
  const chatText = document.getElementById('admin-chat-text');
  const adminSecretStorageKey = 'nimo-games-admin-secret';
  const adminIdentityStorageKey = 'nimo-games-admin-identity';
  const adminMessageVisibleDurationMs = 10000;
  const adminMessagePollIntervalMs = 5000;
  let adminSecret = '';
  let adminIdentity = '';
  let latestMessageUpdatedAt = 0;
  let chatHideTimer = null;
  let messagePollInProgress = false;

  function displayStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = String(isError);
  }

  function updateMessageCount() {
    messageCount.textContent = `${messageInput.value.length} / 250`;
  }

  function showAdminMessage(message, sender, updatedAt) {
    window.clearTimeout(chatHideTimer);
    latestMessageUpdatedAt = Math.max(latestMessageUpdatedAt, updatedAt);
    chatSender.textContent = sender;
    chatText.textContent = message;
    chatBubble.dataset.own = String(sender === adminIdentity);
    chatBubble.hidden = false;
    chatEmpty.hidden = true;
    chatHideTimer = window.setTimeout(() => {
      chatBubble.hidden = true;
      chatEmpty.hidden = false;
      chatHideTimer = null;
    }, adminMessageVisibleDurationMs);
  }

  function getRequestError(error) {
    if (error instanceof TypeError) {
      return 'No se pudo conectar con el servicio de mensajes. Comprueba la conexión e inténtalo de nuevo.';
    }
    return error instanceof Error ? error.message : 'Se produjo un error inesperado.';
  }

  async function readApiResponse(response) {
    const body = await response.text();
    let result;

    try {
      result = JSON.parse(body);
    } catch {
      if (response.status === 404) {
        throw new Error('El servicio de mensajes no está disponible en este servidor. Despliega el sitio con Pages Functions habilitado.');
      }
      throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterSeconds = Number(result.retryAfterSeconds);
        if (Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0) {
          throw new Error(`Acceso bloqueado temporalmente. Inténtalo de nuevo en ${Math.ceil(retryAfterSeconds / 60)} min.`);
        }
      }
      if (response.status === 401) {
        const error = new Error('La clave de administrador no es válida. Revísala e inténtalo de nuevo.');
        error.name = 'UnauthorizedError';
        throw error;
      }
      if (response.status === 503) {
        throw new Error('El servicio de mensajes no está configurado. Revisa la configuración de Pages y la base de datos.');
      }
      throw new Error(result.error || `La solicitud falló (HTTP ${response.status}).`);
    }

    return result;
  }

  messageInput.addEventListener('input', updateMessageCount);
  updateMessageCount();

  try {
    adminSecret = window.localStorage.getItem(adminSecretStorageKey) || '';
    adminIdentity = window.localStorage.getItem(adminIdentityStorageKey) || '';
    identityDisplay.textContent = adminIdentity;
    if (!adminSecret) {
      displayStatus('La sesión de administrador no está disponible. Vuelve al panel e introduce la clave.', true);
    }
  } catch (error) {
    console.error('[messages-admin] Could not load the saved admin secret.', error);
    displayStatus('No se pudo acceder a la sesión de administrador. Vuelve al panel e introduce la clave.', true);
  }

  async function refreshAdminChat() {
    if (!adminSecret || document.hidden || messagePollInProgress) return;
    messagePollInProgress = true;
    try {
      const response = await fetch('/api/messages', { cache: 'no-store' });
      const result = await readApiResponse(response);
      if (typeof result.message !== 'string' || result.message.length > 250 ||
          !['Arb', 'Miticraft89'].includes(result.sender) ||
          !Number.isSafeInteger(result.updatedAt) || result.updatedAt < 0) {
        throw new Error('El servidor devolvió un mensaje con formato no válido.');
      }
      if (result.updatedAt > latestMessageUpdatedAt) {
        if (result.message && Date.now() - result.updatedAt < adminMessageVisibleDurationMs) {
          showAdminMessage(result.message, result.sender, result.updatedAt);
        } else {
          latestMessageUpdatedAt = result.updatedAt;
        }
      }
    } catch (error) {
      console.error('[messages-admin] Failed to refresh the live admin chat.', error);
    } finally {
      messagePollInProgress = false;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    sendButton.disabled = true;
    displayStatus('Enviando…');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: messageInput.value })
      });
      const result = await readApiResponse(response);
      adminIdentity = result.sender;
      identityDisplay.textContent = result.sender;
      if (typeof result.message !== 'string' || !Number.isSafeInteger(result.updatedAt)) {
        throw new Error('El servidor devolvió el mensaje enviado con formato no válido.');
      }
      showAdminMessage(result.message, result.sender, result.updatedAt);

      messageInput.value = '';
      updateMessageCount();
      displayStatus('Mensaje enviado. Se mostrará aquí durante 10 segundos.');
    } catch (error) {
      if (error instanceof Error && error.name === 'UnauthorizedError') {
        adminSecret = '';
        try {
          window.localStorage.removeItem(adminSecretStorageKey);
          window.localStorage.removeItem(adminIdentityStorageKey);
        } catch (storageError) {
          console.error('[messages-admin] Could not remove the rejected admin secret.', storageError);
        }
      }
      console.error('[messages-admin] Failed to send message.', error);
      displayStatus(getRequestError(error), true);
    } finally {
      sendButton.disabled = false;
    }
  });

  refreshAdminChat();
  window.setInterval(refreshAdminChat, adminMessagePollIntervalMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAdminChat();
  });
})();
