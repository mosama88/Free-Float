/* ============================================================
   CLOCKS & MARKET SESSIONS
============================================================ */
const HOL = new Set(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25']);
const EARLY = new Set(['2026-11-27', '2026-12-24']);
const INFO = {
  pre: ['Pre-Market (Pre-Market)', 'قبل الافتتاح الرسمي. سيولة أقل وفرق سعر أوسع، والأخبار بتحرك السهم. استخدم أوامر Limit.'],
  reg: ['Official session (Regular / Intraday)', 'أعلى سيولة وتنفيذ أسرع. دي الجلسة الأنسب للتداول اليومي.'],
  post: ['After Hour (After-Hours)', 'بعد الإغلاق. نتايج الشركات بتنزل غالباً، والسيولة ضعيفة والسعر ممكن يقفز.'],
  closed: ['السوق الأمريكي مقفول', 'عطلة أو فترة بين جلسات (بعد 8 مساءً نيويورك لحد 4 فجراً) أو عطلة نهاية الأسبوع.']
};
const NAMES = { pre: 'Pre-Market', reg: 'Official session', post: 'After Hour' };

function usSegs(now) {
  const p = parts(now, NY), out = [];
  for (let k = -1; k <= 5; k++) {
    const dt = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + k)), y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate(), wd = dt.getUTCDay();
    const key = y + '-' + pad(m) + '-' + pad(d);
    if (wd == 0 || wd == 6 || HOL.has(key)) continue;
    const e = EARLY.has(key), T = (h, mi) => wall(y, m, d, h, mi, NY);
    out.push({ k: 'pre', s: T(4, 0), e: T(9, 30), key }, { k: 'reg', s: T(9, 30), e: T(e ? 13 : 16, 0), key }, { k: 'post', s: T(e ? 13 : 16, 0), e: T(e ? 17 : 20, 0), key });
  }
  return out;
}
function usState(now) {
  const t = +now, segs = usSegs(now), cur = segs.find(s => t >= s.s && t < s.e);
  if (cur) return { k: cur.k, until: cur.e - t, segs, ref: cur.key };
  const nx = segs.find(s => s.s > t);
  return { k: 'closed', until: nx.s - t, segs, ref: nx.key, nk: nx.k };
}

function renderHero(now) {
  const st = usState(now);
  $('hero').className = 'card shadow-sm mb-3 hero-card ' + st.k;
  $('clockC').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: CAI, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  $('dateC').textContent = new Intl.DateTimeFormat('ar-EG', { timeZone: CAI, dateStyle: 'full' }).format(now);
  $('clockN').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: NY, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  $('tzc').textContent = '(' + gmt(now, CAI) + ')';
  $('tzn').textContent = '(' + new Intl.DateTimeFormat('en-US', { timeZone: NY, timeZoneName: 'short' }).format(now).split(' ').pop() + ')';
  $('stName').textContent = INFO[st.k][0];
  $('stDesc').textContent = INFO[st.k][1];
  $('cdLabel').textContent = st.k === 'closed' ? 'بداية ' + NAMES[st.nk] + ' بعد:' : 'الجلسة بتخلص بعد:';
  $('cd').textContent = hms(st.until);
  return st;
}

function renderTl(now, st) {
  const t = +now, p = parts(now, CAI), S = wall(+p.year, +p.month, +p.day, 0, 0, CAI), E = S + 864e5;
  let h = '';
  st.segs.forEach(s => {
    const a = Math.max(s.s, S), b = Math.min(s.e, E);
    if (b > a) h += '<i class="' + s.k + '" style="left:' + ((a - S) / 864e5 * 100) + '%;width:' + ((b - a) / 864e5 * 100) + '%" title="' + NAMES[s.k] + ': ' + range(s.s, s.e, CAI) + '"></i>';
  });
  h += '<b style="left:' + ((t - S) / 864e5 * 100) + '%"></b>';
  $('tl').innerHTML = h;
}

