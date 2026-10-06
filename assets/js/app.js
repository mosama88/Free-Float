/* ============================================================
   app.js — Glue + Refresh All button
============================================================ */
(function () {
  "use strict";

  var refreshAllBtn = document.getElementById('refreshAllBtn');
  if (!refreshAllBtn) {
    console.log('[Stock Analyzer] Modules loaded: theme, session-clock, analyzer, stock-fetcher, app');
    return;
  }

  refreshAllBtn.addEventListener('click', function () {
    if (!window.analyzerGetSymbols) {
      alert('analyzer.js مش محمّل صح');
      return;
    }
    var symbols = window.analyzerGetSymbols();
    if (!symbols.length) {
      alert('الجدول فاضي — أضف أسهم الأول');
      return;
    }

    refreshAllBtn.disabled = true;
    var originalText = refreshAllBtn.textContent;
    var done = 0, ok = 0, fail = 0;

    function updateProgress() {
      refreshAllBtn.textContent = '⏳ ' + (done) + '/' + symbols.length;
    }
    updateProgress();

    // نحتاج نستخدم نفس منطق الـ fetch من stock-fetcher
    // هنعمل dispatch على زر "جيب البيانات" لكل رمز
    var symbolEl = document.getElementById('symbol');
    var fetchBtn = document.getElementById('fetchBtn');
    if (!symbolEl || !fetchBtn) return;

    // نعمل queue متسلسل عشان مانضربش الـ API بـ 100 طلب مع بعض
    var idx = 0;
    function next() {
      if (idx >= symbols.length) {
        refreshAllBtn.textContent = '✅ ' + ok + ' تم · ❌ ' + fail + ' فشل';
        setTimeout(function () {
          refreshAllBtn.textContent = originalText;
          refreshAllBtn.disabled = false;
        }, 2500);
        return;
      }
      var sym = symbols[idx++];
      symbolEl.value = sym;

      // نستدعي نفس الزر ونستنى النتيجة
      var before = symbolEl.value;
      fetchBtn.click();

      // نستنى شوية لحد ما الـ fetch يخلص
      var waited = 0;
      var check = setInterval(function () {
        waited += 200;
        // لو الـ status بقى فيه ✅ أو ❌ أو الـ cards اتملت
        var statusText = document.getElementById('status').textContent || '';
        var finished = statusText.indexOf('✅') === 0 || statusText.indexOf('❌') === 0;
        if (finished || waited > 15000) {
          clearInterval(check);
          if (statusText.indexOf('✅') === 0) ok++; else fail++;
          done++; updateProgress();
          next();
        }
      }, 200);
    }
    next();
  });

  console.log('[Stock Analyzer] Modules loaded: theme, session-clock, analyzer, stock-fetcher, app');
})();