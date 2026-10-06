/* ============================================================
   analyzer.js — Free Float Calculator Table
   + Auto-Add + Update + Refresh All + Export CSV
============================================================ */
(function () {
  "use strict";

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function num(v) { return (v === '' || v == null || isNaN(+v)) ? null : +v; }
  function fmt(n, d) {
    d = d == null ? 2 : d;
    return n.toLocaleString('en-US',
      { maximumFractionDigits: d, minimumFractionDigits: d });
  }
  function fmtM(v) { return v >= 1000 ? fmt(v / 1000, 2) + 'B' : fmt(v, 2) + 'M'; }
  function toM(v, unit) { if (v == null) return null; return unit === 'B' ? v * 1000 : v; }

  var KEY = 'free-float-calc-v4';
  var state = { low: 20, high: 50, rows: [{}] };

  (function load() {
    var s = null;
    try { s = JSON.parse(lsGet(KEY) || 'null'); } catch (e) {}
    if (s && Array.isArray(s.rows) && s.rows.length) {
      state.rows = s.rows;
      if (num(s.low) != null) state.low = +s.low;
      if (num(s.high) != null) state.high = +s.high;
    }
  })();

  function save() { lsSet(KEY, JSON.stringify(state)); }

  var tbody = document.getElementById('rows');
  if (!tbody) return;

  var lowEl = document.getElementById('low');
  var highEl = document.getElementById('high');
  lowEl.value = state.low;
  highEl.value = state.high;

  function limits() {
    var l = num(state.low), h = num(state.high);
    if (l == null) l = 20;
    if (h == null) h = 50;
    return l <= h ? [l, h] : [h, l];
  }

  function evaluate(r) {
    var mc = num(r.mc), p = num(r.p), ffRaw = num(r.ff);
    var vol = num(r.vol), avgVol = num(r.avgVol);
    var mcM = toM(mc, r.mcU || 'M');
    var ffM = toM(ffRaw, r.ffU || 'M');

    var out = {
      total: null, locked: null, pct: null, level: 'none', title: '—',
      text: 'اكتب الأرقام عشان تظهر التوصية.', extra: '', flags: [], bad: {},
      rvol: null, rvolCls: 'lo', rot: null, rotCls: 'lo'
    };

    var hasInput = [mc, p, ffRaw, vol, avgVol].some(function (v) { return v != null; });
    if (!hasInput) return out;

    function err(k, m) { out.flags.push({ t: 'err', m: m }); if (k) out.bad[k] = 1; }

    if (p != null && p <= 0) err('p', 'السعر لازم > 0');
    else if (p != null && p < 5) out.flags.push({ t: 'warn', m: 'سعر < $5 (penny stock)' });
    if (mc != null && mc <= 0) err('mc', 'Market Cap لازم > 0');
    if (ffRaw != null && ffRaw <= 0) err('ff', 'Free Float لازم > 0');
    if (vol != null && vol < 0) err('vol', 'Volume مينفعش يكون سالب');
    if (avgVol != null && avgVol < 0) err('avgVol', 'Avg Volume مينفعش يكون سالب');

    if (mcM != null && mcM > 0 && p != null && p > 0) out.total = mcM / p;
    if (out.total != null && ffM != null && ffM > 0) {
      if (ffM > out.total + 1e-6) err('ff', 'Free Float > Total Shares — راجع الأرقام');
      else { out.locked = out.total - ffM; out.pct = ffM / out.total; }
    }

    if (vol != null && vol >= 0) {
      if (avgVol != null && avgVol > 0) {
        out.rvol = vol / avgVol;
        out.rvolCls = out.rvol >= 2 ? 'hi' : (out.rvol >= 1 ? 'mid' : 'lo');
      } else if (avgVol == null) {
        out.flags.push({ t: 'warn', m: 'اكتب Avg Vol عشان RVOL يتحسب' });
      }
    }

    if (vol != null && vol >= 0 && ffM != null && ffM > 0) {
      out.rot = vol / ffM;
      out.rotCls = out.rot >= 1 ? 'hi' : (out.rot >= 0.5 ? 'mid' : 'lo');
    }

    if (avgVol != null && avgVol >= 0 && avgVol < 0.1)
      out.flags.push({ t: 'warn', m: 'Avg Vol < 100K · سيولة ضعيفة' });

    if (out.flags.some(function (f) { return f.t === 'err'; })) {
      out.level = 'warn'; out.title = 'راجع الأرقام';
      out.text = 'فيه خطأ في المدخلات، صححه الأول.';
      return out;
    }
    if (ffM == null) { out.text = 'اكتب الـ Free Float عشان تظهر التوصية.'; return out; }

    var lim = limits(), low = lim[0], high = lim[1];
    var lvl, title, text;

    if (ffM <= low) {
      lvl = 'good'; title = 'صفقة كويسة';
      text = 'الـ Free Float صغير (' + fmtM(ffM) + ' سهم)، فأي طلب حقيقي بيحرك السهم بسرعة.';
    } else if (ffM <= high) {
      lvl = 'mid'; title = 'صفقة متوسطة';
      text = 'Free Float متوسط (' + fmtM(ffM) + ' سهم). محتاج Volume قوي، ادخل بحذر.';
    } else {
      lvl = 'bad'; title = 'صفقة خطر';
      text = 'الـ Free Float كبير (' + fmtM(ffM) + ' سهم) والسهم تقيل، محتاج سيولة ضخمة.';
    }

    var extra = [];

    if (out.rot != null) {
      if (out.rot >= 1) {
        extra.push('🔥 Float Rotation ≥ 1 — السهم بيتداول بجد.');
        if (lvl === 'mid') { lvl = 'good'; title = 'كويسة (Rotation قوي)'; }
      } else if (out.rot >= 0.5) extra.push('⚡ Rotation متوسط — في اهتمام.');
      else extra.push('💤 Rotation ضعيف — السهم مش بيتحرك بجد.');
    }

    if (out.rvol != null) {
      if (out.rvol >= 2) extra.push('📈 RVOL ≥ 2 (' + out.rvol.toFixed(2) + 'x) — حجم استثنائي.');
      else if (out.rvol >= 1) extra.push('📊 RVOL ' + out.rvol.toFixed(2) + 'x — فوق المتوسط شوية.');
      else {
        extra.push('📉 RVOL < 1 (' + out.rvol.toFixed(2) + 'x) — الحجم ضعيف.');
        if (lvl === 'good') { lvl = 'mid'; title = 'متوسطة (حجم ضعيف)'; }
      }
    }

    if (out.rvol != null && out.rot != null) {
      if (out.rvol >= 2 && out.rot < 0.5) {
        extra.push('⚠️ تناقض: RVOL عالي لكن Rotation ضعيف — مضاربة مش دخول حقيقي.');
        if (lvl === 'good') { lvl = 'mid'; title = 'متوسطة (تناقض)'; }
      }
      if (out.rvol < 1 && out.rot >= 1)
        extra.push('⚠️ تناقض: Rotation عالي لكن RVOL ضعيف.');
    }

    if (ffM < 5) extra.push('⚠️ float ضيق جداً — تقلب عالي.');
    if (out.pct != null && out.pct < 0.25)
      extra.push('أقل من 25% من الأسهم متاحة.');

    out.level = lvl; out.title = title; out.text = text;
    out.extra = extra.join(' ');
    return out;
  }

  function build(i) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="in" data-label="Symbol"><input type="text" data-k="symbol" aria-label="Symbol" style="text-align:center;font-weight:700"></td>' +
      '<td class="in" data-label="Market Cap"><div class="uc-wrap">' +
        '<input type="number" step="any" inputmode="decimal" data-k="mc" aria-label="Market Cap">' +
        '<select class="uc-select" data-k="mcU"><option value="M">M</option><option value="B">B</option></select>' +
      '</div></td>' +
      '<td class="in" data-label="Price ($)"><input type="number" step="any" inputmode="decimal" data-k="p" aria-label="Price"></td>' +
      '<td class="calc" data-label="Total Shares (M)" data-o="total"></td>' +
      '<td class="in" data-label="Free Float"><div class="uc-wrap">' +
        '<input type="number" step="any" inputmode="decimal" data-k="ff" aria-label="Free Float">' +
        '<select class="uc-select" data-k="ffU"><option value="M">M</option><option value="B">B</option></select>' +
      '</div></td>' +
      '<td class="calc" data-label="Locked (M)" data-o="locked"></td>' +
      '<td class="calc" data-label="Float %" data-o="pct"></td>' +
      '<td class="in" data-label="Vol (M)"><input type="number" step="any" inputmode="decimal" data-k="vol" aria-label="Vol M" placeholder="Vol M"></td>' +
      '<td class="in" data-label="Avg Vol (M)"><input type="number" step="any" inputmode="decimal" data-k="avgVol" aria-label="Avg Vol M" placeholder="Avg M"></td>' +
      '<td class="calc" data-label="RVOL" data-o="rvol"></td>' +
      '<td class="calc" data-label="Float Rot." data-o="rot"></td>' +
      '<td class="res" data-label="التوصية" data-o="res"></td>' +
      '<td class="x"><button class="del" type="button" aria-label="حذف">×</button></td>';

    var r = state.rows[i];

    ['symbol', 'mc', 'p', 'ff', 'vol', 'avgVol'].forEach(function (k) {
      var el = tr.querySelector('[data-k="' + k + '"]');
      if (!el) return;
      el.value = r[k] == null ? '' : r[k];
      el.addEventListener('input', function () {
        r[k] = el.value === ''
          ? null
          : (k === 'symbol' ? el.value.trim().toUpperCase() : +el.value);
        refresh(tr, r); summarize(); save();
      });
    });

    ['mcU', 'ffU'].forEach(function (k) {
      var sel = tr.querySelector('[data-k="' + k + '"]');
      sel.value = r[k] || 'M';
      sel.addEventListener('change', function () {
        r[k] = sel.value; refresh(tr, r); save();
      });
    });

    tr.querySelector('.del').addEventListener('click', function () {
      state.rows.splice(i, 1);
      if (!state.rows.length) state.rows.push({});
      render(); save();
    });

    refresh(tr, r);
    return tr;
  }

  function refresh(tr, r) {
    var e = evaluate(r);
    function set(o, html, neg) {
      var c = tr.querySelector('[data-o="' + o + '"]');
      if (!c) return;
      c.innerHTML = html;
      if (o === 'locked') c.classList.toggle('neg', neg === true);
    }

    ['mc', 'p', 'ff', 'vol', 'avgVol'].forEach(function (k) {
      var inp = tr.querySelector('[data-k="' + k + '"]');
      if (inp) inp.classList.toggle('invalid', !!e.bad[k]);
    });

    set('total', e.total == null ? '—' : fmt(e.total));
    set('locked', e.locked == null ? '—' : fmt(e.locked), e.locked != null && e.locked < 0);
    set('pct', e.pct == null ? '—' :
      '<div class="pct"><span>' + (e.pct * 100).toFixed(2) + '%</span>' +
      '<i><em style="width:' + Math.min(100, e.pct * 100) + '%"></em></i></div>');

    set('rvol', e.rvol == null ? '—' :
      '<span class="rvol-cell ' + e.rvolCls + '">' + e.rvol.toFixed(2) + 'x</span>');
    set('rot', e.rot == null ? '—' :
      '<span class="rot-cell ' + e.rotCls + '">' + e.rot.toFixed(2) + 'x</span>');

    var flagsHtml = e.flags.map(function (f) {
      return '<span class="flag ' + f.t + '">' + f.m + '</span>';
    }).join('');

    set('res', flagsHtml +
      '<span class="pill ' + e.level + '">' + e.title + '</span>' +
      '<div class="rec">' + e.text +
      (e.extra ? '<small>' + e.extra + '</small>' : '') + '</div>');

    tr.dataset.level = e.level;
  }

  function summarize() {
    var c = { good: 0, mid: 0, bad: 0, warn: 0 };
    tbody.querySelectorAll('tr').forEach(function (tr) {
      var lv = tr.dataset.level;
      if (c[lv] != null) c[lv]++;
    });
    document.getElementById('cGood').textContent = c.good;
    document.getElementById('cMid').textContent = c.mid;
    document.getElementById('cBad').textContent = c.bad;
    document.getElementById('cWarn').textContent = c.warn;
  }

  function render() {
    tbody.innerHTML = '';
    state.rows.forEach(function (_, i) { tbody.appendChild(build(i)); });
    summarize();
  }

  function onLimits() {
    state.low = num(lowEl.value) == null ? 20 : +lowEl.value;
    state.high = num(highEl.value) == null ? 50 : +highEl.value;
    tbody.querySelectorAll('tr').forEach(function (tr, i) { refresh(tr, state.rows[i]); });
    summarize(); save();
  }
  lowEl.addEventListener('input', onLimits);
  highEl.addEventListener('input', onLimits);

  var resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    state.rows = [{}]; render(); save();
  });

  /* ---------- PUBLIC API: add / update ---------- */
  window.analyzerAddSymbol = function (d) {
    var r = {
      symbol: d.symbol,
      mc: d.marketCap != null ? +(d.marketCap / 1e9).toFixed(4) : null,
      mcU: 'B',
      p: d.price != null ? +d.price : null,
      ff: d.floatShares != null ? +(d.floatShares / 1e6).toFixed(2) : null,
      ffU: 'M',
      vol: d.volume != null ? +(d.volume / 1e6).toFixed(2) : null,
      avgVol: d.avgVolume3M != null ? +(d.avgVolume3M / 1e6).toFixed(2) : null
    };

    // 1) لو فيه صف بنفس الرمز → حدّثه
    var sameIdx = state.rows.findIndex(function (x) {
      return x.symbol && x.symbol === r.symbol;
    });
    if (sameIdx >= 0) {
      state.rows[sameIdx] = Object.assign({}, state.rows[sameIdx], r);
      render(); save();
      return { action: 'updated', index: sameIdx };
    }

    // 2) لو فيه صف فاضي تمامًا → استخدمه
    var emptyIdx = state.rows.findIndex(function (x) {
      return !x.symbol && x.mc == null && x.p == null && x.ff == null &&
             x.vol == null && x.avgVol == null;
    });
    if (emptyIdx >= 0) {
      state.rows[emptyIdx] = r;
      render(); save();
      return { action: 'filled-empty', index: emptyIdx };
    }

    // 3) وإلا ضيف صف جديد
    state.rows.push(r);
    render(); save();
    return { action: 'added', index: state.rows.length - 1 };
  };

  /* ---------- PUBLIC API: refresh all (يستخدمها app.js) ---------- */
  window.analyzerGetSymbols = function () {
    return state.rows
      .map(function (r) { return r.symbol; })
      .filter(Boolean);
  };

  /* ---------- EXPORT CSV ---------- */
  var exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', function () {
    var lines = ['Symbol,MarketCap(M),Price,FreeFloat(M),Vol(M),AvgVol(M),RVOL,FloatRot,Verdict'];
    state.rows.forEach(function (r) {
      var e = evaluate(r);
      var mcM = toM(num(r.mc), r.mcU || 'M');
      var ffM = toM(num(r.ff), r.ffU || 'M');
      lines.push([
        r.symbol || '',
        mcM != null ? mcM : '',
        r.p || '',
        ffM != null ? ffM : '',
        r.vol || '',
        r.avgVol || '',
        e.rvol != null ? e.rvol.toFixed(2) : '',
        e.rot != null ? e.rot.toFixed(2) : '',
        e.title || ''
      ].join(','));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'scanner.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  // تأكد إن فيه صف فاضي واحد على الأقل
  (function ensureEmptyRow() {
    if (!state.rows.length) state.rows.push({});
  })();

  render();
})();