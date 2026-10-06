(function () {
  "use strict";

  /* ============================================================
     HELPERS (localStorage آمن: ممكن يرمي error في الوضع الخاص)
  ============================================================ */
  function lsGet(k){ try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v){ try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k){ try { window.localStorage.removeItem(k); } catch (e) {} }
  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function num(v){ return (v === '' || v == null || isNaN(+v)) ? null : +v; }
  function fmt(n, d){ d = d == null ? 2 : d; return n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }
  function fmtM(v){ return v >= 1000 ? fmt(v / 1000, 2) + 'B' : fmt(v, 2) + 'M'; }



  /* ============================================================
     NYSE CALENDAR (محسوب لأي سنة، مش مكتوب يدوي لسنة واحدة)
  ============================================================ */
  var AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  function utc(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function keyOf(dt) { return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate()); }
  // n-th weekday (wd: 0=Sun..6=Sat) of month m (1-12)
  function nthWeekday(y, m, wd, n) {
    var first = utc(y, m, 1).getUTCDay();
    return 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
  }
  function lastWeekday(y, m, wd) {
    var last = new Date(Date.UTC(y, m, 0));
    return last.getUTCDate() - ((last.getUTCDay() - wd + 7) % 7);
  }
  function easterSunday(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return utc(y, mo, da);
  }
  // لو العطلة سبت تتنقل للجمعة، ولو أحد تتنقل للاثنين
  function observed(y, m, d) {
    var dt = utc(y, m, d), w = dt.getUTCDay();
    if (w === 6) return utc(y, m, d - 1);
    if (w === 0) return utc(y, m, d + 1);
    return dt;
  }

  var YEAR_CACHE = {};
  function marketYear(y) {
    if (YEAR_CACHE[y]) return YEAR_CACHE[y];
    var hol = [], early = [], hk = {}, ek = {};
    function addH(dt, name) { var k = keyOf(dt); hol.push({ k: k, dt: dt, n: name }); hk[k] = 1; }

    var ny = utc(y, 1, 1), nyw = ny.getUTCDay();
    if (nyw === 0) addH(utc(y, 1, 2), "New Year's Day");
    else if (nyw !== 6) addH(ny, "New Year's Day");           // لو 1 يناير سبت، NYSE مبتعوضش
    addH(utc(y, 1, nthWeekday(y, 1, 1, 3)), 'MLK Day');
    addH(utc(y, 2, nthWeekday(y, 2, 1, 3)), "Presidents' Day");
    var es = easterSunday(y);
    addH(utc(es.getUTCFullYear(), es.getUTCMonth() + 1, es.getUTCDate() - 2), 'Good Friday');
    addH(utc(y, 5, lastWeekday(y, 5, 1)), 'Memorial Day');
    if (y >= 2022) addH(observed(y, 6, 19), 'Juneteenth');
    addH(observed(y, 7, 4), 'Independence Day');
    addH(utc(y, 9, nthWeekday(y, 9, 1, 1)), 'Labor Day');
    var tgDay = nthWeekday(y, 11, 4, 4);
    addH(utc(y, 11, tgDay), 'Thanksgiving');
    addH(observed(y, 12, 25), 'Christmas');
    hol.sort(function (a, b) { return a.k < b.k ? -1 : 1; });

    function addE(dt, name) { var k = keyOf(dt); if (!hk[k]) { early.push({ k: k, dt: dt, n: name }); ek[k] = 1; } }
    addE(utc(y, 11, tgDay + 1), 'اليوم بعد Thanksgiving');
    [[12, 24], [7, 3]].forEach(function (md) {
      var dt = utc(y, md[0], md[1]), w = dt.getUTCDay();
      if (w >= 1 && w <= 4) addE(dt, md[0] === 12 ? 'Christmas Eve' : 'قبل Independence Day');
    });
    early.sort(function (a, b) { return a.k < b.k ? -1 : 1; });

    return (YEAR_CACHE[y] = { hol: hol, early: early, hk: hk, ek: ek });
  }

  function nextTradingDay(y, m, d) {
    for (var k = 1; k < 15; k++) {
      var dt = utc(y, m, d + k), w = dt.getUTCDay();
      if (w !== 0 && w !== 6 && !marketYear(dt.getUTCFullYear()).hk[keyOf(dt)]) {
        return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
      }
    }
    return { y: y, m: m, d: d + 1 };
  }

  /* ============================================================
     SESSION CLOCK (New York time, DST-aware)
  ============================================================ */
  function nyParts(date) {
    var f = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, weekday: 'short'
    });
    var parts = {};
    f.formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
    var h = parseInt(parts.hour, 10); if (h === 24) h = 0;
    return { y: +parts.year, m: +parts.month, d: +parts.day, h: h, min: +parts.minute, s: +parts.second, wd: parts.weekday };
  }

  // يحول وقت حائط نيويورك لـ UTC ms مع احترام DST
  function nyWallToUTC(y, mo, d, h, mi, s) {
    var target = Date.UTC(y, mo - 1, d, h, mi, s), guess = target;
    for (var i = 0; i < 4; i++) {
      var p = nyParts(new Date(guess));
      var diff = target - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
      if (diff === 0) break;
      guess += diff;
    }
    return guess;
  }

  function getSessionInfo(nowMs) {
    var p = nyParts(new Date(nowMs));
    var my = marketYear(p.y);
    var dateKey = p.y + '-' + pad(p.m) + '-' + pad(p.d);
    var weekend = (p.wd === 'Sat' || p.wd === 'Sun');
    var holiday = !!my.hk[dateKey];
    var early = !!my.ek[dateKey];
    var trading = !(weekend || holiday);

    var mins = p.h * 60 + p.min;
    var PRE = 4 * 60, OPEN = 9 * 60 + 30;
    var CLOSE = early ? 13 * 60 : 16 * 60;
    var POST_END = early ? 17 * 60 : 20 * 60;   // يوم الإغلاق المبكر الـ After-Hours بتخلص 5 PM

    var today = { y: p.y, m: p.m, d: p.d };
    var nd = null;
    function nextDay() { return nd || (nd = nextTradingDay(p.y, p.m, p.d)); }
    function at(o, h, m) { return nyWallToUTC(o.y, o.m, o.d, h, m, 0); }

    var state, label, next, target, openMs;
    if (!trading) {
      state = 'closed';
      label = holiday ? 'عطلة رسمية · السوق مغلق' : 'نهاية الأسبوع · السوق مغلق';
      next = 'يبدأ Pre-Market'; target = at(nextDay(), 4, 0); openMs = at(nextDay(), 9, 30);
    } else if (mins < PRE) {
      state = 'closed'; label = 'مغلق (قبل الـ Pre-Market)';
      next = 'يبدأ Pre-Market'; target = at(today, 4, 0); openMs = at(today, 9, 30);
    } else if (mins < OPEN) {
      state = 'pre'; label = 'Pre-Market';
      next = 'يفتح السوق'; target = at(today, 9, 30); openMs = target;
    } else if (mins < CLOSE) {
      state = 'open'; label = 'الجلسة الرسمية';
      next = 'يغلق السوق'; target = at(today, Math.floor(CLOSE / 60), CLOSE % 60); openMs = null;
    } else if (mins < POST_END) {
      state = 'post'; label = 'After-Hours';
      next = 'ينتهي After-Hours'; target = at(today, Math.floor(POST_END / 60), POST_END % 60); openMs = at(nextDay(), 9, 30);
    } else {
      state = 'closed'; label = 'مغلق (بعد الـ After-Hours)';
      next = 'يبدأ Pre-Market'; target = at(nextDay(), 4, 0); openMs = at(nextDay(), 9, 30);
    }

    return {
      state: state, label: label, nextEventLabel: next, targetMs: target, openMs: openMs,
      dateKey: dateKey, isEarly: early, ny: p
    };
  }

  function fmtClock(ms) {
    if (ms < 0) ms = 0;
    var tot = Math.floor(ms / 1000);
    var days = Math.floor(tot / 86400);
    var h = Math.floor((tot % 86400) / 3600);
    var m = Math.floor((tot % 3600) / 60);
    var s = tot % 60;
    return (days > 0 ? days + 'd ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  // الوقت بتوقيت جهاز المستخدم (مثلاً القاهرة)
  function localStr(ms) {
    try {
      return new Date(ms).toLocaleString('ar-EG-u-nu-latn', { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      return new Date(ms).toLocaleString();
    }
  }

  /* ============================================================
     NOTIFICATIONS
  ============================================================ */
  var notifEnabled = false;
  var notifiedFor = {};
  var notifBtn = document.getElementById('notifBtn');
  notifBtn.title = 'التنبيه بيشتغل طول ما الصفحة مفتوحة';

  function notifSupported() { try { return 'Notification' in window; } catch (e) { return false; } }

  function updateNotifBtn() {
    notifBtn.classList.remove('on');
    if (!notifSupported()) {
      notifBtn.textContent = '⚠️ التنبيهات غير مدعومة';
      notifBtn.disabled = true;
    } else if (Notification.permission === 'denied') {
      notifBtn.textContent = '🔕 التنبيهات محظورة من المتصفح';
      notifBtn.disabled = true;
    } else if (Notification.permission === 'granted' && notifEnabled) {
      notifBtn.textContent = '🔔 التنبيهات مفعّلة';
      notifBtn.classList.add('on');
    } else {
      notifBtn.textContent = '🔔 فعّل التنبيهات';
    }
  }
  notifBtn.addEventListener('click', function () {
    if (!notifSupported()) return;
    try {
      if (Notification.permission === 'granted') {
        notifEnabled = !notifEnabled;
        updateNotifBtn();
        return;
      }
      var req = Notification.requestPermission(function (p) {   // نسخة Safari القديمة
        notifEnabled = (p === 'granted'); updateNotifBtn();
      });
      if (req && req.then) {
        req.then(function (p) { notifEnabled = (p === 'granted'); updateNotifBtn(); });
      }
    } catch (e) { updateNotifBtn(); }
  });
  updateNotifBtn();

  /* ============================================================
     SESSION UI
  ============================================================ */
  var sessionDot = document.getElementById('sessionDot');
  var sessionName = document.getElementById('sessionName');
  var sessionTime = document.getElementById('sessionTime');
  var sessionLocal = document.getElementById('sessionLocal');
  var countdownEl = document.getElementById('countdown');
  var countdownLabel = document.getElementById('countdownLabel');

  function tickSession() {
    var now = Date.now();
    var info = getSessionInfo(now);
    sessionDot.className = 'session-dot ' + info.state;
    sessionName.textContent = info.label;
    var ny = info.ny;
    sessionTime.textContent = 'نيويورك: ' + pad(ny.h) + ':' + pad(ny.min) + ':' + pad(ny.s) +
      ' · ' + info.dateKey + (info.isEarly ? ' (إغلاق مبكر 1:00 PM)' : '');
    sessionLocal.textContent = info.openMs
      ? 'الافتتاح الرسمي بتوقيتك: ' + localStr(info.openMs)
      : 'الإغلاق بتوقيتك: ' + localStr(info.targetMs);
    countdownLabel.textContent = info.nextEventLabel + ' بعد';
    countdownEl.textContent = fmtClock(info.targetMs - now);

    var msLeft = info.targetMs - now;
    if (notifEnabled && msLeft > 0 && msLeft <= 30 * 60 * 1000 && !notifiedFor[info.targetMs]) {
      notifiedFor[info.targetMs] = true;
      try {
        new Notification('⏰ تنبيه السوق', {
          body: info.nextEventLabel + ' بعد ' + fmtClock(msLeft),
          tag: 'market-' + info.targetMs
        });
      } catch (e) {}
    }
  }
  setInterval(tickSession, 1000);
  tickSession();

  /* ============================================================
     HOLIDAYS LIST (بتتولد للسنة الحالية بتوقيت نيويورك)
  ============================================================ */
  (function renderHolidays() {
    var y = nyParts(new Date(Date.now())).y;
    var my = marketYear(y);
    document.getElementById('holYear').textContent = y;
    var ul = document.getElementById('holidayList');
    function li(dt, name, strong) {
      var el = document.createElement('li');
      var txt = dt.getUTCDate() + ' ' + AR_MONTHS[dt.getUTCMonth()] + ' – ' + name;
      if (strong) { var b = document.createElement('b'); b.textContent = txt; el.appendChild(b); }
      else el.textContent = txt;
      ul.appendChild(el);
    }
    my.hol.forEach(function (h) { li(h.dt, h.n, false); });
    my.early.forEach(function (h) { li(h.dt, 'Early Close (1:00 PM) · ' + h.n, true); });
  })();

  /* ============================================================
     STATE
  ============================================================ */
  var KEY = 'free-float-calc-v4', OLD_KEY = 'free-float-calc-v3';
  var state = {
    low: 20, high: 50,
    rows: [
      { mc: 94.36, mcU: 'B', p: 281.97, ff: 266.64, ffU: 'M', vol: 6.90, avgVol: 5.09 },
      {}
    ]
  };
  (function load() {
    var s = null;
    try { s = JSON.parse(lsGet(KEY) || 'null'); } catch (e) {}
    if (s && Array.isArray(s.rows) && s.rows.length) {
      state.rows = s.rows;
      if (num(s.low) != null) state.low = +s.low;
      if (num(s.high) != null) state.high = +s.high;
      return;
    }
    // ترحيل الصفوف فقط من v3 (الحدود القديمة كانت نسب مئوية مش ملايين أسهم)
    try {
      var o = JSON.parse(lsGet(OLD_KEY) || 'null');
      if (o && Array.isArray(o.rows) && o.rows.length) state.rows = o.rows;
    } catch (e) {}
  })();
  function save() { lsSet(KEY, JSON.stringify(state)); }

  var tbody = document.getElementById('rows');
  var lowEl = document.getElementById('low'), highEl = document.getElementById('high');
  lowEl.value = state.low; highEl.value = state.high;

  function toM(v, unit) { if (v == null) return null; return unit === 'B' ? v * 1000 : v; }
  function limits() {
    var l = num(state.low), h = num(state.high);
    if (l == null) l = 20;
    if (h == null) h = 50;
    return l <= h ? [l, h] : [h, l];
  }

  /* ============================================================
     EVALUATION (v4)
     التوصية الأساسية = حجم Free Float بالمليون سهم (مش النسبة المئوية):
     سهم float 5M و 100% متاح = خفيف جداً، فالنسبة لوحدها كانت بتضلل.
  ============================================================ */
  function evaluate(r) {
    var mc = num(r.mc), p = num(r.p), ffRaw = num(r.ff);
    var vol = num(r.vol), avgVol = num(r.avgVol);
    var mcM = toM(mc, r.mcU || 'M');
    var ffM = toM(ffRaw, r.ffU || 'M');

    var out = {
      total: null, locked: null, pct: null,
      level: 'none', title: '—',
      text: 'اكتب الأرقام عشان تظهر التوصية.',
      extra: '', flags: [], bad: {},
      rvol: null, rvolCls: 'lo', rot: null, rotCls: 'lo'
    };

    var hasInput = [mc, p, ffRaw, vol, avgVol].some(function (v) { return v != null; });
    if (!hasInput) return out;

    function err(k, m) { out.flags.push({ t: 'err', m: m }); if (k) out.bad[k] = 1; }

    // validation (كل حقل بيتعلّم لوحده)
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

    // RVOL
    if (vol != null && vol >= 0) {
      if (avgVol != null && avgVol > 0) {
        out.rvol = vol / avgVol;
        out.rvolCls = out.rvol >= 2 ? 'hi' : (out.rvol >= 1 ? 'mid' : 'lo');
      } else if (avgVol == null) {
        out.flags.push({ t: 'warn', m: 'اكتب Avg Vol عشان RVOL يتحسب' });
      }
    }

    // Float Rotation
    if (vol != null && vol >= 0 && ffM != null && ffM > 0) {
      out.rot = vol / ffM;
      out.rotCls = out.rot >= 1 ? 'hi' : (out.rot >= 0.5 ? 'mid' : 'lo');
    }

    // liquidity
    if (avgVol != null && avgVol >= 0 && avgVol < 0.1) out.flags.push({ t: 'warn', m: 'Avg Vol < 100K · سيولة ضعيفة' });

    // verdict
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
      text = 'Free Float متوسط (' + fmtM(ffM) + ' سهم). محتاج Volume قوي عشان يتحرك، ادخل بحذر مع وقف خسارة.';
    } else {
      lvl = 'bad'; title = 'صفقة خطر';
      text = 'الـ Free Float كبير (' + fmtM(ffM) + ' سهم) والسهم تقيل، الحركة السريعة محتاجة سيولة ضخمة.';
    }

    var extra = [];

    // Float Rotation impact
    if (out.rot != null) {
      if (out.rot >= 1) {
        extra.push('🔥 Float Rotation ≥ 1 — السهم بيتداول بجد النهاردة.');
        if (lvl === 'mid') { lvl = 'good'; title = 'كويسة (Rotation قوي)'; }
      } else if (out.rot >= 0.5) {
        extra.push('⚡ Rotation متوسط — في اهتمام لكن مش كامل.');
      } else {
        extra.push('💤 Rotation ضعيف — السهم مش بيتحرك بجد.');
      }
    }

    // RVOL impact
    if (out.rvol != null) {
      if (out.rvol >= 2) {
        extra.push('📈 RVOL ≥ 2 (' + out.rvol.toFixed(2) + 'x) — حجم استثنائي، دخول مدعوم.');
      } else if (out.rvol >= 1) {
        extra.push('📊 RVOL ' + out.rvol.toFixed(2) + 'x — حجم فوق المتوسط شوية.');
      } else {
        extra.push('📉 RVOL < 1 (' + out.rvol.toFixed(2) + 'x) — الحجم ضعيف، متدخلش.');
        if (lvl === 'good') { lvl = 'mid'; title = 'متوسطة (حجم ضعيف)'; }
      }
    }

    // Contradiction alerts
    if (out.rvol != null && out.rot != null) {
      if (out.rvol >= 2 && out.rot < 0.5) {
        extra.push('⚠️ تناقض: RVOL عالي لكن Rotation ضعيف — الحركة مضاربة مش دخول حقيقي.');
        if (lvl === 'good') { lvl = 'mid'; title = 'متوسطة (تناقض)'; }
      }
      if (out.rvol < 1 && out.rot >= 1) {
        extra.push('⚠️ تناقض: Rotation عالي لكن RVOL ضعيف — الحجم أقل من المتوسط، خد حذر.');
      }
    }

    if (ffM < 5) extra.push('⚠️ float ضيق جداً — تقلب عالي وحركة عنيفة.');
    if (out.pct != null && out.pct < 0.25) extra.push('أقل من 25% من الأسهم متاحة للتداول، يعني نسبة كبيرة مقفولة.');

    out.level = lvl; out.title = title; out.text = text;
    out.extra = extra.join(' ');
    return out;
  }

  /* ============================================================
     BUILD ROW
  ============================================================ */
  function build(i) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="in" data-label="Market Cap"><div class="uc-wrap">' +
        '<input type="number" step="any" inputmode="decimal" data-k="mc" aria-label="Market Cap">' +
        '<select class="uc-select" data-k="mcU" aria-label="Market Cap unit"><option value="M">M</option><option value="B">B</option></select>' +
      '</div></td>' +
      '<td class="in" data-label="Price ($)"><input type="number" step="any" inputmode="decimal" data-k="p" aria-label="Stock Price"></td>' +
      '<td class="calc" data-label="Total Shares (M)" data-o="total"></td>' +
      '<td class="in" data-label="Free Float"><div class="uc-wrap">' +
        '<input type="number" step="any" inputmode="decimal" data-k="ff" aria-label="Free Float">' +
        '<select class="uc-select" data-k="ffU" aria-label="Free Float unit"><option value="M">M</option><option value="B">B</option></select>' +
      '</div></td>' +
      '<td class="calc" data-label="Locked (M)" data-o="locked"></td>' +
      '<td class="calc" data-label="Float %" data-o="pct"></td>' +
      '<td class="in" data-label="Vol (M)"><input type="number" step="any" inputmode="decimal" data-k="vol" aria-label="Volume (M)" placeholder="Vol M"></td>' +
      '<td class="in" data-label="Avg Vol (M)"><input type="number" step="any" inputmode="decimal" data-k="avgVol" aria-label="Avg Volume (M)" placeholder="Avg M"></td>' +
      '<td class="calc" data-label="RVOL" data-o="rvol"></td>' +
      '<td class="calc" data-label="Float Rot." data-o="rot"></td>' +
      '<td class="res" data-label="التوصية" data-o="res"></td>' +
      '<td class="x"><button class="del" type="button" aria-label="حذف">×</button></td>';

    var r = state.rows[i];

    ['mc', 'p', 'ff', 'vol', 'avgVol'].forEach(function (k) {
      var el = tr.querySelector('[data-k="' + k + '"]');
      el.value = r[k] == null ? '' : r[k];
      el.addEventListener('input', function () {
        r[k] = el.value === '' ? null : +el.value;
        refresh(tr, r); summarize(); save();
      });
    });

    ['mcU', 'ffU'].forEach(function (k) {
      var sel = tr.querySelector('[data-k="' + k + '"]');
      sel.value = r[k] || 'M';
      sel.addEventListener('change', function () {
        r[k] = sel.value;
        refresh(tr, r); summarize(); save();
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

  /* ============================================================
     REFRESH ROW
  ============================================================ */
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

    set('res',
      flagsHtml +
      '<span class="pill ' + e.level + '">' + e.title + '</span>' +
      '<div class="rec">' + e.text +
      (e.extra ? '<small>' + e.extra + '</small>' : '') + '</div>');

    tr.dataset.level = e.level;
  }

  /* ============================================================
     SUMMARY (الصف الفاضي مش بيتعد تحذير)
  ============================================================ */
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

  /* ============================================================
     RENDER
  ============================================================ */
  function render() {
    tbody.innerHTML = '';
    state.rows.forEach(function (_, i) { tbody.appendChild(build(i)); });
    summarize();
  }

  /* ============================================================
     LIMITS
  ============================================================ */
  function onLimits() {
    state.low = num(lowEl.value) == null ? 20 : +lowEl.value;
    state.high = num(highEl.value) == null ? 50 : +highEl.value;
    var flip = state.low > state.high;
    lowEl.classList.toggle('invalid', flip);
    highEl.classList.toggle('invalid', flip);
    tbody.querySelectorAll('tr').forEach(function (tr, i) { refresh(tr, state.rows[i]); });
    summarize(); save();
  }
  lowEl.addEventListener('input', onLimits);
  highEl.addEventListener('input', onLimits);

  /* ============================================================
     ACTIONS
  ============================================================ */
  document.getElementById('add').addEventListener('click', function () {
    state.rows.push({}); render(); save();
    var inputs = tbody.querySelectorAll('tr:last-child input');
    if (inputs[0]) inputs[0].focus();
  });
  document.getElementById('reset').addEventListener('click', function () {
    state.rows = [{}]; render(); save();
  });

  render();
})();
