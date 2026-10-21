(() => {
  document.documentElement.style.visibility = 'hidden';

  try {
    if (window.sessionStorage.getItem('nimo-games-admin-secret')) {
      document.documentElement.style.visibility = '';
      return;
    }
  } catch (error) {
    console.error('[admin-guard] Could not read the admin session.', error);
  }

  window.location.replace('/admin/analytics.html');
})();
