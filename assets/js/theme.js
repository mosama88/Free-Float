/* ============================================================
   THEME TOGGLE
============================================================ */
(function initTheme() {
  const saved = localStorage.getItem('bs_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-bs-theme', saved);
  $('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', cur);
    localStorage.setItem('bs_theme', cur);
  });
})();