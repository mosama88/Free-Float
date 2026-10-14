/* ============================================================
   TIME ZONE UTILITIES
============================================================ */
function parts(d, tz) {
  const o = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' }).formatToParts(d).forEach(p => o[p.type] = p.value);
  return o;
}
function offset(d, tz) {
  const p = parts(d, tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000;
}
function wall(y, m, d, h, mi, tz) {
  const g = Date.UTC(y, m - 1, d, h, mi);
  let t = g - offset(new Date(g), tz);
  t = g - offset(new Date(t), tz);
  return t;
}
const fmtTime = (ms, tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
const dk = (ms, tz) => { const p = parts(new Date(ms), tz); return p.year + p.month + p.day };
const range = (s, e, tz) => fmtTime(s, tz) + ' – ' + fmtTime(e, tz) + (dk(e - 1, tz) !== dk(s, tz) ? ' (اليوم التالي)' : '');
const hms = ms => { ms = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(ms / 3600)) + ':' + pad(Math.floor(ms % 3600 / 60)) + ':' + pad(ms % 60) };
const gmt = (now, tz) => { const h = offset(now, tz) / 3.6e6; return 'GMT' + (h >= 0 ? '+' : '') + h };