function renderUs(now, st) {
  const g = st.segs.filter(s => s.key === st.ref);
  $('usDay').textContent = '(لتاريخ ' + st.ref + ' بتوقيت نيويورك)';
  $('usRows').innerHTML = g.map(s => {
    const on = +now >= s.s && +now < s.e;
    return '<tr><td><b>' + NAMES[s.k] + '</b></td><td dir="ltr" class="text-start">' + range(s.s, s.e, NY) + '</td><td dir="ltr" class="text-start">' + range(s.s, s.e, CAI) + '</td><td><span class="pill ' + (on ? (s.k === 'reg' ? 'on' : s.k) : '') + '">' + (on ? 'شغالة دلوقتي' : 'مقفولة') + '</span></td></tr>';
  }).join('');
}

const MK = [
  ['🇺🇸', 'نيويورك (NYSE / Nasdaq)', NY, [1, 2, 3, 4, 5], [9, 30], [16, 0], 'US'],
  ['🇬🇧', 'لندن (LSE)', 'Europe/London', [1, 2, 3, 4, 5], [8, 0], [16, 30]],
  ['🇩🇪', 'فرانكفورت (Xetra)', 'Europe/Berlin', [1, 2, 3, 4, 5], [9, 0], [17, 30]],
  ['🇯🇵', 'طوكيو (TSE)', 'Asia/Tokyo', [1, 2, 3, 4, 5], [9, 0], [15, 30]],
  ['🇭🇰', 'هونج كونج (HKEX)', 'Asia/Hong_Kong', [1, 2, 3, 4, 5], [9, 30], [16, 0]],
  ['🇨🇳', 'شنغهاي (SSE)', 'Asia/Shanghai', [1, 2, 3, 4, 5], [9, 30], [15, 0]],
  ['🇸🇦', 'السعودية (تداول)', 'Asia/Riyadh', [0, 1, 2, 3, 4], [10, 0], [15, 0]],
  ['🇪🇬', 'مصر (EGX)', CAI, [0, 1, 2, 3, 4], [10, 0], [14, 30]]
];
const DN = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function renderMk(now, st) {
  $('mkRows').innerHTML = MK.map(m => {
    const [fl, name, tz, days, o, c, us] = m, p = parts(now, tz), y = +p.year, mo = +p.month, d = +p.day;
    const s = wall(y, mo, d, o[0], o[1], tz), e = wall(y, mo, d, c[0], c[1], tz), t = +now, tr = days.includes(WD[p.weekday]);
    const open = us ? st.k === 'reg' : (tr && t >= s && t < e);
    let note = open ? 'مفتوح' : 'مقفول';
    if (!open && !us && tr && t < s) note = 'يفتح بعد ' + hms(s - t).slice(0, 5) + ' س';
    return '<tr><td>' + fl + ' ' + name + '</td><td>' + DN[days[0]] + ' – ' + DN[days[days.length - 1]] + '</td><td dir="ltr" class="text-start">' + range(s, e, CAI) + '</td><td><span class="pill ' + (open ? 'on' : '') + '">' + note + '</span></td></tr>';
  }).join('');
}

function fillEt(now) {
  const p = parts(now, NY);
  document.querySelectorAll('[data-et]').forEach(el => {
    const [a, b] = el.dataset.et.split('-').map(x => x.split(':').map(Number));
    const s = wall(+p.year, +p.month, +p.day, a[0], a[1], NY), e = wall(+p.year, +p.month, +p.day, b[0], b[1], NY);
    el.innerHTML = '<span dir="ltr">' + range(s, e, CAI) + '</span> <span class="text-body-secondary fw-normal">القاهرة</span>';
  });
}

let tickCount = 0;
function tick() {
  const now = new Date(), st = renderHero(now);
  if (tickCount % 20 === 0) { renderTl(now, st); renderUs(now, st); renderMk(now, st); fillEt(now) }
  tickCount++;
}
tick();
setInterval(tick, 1000);