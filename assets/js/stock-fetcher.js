/* ============================================================
   stock-fetcher.js — Fetch single stock via Worker / Proxy
   + Yahoo Fallback (Float + Avg Volume)
   + Auto-Add to analyzer table
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

  /* ---------- helpers ---------- */
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

  /* ---------- SOURCE 1: Worker /quote ---------- */
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
          var data = body.data || {};

          // لو Float ناقص، جرّب /financials على نفس الـ Worker
          if (!isNum(data.floatShares) && /workers\.dev/i.test(base)) {
            return timedFetch(base + '/financials?symbol=' + encodeURIComponent(symbol), 10000)
              .then(function (r2) { return r2.json(); })
              .then(function (b2) {
                if (b2 && b2.ok && b2.data) {
                  if (isNum(b2.data.floatShares)) data.floatShares = b2.data.floatShares;
                  if (!isNum(data.sharesOutstanding) && isNum(b2.data.sharesOutstanding))
                    data.sharesOutstanding = b2.data.sharesOutstanding;
                  if (!isNum(data.marketCap) && isNum(b2.data.marketCap))
                    data.marketCap = b2.data.marketCap;
                  if (!isNum(data.avgVolume3M) && isNum(b2.data.avgVolume3M))
                    data.avgVolume3M = b2.data.avgVolume3M;
                }
                return { source: 'Trading View عبر الـ Worker', data: data, raw: body };
              })
              .catch(function () {
                return { source: 'Trading View عبر الـ Worker', data: data, raw: body };
              });
          }

          return { source: 'Trading View عبر الـ Worker', data: data, raw: body };
        });
      });
  }

  /* ---------- SOURCE 2: Yahoo quoteSummary (Fallback for Float/AvgVol) ---------- */
  function fetchFromYahooSummary(symbol) {
    var yUrl = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' +
      encodeURIComponent(symbol) +
      '?modules=defaultKeyStatistics,summaryDetail,price';

    // جرّب كل البروكسيات بالترتيب
    var problems = [];

    function tryProxy(idx) {
      if (idx >= PROXIES.length) {
        console.warn('[Yahoo Fallback] All proxies failed:', problems.join(' · '));
        return Promise.resolve(null);
      }
      var p = PROXIES[idx];
      return timedFetch(p.build(yUrl), 10000)
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (json) {
          var result = json && json.quoteSummary && json.quoteSummary.result &&
                       json.quoteSummary.result[0];
          if (!result) throw new Error('No result');

          var ks = result.defaultKeyStatistics || {};
          var sd = result.summaryDetail || {};
          var pr = result.price || {};

          return {
            floatShares:      ks.floatShares ? ks.floatShares.raw : null,
            sharesOutstanding: ks.sharesOutstanding ? ks.sharesOutstanding.raw : null,
            avgVolume3M:      sd.averageVolume ? sd.averageVolume.raw : null,
            avgVolume10D:     ks.averageDailyVolume10Day ? ks.averageDailyVolume10Day.raw : null,
            marketCap:        (sd.marketCap ? sd.marketCap.raw : null) ||
                              (pr.marketCap ? pr.marketCap.raw : null)
          };
        })
        .catch(function (e) {
          problems.push(p.name + ' ← ' + reason(e));
          return tryProxy(idx + 1);
        });
    }

    return tryProxy(0);
  }

  /* ---------- SOURCE 3: Yahoo chart (سعر فقط، بدون Float) ---------- */
  function viaProxies(symbol) {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
      encodeURIComponent(symbol) + '?interval=1d&range=5d';
    var problems = [];

    function tryProxy(idx) {
      if (idx >= PROXIES.length) {
        throw new Error('كل المصادر فشلت: ' + problems.join(' · '));
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
              currency: m.currency || '',
              exchange: m.fullExchangeName || m.exchangeName || '',
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

  /* ---------- getStock: يجرّب Worker ثم Yahoo ---------- */
  function getStock(symbol) {
    var useWorker = workerEl.value.trim().length > 0;

    var primary = useWorker
      ? viaWorker(symbol)
      : viaProxies(symbol);

    return primary
      .then(function (out) {
        var d = out.data || {};
        var needFloat = !isNum(d.floatShares);
        var needAvg   = !isNum(d.avgVolume3M);

        // لو ناقص حاجة مهمة، جرّب Yahoo quoteSummary
        if (needFloat || needAvg) {
          return fetchFromYahooSummary(symbol).then(function (fb) {
            if (fb) {
              var added = [];
              if (needFloat && isNum(fb.floatShares)) {
                d.floatShares = fb.floatShares;
                added.push('Float');
              }
              if (!isNum(d.sharesOutstanding) && isNum(fb.sharesOutstanding))
                d.sharesOutstanding = fb.sharesOutstanding;
              if (needAvg && isNum(fb.avgVolume3M)) {
                d.avgVolume3M = fb.avgVolume3M;
                added.push('AvgVol');
              }
              if (!isNum(d.avgVolume10D) && isNum(fb.avgVolume10D))
                d.avgVolume10D = fb.avgVolume10D;
              if (!isNum(d.marketCap) && isNum(fb.marketCap))
                d.marketCap = fb.marketCap;

              if (added.length) {
                out.source += ' + ' + added.join(' + ') + ' من Yahoo';
              }
            }
            return out;
          });
        }
        return out;
      })
      .catch(function (err) {
        // لو الـ Worker فشل، جرّب Yahoo chart كـ last resort
        if (useWorker) {
          return viaProxies(symbol).then(function (out) {
            return fetchFromYahooSummary(symbol).then(function (fb) {
              if (fb) {
                var d = out.data;
                if (isNum(fb.floatShares)) d.floatShares = fb.floatShares;
                if (isNum(fb.sharesOutstanding)) d.sharesOutstanding = fb.sharesOutstanding;
                if (isNum(fb.avgVolume3M)) d.avgVolume3M = fb.avgVolume3M;
                if (isNum(fb.marketCap)) d.marketCap = fb.marketCap;
                out.source += ' + Yahoo';
              }
              return out;
            });
          }).catch(function () {
            throw err;
          });
        }
        throw err;
      });
  }

  var lastData = null;

  /* ---------- Ready Block ---------- */
  function readyBlock(d) {
    var ffM = isNum(d.floatShares) ? d.floatShares / 1e6 : null;
    var volM = isNum(d.volume) ? d.volume / 1e6 : null;
    var avgM = isNum(d.avgVolume3M) ? d.avgVolume3M / 1e6 : null;
    var mc = isNum(d.marketCap) ? d.marketCap : null;
    var mcTxt = mc === null
      ? '—'
      : (mc >= 1e9 ? (mc / 1e9).toFixed(2) + ' B' : (mc / 1e6).toFixed(2) + ' M');
    var rvol = (volM !== null && avgM) ? volM / avgM : null;
    var rot  = (volM !== null && ffM) ? volM / ffM : null;

    var verdict, cls;
    if (ffM === null) {
      verdict = '⚠️ الـ Float مش متاح — اكتبه يدويًا في الجدول تحت';
      cls = 'warn';
    } else if (ffM <= LOW) {
      verdict = 'Float خفيف (' + ffM.toFixed(2) + 'M) — صفقة كويسة';
      cls = 'good';
    } else if (ffM <= HIGH) {
      verdict = 'Float متوسط (' + ffM.toFixed(2) + 'M) — صفقة متوسطة';
      cls = 'mid';
    } else {
      verdict = 'Float كبير (' + ffM.toFixed(2) + 'M) — صفقة خطر';
      cls = 'bad';
    }

    var line = 'Market Cap ' + mcTxt +
      ' | Price ' + (fmtNum(d.price) || '—') +
      ' | Free Float ' + (ffM !== null ? ffM.toFixed(2) + ' M' : '—') +
      ' | Vol ' + (volM !== null ? volM.toFixed(2) + ' M' : '—') +
      ' | Avg Vol ' + (avgM !== null ? avgM.toFixed(2) + ' M' : '—');

    readyEl.innerHTML = '<div class="ready"><h2>جاهز للمحلل</h2>' +
      '<div class="line">' + esc(line) + '</div>' +
      '<div class="line">RVOL ' + (rvol !== null ? rvol.toFixed(2) + 'x' : '—') +
      ' | Float Rot ' + (rot !== null ? rot.toFixed(2) + 'x' : '—') + '</div>' +
      '<div class="verdict ' + cls + '">' + esc(verdict) + '</div></div>';
  }

  /* ---------- Cards ---------- */
  function render(d) {
    var up = isNum(d.change) ? d.change >= 0 : null;
    var html = '';
    html += card('Symbol', d.symbol);
    html += card('Name', d.name);
    html += card('Price', isNum(d.price) ? fmtNum(d.price) + ' ' + (d.currency || '') : null, 'good');
    html += card('Change', fmtNum(d.change), up === null ? 'muted' : up ? 'good' : 'bad');
    html += card('Change %', isNum(d.changePct) ? fmtNum(d.changePct) + '%' : null,
      up === null ? 'muted' : up ? 'good' : 'bad');
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

  /* ---------- helper: رسالة الإضافة ---------- */
  function addResultMessage(sym, res, source) {
    var action = res && res.action;
    var msg;
    if (action === 'updated')           msg = 'تم تحديث الصف في الجدول';
    else if (action === 'filled-empty') msg = 'تم ملء الصف الفاضي';
    else                                msg = 'تمت الإضافة للجدول';
    return '✅ ' + sym + ' — ' + msg + ' — المصدر: ' + source;
  }

  /* ---------- MAIN: doFetch ---------- */
  function doFetch() {
    var sym = symbolEl.value.trim().toUpperCase();
    if (!sym) { setStatus('اكتب رمز السهم الأول', 'err'); return; }
    lsSet('sf-last-symbol', sym);
    btn.disabled = true;
    setStatus('⏳ بيجيب أحدث البيانات...', '');
    cardsEl.innerHTML = '';
    readyEl.innerHTML = '';
    rawEl.textContent = '';
    lastData = null;

    getStock(sym)
      .then(function (out) {
        lastData = out.data;
        render(out.data);
        rawEl.textContent = JSON.stringify(out.raw, null, 2);

        if (window.analyzerAddSymbol) {
          var res = window.analyzerAddSymbol(out.data);
          setStatus(addResultMessage(out.data.symbol, res, out.source), 'ok');
        } else {
          setStatus('✅ ' + out.data.symbol + ' — المصدر: ' + out.source, 'ok');
        }

        if (window.appOnStockData) window.appOnStockData(out.data);
      })
      .catch(function (e) {
        setStatus('❌ ' + e.message, 'err');
      })
      .finally(function () { btn.disabled = false; });
  }

  /* ---------- CLEAR ---------- */
  function clearAllData() {
    symbolEl.value = '';
    cardsEl.innerHTML = '';
    readyEl.innerHTML = '';
    rawEl.textContent = '';
    lsRemove('sf-last-symbol');
    lastData = null;
    setStatus('تم مسح البيانات', '');
  }

  /* ---------- EVENTS ---------- */
  btn.addEventListener('click', doFetch);
  if (clearBtn) clearBtn.addEventListener('click', clearAllData);
  symbolEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') doFetch(); });

  if (addBtn) addBtn.addEventListener('click', function () {
    if (!lastData) { setStatus('ابحث عن سهم الأول', 'err'); return; }
    if (window.analyzerAddSymbol) {
      var res = window.analyzerAddSymbol(lastData);
      setStatus(addResultMessage(lastData.symbol, res, 'تحديث يدوي'), 'ok');
    }
  });

  if (symbolEl.value.trim()) doFetch();
  else setStatus('جاهز...', '');
})();