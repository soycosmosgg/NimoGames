(() => {
  const form = document.getElementById('message-form');
  const adminSecret = document.getElementById('admin-secret');
  const messageInput = document.getElementById('message');
  const sendButton = document.getElementById('send-message');
  const status = document.getElementById('status');

  function displayStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = String(isError);
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
        throw new Error(result.error || `Request failed with status ${response.status}.`);
      }

      messageInput.value = result.message;
      adminSecret.value = '';
      displayStatus('Message sent. Open pages will show it within a few seconds.');
    } catch (error) {
      console.error('[messages-admin] Failed to send message.', error);
      displayStatus(error.message, true);
    } finally {
      sendButton.disabled = false;
    }
  });

  loadCurrentMessage();
})();
