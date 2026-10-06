/* ============================================================
   theme.js — Dark / Light / Auto mode
============================================================ */
(function () {
  "use strict";

  var htmlEl = document.documentElement;
  var themeBtns = document.querySelectorAll('[data-theme-set]');

  function updateBtns() {
    var cur = htmlEl.getAttribute('data-theme') || 'system';
    themeBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-theme-set') === cur);
    });
  }

  function setTheme(m) {
    if (m === 'light' || m === 'dark') {
      htmlEl.setAttribute('data-theme', m);
      try { localStorage.setItem('ff-theme', m); } catch (e) {}
    } else {
      htmlEl.removeAttribute('data-theme');
      try { localStorage.removeItem('ff-theme'); } catch (e) {}
    }
    updateBtns();
  }

  // Load saved theme on startup
  try {
    var saved = localStorage.getItem('ff-theme');
    if (saved) htmlEl.setAttribute('data-theme', saved);
  } catch (e) {}

  updateBtns();

  themeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      setTheme(b.getAttribute('data-theme-set'));
    });
  });
})();