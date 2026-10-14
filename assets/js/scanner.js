/* ============================================================
   PRO MULTI-PANEL SCANNER (Momos-style) — $0.01 to $25
   يعتمد على نفس الـ Worker (/scan) ونفس دوال الصفحة: $, calc,
   renderQuoteCard, saveStockToCache
============================================================ */
(function () {
  "use strict";

  var tbody = document.getElementById('scannerRows');
  var panelsEl = document.getElementById('scannerPanels');
  if (!tbody && !panelsEl) return;

  var scanBtn = document.getElementById('scannerBtn');
  var stopBtn = document.getElementById('scannerStop');
  var statusEl = document.getElementById('scannerStatus');
  var lastUpdate = document.getElementById('scannerLastUpdate');
  var countEl = document.getElementById('scannerCount');
  var autoEl = document.getElementById('scannerAuto');
  var soundEl = document.getElementById('scannerSound');

  var fPriceMin = document.getElementById('filterPriceMin');
  var fPriceMax = document.getElementById('filterPriceMax');
  var fVolumeMin = document.getElementById('filterVolumeMin');
  var fCapMin = document.getElementById('filterMarketCapMin');
  var fChangeMin = document.getElementById('filterChangeMin');
  var fRvolMin = document.getElementById('filterRvolMin');
  var fMarket = document.getElementById('filterMarket');
  var fLimit = document.getElementById('filterLimit');
  var fVerdict = document.getElementById('filterVerdict');
  var fSort = document.getElementById('filterSort');
  var fRows = document.getElementById('filterPanelRows');
  var resetBtn = document.getElementById('scannerReset');

  var K_FILTERS = 'scanner-filters-v4-panels';
  var lastScannedRows = [];
  var prevPanelSyms = {};
  var AUTO_MS = 8000;

  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  var allFilterEls = [fPriceMin, fPriceMax, fVolumeMin, fCapMin, fChangeMin, fRvolMin, fMarket, fLimit, fVerdict, fSort, fRows];

  function saveFilters() {
    lsSet(K_FILTERS, JSON.stringify({
      priceMin: fPriceMin.value, priceMax: fPriceMax.value,
      volumeMin: fVolumeMin.value, capMin: fCapMin.value,
      changeMin: fChangeMin.value, rvolMin: fRvolMin.value,
      market: fMarket.value, limit: fLimit.value,
      verdict: fVerdict ? fVerdict.value : '',
      sort: fSort ? fSort.value : 'momo',
      panelRows: fRows ? fRows.value : '8'
    }));
  }

  function loadFilters() {
    try {
      var f = JSON.parse(lsGet(K_FILTERS, 'null'));
      if (!f) return;
      if (f.priceMin != null) fPriceMin.value = f.priceMin;
      if (f.priceMax != null) fPriceMax.value = f.priceMax;
      if (f.volumeMin != null) fVolumeMin.value = f.volumeMin;
      if (f.capMin != null) fCapMin.value = f.capMin;
      if (f.changeMin != null) fChangeMin.value = f.changeMin;
      if (f.rvolMin != null) fRvolMin.value = f.rvolMin;
      if (f.market != null) fMarket.value = f.market;
      if (f.limit != null) fLimit.value = f.limit;
      if (f.verdict != null && fVerdict) fVerdict.value = f.verdict;
      if (f.sort != null && fSort) fSort.value = f.sort;
      if (f.panelRows != null && fRows) fRows.value = f.panelRows;
    } catch (e) { }
  }
  loadFilters();

  // Quick Price Preset Buttons
  document.querySelectorAll('.preset-price').forEach(function (btn) {
    btn.addEventListener('click', function () {
      fPriceMin.value = btn.getAttribute('data-min');
      fPriceMax.value = btn.getAttribute('data-max');
      saveFilters();
      doScan();
    });
  });

  /* ---------------- helpers ---------------- */
  function isNum(n) { return n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)); }
  function num(v) { if (v === '' || v == null) return null; var n = Number(v); return Number.isFinite(n) ? n : null; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(n, d) {
    if (!isNum(n)) return '—';
    d = d == null ? 2 : d;
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtBig(n) {
    if (!isNum(n)) return '—';
    n = Number(n);
    var a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return n.toFixed(0);
  }
  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'fw-semibold ' + (cls || '');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* ============ MOMO Score (Tuned for $0.01 - $25) ============ */
  function computeMomo(s) {
    var chg = num(s.changePct) || 0;
    var vol = num(s.volume) || 0;
    var avg30 = num(s.avgVolume3M) || 0;
    var rvol = avg30 > 0 ? vol / avg30 : (num(s.relVol10D) || 0);
    var floatS = num(s.floatShares) || 0;
    var w52 = num(s.week52Pos);
    var vwapD = num(s.vwapDiff);

    var score = 50;

    if (rvol >= 5) score += 25;
    else if (rvol >= 3) score += 18;
    else if (rvol >= 2) score += 12;
    else if (rvol >= 1.5) score += 6;
    else if (rvol < 1) score -= 10;

    if (chg >= 4 && chg <= 15) score += 15;
    else if (chg > 15 && chg <= 30) score += 12;
    else if (chg > 30 && chg <= 50) score += 5;
    else if (chg > 50) score -= 5;
    else if (chg >= 1 && chg < 4) score += 5;
    else if (chg < 0) score -= 15;

    var ffM = floatS / 1e6;
    if (ffM > 0 && ffM <= 5) score += 15;
    else if (ffM > 0 && ffM <= 20) score += 10;
    else if (ffM > 0 && ffM <= 50) score += 5;
    else if (ffM > 200) score -= 10;

    if (w52 != null) {
      if (w52 >= 85) score += 8;
      else if (w52 >= 65) score += 4;
      else if (w52 <= 15) score -= 6;
    }

    if (vwapD != null) {
      if (vwapD > 2) score += 7;
      else if (vwapD > 0) score += 3;
      else if (vwapD < -2) score -= 7;
    }

    if (vol > 0 && vol < 100000) score -= 15;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /* ============ Verdict Engine ============ */
  function computeVerdict(s) {
    if (s._v) return s._v;
    var price = num(s.price) || 0;
    var chg = num(s.changePct) || 0;
    var vol = num(s.volume) || 0;
    var avg30 = num(s.avgVolume3M) || 0;
    var rvol = avg30 > 0 ? vol / avg30 : (num(s.relVol10D) || 0);
    var momo = computeMomo(s);
    var floatS = num(s.floatShares) || 0;
    var w52 = num(s.week52Pos);

    var type = 'wait';
    var signals = [];
    var risks = [];

    if (rvol >= 3) signals.push('🔥 RVOL ' + rvol.toFixed(1) + 'x');
    else if (rvol >= 2) signals.push('📈 RVOL ' + rvol.toFixed(1) + 'x');
    else if (rvol >= 1.5) signals.push('📊 RVOL نشط');

    if (chg >= 4 && chg <= 20) signals.push('✅ صعود ' + chg.toFixed(1) + '%');
    else if (chg > 20 && chg <= 40) signals.push('🚀 فوران ' + chg.toFixed(1) + '%');

    if (floatS > 0 && floatS <= 15e6) signals.push('💎 Float خفيف ' + (floatS / 1e6).toFixed(1) + 'M');
    if (w52 != null && w52 >= 85) signals.push('🏔️ قمة 52W');

    if (price > 0 && price < 1) risks.push('🪙 سهم سنتات (<$1)');
    if (chg > 45) risks.push('⚡ متضخم جداً');
    if (chg < -5) risks.push('📉 هبوط حاد');
    if (rvol > 20) risks.push('🎰 مضاربة عنيفة');
    if (vol > 0 && vol < 100000) risks.push('💧 سيولة ضعيفة');
    if (floatS > 120e6) risks.push('🐘 Float ثقيل');

    if (vol > 0 && vol < 80000) {
      type = 'danger';
    } else if (chg > 55 || chg < -8) {
      type = 'unstable';
    } else if (momo >= 72 && rvol >= 1.8 && chg >= 3 && chg <= 40) {
      type = 'enter';
    } else if (momo >= 58 && rvol >= 1.3) {
      type = 'watch';
    } else if (momo >= 45) {
      type = 'wait';
    } else {
      type = 'weak';
    }

    var tp1, tp2, sl;
    if (price > 0) {
      var vol_pct = Math.max(Math.abs(chg) / 100, 0.04);
      tp1 = price * (1 + Math.min(0.25, Math.max(0.05, vol_pct * 0.8)));
      tp2 = price * (1 + Math.min(0.45, Math.max(0.10, vol_pct * 1.5)));
      sl = price * (1 - Math.min(0.12, Math.max(0.03, vol_pct * 0.4)));
    }

    var labels = {
      enter: { txt: '🚀 ادخل فوراً', cls: 'enter' },
      watch: { txt: '👀 مراقبة', cls: 'watch' },
      wait: { txt: '⏸️ انتظر', cls: 'wait' },
      weak: { txt: '💤 ضعيف', cls: 'weak' },
      unstable: { txt: '⚡ غير مستقر', cls: 'unstable' },
      danger: { txt: '🛑 خطر', cls: 'danger' }
    };

    s._v = {
      type: type, label: labels[type].txt, cls: labels[type].cls,
      momo: momo, signals: signals, risks: risks,
      tp1: tp1, tp2: tp2, sl: sl, rvol: rvol
    };
    return s._v;
  }

  /* ============ API filters (universes) ============ */
  function baseFilters(opts) {
    opts = opts || {};
    var filters = [];
    var pMin = num(fPriceMin.value), pMax = num(fPriceMax.value);
    var vMin = num(fVolumeMin.value), cMin = num(fCapMin.value);

    if (!opts.noPrice) {
      if (pMin != null && pMax != null) {
        filters.push({ left: 'close', operation: 'in_range', right: [pMin, pMax] });
      } else if (pMin != null) {
        filters.push({ left: 'close', operation: 'greater', right: pMin });
      } else if (pMax != null) {
        filters.push({ left: 'close', operation: 'less', right: pMax });
      }
    }
    if (vMin != null && vMin > 0) filters.push({ left: 'volume', operation: 'greater', right: vMin });
    if (cMin != null && cMin > 0) filters.push({ left: 'market_cap_basic', operation: 'greater', right: cMin });

    var market = fMarket.value;
    if (market === 'nasdaq') filters.push({ left: 'exchange', operation: 'equal', right: 'NASDAQ' });
    else if (market === 'nyse') filters.push({ left: 'exchange', operation: 'equal', right: 'NYSE' });
    else if (market === 'amex') filters.push({ left: 'exchange', operation: 'equal', right: 'AMEX' });

    filters.push({ left: 'type', operation: 'equal', right: 'stock' });
    return filters;
  }

  function largeCapFilters() {
    var filters = [
      { left: 'close', operation: 'greater', right: 0 },
      { left: 'market_cap_basic', operation: 'greater', right: 1e10 },
      { left: 'volume', operation: 'greater', right: 1000000 },
      { left: 'type', operation: 'equal', right: 'stock' }
    ];
    var market = fMarket.value;
    if (market === 'nasdaq') filters.push({ left: 'exchange', operation: 'equal', right: 'NASDAQ' });
    else if (market === 'nyse') filters.push({ left: 'exchange', operation: 'equal', right: 'NYSE' });
    else if (market === 'amex') filters.push({ left: 'exchange', operation: 'equal', right: 'AMEX' });
    return filters;
  }

  /* ============ Panels definition (Momos-style) ============ */
  // cols: price | chg | vol | flt | rvol | mc | w52 | momo | vwap
  function P(s) { return num(s.price) || 0; }
  function C(s) { return num(s.changePct) || 0; }
  function V(s) { return num(s.volume) || 0; }
  function R(s) { return computeVerdict(s).rvol; }
  function M(s) { return computeVerdict(s).momo; }
  function W(s) { var w = num(s.week52Pos); return w == null ? -1 : w; }
  function VW(s) { var w = num(s.vwapDiff); return w == null ? -999 : w; }

  var PANELS = [
    { id: 'gappers', title: 'GAPPERS', color: '#0e7490', cols: ['price', 'vol', 'flt', 'chg'],
      test: function (s) { return C(s) >= 3; }, sort: function (a, b) { return C(b) - C(a); } },
    { id: 'losers', title: 'LOSERS', color: '#be185d', cols: ['price', 'vol', 'flt', 'chg'],
      test: function (s) { return C(s) <= -3; }, sort: function (a, b) { return C(a) - C(b); } },
    { id: 'penny', title: 'PENNY GAPPERS', color: '#7e22ce', cols: ['price', 'vol', 'chg'],
      test: function (s) { return P(s) < 1 && C(s) >= 5; }, sort: function (a, b) { return C(b) - C(a); } },
    { id: 'momox', title: 'MOMO X', color: '#0891b2', cols: ['price', 'vol', 'rvol', 'momo'],
      test: function (s) { return M(s) >= 65; }, sort: function (a, b) { return M(b) - M(a); } },
    { id: 'radar', title: 'RADAR', color: '#1e3a8a', cols: ['price', 'vol', 'rvol', 'flt'],
      test: function (s) { return R(s) >= 2; }, sort: function (a, b) { return R(b) - R(a); } },
    { id: 'trending', title: 'TRENDING', color: '#4338ca', cols: ['price', 'vol', 'rvol', 'chg'],
      test: function (s) { return V(s) > 0; }, sort: function (a, b) { return V(b) - V(a); } },
    { id: 'breakhigh', title: 'BREAKING HIGH + VOLUME', color: '#16a34a', cols: ['price', 'flt', 'vol', 'rvol'],
      test: function (s) { return W(s) >= 90 && R(s) >= 1.5 && C(s) > 0; }, sort: function (a, b) { return R(b) - R(a); } },
    { id: 'newhighs', title: 'NEW HIGHS', color: '#0d9488', cols: ['price', 'vol', 'w52', 'chg'],
      test: function (s) { return W(s) >= 97; }, sort: function (a, b) { return W(b) - W(a) || C(b) - C(a); } },
    { id: 'pop', title: 'POP', color: '#65a30d', cols: ['price', 'flt', 'vol', 'chg'],
      test: function (s) { return C(s) >= 8 && R(s) >= 3; }, sort: function (a, b) { return C(b) - C(a); } },
    { id: 'uptick', title: 'UPTICK', color: '#0369a1', cols: ['price', 'vol', 'vwap', 'chg'],
      test: function (s) { return VW(s) > 0 && C(s) >= 1; }, sort: function (a, b) { return VW(b) - VW(a); } },
    { id: 'topmovers', title: 'TOP MOVERS', color: '#1d4ed8', cols: ['price', 'chg', 'vol', 'rvol'],
      test: function (s) { return V(s) > 0; }, sort: function (a, b) { return Math.abs(C(b)) - Math.abs(C(a)); } },
    { id: 'cheap', title: 'CHEAP STOCKS', color: '#b91c1c', cols: ['price', 'chg', 'vol', 'rvol'],
      test: function (s) { return P(s) > 0 && P(s) < 5 && C(s) > 0; }, sort: function (a, b) { return C(b) - C(a); } },
    { id: 'swing', title: 'SWING IDEAS', color: '#be123c', cols: ['price', 'vol', 'chg', 'w52'],
      test: function (s) { return P(s) >= 3 && C(s) >= -3 && C(s) <= 6 && W(s) >= 50 && R(s) >= 1; }, sort: function (a, b) { return W(b) - W(a); } },
    { id: 'oneto25', title: '1 – 25', color: '#ca8a04', cols: ['price', 'flt', 'vol', 'chg'],
      test: function (s) { return P(s) >= 1 && P(s) <= 25; }, sort: function (a, b) { return V(b) - V(a); } },
    { id: 'entry', title: 'POSSIBLE ENTRY', color: '#ea580c', cols: ['price', 'flt', 'rvol', 'momo'],
      test: function (s) { var t = computeVerdict(s).type; return t === 'enter' || t === 'watch'; }, sort: function (a, b) { return M(b) - M(a); } },
    { id: 'vwap', title: 'VWAP', color: '#4d7c0f', cols: ['price', 'flt', 'vol', 'vwap'],
      test: function (s) { return VW(s) > 0.5; }, sort: function (a, b) { return VW(b) - VW(a); } },
    { id: 'flush', title: 'FLUSH', color: '#9f1239', cols: ['price', 'vol', 'rvol', 'chg'],
      test: function (s) { return C(s) <= -8; }, sort: function (a, b) { return C(a) - C(b); } },
    { id: 'highsplay', title: 'HIGHS IN PLAY', color: '#166534', cols: ['price', 'vol', 'rvol', 'w52'],
      test: function (s) { return W(s) >= 90 && V(s) >= 1e6; }, sort: function (a, b) { return V(b) - V(a); } },
    { id: 'largecaps', title: 'LARGE CAPS', color: '#0f766e', cols: ['price', 'mc', 'vol', 'chg'], big: true,
      test: function (s) { return (num(s.marketCap) || 0) >= 1e10; }, sort: function (a, b) { return (num(b.marketCap) || 0) - (num(a.marketCap) || 0); } }
  ];

  var COLS = {
    price: { h: 'Price', f: function (s) { var p = num(s.price); return isNum(p) ? fmt(p, p < 1 ? 4 : 2) : '—'; } },
    chg: { h: 'Chg%', f: function (s) { var c = num(s.changePct); return isNum(c) ? '<b class="' + (c >= 0 ? 'up' : 'down') + '">' + (c >= 0 ? '+' : '') + fmt(c, 1) + '%</b>' : '—'; } },
    vol: { h: 'Volume', f: function (s) { return fmtBig(s.volume); } },
    flt: { h: 'Float', f: function (s) { return isNum(s.floatShares) ? fmtBig(s.floatShares) : '—'; } },
    rvol: { h: 'RVOL', f: function (s) { var r = R(s); return r > 0 ? fmt(r, 1) + 'x' : '—'; } },
    mc: { h: 'M.Cap', f: function (s) { return fmtBig(s.marketCap); } },
    w52: { h: '52W%', f: function (s) { return isNum(s.week52Pos) ? fmt(s.week52Pos, 0) + '%' : '—'; } },
    momo: { h: 'MOMO', f: function (s) { return '<b>' + M(s) + '</b>'; } },
    vwap: { h: 'VWAP%', f: function (s) { var v = num(s.vwapDiff); return isNum(v) ? '<b class="' + (v >= 0 ? 'up' : 'down') + '">' + (v >= 0 ? '+' : '') + fmt(v, 1) + '%</b>' : '—'; } }
  };

  function renderPanels(rows) {
    if (!panelsEl) return;
    var limit = parseInt(fRows ? fRows.value : '8', 10) || 8;
    var html = PANELS.map(function (p) {
      var list = rows.filter(function (s) { return p.test(s); }).sort(p.sort);
      var total = list.length;
      list = list.slice(0, limit);

      var prev = prevPanelSyms[p.id] || null;
      var syms = list.map(function (s) { return s.symbol; });
      prevPanelSyms[p.id] = syms;

      var head = '<tr><th>Symbol</th>' + p.cols.map(function (c) { return '<th>' + COLS[c].h + '</th>'; }).join('') + '</tr>';
      var body = list.length ? list.map(function (s) {
        var isNew = prev && prev.indexOf(s.symbol) === -1;
        return '<tr data-symbol="' + esc(s.symbol) + '"' + (isNew ? ' class="sc-new"' : '') + '>' +
          '<td class="sy">' + esc(s.symbol) + '</td>' +
          p.cols.map(function (c) { return '<td>' + COLS[c].f(s) + '</td>'; }).join('') + '</tr>';
      }).join('') : '<tr><td colspan="' + (p.cols.length + 1) + '" class="sc-empty">لا توجد نتائج</td></tr>';

      return '<div class="sc-panel" style="--pc:' + p.color + '">' +
        '<div class="sc-ph"><span>' + esc(p.title) + '</span><small>' + total + '</small></div>' +
        '<div class="sc-pb"><table class="sc-pt"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
        '</div>';
    }).join('');
    panelsEl.innerHTML = html;
  }

  /* ============ Main detailed table ============ */
  function momoBar(score) {
    var cls = score >= 72 ? 'hi' : score >= 55 ? 'mid' : score >= 35 ? 'lo' : 'vlo';
    return '<div class="momo-wrap">' +
      '<span class="momo-val ' + cls + '">' + score + '</span>' +
      '<i class="momo-bar"><em class="' + cls + '" style="width:' + score + '%"></em></i>' +
      '</div>';
  }

  function renderRow(s) {
    var v = computeVerdict(s);
    var price = num(s.price);
    var dec = (price != null && price < 1) ? 4 : 2;
    var chg = num(s.changePct);
    var chgCls = (chg || 0) >= 0 ? 'up' : 'down';

    var prevClose = num(s.previousClose || s.prevClose);
    if (prevClose == null && price != null && chg != null) {
      prevClose = price / (1 + (chg / 100));
    }

    var priceStr = isNum(price) ? '$' + fmt(price, dec) : '—';
    var pcStr = isNum(prevClose) ? '$' + fmt(prevClose, dec) : '—';
    var chgStr = isNum(chg) ? (chg >= 0 ? '+' : '') + fmt(chg, 2) + '%' : '—';
    var volStr = fmtBig(s.volume);
    var relVol = isNum(s.relVol10D) ? fmt(s.relVol10D, 2) + 'x' : '—';
    var rvolStr = v.rvol > 0 ? fmt(v.rvol, 2) + 'x' : '—';
    var mcStr = fmtBig(s.marketCap);
    var floatStr = isNum(s.floatShares) ? fmtBig(s.floatShares) + (isNum(s.floatPct) ? ' <small class="text-body-secondary">(' + fmt(s.floatPct, 0) + '%)</small>' : '') : '—';
    var w52Str = isNum(s.week52Pos) ? fmt(s.week52Pos, 0) + '%' : '—';
    var actStr = s.sector || s.industry || '';

    var tpSlHtml = '';
    if (v.tp1 && v.sl && (v.type === 'enter' || v.type === 'watch')) {
      tpSlHtml =
        '<div class="tp-sl">' +
        '<span class="tp">TP1: $' + fmt(v.tp1, dec) + '</span>' +
        '<span class="tp2">TP2: $' + fmt(v.tp2, dec) + '</span>' +
        '<span class="sl">SL: $' + fmt(v.sl, dec) + '</span>' +
        '</div>';
    } else if (v.type === 'danger' || v.type === 'unstable') {
      tpSlHtml = '<div class="tp-sl text-body-secondary">' + esc(v.risks[0] || '—') + '</div>';
    } else {
      tpSlHtml = '<div class="tp-sl text-body-secondary">—</div>';
    }

    var allNotes = v.signals.concat(v.risks);
    var noteHtml = allNotes.length ? '<div class="verdict-notes">' + allNotes.map(esc).join(' · ') + '</div>' : '';

    return '<tr data-symbol="' + esc(s.symbol) + '">' +
      '<td class="sym-col">' +
      '<div class="sym">' + esc(s.symbol) + '</div>' +
      '<div class="sname" title="' + esc(s.name) + '">' + esc(s.name || '') + '</div>' +
      (actStr ? '<span class="badge bg-secondary bg-opacity-25 text-body-secondary" style="font-size:0.65rem">' + esc(actStr) + '</span>' : '') +
      '</td>' +
      '<td class="num fw-bold">' + priceStr + '</td>' +
      '<td class="num fw-bold ' + chgCls + '">' + chgStr + '</td>' +
      '<td class="num text-body-secondary">' + pcStr + '</td>' +
      '<td class="num">' + volStr + '</td>' +
      '<td class="num">' + relVol + '</td>' +
      '<td class="num">' + rvolStr + '</td>' +
      '<td class="num text-warning">' + floatStr + '</td>' +
      '<td class="num">' + mcStr + '</td>' +
      '<td class="num">' + w52Str + '</td>' +
      '<td>' + momoBar(v.momo) + '</td>' +
      '<td><span class="v-pill v-' + v.cls + '">' + esc(v.label) + '</span>' + noteHtml + '</td>' +
      '<td>' + tpSlHtml + '</td>' +
      '</tr>';
  }

  function renderTable(rows) {
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center py-4 text-body-secondary">لا توجد أسهم مطابقة حالياً — جرّب تقليل شرط الـ RVOL أو التغيّر%</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(renderRow).join('');
  }

  function mainSorter() {
    var k = fSort ? fSort.value : 'momo';
    if (k === 'change') return function (a, b) { return C(b) - C(a); };
    if (k === 'volume') return function (a, b) { return V(b) - V(a); };
    if (k === 'rvol') return function (a, b) { return R(b) - R(a); };
    if (k === 'marketCap') return function (a, b) { return (num(b.marketCap) || 0) - (num(a.marketCap) || 0); };
    return function (a, b) { return M(b) - M(a); };
  }

  /* ============ Sound / alerts ============ */
  function beep() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.start();
      o.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.stop(ctx.currentTime + 0.3);
    } catch (e) { }
  }

  function flashNewEnters(rows) {
    if (!soundEl || !soundEl.checked) return;
    var prev = [];
    try { prev = JSON.parse(lsGet('scanner-prev-enters', '[]') || '[]'); } catch (e) { }
    var curr = rows.filter(function (s) { return computeVerdict(s).type === 'enter'; })
      .map(function (s) { return s.symbol; });
    var newOnes = curr.filter(function (sym) { return prev.indexOf(sym) === -1; });
    if (newOnes.length && prev.length) {
      beep();
      setStatus('🚀 إشارة دخول جديدة: ' + newOnes.join(', '), 'text-success');
    }
    lsSet('scanner-prev-enters', JSON.stringify(curr));
  }

  /* ============ Select stock → Calculator ============ */
  function selectStockFromScanner(sym) {
    var row = lastScannedRows.find(function (r) { return r.symbol === sym; });
    $('sym').value = sym;
    if (row) {
      var price = num(row.price);
      var chg = num(row.changePct);
      var pc = num(row.previousClose || row.prevClose);
      if (pc == null && price != null && chg != null) {
        pc = price / (1 + (chg / 100));
      }
      var v = computeVerdict(row);
      var stockData = {
        sym: row.symbol,
        name: row.name || '',
        activity: row.sector || row.industry || 'مدرج في الاسكانر',
        price: price,
        pc: pc,
        chg: chg,
        vol: num(row.volume),
        floatShares: num(row.floatShares),
        floatPct: num(row.floatPct),
        mc: num(row.marketCap),
        bid: null,
        ask: null
      };
      renderQuoteCard(stockData);
      saveStockToCache(stockData);
      if (price > 0) {
        $('buy').value = price;
        if (v.tp1) $('sell').value = Number(v.tp1.toFixed(price < 1 ? 4 : 2));
        calc();
      }
      $('calcSection').scrollIntoView({ behavior: 'smooth' });
      $('get').click();
    } else {
      $('get').click();
      $('calcSection').scrollIntoView({ behavior: 'smooth' });
    }
  }

  function onRowClick(e) {
    var tr = e.target.closest('tr[data-symbol]');
    if (tr) selectStockFromScanner(tr.getAttribute('data-symbol'));
  }
  if (tbody) tbody.addEventListener('click', onRowClick);
  if (panelsEl) panelsEl.addEventListener('click', onRowClick);

  /* ============ Scan ============ */
  var scanning = false;
  var autoTimer = null;

  function getWorkerBase() {
    var apiInput = $('api');
    var b = (apiInput && apiInput.value ? apiInput.value : '').trim().replace(/\/+$/, '');
    if (!b) b = 'https://small-disk-18d3stock-proxy.osamaanit.workers.dev';
    if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
    return b;
  }

  function postScan(base, filters, sortBy, sortOrder, limit) {
    return fetch(base + '/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: filters,
        sort: { sortBy: sortBy, sortOrder: sortOrder },
        range: [0, limit]
      })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j.data || [];
      });
    });
  }

  function doScan() {
    if (scanning) return;
    scanning = true;
    scanBtn.disabled = true;
    setStatus('⏳ جاري مسح السوق...', 'text-warning');

    var base = getWorkerBase();
    var bf = baseFilters();
    var soft = function () { return []; };

    Promise.all([
      postScan(base, bf, 'change', 'desc', 150),                                   // الصاعدون
      postScan(base, bf, 'volume', 'desc', 150).catch(soft),                       // الأعلى سيولة
      postScan(base, bf, 'change', 'asc', 60).catch(soft),                         // الهابطون
      postScan(base, largeCapFilters(), 'market_cap_basic', 'desc', 30).catch(soft) // الشركات الكبرى
    ])
      .then(function (parts) {
        var map = {};
        var all = [];
        parts.forEach(function (arr) {
          arr.forEach(function (s) {
            if (!s || !s.symbol || map[s.symbol]) return;
            map[s.symbol] = true;
            all.push(s);
          });
        });
        lastScannedRows = all;

        // اللوحات
        renderPanels(all);

        // الجدول التفصيلي (يطبّق شروط التغيّر و RVOL والقرار)
        var chgMin = num(fChangeMin.value);
        var rvMin = num(fRvolMin.value);
        var vFilter = fVerdict ? fVerdict.value : '';
        var pMin = num(fPriceMin.value), pMax = num(fPriceMax.value);
        var main = all.filter(function (s) {
          var p = P(s);
          if (pMin != null && p < pMin) return false;
          if (pMax != null && p > pMax) return false;
          if (chgMin != null && C(s) < chgMin) return false;
          if (rvMin != null && rvMin > 0 && R(s) < rvMin) return false;
          if (vFilter && computeVerdict(s).type !== vFilter) return false;
          return true;
        });
        main.sort(mainSorter());
        var lim = parseInt(fLimit.value, 10) || 50;
        var shown = main.slice(0, lim);
        renderTable(shown);
        flashNewEnters(all);

        var now = new Date();
        if (lastUpdate) lastUpdate.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
        if (countEl) countEl.textContent = shown.length + ' / ' + all.length;
        setStatus('✅ تم تحليل ' + all.length + ' سهم', 'text-success');
      })
      .catch(function (e) {
        setStatus('❌ ' + (e.message || 'فشل الاتصال بالـ Worker'), 'text-danger');
      })
      .finally(function () {
        scanning = false;
        scanBtn.disabled = false;
      });
  }

  function startAuto() {
    stopAuto();
    if (!autoEl || !autoEl.checked) return;
    autoTimer = setInterval(doScan, AUTO_MS);
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  if (autoEl) autoEl.addEventListener('change', function () {
    if (autoEl.checked) startAuto(); else stopAuto();
  });

  scanBtn.addEventListener('click', doScan);
  if (stopBtn) stopBtn.addEventListener('click', function () {
    if (autoEl) autoEl.checked = false;
    stopAuto();
    setStatus('⏸️ متوقف', 'text-body-secondary');
  });

  allFilterEls.forEach(function (el) {
    if (!el) return;
    el.addEventListener('change', function () { saveFilters(); doScan(); });
  });

  if (resetBtn) resetBtn.addEventListener('click', function () {
    fPriceMin.value = '0.01';
    fPriceMax.value = '25';
    fVolumeMin.value = '250000';
    fCapMin.value = '0';
    fChangeMin.value = '2';
    fRvolMin.value = '1.2';
    fMarket.value = 'all';
    fLimit.value = '50';
    if (fVerdict) fVerdict.value = '';
    if (fSort) fSort.value = 'momo';
    if (fRows) fRows.value = '8';
    saveFilters();
    doScan();
  });

  doScan();
  if (autoEl && autoEl.checked) startAuto();
})();
