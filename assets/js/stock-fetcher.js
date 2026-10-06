/* ============================================================
   stock-fetcher.js — Fetch single stock via Worker / Proxy
============================================================ */
(function () {
  "use strict";

  var symbolEl = document.getElementById('symbol');
  var workerEl = document.getElementById('workerUrl');
  var btn = document.getElementById('fetchBtn');
  var addBtn = document.getElementById('addToTableBtn');
  var clearBtn = document.getElementById('clearBtn');
  var statusEl = document.getElementById('status');
  var cardsEl = document.getElementById('cards');
  var readyEl = document.getElementById('ready');
  var rawEl = document.getElementById('rawJson');

  if (!symbolEl) return;

  var PROXIES = [
    { name: 'corsproxy.io', build: function (u) { return 'https://corsproxy.io/?url=' + encodeURIComponent(u); } },
    { name: 'allorigins.win', build: function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); } }
  ];
  var LOW = 20, HIGH = 50;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsRemove(k) { try { localStorage.removeItem(k); } catch (e) {} }

  workerEl.value = lsGet('sf-worker') || 'https://small-disk-18d3stock-proxy.osamaanit.workers.dev';
  workerEl.addEventListener('input', function () { lsSet('sf-worker', workerEl.value.trim()); });

  var savedSymbol = lsGet('sf-last-symbol');
  if (savedSymbol) symbolEl.value = savedSymbol;

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function isNum(n) { return n !== null && n !== undefined && Number.isFinite(Number(n)); }
  function fmtNum(n, d) {
    d = d || 2;
    return isNum(n)
      ? Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
      : null;
  }
  function fmtBig(n) {
    if (!isNum(n)) return null;
    n = Number(n);
    var a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + ' T';
    if (a >= 1e9)  return (n / 1e9).toFixed(2) + ' B';
    if (a >= 1e6)  return (n / 1e6).toFixed(2) + ' M';
    if (a >= 1e3)  return (n / 1e3).toFixed(2) + ' K';
    return n.toFixed(2);
  }
  function card(label, value, cls) {
    if (value === null || value === undefined || value === '') { value = '—'; cls = 'muted'; }
    return '<div class="card"><div class="label">' + esc(label) +
      '</div><div class="value ' + (cls || '') + '">' + esc(value) + '</div></div>';
  }
  function getNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && v.raw !== undefined) return getNumber(v.raw);
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function timedFetch(url, ms) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: c.signal })
      .finally(function () { clearTimeout(t); });
  }
  function reason(e) {
    if (e && e.name === 'AbortError') return 'انتهت المهلة';
    if (e && e.name === 'TypeError') return 'CORS أو الشبكة';
    return (e && e.message) || 'خطأ غير معروف';
  }

  function viaWorker(symbol) {
    var base = workerEl.value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
    return timedFetch(base + '/quote?symbol=' + encodeURIComponent(symbol), 12000)
      .catch(function (e) { throw new Error('الـ Worker: ' + reason(e)); })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (body) {
          if (!res.ok || !body || !body.ok) {
            throw new Error('الـ Worker: ' + ((body && body.error) || ('HTTP ' + res.status)));
          }
          return { source: 'Trading View عبر الـ Worker', data: body.data, raw: body };
        });
      });
  }

  function viaProxies(symbol) {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
      encodeURIComponent(symbol) + '?interval=1d&range=5d';
    var problems = [];
    function tryProxy(idx) {
      if (idx >= PROXIES.length) {
        throw new Error('البروكسيات فشلت: ' + problems.join(' · '));
      }
      var p = PROXIES[idx];
      return timedFetch(p.build(url), 8000)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (text) {
          var json = JSON.parse(text);
          var r = json && json.chart && json.chart.result && json.chart.result[0];
          if (!r || !r.meta || !r.meta.symbol) throw new Error('السهم غير موجود');
          var m = r.meta;
          var price = getNumber(m.regularMarketPrice);
          var prev = getNumber(m.chartPreviousClose);
          if (prev == null) prev = getNumber(m.previousClose);
          var change = (price !== null && prev !== null) ? price - prev : null;
          return {
            source: 'بروكسي عام (' + p.name + ') — بدون Float',
            raw: json,
            data: {
              symbol: m.symbol, name: m.shortName || m.longName || m.symbol,
              currency: m.currency || '', exchange: m.fullExchangeName || m.exchangeName || '',
              marketState: m.marketState || null,
              price: price, previousClose: prev, change: change,
              changePct: (change !== null && prev) ? (change / prev) * 100 : null,
              dayHigh: getNumber(m.regularMarketDayHigh),
              dayLow: getNumber(m.regularMarketDayLow),
              volume: getNumber(m.regularMarketVolume),
              avgVolume3M: null, avgVolume10D: null,
              marketCap: null, sharesOutstanding: null, floatShares: null,
              fiftyTwoHigh: getNumber(m.fiftyTwoWeekHigh),
              fiftyTwoLow: getNumber(m.fiftyTwoWeekLow)
            }
          };
        })
        .catch(function (e) {
          problems.push(p.name + ' ← ' + reason(e));
          return tryProxy(idx + 1);
        });
    }
    return tryProxy(0);
  }

  function getStock(symbol) {
    if (workerEl.value.trim()) return viaWorker(symbol);
    return viaProxies(symbol);
  }

  var lastData = null;

  function readyBlock(d) {
    var ffM = isNum(d.floatShares) ? d.floatShares / 1e6 : null;
    var volM = isNum(d.volume) ? d.volume / 1e6 : null;
    var avgM = isNum(d.avgVolume3M) ? d.avgVolume3M / 1e6 : null;
    var mc = isNum(d.marketCap) ? d.marketCap : null;
    var mcTxt = mc === null ? '—' : (mc >= 1e9 ? (mc / 1e9).toFixed(2) + ' B' : (mc / 1e6).toFixed(2) + ' M');
    var rvol = (volM !== null && avgM) ? volM / avgM : null;
    var rot = (volM !== null && ffM) ? volM / ffM : null;

    var verdict = 'اكتب الـ Float يدويًا لأن المصدر ما رجّعوش';
    var cls = 'muted';
    if (ffM !== null) {
      if (ffM <= LOW) { verdict = 'Float خفيف (' + ffM.toFixed(2) + 'M) — صفقة كويسة'; cls = 'good'; }
      else if (ffM <= HIGH) { verdict = 'Float متوسط (' + ffM.toFixed(2) + 'M) — صفقة متوسطة'; cls = 'mid'; }
      else { verdict = 'Float كبير (' + ffM.toFixed(2) + 'M) — صفقة خطر'; cls = 'bad'; }
    }

    var line = 'Market Cap ' + mcTxt + ' | Price ' + (fmtNum(d.price) || '—') +
      ' | Free Float ' + (ffM !== null ? ffM.toFixed(2) + ' M' : '—') +
      ' | Vol ' + (volM !== null ? volM.toFixed(2) + ' M' : '—') +
      ' | Avg Vol ' + (avgM !== null ? avgM.toFixed(2) + ' M' : '—');

    readyEl.innerHTML = '<div class="ready"><h2>جاهز للمحلل</h2>' +
      '<div class="line">' + esc(line) + '</div>' +
      '<div class="line">RVOL ' + (rvol !== null ? rvol.toFixed(2) + 'x' : '—') +
      ' | Float Rot ' + (rot !== null ? rot.toFixed(2) + 'x' : '—') + '</div>' +
      '<div class="verdict ' + cls + '">' + esc(verdict) + '</div></div>';
  }

  function render(d) {
    var up = isNum(d.change) ? d.change >= 0 : null;
    var html = '';
    html += card('Symbol', d.symbol);
    html += card('Name', d.name);
    html += card('Price', isNum(d.price) ? fmtNum(d.price) + ' ' + (d.currency || '') : null, 'good');
    html += card('Change', fmtNum(d.change), up === null ? 'muted' : up ? 'good' : 'bad');
    html += card('Change %', isNum(d.changePct) ? fmtNum(d.changePct) + '%' : null, up === null ? 'muted' : up ? 'good' : 'bad');
    html += card('Previous Close', fmtNum(d.previousClose));
    html += card('Day High', fmtNum(d.dayHigh));
    html += card('Day Low', fmtNum(d.dayLow));
    html += card('Volume', fmtBig(d.volume));
    html += card('Avg Volume (3M)', fmtBig(d.avgVolume3M));
    html += card('Market Cap', fmtBig(d.marketCap));
    html += card('Shares Float', fmtBig(d.floatShares));
    html += card('Shares Outstanding', fmtBig(d.sharesOutstanding));
    html += card('Market State', d.marketState);
    html += card('Exchange', d.exchange);
    html += card('52W High', fmtNum(d.fiftyTwoHigh));
    html += card('52W Low', fmtNum(d.fiftyTwoLow));
    cardsEl.innerHTML = html;
    readyBlock(d);
  }

  function doFetch() {
    var sym = symbolEl.value.trim().toUpperCase();
    if (!sym) { setStatus('اكتب رمز السهم الأول', 'err'); return; }
    lsSet('sf-last-symbol', sym);
    btn.disabled = true;
    setStatus('⏳ بيجيب أحدث البيانات...', '');
    cardsEl.innerHTML = ''; readyEl.innerHTML = ''; rawEl.textContent = '';
    lastData = null;

    getStock(sym)
      .then(function (out) {
        lastData = out.data;
        render(out.data);
        rawEl.textContent = JSON.stringify(out.raw, null, 2);
        setStatus('✅ ' + out.data.symbol + ' — المصدر: ' + out.source, 'ok');
        // Notify app.js that new data is ready
        if (window.appOnStockData) window.appOnStockData(out.data);
      })
      .catch(function (e) {
        setStatus('❌ ' + e.message, 'err');
      })
      .finally(function () { btn.disabled = false; });
  }

  function clearAllData() {
    symbolEl.value = '';
    cardsEl.innerHTML = ''; readyEl.innerHTML = ''; rawEl.textContent = '';
    lsRemove('sf-last-symbol');
    lastData = null;
    setStatus('تم مسح البيانات', '');
  }

  btn.addEventListener('click', doFetch);
  if (clearBtn) clearBtn.addEventListener('click', clearAllData);
  symbolEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') doFetch(); });

  if (addBtn) addBtn.addEventListener('click', function () {
    if (!lastData) { setStatus('ابحث عن سهم الأول', 'err'); return; }
    if (window.analyzerAddSymbol) {
      window.analyzerAddSymbol(lastData);
      setStatus('✅ تمت إضافة ' + lastData.symbol + ' للجدول', 'ok');
    }
  });

  if (symbolEl.value.trim()) doFetch();
  else setStatus('جاهز...', '');
})();