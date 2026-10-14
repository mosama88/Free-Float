/* ============================================================
   PRO GLOBAL SCANNER (Cents $0.01 to $25)
============================================================ */
(function () {
  "use strict";

  var tbody = document.getElementById('scannerRows');
  if (!tbody) return;

  var scanBtn = document.getElementById('scannerBtn');
  var stopBtn = document.getElementById('scannerStop');
  var statusEl = document.getElementById('scannerStatus');
  var lastUpdate = document.getElementById('scannerLastUpdate');
  var countEl = document.getElementById('scannerCount');
  var autoEl = document.getElementById('scannerAuto');
  var soundEl = document.getElementById('scannerSound');
  var topMovers = document.getElementById('scannerTopMovers');

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
  var resetBtn = document.getElementById('scannerReset');

  var K_FILTERS = 'scanner-filters-v3-penny25';
  var lastScannedRows = [];

  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  function saveFilters() {
    lsSet(K_FILTERS, JSON.stringify({
      priceMin: fPriceMin.value, priceMax: fPriceMax.value,
      volumeMin: fVolumeMin.value, capMin: fCapMin.value,
      changeMin: fChangeMin.value, rvolMin: fRvolMin.value,
      market: fMarket.value, limit: fLimit.value,
      verdict: fVerdict ? fVerdict.value : '',
      sort: fSort ? fSort.value : 'change'
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
    } catch (e) { }
  }
  loadFilters();

  [fPriceMin, fPriceMax, fVolumeMin, fCapMin, fChangeMin, fRvolMin, fMarket, fLimit, fVerdict, fSort]
    .forEach(function (el) { if (el) el.addEventListener('change', saveFilters); });

  // Quick Price Preset Buttons
  document.querySelectorAll('.preset-price').forEach(function (btn) {
    btn.addEventListener('click', function () {
      fPriceMin.value = btn.getAttribute('data-min');
      fPriceMax.value = btn.getAttribute('data-max');
      saveFilters();
      doScan();
    });
  });

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
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
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
    var price = num(s.price) || 0;
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

    return {
      type: type, label: labels[type].txt, cls: labels[type].cls,
      momo: momo, signals: signals, risks: risks,
      tp1: tp1, tp2: tp2, sl: sl, rvol: rvol
    };
  }

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

    if (vMin != null && vMin > 0) filters.push({ left: 'volume', operation: 'greater', right: vMin });
    if (cMin != null && cMin > 0) filters.push({ left: 'market_cap_basic', operation: 'greater', right: cMin });
    if (chgMin != null) filters.push({ left: 'change', operation: 'greater', right: chgMin });
    if (rvMin != null && rvMin > 0) filters.push({ left: 'relative_volume_10d_calc', operation: 'greater', right: rvMin });

    var market = fMarket.value;
    if (market === 'nasdaq') filters.push({ left: 'exchange', operation: 'equal', right: 'NASDAQ' });
    else if (market === 'nyse') filters.push({ left: 'exchange', operation: 'equal', right: 'NYSE' });
    else if (market === 'amex') filters.push({ left: 'exchange', operation: 'equal', right: 'AMEX' });

    filters.push({ left: 'type', operation: 'equal', right: 'stock' });
    return filters;
  }

  function buildSort() {
    var s = fSort ? fSort.value : 'change';
    var map = {
      volume: { sortBy: 'volume', sortOrder: 'desc' },
      change: { sortBy: 'change', sortOrder: 'desc' },
      rvol: { sortBy: 'relative_volume_10d_calc', sortOrder: 'desc' },
      marketCap: { sortBy: 'market_cap_basic', sortOrder: 'desc' }
    };
    return map[s] || map.change;
  }

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
    var prev = JSON.parse(lsGet('scanner-prev-enters', '[]') || '[]');
    var curr = rows.filter(function (s) { return computeVerdict(s).type === 'enter'; })
      .map(function (s) { return s.symbol; });
    var newOnes = curr.filter(function (sym) { return prev.indexOf(sym) === -1; });
    if (newOnes.length && prev.length) {
      beep();
      setStatus('🚀 إشارة دخول جديدة: ' + newOnes.join(', '), 'text-success');
    }
    lsSet('scanner-prev-enters', JSON.stringify(curr));
  }

  function renderTopMovers(rows) {
    if (!topMovers || !rows.length) { if (topMovers) topMovers.innerHTML = ''; return; }
    var sorted = rows.slice().sort(function (a, b) {
      return (num(b.changePct) || 0) - (num(a.changePct) || 0);
    });
    var gainers = sorted.slice(0, 5);
    var highRvol = rows.slice().sort(function (a, b) {
      return computeVerdict(b).momo - computeVerdict(a).momo;
    }).slice(0, 5);

    function itemHtml(s) {
      var chg = num(s.changePct) || 0;
      var cls = chg >= 0 ? 'up' : 'down';
      var p = num(s.price);
      var dec = (p != null && p < 1) ? 4 : 2;
      return '<div class="mover-item" data-symbol="' + esc(s.symbol) + '">' +
        '<div><b class="text-primary">' + esc(s.symbol) + '</b> <small class="text-body-secondary ms-1">$' + fmt(p, dec) + '</small></div>' +
        '<span class="fw-bold ' + cls + '" dir="ltr">' + (chg >= 0 ? '+' : '') + fmt(chg, 2) + '%</span>' +
        '</div>';
    }

    topMovers.innerHTML =
      '<div class="p-2 border rounded bg-body-tertiary">' +
      '<div class="small fw-bold mb-2">🚀 الأعلى صعوداً في الفلتر (Top Gainers)</div>' +
      gainers.map(itemHtml).join('') +
      '</div>' +
      '<div class="p-2 border rounded bg-body-tertiary">' +
      '<div class="small fw-bold mb-2">🔥 الأقوى زخماً (Top MOMO Score)</div>' +
      highRvol.map(itemHtml).join('') +
      '</div>';
  }

  // Select stock from Scanner to Calculator & Cache
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

  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-symbol]');
    if (tr) selectStockFromScanner(tr.getAttribute('data-symbol'));
  });
  if (topMovers) {
    topMovers.addEventListener('click', function (e) {
      var item = e.target.closest('[data-symbol]');
      if (item) selectStockFromScanner(item.getAttribute('data-symbol'));
    });
  }

  var scanning = false;
  var autoTimer = null;

  function getWorkerBase() {
    var apiInput = $('api');
    var b = (apiInput && apiInput.value ? apiInput.value : '').trim().replace(/\/+$/, '');
    if (!b) b = 'https://small-disk-18d3stock-proxy.osamaanit.workers.dev';
    if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
    return b;
  }

  function doScan() {
    if (scanning) return;
    scanning = true;
    scanBtn.disabled = true;
    setStatus('⏳ جاري مسح السوق...', 'text-warning');

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
        lastScannedRows = results;
        var vFilter = fVerdict ? fVerdict.value : '';
        var filtered = vFilter
          ? results.filter(function (s) { return computeVerdict(s).type === vFilter; })
          : results;

        filtered.sort(function (a, b) {
          return computeVerdict(b).momo - computeVerdict(a).momo;
        });

        renderTable(filtered);
        renderTopMovers(results);
        flashNewEnters(results);

        var now = new Date();
        if (lastUpdate) lastUpdate.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
        if (countEl) countEl.textContent = filtered.length + ' / ' + results.length;
        setStatus('✅ تم جلب ' + filtered.length + ' سهم', 'text-success');
      })
      .catch(function (e) {
        setStatus('❌ ' + (e.message || 'فشل الاتصال بالـ Worker'), 'text-danger');
      })
      .finally(function () {
        scanning = false;
        scanBtn.disabled = false;
      });
  }

  function renderTable(rows) {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center py-4 text-body-secondary">لا توجد أسهم مطابقة حالياً — جرّب تقليل شرط الـ RVOL أو التغيّر%</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(renderRow).join('');
  }

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

  scanBtn.addEventListener('click', doScan);
  if (stopBtn) stopBtn.addEventListener('click', function () {
    if (autoEl) autoEl.checked = false;
    stopAuto();
    setStatus('⏸️ متوقف', 'text-body-secondary');
  });

  [fPriceMin, fPriceMax, fVolumeMin, fCapMin, fChangeMin, fRvolMin, fMarket, fLimit, fVerdict, fSort]
    .forEach(function (el) {
      if (el) el.addEventListener('change', function () { doScan(); });
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
    if (fSort) fSort.value = 'change';
    saveFilters();
    doScan();
  });

  doScan();
  if (autoEl && autoEl.checked) startAuto();
})();