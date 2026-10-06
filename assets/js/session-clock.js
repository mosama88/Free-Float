/* ============================================================
   session-clock.js — NYSE Session + Countdown + Holidays + Notifications
============================================================ */
(function () {
  "use strict";

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                   'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  function utc(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function keyOf(dt) {
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  }
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
    var mo = Math.floor((h + l - 7 * m + 114) / 31);
    var da = ((h + l - 7 * m + 114) % 31) + 1;
    return utc(y, mo, da);
  }
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

    function addH(dt, name) {
      var k = keyOf(dt);
      hol.push({ k: k, dt: dt, n: name });
      hk[k] = 1;
    }

    var ny = utc(y, 1, 1), nyw = ny.getUTCDay();
    if (nyw === 0) addH(utc(y, 1, 2), "New Year's Day");
    else if (nyw !== 6) addH(ny, "New Year's Day");
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

    function addE(dt, name) {
      var k = keyOf(dt);
      if (!hk[k]) { early.push({ k: k, dt: dt, n: name }); ek[k] = 1; }
    }
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
    return {
      y: +parts.year, m: +parts.month, d: +parts.day,
      h: h, min: +parts.minute, s: +parts.second, wd: parts.weekday
    };
  }

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
    var POST_END = early ? 17 * 60 : 20 * 60;

    var today = { y: p.y, m: p.m, d: p.d }, nd = null;
    function nextDay() { return nd || (nd = nextTradingDay(p.y, p.m, p.d)); }
    function at(o, h, m) { return nyWallToUTC(o.y, o.m, o.d, h, m, 0); }

    var state, label, next, target, openMs;

    if (!trading) {
      state = 'closed';
      label = holiday ? 'عطلة رسمية · السوق مغلق' : 'نهاية الأسبوع · السوق مغلق';
      next = 'يبدأ Pre-Market';
      target = at(nextDay(), 4, 0);
      openMs = at(nextDay(), 9, 30);
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
      next = 'ينتهي After-Hours';
      target = at(today, Math.floor(POST_END / 60), POST_END % 60);
      openMs = at(nextDay(), 9, 30);
    } else {
      state = 'closed'; label = 'مغلق (بعد الـ After-Hours)';
      next = 'يبدأ Pre-Market'; target = at(nextDay(), 4, 0); openMs = at(nextDay(), 9, 30);
    }

    return {
      state: state, label: label, nextEventLabel: next,
      targetMs: target, openMs: openMs, dateKey: dateKey,
      isEarly: early, ny: p
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

  function localStr(ms) {
    try {
      return new Date(ms).toLocaleString('ar-EG-u-nu-latn',
        { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { return new Date(ms).toLocaleString(); }
  }

  /* ---------- NOTIFICATIONS ---------- */
  var notifEnabled = false, notifiedFor = {};
  var notifBtn = document.getElementById('notifBtn');

  function notifSupported() {
    try { return 'Notification' in window; } catch (e) { return false; }
  }

  function updateNotifBtn() {
    if (!notifBtn) return;
    notifBtn.classList.remove('on');
    if (!notifSupported()) {
      notifBtn.textContent = '⚠️ التنبيهات غير مدعومة';
      notifBtn.disabled = true;
    } else if (Notification.permission === 'denied') {
      notifBtn.textContent = '🔕 محظورة من المتصفح';
      notifBtn.disabled = true;
    } else if (Notification.permission === 'granted' && notifEnabled) {
      notifBtn.textContent = '🔔 التنبيهات مفعّلة';
      notifBtn.classList.add('on');
    } else {
      notifBtn.textContent = '🔔 فعّل التنبيهات';
    }
  }

  if (notifBtn) {
    notifBtn.addEventListener('click', function () {
      if (!notifSupported()) return;
      try {
        if (Notification.permission === 'granted') {
          notifEnabled = !notifEnabled;
          updateNotifBtn();
          return;
        }
        var req = Notification.requestPermission(function (p) {
          notifEnabled = (p === 'granted');
          updateNotifBtn();
        });
        if (req && req.then) {
          req.then(function (p) { notifEnabled = (p === 'granted'); updateNotifBtn(); });
        }
      } catch (e) { updateNotifBtn(); }
    });
    updateNotifBtn();
  }

  /* ---------- RENDER TICK ---------- */
  var sessionDot = document.getElementById('sessionDot');
  var sessionName = document.getElementById('sessionName');
  var sessionTime = document.getElementById('sessionTime');
  var sessionLocal = document.getElementById('sessionLocal');
  var countdownEl = document.getElementById('countdown');
  var countdownLabel = document.getElementById('countdownLabel');

  function tickSession() {
    var now = Date.now();
    var info = getSessionInfo(now);
    if (sessionDot) sessionDot.className = 'session-dot ' + info.state;
    if (sessionName) sessionName.textContent = info.label;
    var ny = info.ny;
    if (sessionTime) {
      sessionTime.textContent = 'نيويورك: ' + pad(ny.h) + ':' + pad(ny.min) + ':' + pad(ny.s) +
        ' · ' + info.dateKey + (info.isEarly ? ' (إغلاق مبكر 1:00 PM)' : '');
    }
    if (sessionLocal) {
      sessionLocal.textContent = info.openMs
        ? 'الافتتاح الرسمي بتوقيتك: ' + localStr(info.openMs)
        : 'الإغلاق بتوقيتك: ' + localStr(info.targetMs);
    }
    if (countdownLabel) countdownLabel.textContent = info.nextEventLabel + ' بعد';
    if (countdownEl) countdownEl.textContent = fmtClock(info.targetMs - now);

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

  /* ---------- HOLIDAYS LIST ---------- */
  (function renderHolidays() {
    var y = nyParts(new Date(Date.now())).y;
    var my = marketYear(y);
    var el = document.getElementById('holYear');
    if (el) el.textContent = y;
    var ul = document.getElementById('holidayList');
    if (!ul) return;
    function li(dt, name, strong) {
      var it = document.createElement('li');
      var txt = dt.getUTCDate() + ' ' + AR_MONTHS[dt.getUTCMonth()] + ' – ' + name;
      if (strong) { var b = document.createElement('b'); b.textContent = txt; it.appendChild(b); }
      else it.textContent = txt;
      ul.appendChild(it);
    }
    my.hol.forEach(function (h) { li(h.dt, h.n, false); });
    my.early.forEach(function (h) { li(h.dt, 'Early Close (1:00 PM) · ' + h.n, true); });
  })();
})();