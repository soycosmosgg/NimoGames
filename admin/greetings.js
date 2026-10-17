(() => {
  const form = document.getElementById('greetings-form');
  const adminSecret = document.getElementById('admin-secret');
  const firstVisitGreetings = document.getElementById('first-visit-greetings');
  const returningGreetings = document.getElementById('returning-greetings');
  const saveButton = document.getElementById('save-greetings');
  const status = document.getElementById('status');

  function displayStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = String(isError);
  }

  function parseGreetingLines(text) {
    return text.split(/\r?\n/).map(greeting => greeting.trim()).filter(Boolean);
  }

  async function loadGreetings() {
    try {
      const response = await fetch('/api/greetings', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Request failed with status ${response.status}.`);
      }

      firstVisitGreetings.value = result.firstVisit.join('\n');
      returningGreetings.value = result.returning.join('\n');
      displayStatus('Current greetings loaded.');
    } catch (error) {
      console.error('[greetings-admin] Failed to load greetings.', error);
      displayStatus(error.message, true);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    saveButton.disabled = true;
    displayStatus('Saving…');

    try {
      const response = await fetch('/api/greetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret.value}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstVisit: parseGreetingLines(firstVisitGreetings.value),
          returning: parseGreetingLines(returningGreetings.value)
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Request failed with status ${response.status}.`);
      }

      firstVisitGreetings.value = result.firstVisit.join('\n');
      returningGreetings.value = result.returning.join('\n');
      adminSecret.value = '';
      displayStatus('Greetings saved. Open pages will update within a few seconds.');
    } catch (error) {
      console.error('[greetings-admin] Failed to save greetings.', error);
      displayStatus(error.message, true);
    } finally {
      saveButton.disabled = false;
    }
  });

  loadGreetings();
})();
