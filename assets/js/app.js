/* ============================================================
   app.js — Optional glue between modules
============================================================ */
(function () {
  "use strict";

  // Placeholder in case we need to hook into fetcher events.
  // Currently, "addToTable" is handled directly in stock-fetcher.js
  // by calling window.analyzerAddSymbol(). This file is reserved
  // for future cross-module features.

  console.log('[Stock Analyzer] Modules loaded: theme, session-clock, analyzer, stock-fetcher, app');
})();