/* ============================================================
   scanner.js — Global TradingView Scanner
   - Server-side filters via Worker /scan
   - Auto-refresh كل 5 ثواني
   - Verdict engine + TP/SL
============================================================ */
(function () {
  "use strict";

  /* ============ Elements ============ */
  var tbody       = document.getElementById('scannerRows');
  if (!tbody) return;

  var scanBtn     = document.getElementById('scannerBtn');
  var stopBtn     = document.getElementById('scannerStop');
  var statusEl    = document.getElementById('scannerStatus');
  var lastUpdate  = document.getElementById('scannerLastUpdate');
  var countEl     = document.getElementById('scannerCount');
  var autoEl      = document.getElementById('scannerAuto');

  var fPriceMin   = document.getElementById('filterPriceMin');
  var fPriceMax   = document.getElementById('filterPriceMax');
  var fVolumeMin  = document.getElementById('filterVolumeMin');
  var fCapMin     = document.getElementById('filterMarketCapMin');
  var fChangeMin  = document.getElementById('filterChangeMin');
  var fRvolMin    = document.getElementById('filterRvolMin');
  var fMarket     = document.getElementById('filterMarket');
  var fLimit      = document.getElementById('filterLimit');
  var fVerdict    = document.getElementById('filterVerdict');
  var fSort       = document.getElementById('filterSort');
  var resetBtn    = document.getElementById('scannerReset');

  /* ============ Storage ============ */
  var K_FILTERS = 'scanner-filters-v1';

  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function saveFilters() {
    var f = {
      priceMin: fPriceMin.value,
      priceMax: fPriceMax.value,
      volumeMin: fVolumeMin.value,
      capMin: fCapMin.value,
      changeMin: fChangeMin.value,
      rvolMin: fRvolMin.value,
      market: fMarket.value,
      limit: fLimit.value,
      verdict: fVerdict ? fVerdict.value : '',
      sort: fSort ? fSort.value : 'volume'
    };
    lsSet(K_FILTERS, JSON.stringify(f));
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
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: d, maximumFractionDigits: d
    });
  }
  function fmtBig(n) {
    if (!isNum(n)) return '—';
    n = Number(n);
    var a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + ' T';
    if (a >= 1e9)  return (n / 1e9).toFixed(2) + ' B';
    if (a >= 1e6)  return (n / 1e6).toFixed(2) + ' M';
    if (a >= 1e3)  return (n / 1e3).toFixed(2) + ' K';
    return n.toFixed(2);
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

  /* ============ Verdict Engine ============ */
  function computeVerdict(s) {
    var price    = num(s.price) || 0;
    var chg      = num(s.changePct) || 0;
    var vol      = num(s.volume) || 0;
    var avg30    = num(s.avgVolume3M) || 0;
    var rvol     = avg30 > 0 ? vol / avg30 : 0;
    var floatS   = num(s.floatShares) || 0;
    var mc       = num(s.marketCap) || 0;

    var score = 0;
    var signals = [];
    var risks = [];
    var type = 'wait';

    /* ---------- إشارات إيجابية ---------- */
    if (rvol >= 3)      { score += 3; signals.push('🔥 حجم استثنائي'); }
    else if (rvol >= 2) { score += 2; signals.push('📈 حجم عالي'); }
    else if (rvol >= 1.5) { score += 1; signals.push('📊 حجم فوق المتوسط'); }

    if (chg >= 5 && chg <= 15) { score += 2; signals.push('✅ صعود صحي'); }
    else if (chg > 15 && chg <= 25) { score += 1; signals.push('🚀 صعود قوي'); }
    else if (chg >= 2 && chg < 5)  { score += 1; signals.push('⬆️ صعود هادئ'); }

    if (floatS > 0 && floatS < 20e6)      { score += 2; signals.push('💎 Float خفيف'); }
    else if (floatS > 0 && floatS < 50e6) { score += 1; signals.push('🔷 Float متوسط'); }

    if (price >= 2 && price <= 20) { score += 1; signals.push('💵 سعر مناسب'); }

    /* ---------- مخاطر → ترفع المستوى ---------- */
    if (chg > 25)   { risks.push('⚡ صعود مفرط'); type = 'unstable'; }
    if (chg < -5)   { risks.push('📉 هبوط حاد'); type = 'unstable'; }
    if (rvol > 10)  { risks.push('🎰 حجم مضاربة مفرطة'); if (type !== 'danger') type = 'unstable'; }
    if (vol > 0 && vol < 100000) { risks.push('💧 سيولة ضعيفة'); type = 'danger'; }
    if (price > 0 && price < 1)  { risks.push('⚠️ Penny stock'); type = 'danger'; }
    if (floatS > 100e6) risks.push('🐘 Float تقيل');
    if (mc > 0 && mc < 10e6) risks.push('🦐 Market Cap صغير جدًا');

    /* ---------- القرار النهائي ---------- */
    if (type !== 'danger' && type !== 'unstable') {
      if (score >= 6) type = 'enter';
      else if (score >= 3) type = 'watch';
      else type = 'wait';
    }

    /* ---------- TP / SL ---------- */
    var vol_pct = Math.max(Math.abs(chg) / 100, 0.03);
    var tp1, tp2, sl;
    if (price > 0) {
      tp1 = price * (1 + Math.max(0.06, vol_pct * 1.2));
      tp2 = price * (1 + Math.max(0.12, vol_pct * 2.0));
      sl  = price * (1 - Math.max(0.03, vol_pct * 0.5));
    }

    var labels = {
      enter:    { txt: '🚀 ادخل فورًا',  cls: 'enter' },
      watch:    { txt: '👀 مراقبة',      cls: 'watch' },
      wait:     { txt: '⏸️ انتظر',       cls: 'wait' },
      unstable: { txt: '⚡ غير مستقر',   cls: 'unstable' },
      danger:   { txt: '🛑 خطر',         cls: 'danger' }
    };

    return {
      type: type,
      label: labels[type].txt,
      cls: labels[type].cls,
      score: score,
      signals: signals,
      risks: risks,
      tp1: tp1, tp2: tp2, sl: sl,
      rvol: rvol
    };
  }

  /* ============ Build filters for API ============ */
  function buildApiFilters() {
    var filters = [];
    var pMin = num(fPriceMin.value);
    var pMax = num(fPriceMax.value);
    var vMin = num(fVolumeMin.value);
    var cMin = num(fCapMin.value);
    var chgMin = num(fChangeMin.value);
    var rvMin = num(fRvolMin.value);

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

    // فلتر السوق
    var market = fMarket.value;
    if (market === 'nasdaq') {
      filters.push({ left: 'exchange', operation: 'equal', right: 'NASDAQ' });
    } else if (market === 'nyse') {
      filters.push({ left: 'exchange', operation: 'equal', right: 'NYSE' });
    } else if (market === 'amex') {
      filters.push({ left: 'exchange', operation: 'equal', right: 'AMEX' });
    }

    // استثناء السندات والعملات
    filters.push({ left: 'type', operation: 'equal', right: 'stock' });

    return filters;
  }

  /* ============ Build sort ============ */
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

  /* ============ Render row ============ */
  function renderRow(s) {
    var v = computeVerdict(s);
    var chgCls = (num(s.changePct) || 0) >= 0 ? 'up' : 'down';
    var market = s.exchange || '—';
    var priceStr = isNum(s.price) ? '$' + fmt(s.price, 2) : '—';
    var chgStr = isNum(s.changePct) ? (s.changePct >= 0 ? '+' : '') + fmt(s.changePct, 2) + '%' : '—';
    var volStr = fmtBig(s.volume);
    var relVol = isNum(s.relVol10D) ? fmt(s.relVol10D, 2) + 'x' : '—';
    var rvolStr = v.rvol > 0 ? fmt(v.rvol, 2) + 'x' : '—';
    var mcStr = fmtBig(s.marketCap);
    var floatStr = isNum(s.floatShares) ? fmtBig(s.floatShares) : '—';

    var tpSlHtml = '';
    if (v.tp1 && v.sl && (v.type === 'enter' || v.type === 'watch')) {
      tpSlHtml =
        '<div class="tp-sl">' +
          '<span class="tp">TP1 $' + fmt(v.tp1, 2) + '</span>' +
          '<span class="tp2">TP2 $' + fmt(v.tp2, 2) + '</span>' +
          '<span class="sl">SL $' + fmt(v.sl, 2) + '</span>' +
        '</div>';
    } else if (v.type === 'danger' || v.type === 'unstable') {
      tpSlHtml = '<div class="tp-sl muted">' + (v.risks[0] || '—') + '</div>';
    } else {
      tpSlHtml = '<div class="tp-sl muted">—</div>';
    }

    var allNotes = v.signals.concat(v.risks);
    var noteHtml = allNotes.length
      ? '<div class="verdict-notes">' + allNotes.map(esc).join(' · ') + '</div>'
      : '';

    return '<tr data-symbol="' + esc(s.symbol) + '" data-verdict="' + v.type + '">' +
      '<td class="sym-col">' +
        '<div class="sym">' + esc(s.symbol) + '</div>' +
        '<div class="sname" title="' + esc(s.name) + '">' + esc(s.name || '') + '</div>' +
      '</td>' +
      '<td class="mkt-col"><span class="mkt">' + esc(market) + '</span></td>' +
      '<td class="num">' + priceStr + '</td>' +
      '<td class="num ' + chgCls + '">' + chgStr + '</td>' +
      '<td class="num">' + volStr + '</td>' +
      '<td class="num">' + relVol + '</td>' +
      '<td class="num">' + mcStr + '</td>' +
      '<td class="num">' + floatStr + '</td>' +
      '<td class="num">' + rvolStr + '</td>' +
      '<td class="verdict-cell"><span class="v-pill v-' + v.cls + '">' + esc(v.label) + '</span>' + noteHtml + '</td>' +
      '<td class="tp-sl-cell">' + tpSlHtml + '</td>' +
    '</tr>';
  }

  /* ============ Do Scan ============ */
  var scanning = false;
  var autoTimer = null;
  var currentResults = [];

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

    var base = getWorkerBase();
    var filters = buildApiFilters();
    var sort = buildSort();
    var limit = parseInt(fLimit.value, 10) || 50;

    var body = {
      filters: filters,
      sort: sort,
      range: [0, limit]
    };

    fetch(base + '/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j || !j.ok) {
          throw new Error((j && j.error) || ('HTTP ' + r.status));
        }
        return j.data || [];
      });
    })
    .then(function (results) {
      currentResults = results;

      // client-side verdict filter
      var vFilter = fVerdict ? fVerdict.value : '';
      var filtered = results;
      if (vFilter) {
        filtered = results.filter(function (s) {
          return computeVerdict(s).type === vFilter;
        });
      }

      renderTable(filtered);

      var now = new Date();
      var hh = String(now.getHours()).padStart(2, '0');
      var mm = String(now.getMinutes()).padStart(2, '0');
      var ss = String(now.getSeconds()).padStart(2, '0');
      if (lastUpdate) lastUpdate.textContent = hh + ':' + mm + ':' + ss;
      if (countEl) countEl.textContent = filtered.length + ' نتيجة';
      setStatus('✅ ' + filtered.length + ' من ' + results.length + ' سهم', 'ok');
    })
    .catch(function (e) {
      setStatus('❌ ' + (e.message || 'فشل المسح'), 'err');
    })
    .finally(function () {
      scanning = false;
      scanBtn.disabled = false;
    });
  }

  /* ============ Render Table ============ */
  function renderTable(rows) {
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="11" class="empty-row">' +
        'لا توجد نتائج مطابقة — جرّب تخفيف الفلاتر' +
        '</td></tr>';
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

  if (autoEl) {
    autoEl.addEventListener('change', function () {
      if (autoEl.checked) startAuto();
      else stopAuto();
    });
  }

  /* ============ Events ============ */
  scanBtn.addEventListener('click', doScan);
  if (stopBtn) stopBtn.addEventListener('click', function () {
    if (autoEl) autoEl.checked = false;
    stopAuto();
    setStatus('⏸️ التحديث التلقائي متوقف', '');
  });

  // تغيير أي فلتر → يعيد المسح تلقائي
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

  console.log('[Scanner] ready');
})();