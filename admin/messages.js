(() => {
  const form = document.getElementById('message-form');
  const messageInput = document.getElementById('message');
  const messageCount = document.getElementById('message-count');
  const sendButton = document.getElementById('send-message');
  const status = document.getElementById('status');
  const identityDisplay = document.getElementById('admin-identity');
  const adminSecretStorageKey = 'nimo-games-admin-secret';
  const adminIdentityStorageKey = 'nimo-games-admin-identity';
  let adminSecret = '';

  function displayStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = String(isError);
  }

  function updateMessageCount() {
    messageCount.textContent = `${messageInput.value.length} / 250`;
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
    identityDisplay.textContent = window.localStorage.getItem(adminIdentityStorageKey) || '';
    if (!adminSecret) {
      displayStatus('La sesión de administrador no está disponible. Vuelve al panel e introduce la clave.', true);
    }
  } catch (error) {
    console.error('[messages-admin] Could not load the saved admin secret.', error);
    displayStatus('No se pudo acceder a la sesión de administrador. Vuelve al panel e introduce la clave.', true);
  }

  async function loadCurrentMessage() {
    try {
      const response = await fetch('/api/messages', { cache: 'no-store' });
      const result = await readApiResponse(response);
      messageInput.value = result.message;
      updateMessageCount();
      displayStatus(result.message ? 'Mensaje actual cargado.' : 'Todavía no se ha enviado ningún mensaje.');
    } catch (error) {
      console.error('[messages-admin] Failed to load current message.', error);
      displayStatus(getRequestError(error), true);
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
      identityDisplay.textContent = result.sender;

      messageInput.value = '';
      updateMessageCount();
      displayStatus('Mensaje enviado. Se mostrará una vez por pestaña y caducará a los 10 segundos.');
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

  loadCurrentMessage();
})();
