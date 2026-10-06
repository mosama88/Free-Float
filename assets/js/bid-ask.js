/* ============================================================
   bid-ask.js — يجيب Bid/Ask من الـ Worker (route: /bidask)
============================================================ */
(function () {
  "use strict";

  var symEl = document.getElementById('baSymbol');
  var btn = document.getElementById('baFetch');
  var box = document.getElementById('bidaskDisplay');
  var bidEl = document.getElementById('baBid');
  var askEl = document.getElementById('baAsk');
  var spreadEl = document.getElementById('baSpread');
  var midEl = document.getElementById('baMid');
  var lastEl = document.getElementById('baLast');
  var statusEl = document.getElementById('status');

  if (!symEl || !btn) return;

  // الـ Worker المخصص للـ Bid/Ask (منفصل عن Worker الأسهم)
  var BIDASK_WORKER = 'https://falling-wildflower-192ebid-ask.osamaanit.workers.dev';

  function workerBase() {
    return BIDASK_WORKER.replace(/\/+$/, '');
  }

  function fmt(n, d) {
    return (n === null || n === undefined || !isFinite(n)) ? '—' : Number(n).toFixed(d || 2);
  }

  function say(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function reset() {
    bidEl.textContent = askEl.textContent = '—';
    spreadEl.textContent = midEl.textContent = lastEl.textContent = '—';
  }

  function go() {
    var sym = symEl.value.trim().toUpperCase();
    if (!sym) { say('اكتب رمز السهم الأول', 'err'); return; }

    var base = workerBase();
    if (!base) { say('اكتب رابط الـ Worker فوق الأول', 'err'); return; }

    btn.disabled = true;
    say('⏳ بيجيب Bid/Ask...', '');
    box.hidden = false;
    reset();

    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, 12000);

    fetch(base + '/bidask?symbol=' + encodeURIComponent(sym), { cache: 'no-store', signal: c.signal })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (body) {
          if (!res.ok || !body || !body.ok) {
            throw new Error((body && body.error) || ('HTTP ' + res.status));
          }
          return body.data;
        });
      })
      .then(function (d) {
        bidEl.textContent = fmt(d.bid);
        askEl.textContent = fmt(d.ask);
        spreadEl.textContent = fmt(d.spread, 4);
        midEl.textContent = fmt(d.mid, 4);
        lastEl.textContent = fmt(d.last);

        if (d.bid === null || d.ask === null) {
          say('⚠️ ' + sym + ' — مفيش bid أو ask دلوقتي على IEX (طبيعي في الأسهم الصغيرة أو لما السوق مقفول)', 'err');
        } else {
          say('✅ ' + sym + ' — ' + d.source, 'ok');
        }
      })
      .catch(function (e) {
        var m = e && e.name === 'AbortError' ? 'انتهت المهلة'
              : e && e.name === 'TypeError' ? 'CORS أو الشبكة'
              : (e && e.message) || 'خطأ غير معروف';
        say('❌ Bid/Ask: ' + m, 'err');
      })
      .finally(function () { clearTimeout(t); btn.disabled = false; });
  }

  btn.addEventListener('click', go);
  symEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
})();