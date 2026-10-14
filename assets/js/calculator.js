/* ============================================================
   PROFIT CALCULATOR & STOCK CACHE
============================================================ */
const CACHE_SYM_KEY = 'mh_cached_symbol';
const CACHE_QUOTE_KEY = 'mh_cached_quote_data';

const numVal = id => parseFloat($(id).value);
const fNum = (x, d = 2) => isFinite(x) ? Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fBig = n => {
  if (!isFinite(n) || n === null) return '—';
  n = Number(n);
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString('en-US');
};
const sg = (x, d = 2) => (x > 0 ? '+' : '') + fNum(x, d);

function calc() {
  const msg = $('msg'), res = $('res'), sc = $('scen');
  msg.textContent = ''; res.innerHTML = ''; sc.hidden = true;
  
  // تم إلغاء قراءة frac لأننا سنجبر العدد على أن يكون صحيحاً
  const p = numVal('buy'), s = numVal('sell'), fb = numVal('fbf') || 0, pb = numVal('fbp') || 0, fs = numVal('fsf') || 0, ps = numVal('fsp') || 0;
  
  if (!(p > 0)) { msg.textContent = 'اكتب سعر الشراء أو اضغط على سهم من الاسكانر.'; return }
  
  // حساب عدد الأسهم
  let sh = $('mode').value === 'budget' ? (numVal('budget') - fb) / (p * (1 + pb / 100)) : numVal('shares');
  if (!isFinite(sh)) sh = 0;
  
  // إجبار العدد على أن يكون صحيحاً دائماً
  sh = Math.floor(sh);
  
  if (!(sh > 0)) { msg.textContent = 'المبلغ غير كافٍ لشراء سهم واحد بعد العمولة.'; return }
  
  const val = sh * p, cb = fb + val * pb / 100, inn = val + cb;
  const out = (sp) => { const rev = sh * sp, cs = fs + rev * ps / 100, net = rev - cs - inn; return { rev, cs, net, pct: net / inn * 100 } };
  const be = (inn + fs) / (sh * (1 - ps / 100));
  const dec = p < 1 ? 4 : 2;

  // تعديل دالة box لتقبل كلاس خلفية إضافي
  const box = (l, v, c, bgClass = '') => `<div class="col-6 col-md-4 col-lg-3"><div class="p-2 rounded ${bgClass || 'bg-body-tertiary'} border h-100"><small class="text-body-secondary d-block">${l}</small><b class="fs-6 ${c || ''}" dir="ltr">${v}</b></div></div>`;
  
  // تم إضافة خلفية success لخانة عدد الأسهم فقط
  let h = box('عدد الأسهم', fNum(sh, 0), '', 'bg-success text-white')
    + box('قيمة الشراء', '$' + fNum(val, 2))
    + box('إجمالي التكلفة بالعمولة', '$' + fNum(inn, 2))
    + box('سعر التعادل (Break-even)', '$' + fNum(be, 4));
    
  if ($('mode').value === 'budget') h += box('المتبقي من المبلغ', '$' + fNum(numVal('budget') - inn, 2));
  
  if (s > 0) {
    const r = out(s);
    h += box('إجمالي البيع', '$' + fNum(r.rev, 2))
      + box('صافي الربح / الخسارة', sg(r.net, 2) + ' $', r.net >= 0 ? 'up' : 'dn')
      + box('نسبة العائد (ROI)', sg(r.pct, 2) + '%', r.net >= 0 ? 'up' : 'dn');
  }
  res.innerHTML = h;

  sc.querySelector('tbody').innerHTML = [-15, -10, -5, -2, 0, 2, 5, 10, 20, 35].map(x => {
    const sp = p * (1 + x / 100), r = out(sp), c = r.net >= 0 ? 'up' : 'dn';
    return `<tr><td dir="ltr" class="text-start">$${fNum(sp, dec)}</td><td dir="ltr" class="text-start">${x > 0 ? '+' : ''}${x}%</td><td class="${c} fw-bold" dir="ltr" class="text-start">${sg(r.net, 2)} $</td><td class="${c}" dir="ltr" class="text-start">${sg(r.pct, 2)}%</td></tr>`;
  }).join('');
  sc.hidden = false;
}

['buy', 'sell', 'budget', 'shares', 'fbf', 'fbp', 'fsf', 'fsp', 'frac', 'mode'].forEach(id => $(id).addEventListener('input', calc));
$('mode').addEventListener('change', () => { const b = $('mode').value === 'budget'; $('bw').hidden = !b; $('sw').hidden = b; calc() });
document.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => { $('mode').value = 'budget'; $('bw').hidden = false; $('sw').hidden = true; $('budget').value = b.dataset.b; calc() }));

