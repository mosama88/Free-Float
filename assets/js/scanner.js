/* ============================================================
   scanner.js — Pro Global Scanner
   - Momentum Score (MOMO)
   - 6-level verdict engine
   - TP1/TP2/SL auto-calc
   - Flash animation on new signals
   - Sound alert for ENTER
============================================================ */
(function () {
  "use strict";

  var tbody = document.getElementById('scannerRows');
  if (!tbody) return;

  /* ============ Elements ============ */
  var scanBtn    = document.getElementById('scannerBtn');
  var stopBtn    = document.getElementById('scannerStop');
  var statusEl   = document.getElementById('scannerStatus');
  var lastUpdate = document.getElementById('scannerLastUpdate');
  var countEl    = document.getElementById('scannerCount');
  var autoEl     = document.getElementById('scannerAuto');
  var soundEl    = document.getElementById('scannerSound');
  var topMovers  = document.getElementById('scannerTopMovers');

  var fPriceMin  = document.getElementById('filterPriceMin');
  var fPriceMax  = document.getElementById('filterPriceMax');
  var fVolumeMin = document.getElementById('filterVolumeMin');
  var fCapMin    = document.getElementById('filterMarketCapMin');
  var fChangeMin = document.getElementById('filterChangeMin');
  var fRvolMin   = document.getElementById('filterRvolMin');
  var fMarket    = document.getElementById('filterMarket');
  var fLimit     = document.getElementById('filterLimit');
  var fVerdict   = document.getElementById('filterVerdict');
  var fSort      = document.getElementById('filterSort');
  var resetBtn   = document.getElementById('scannerReset');

  /* ============ Storage ============ */
  var K_FILTERS = 'scanner-filters-v2';
  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function saveFilters() {
    lsSet(K_FILTERS, JSON.stringify({
      priceMin: fPriceMin.value, priceMax: fPriceMax.value,
      volumeMin: fVolumeMin.value, capMin: fCapMin.value,
      changeMin: fChangeMin.value, rvolMin: fRvolMin.value,
      market: fMarket.value, limit: fLimit.value,
      verdict: fVerdict ? fVerdict.value : '',
      sort: fSort ? fSort.value : 'volume'
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
    } catch (e) {}
  }
  loadFilters();

  [fPriceMin, fPriceMax, fVolumeMin, fCapMin, fChangeMin, fRvolMin, fMarket, fLimit, fVerdict, fSort]
    .forEach(function (el) { if (el) el.addEventListener('change', saveFilters); });

  /* ============ Helpers ============ */
  function isNum(n) { return n !== null && n !== undefined && Number.isFinite(Number(n)); }
  function num(v) { if (v === '' || v == null) return null; var n = Number(v); return Number.isFinite(n) ? n : null; }
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
    if (a >= 1e9)  return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6)  return (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  }
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'scanner-status' + (type ? ' ' + type : '');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* ============ MOMO Score (0-100) ============ */
  function computeMomo(s) {
    var price = num(s.price) || 0;
    var chg   = num(s.changePct) || 0;
    var vol   = num(s.volume) || 0;
    var avg30 = num(s.avgVolume3M) || 0;
    var rvol  = avg30 > 0 ? vol / avg30 : 0;
    var floatS = num(s.floatShares) || 0;
    var w52 = num(s.week52Pos);
    var vwapD = num(s.vwapDiff);

    var score = 50;  // baseline

    // RVOL — أكبر محرك
    if (rvol >= 5) score += 25;
    else if (rvol >= 3) score += 18;
    else if (rvol >= 2) score += 12;
    else if (rvol >= 1.5) score += 6;
    else if (rvol < 1) score -= 10;

    // Change%
    if (chg >= 3 && chg <= 10) score += 15;
    else if (chg > 10 && chg <= 20) score += 10;
    else if (chg > 20 && chg <= 30) score += 5;
    else if (chg > 30) score -= 10;
    else if (chg >= 1 && chg < 3) score += 5;
    else if (chg < 0) score -= 15;

    // Float (أصغر أفضل)
    var ffM = floatS / 1e6;
    if (ffM > 0 && ffM <= 5) score += 15;
    else if (ffM <= 20) score += 10;
    else if (ffM <= 50) score += 5;
    else if (ffM > 200) score -= 10;

    // Week 52 Position — قرب القمة = قوة
    if (w52 != null) {
      if (w52 >= 90) score += 10;
      else if (w52 >= 70) score += 5;
      else if (w52 <= 20) score -= 10;
    }

    // VWAP — فوق = bullish
    if (vwapD != null) {
      if (vwapD > 2) score += 8;
      else if (vwapD > 0) score += 3;
      else if (vwapD < -2) score -= 8;
    }

    // Price filter
    if (price > 0 && price < 1) score -= 20;
    if (price >= 1 && price < 3) score -= 5;

    // فلتر سيولة
    if (vol > 0 && vol < 100000) score -= 15;

    // Clamp
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    return Math.round(score);
  }

  /* ============ Verdict Engine ============ */
  function computeVerdict(s) {
    var price = num(s.price) || 0;
    var chg   = num(s.changePct) || 0;
    var vol   = num(s.volume) || 0;
    var avg30 = num(s.avgVolume3M) || 0;
    var rvol  = avg30 > 0 ? vol / avg30 : 0;
    var momo  = computeMomo(s);
    var floatS = num(s.floatShares) || 0;
    var mc    = num(s.marketCap) || 0;
    var w52 = num(s.week52Pos);

    var type = 'wait';
    var signals = [];
    var risks = [];

    /* ---- Signals ---- */
    if (rvol >= 3)      signals.push('🔥 RVOL ' + rvol.toFixed(1) + 'x');
    else if (rvol >= 2) signals.push('📈 RVOL ' + rvol.toFixed(1) + 'x');
    else if (rvol >= 1.5) signals.push('📊 RVOL فوق المتوسط');

    if (chg >= 5 && chg <= 15) signals.push('✅ صعود صحي ' + chg.toFixed(1) + '%');
    else if (chg > 15 && chg <= 25) signals.push('🚀 صعود قوي ' + chg.toFixed(1) + '%');
    else if (chg >= 2 && chg < 5) signals.push('⬆️ صعود هادئ');

    if (floatS > 0 && floatS < 20e6) signals.push('💎 Float خفيف ' + (floatS/1e6).toFixed(1) + 'M');
    if (w52 != null && w52 >= 85) signals.push('🏔️ عند قمة 52 أسبوع');

    /* ---- Risks ---- */
    if (chg > 30)     risks.push('⚡ صعود مفرط');
    if (chg < -5)     risks.push('📉 هبوط حاد');
    if (rvol > 15)    risks.push('🎰 مضاربة مفرطة');
    if (vol > 0 && vol < 100000) risks.push('💧 سيولة ضعيفة');
    if (price > 0 && price < 1)  risks.push('⚠️ Penny stock');
    if (floatS > 100e6) risks.push('🐘 Float تقيل');
    if (mc > 0 && mc < 10e6) risks.push('🦐 Market Cap صغير');

    /* ---- Decision ---- */
    if (price < 1 || (vol > 0 && vol < 100000)) {
      type = 'danger';
    } else if (chg > 35 || chg < -8 || rvol > 15) {
      type = 'unstable';
    } else if (momo >= 75 && rvol >= 2 && chg >= 3 && chg <= 25) {
      type = 'enter';
    } else if (momo >= 60 && rvol >= 1.5) {
      type = 'watch';
    } else if (momo >= 45) {
      type = 'wait';
    } else {
      type = 'weak';
    }

    /* ---- TP/SL ---- */
    var tp1, tp2, sl;
    if (price > 0) {
      var vol_pct = Math.max(Math.abs(chg) / 100, 0.03);
      tp1 = price * (1 + Math.max(0.05, vol_pct * 1.3));
      tp2 = price * (1 + Math.max(0.10, vol_pct * 2.2));
      sl  = price * (1 - Math.max(0.025, vol_pct * 0.5));
    }

    var labels = {
      enter:    { txt: '🚀 ادخل فورًا',  cls: 'enter' },
      watch:    { txt: '👀 مراقبة',      cls: 'watch' },
      wait:     { txt: '⏸️ انتظر',       cls: 'wait' },
      weak:     { txt: '💤 ضعيف',         cls: 'weak' },
      unstable: { txt: '⚡ غير مستقر',   cls: 'unstable' },
      danger:   { txt: '🛑 خطر',         cls: 'danger' }
    };

    return {
      type: type,
      label: labels[type].txt,
      cls: labels[type].cls,
      momo: momo,
      signals: signals,
      risks: risks,
      tp1: tp1, tp2: tp2, sl: sl,
      rvol: rvol
    };
  }

  /* ============ Build filters for API ============ */
  function buildApiFilters() {
    var filters = [];
    var pMin = num(fPriceMin.value), pMax = num(fPriceMax.value);
    var vMin = num(fVolumeMin.value), cMin = num(fCapMin.value);
    var chgMin = num(fChangeMin.value), rvMin = num(fRvolMin.value);

    if (pMin != null && pMax != null) {
      filters.push({ left: 'close', operation: 'in_range', right: [pMin, pMax] });
    } else if (pMin != null) {
      filters.push({ left: 'close', operation: 'greater', right: pMin });
    } else if (pMax != null) {
      filters.push({ left: 'close', operation: 'less', right: pMax });
    }

    if (vMin != null) filters.push({ left: 'volume', operation: 'greater', right: vMin });
    if (cMin != null) filters.push({ left: 'market_cap_basic', operation: 'greater', right: cMin });
    if (chgMin != null) filters.push({ left: 'change', operation: 'greater', right: chgMin });
    if (rvMin != null) filters.push({ left: 'relative_volume_10d_calc', operation: 'greater', right: rvMin });

    var market = fMarket.value;
    if (market === 'nasdaq') filters.push({ left: 'exchange', operation: 'equal', right: 'NASDAQ' });
    else if (market === 'nyse') filters.push({ left: 'exchange', operation: 'equal', right: 'NYSE' });
    else if (market === 'amex') filters.push({ left: 'exchange', operation: 'equal', right: 'AMEX' });

    filters.push({ left: 'type', operation: 'equal', right: 'stock' });
    return filters;
  }

  function buildSort() {
    var s = fSort ? fSort.value : 'volume';
    var map = {
      volume:   { sortBy: 'volume', sortOrder: 'desc' },
      change:   { sortBy: 'change', sortOrder: 'desc' },
      rvol:     { sortBy: 'relative_volume_10d_calc', sortOrder: 'desc' },
      marketCap:{ sortBy: 'market_cap_basic', sortOrder: 'desc' }
    };
    return map[s] || map.volume;
  }

  /* ============ MOMO Bar ============ */
  function momoBar(score) {
    var cls = score >= 75 ? 'hi' : score >= 55 ? 'mid' : score >= 35 ? 'lo' : 'vlo';
    return '<div class="momo-wrap">' +
      '<span class="momo-val ' + cls + '">' + score + '</span>' +
      '<i class="momo-bar"><em class="' + cls + '" style="width:' + score + '%"></em></i>' +
    '</div>';
  }

  /* ============ Render Row ============ */
  function renderRow(s) {
    var v = computeVerdict(s);
    var chgCls = (num(s.changePct) || 0) >= 0 ? 'up' : 'down';
    var priceStr = isNum(s.price) ? '$' + fmt(s.price, 2) : '—';
    var chgStr = isNum(s.changePct) ? (s.changePct >= 0 ? '+' : '') + fmt(s.changePct, 2) + '%' : '—';
    var volStr = fmtBig(s.volume);
    var relVol = isNum(s.relVol10D) ? fmt(s.relVol10D, 2) + 'x' : '—';
    var rvolStr = v.rvol > 0 ? fmt(v.rvol, 2) + 'x' : '—';
    var mcStr = fmtBig(s.marketCap);
    var floatStr = isNum(s.floatShares) ? fmtBig(s.floatShares) : '—';
    var floatPctStr = isNum(s.floatPct) ? fmt(s.floatPct, 1) + '%' : '—';
    var w52Str = isNum(s.week52Pos) ? fmt(s.week52Pos, 0) + '%' : '—';

    var tpSlHtml = '';
    if (v.tp1 && v.sl && (v.type === 'enter' || v.type === 'watch')) {
      tpSlHtml =
        '<div class="tp-sl">' +
          '<span class="tp">TP1 $' + fmt(v.tp1, 2) + '</span>' +
          '<span class="tp2">TP2 $' + fmt(v.tp2, 2) + '</span>' +
          '<span class="sl">SL $' + fmt(v.sl, 2) + '</span>' +
        '</div>';
    } else if (v.type === 'danger' || v.type === 'unstable') {
      tpSlHtml = '<div class="tp-sl muted">' + esc(v.risks[0] || '—') + '</div>';
    } else {
      tpSlHtml = '<div class="tp-sl muted">—</div>';
    }

    var allNotes = v.signals.concat(v.risks);
    var noteHtml = allNotes.length
      ? '<div class="verdict-notes">' + allNotes.map(esc).join(' · ') + '</div>'
      : '';

    return '<tr data-symbol="' + esc(s.symbol) + '" data-verdict="' + v.type + '" data-momo="' + v.momo + '">' +
      '<td class="sym-col">' +
        '<div class="sym">' + esc(s.symbol) + '</div>' +
        '<div class="sname" title="' + esc(s.name) + '">' + esc(s.name || '') + '</div>' +
      '</td>' +
      '<td class="num">' + priceStr + '</td>' +
      '<td class="num ' + chgCls + '">' + chgStr + '</td>' +
      '<td class="num">' + volStr + '</td>' +
      '<td class="num">' + relVol + '</td>' +
      '<td class="num">' + rvolStr + '</td>' +
      '<td class="num">' + mcStr + '</td>' +
      '<td class="num">' + floatStr + '</td>' +
      '<td class="num">' + floatPctStr + '</td>' +
      '<td class="num">' + w52Str + '</td>' +
      '<td class="momo-cell">' + momoBar(v.momo) + '</td>' +
      '<td class="verdict-cell"><span class="v-pill v-' + v.cls + '">' + esc(v.label) + '</span>' + noteHtml + '</td>' +
      '<td class="tp-sl-cell">' + tpSlHtml + '</td>' +
    '</tr>';
  }

  /* ============ Sound ============ */
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
    } catch (e) {}
  }

  /* ============ Flash animation ============ */
  function flashNewEnters(rows) {
    if (!soundEl || !soundEl.checked) return;
    var prev = JSON.parse(lsGet('scanner-prev-enters', '[]') || '[]');
    var curr = rows.filter(function (s) { return computeVerdict(s).type === 'enter'; })
                   .map(function (s) { return s.symbol; });
    var newOnes = curr.filter(function (sym) { return prev.indexOf(sym) === -1; });
    if (newOnes.length && prev.length) {
      beep();
      setStatus('🚀 إشارة جديدة: ' + newOnes.join(', '), 'ok');
    }
    lsSet('scanner-prev-enters', JSON.stringify(curr));
  }

  /* ============ Top Movers Panel ============ */
  function renderTopMovers(rows) {
    if (!topMovers) return;
    var sorted = rows.slice().sort(function (a, b) {
      return (num(b.changePct) || 0) - (num(a.changePct) || 0);
    });
    var gainers = sorted.slice(0, 5);
    var losers = sorted.slice(-5).reverse();

    function itemHtml(s) {
      var chg = num(s.changePct) || 0;
      var cls = chg >= 0 ? 'up' : 'down';
      return '<div class="mover-item">' +
        '<span class="mover-sym">' + esc(s.symbol) + '</span>' +
        '<span class="mover-chg ' + cls + '">' + (chg >= 0 ? '+' : '') + fmt(chg, 2) + '%</span>' +
      '</div>';
    }

    topMovers.innerHTML =
      '<div class="movers-col">' +
        '<div class="movers-title">🚀 Top Gainers</div>' +
        gainers.map(itemHtml).join('') +
      '</div>' +
      '<div class="movers-col">' +
        '<div class="movers-title">📉 Top Losers</div>' +
        losers.map(itemHtml).join('') +
      '</div>';
  }

  /* ============ Do Scan ============ */
  var scanning = false;
  var autoTimer = null;

  function getWorkerBase() {
    var b = (lsGet('sf-worker', '') || '').trim().replace(/\/+$/, '');
    if (!b) b = 'https://small-disk-18d3stock-proxy.osamaanit.workers.dev';
    if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
    return b;
  }

  function doScan() {
    if (scanning) return;
    scanning = true;
    scanBtn.disabled = true;
    setStatus('⏳ جاري المسح...', 'loading');

    var body = {
      filters: buildApiFilters(),
      sort: buildSort(),
      range: [0, parseInt(fLimit.value, 10) || 50]
    };

    fetch(getWorkerBase() + '/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j.data || [];
      });
    })
    .then(function (results) {
      var vFilter = fVerdict ? fVerdict.value : '';
      var filtered = vFilter
        ? results.filter(function (s) { return computeVerdict(s).type === vFilter; })
        : results;

      // Sort by MOMO descending
      filtered.sort(function (a, b) {
        return computeVerdict(b).momo - computeVerdict(a).momo;
      });

      renderTable(filtered);
      renderTopMovers(results);
      flashNewEnters(results);

      var now = new Date();
      var hh = String(now.getHours()).padStart(2, '0');
      var mm = String(now.getMinutes()).padStart(2, '0');
      var ss = String(now.getSeconds()).padStart(2, '0');
      if (lastUpdate) lastUpdate.textContent = hh + ':' + mm + ':' + ss;
      if (countEl) countEl.textContent = filtered.length + '/' + results.length;
      setStatus('✅ ' + filtered.length + ' من ' + results.length + ' سهم', 'ok');
    })
    .catch(function (e) {
      setStatus('❌ ' + (e.message || 'فشل'), 'err');
    })
    .finally(function () {
      scanning = false;
      scanBtn.disabled = false;
    });
  }

  function renderTable(rows) {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="empty-row">لا توجد نتائج — جرّب تخفيف الفلاتر</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(renderRow).join('');
  }

  /* ============ Auto Refresh ============ */
  function startAuto() {
    stopAuto();
    if (!autoEl || !autoEl.checked) return;
    autoTimer = setInterval(doScan, 5000);
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  if (autoEl) autoEl.addEventListener('change', function () {
    if (autoEl.checked) startAuto(); else stopAuto();
  });

  /* ============ Events ============ */
  scanBtn.addEventListener('click', doScan);
  if (stopBtn) stopBtn.addEventListener('click', function () {
    if (autoEl) autoEl.checked = false;
    stopAuto();
    setStatus('⏸️ متوقف', '');
  });

  [fPriceMin, fPriceMax, fVolumeMin, fCapMin, fChangeMin, fRvolMin, fMarket, fLimit, fVerdict, fSort]
    .forEach(function (el) {
      if (el) el.addEventListener('change', function () { doScan(); });
    });

  if (resetBtn) resetBtn.addEventListener('click', function () {
    fPriceMin.value = '1';
    fPriceMax.value = '100';
    fVolumeMin.value = '500000';
    fCapMin.value = '10000000';
    fChangeMin.value = '3';
    fRvolMin.value = '1.5';
    fMarket.value = 'all';
    fLimit.value = '50';
    if (fVerdict) fVerdict.value = '';
    if (fSort) fSort.value = 'volume';
    saveFilters();
    doScan();
  });

  /* ============ Boot ============ */
  doScan();
  if (autoEl && autoEl.checked) startAuto();

  console.log('[Scanner Pro] ready');
})();