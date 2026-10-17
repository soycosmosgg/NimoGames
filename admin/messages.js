(() => {
  const form = document.getElementById('message-form');
  const adminSecret = document.getElementById('admin-secret');
  const messageInput = document.getElementById('message');
  const sendButton = document.getElementById('send-message');
  const status = document.getElementById('status');
  const adminSecretStorageKey = 'nimo-games-admin-secret';

  function displayStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = String(isError);
  }

  try {
    adminSecret.value = window.localStorage.getItem(adminSecretStorageKey) || '';
  } catch (error) {
    console.error('[messages-admin] Could not load the saved admin secret.', error);
    displayStatus('Could not access this browser’s saved admin secret.', true);
  }

  async function loadCurrentMessage() {
    try {
      const response = await fetch('/api/messages', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Request failed with status ${response.status}.`);
      }

      messageInput.value = result.message;
      displayStatus(result.message ? 'Current published message loaded.' : 'No message has been sent yet.');
    } catch (error) {
      console.error('[messages-admin] Failed to load current message.', error);
      displayStatus(error.message, true);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    sendButton.disabled = true;
    displayStatus('Sending…');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret.value}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: messageInput.value })
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          try {
            window.localStorage.removeItem(adminSecretStorageKey);
          } catch (error) {
            console.error('[messages-admin] Could not remove the rejected admin secret.', error);
          }
        }
        throw new Error(result.error || `Request failed with status ${response.status}.`);
      }

      messageInput.value = '';
      try {
        window.localStorage.setItem(adminSecretStorageKey, adminSecret.value);
      } catch (error) {
        console.error('[messages-admin] Could not save the admin secret in this browser.', error);
        displayStatus('Message sent, but the admin secret could not be remembered in this browser.', true);
        return;
      }
      displayStatus('Message sent. It will show once per tab, expire after 30 seconds, and not appear on later visits.');
    } catch (error) {
      console.error('[messages-admin] Failed to send message.', error);
      displayStatus(error.message, true);
    } finally {
      sendButton.disabled = false;
    }
  });

  loadCurrentMessage();
})();