/* ---------- Deep Object Extractor ---------- */
function dig(o, keys, isStr) {
  const q = [o];
  while (q.length) {
    const x = q.shift();
    if (x && typeof x === 'object') {
      for (const k of keys) {
        if (k in x && x[k] != null) {
          let v = x[k];
          if (typeof v === 'object' && 'raw' in v) v = v.raw;
          if (typeof v === 'object' && 'fmt' in v && isStr) v = v.fmt;
          if (isStr) {
            if (typeof v === 'string' && v.trim()) return v.trim();
          } else {
            const nv = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
            if (isFinite(nv)) return nv;
          }
        }
      }
      q.push(...Object.values(x));
    }
  }
  return null;
}

/* ---------- Render Stock Quote Card ---------- */
function renderQuoteCard(data) {
  const q = $('q');
  q.className = 'alert alert-secondary mb-3 p-3';
  const chgCls = (data.chg || 0) >= 0 ? 'up' : 'dn';
  const priceDec = data.price < 1 ? 4 : 2;
  const pcDec = (data.pc && data.pc < 1) ? 4 : 2;

  q.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center border-bottom pb-2 mb-2 gap-2">
      <div>
        <span class="h5 fw-bold text-primary mb-0 me-2">${data.sym}</span>
        <span class="fw-semibold">${data.name || ''}</span>
        <span class="badge bg-info text-dark ms-2">🏢 النشاط: ${data.activity || 'غير محدد'}</span>
      </div>
      <div class="fs-5 fw-bold" dir="ltr">
        $${fNum(data.price, priceDec)}
        ${data.chg != null ? `<span class="ms-2 fs-6 ${chgCls}">(${sg(data.chg, 2)}%)</span>` : ''}
      </div>
    </div>
    <div class="row g-2 small">
      <div class="col-6 col-sm-4 col-md-2"><span class="text-body-secondary d-block">إغلاق أمس (Prev Close):</span><b dir="ltr">${data.pc != null ? '$' + fNum(data.pc, pcDec) : '—'}</b></div>
      <div class="col-6 col-sm-4 col-md-2"><span class="text-body-secondary d-block">الفوليوم (Volume):</span><b dir="ltr">${data.vol != null ? fBig(data.vol) : '—'} (${data.vol != null ? Math.round(data.vol).toLocaleString('en-US') : '—'})</b></div>
      <div class="col-6 col-sm-4 col-md-3"><span class="text-body-secondary d-block">الأسهم الحرة (Free Float):</span><b class="text-warning" dir="ltr">${data.floatShares != null ? fBig(data.floatShares) + (data.floatPct ? ` (${fNum(data.floatPct, 1)}%)` : '') : '—'}</b></div>
      <div class="col-6 col-sm-4 col-md-2"><span class="text-body-secondary d-block">القيمة السوقية (M.Cap):</span><b dir="ltr">${data.mc != null ? '$' + fBig(data.mc) : '—'}</b></div>
      <div class="col-12 col-sm-8 col-md-3"><span class="text-body-secondary d-block">العرض والطلب (Bid / Ask):</span><b dir="ltr">Bid: ${data.bid != null ? '$' + fNum(data.bid, priceDec) : '—'} | Ask: ${data.ask != null ? '$' + fNum(data.ask, priceDec) : '—'}</b></div>
    </div>
  `;
}

function saveStockToCache(data) {
  try {
    localStorage.setItem(CACHE_SYM_KEY, data.sym);
    localStorage.setItem(CACHE_QUOTE_KEY, JSON.stringify(data));
    $('cacheBadge').hidden = false;
  } catch (e) { }
}

/* ---------- Fetch Quote + Supplemental Scan Data ---------- */
async function fetchFullStockData(sym) {
  const base = $('api').value.trim().replace(/\/+$/, '');
  const s = encodeURIComponent(sym);
  const urls = [
    base + '/?symbol=' + s,
    base + '/quote?symbol=' + s,
    base + '/?ticker=' + s,
    base + '/' + s
  ];

  let quoteJson = null, price = null, lastErr = '';
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) { lastErr = 'HTTP ' + r.status; continue; }
      const j = await r.json();
      const p = dig(j, ['price', 'regularMarketPrice', 'last', 'lastPrice', 'currentPrice', 'c', 'close']);
      if (p != null) { price = p; quoteJson = j; break; }
    } catch (e) { lastErr = e.message; }
  }

  let data = {
    sym: sym,
    price: price,
    name: quoteJson ? dig(quoteJson, ['shortName', 'longName', 'name', 'companyName', 'description'], true) : null,
    activity: quoteJson ? dig(quoteJson, ['sector', 'industry', 'category', 'sectorDisp', 'industryDisp', 'finnhubIndustry', 'sic_description'], true) : null,
    pc: quoteJson ? dig(quoteJson, ['previousClose', 'regularMarketPreviousClose', 'pc', 'prevClose', 'prev_close']) : null,
    chg: quoteJson ? dig(quoteJson, ['changePercent', 'regularMarketChangePercent', 'dp', 'change_percent', 'changePct']) : null,
    vol: quoteJson ? dig(quoteJson, ['volume', 'regularMarketVolume', 'v', 'vol']) : null,
    floatShares: quoteJson ? dig(quoteJson, ['floatShares', 'float_shares', 'freeFloat', 'sharesFloat', 'float', 'shares_float']) : null,
    floatPct: quoteJson ? dig(quoteJson, ['floatPct', 'float_pct']) : null,
    mc: quoteJson ? dig(quoteJson, ['marketCap', 'market_cap', 'market_cap_basic']) : null,
    bid: quoteJson ? dig(quoteJson, ['bid', 'bidPrice']) : null,
    ask: quoteJson ? dig(quoteJson, ['ask', 'askPrice']) : null
  };

  if (data.price == null || data.floatShares == null || !data.activity || data.pc == null) {
    try {
      const scanRes = await fetch(base + '/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: [{ left: 'name', operation: 'equal', right: sym }],
          range: [0, 5]
        })
      });
      if (scanRes.ok) {
        const sj = await scanRes.json();
        const row = (sj.data || []).find(item => String(item.symbol).toUpperCase() === sym);
        if (row) {
          if (data.price == null) data.price = row.price;
          if (!data.name) data.name = row.name;
          if (!data.activity) data.activity = row.sector || row.industry || row.description || null;
          if (data.vol == null) data.vol = row.volume;
          if (data.chg == null) data.chg = row.changePct;
          if (data.floatShares == null) data.floatShares = row.floatShares;
          if (data.floatPct == null) data.floatPct = row.floatPct;
          if (data.mc == null) data.mc = row.marketCap;
          if (data.pc == null && row.price != null && row.changePct != null) {
            data.pc = row.price / (1 + (row.changePct / 100));
          }
        }
      }
    } catch (e) { }
  }

  if (data.pc == null && data.price != null && data.chg != null) {
    data.pc = data.price / (1 + (data.chg / 100));
  }

  if (data.price == null) throw new Error(lastErr || 'لم يتم العثور على بيانات السهم');
  return data;
}

/* ---------- Events for Stock Fetcher & Clear Button ---------- */
$('sym').addEventListener('input', () => {
  const val = $('sym').value.trim().toUpperCase();
  if (val) {
    localStorage.setItem(CACHE_SYM_KEY, val);
    $('cacheBadge').hidden = false;
  }
});

$('get').addEventListener('click', async () => {
  const sym = $('sym').value.trim().toUpperCase();
  const q = $('q'), b = $('get');
  if (!sym) {
    q.className = 'alert alert-warning mb-3 p-2';
    q.textContent = '⚠️ اكتب رمز السهم أولاً.';
    return;
  }
  b.disabled = true;
  b.textContent = '⏳ جاري الجلب...';
  try {
    const data = await fetchFullStockData(sym);
    renderQuoteCard(data);
    saveStockToCache(data);
    $('buy').value = (data.ask != null && data.ask > 0) ? data.ask : data.price;
    if (data.bid != null && data.bid > 0) $('sell').value = data.bid;
    calc();
  } catch (e) {
    q.className = 'alert alert-danger mb-3 p-2';
    q.innerHTML = `❌ تعذر جلب السعر (${e.message}). تأكد من الرمز أو رابط الـ Worker.`;
  }
  b.disabled = false;
  b.textContent = '🔍 هات السعر والبيانات';
});

$('sym').addEventListener('keydown', e => { if (e.key === 'Enter') $('get').click(); });

// Clear Cache Button
$('clearCache').addEventListener('click', () => {
  try {
    localStorage.removeItem(CACHE_SYM_KEY);
    localStorage.removeItem(CACHE_QUOTE_KEY);
  } catch (e) { }
  $('sym').value = '';
  $('buy').value = '';
  $('sell').value = '';
  $('q').className = 'alert alert-secondary d-none mb-3 p-3';
  $('q').innerHTML = '';
  $('res').innerHTML = '';
  $('scen').hidden = true;
  $('msg').textContent = '';
  $('cacheBadge').hidden = true;
});

// Restore Cached Symbol & Quote on Page Load
(function restoreCache() {
  try {
    const savedApi = localStorage.getItem('mh_api');
    if (savedApi) $('api').value = savedApi;
    $('api').addEventListener('change', () => localStorage.setItem('mh_api', $('api').value.trim()));

    const savedSym = localStorage.getItem(CACHE_SYM_KEY);
    const savedQuote = localStorage.getItem(CACHE_QUOTE_KEY);
    if (savedSym) {
      $('sym').value = savedSym;
      $('cacheBadge').hidden = false;
    }
    if (savedQuote) {
      const data = JSON.parse(savedQuote);
      if (data && data.sym) {
        renderQuoteCard(data);
        $('buy').value = (data.ask != null && data.ask > 0) ? data.ask : data.price;
        if (data.bid != null && data.bid > 0) $('sell').value = data.bid;
        calc();
      }
    }
  } catch (e) { }
})();