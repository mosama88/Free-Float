/* ============================================================================
   MOMO ARABIC VISUAL NEWS & CATALYST TERMINAL v2.1 (news.js)
   تصميم Investing.com المصور + ترجمة عربية + زر "اقرأ من المصدر" في كل مكان
============================================================================ */
(function () {
  "use strict";

  var WORKER_BASE = 'https://small-disk-18d3stock-proxy.osamaanit.workers.dev';

  var heroContainer = document.getElementById('heroNewsContainer');
  var subGridContainer = document.getElementById('subNewsGridContainer');
  var moreNewsContainer = document.getElementById('moreNewsContainer');
  var panelsEl = document.getElementById('catalystPanels');
  var tbody = document.getElementById('catalystRows');
  var statusEl = document.getElementById('newsStatus');
  var lastUpdateEl = document.getElementById('newsLastUpdate');
  var totalCountEl = document.getElementById('newsTotalCount');

  var nfSearch = document.getElementById('nfSearch');
  var nfAuto = document.getElementById('nfAuto');
  var nfSound = document.getElementById('nfSound');
  var nfScanBtn = document.getElementById('nfScanBtn');

  var activeCategory = 'all';
  var carouselOffset = 0;
  var allCatalystStocks = [];
  var visualArticles = [];
  var stockRealNewsMap = {};
  var currentChartSym = '';
  var currentTf = '5';
  var autoTimer = null;

  /* ---------------- 1. مكتبة الصور المالية عالية الدقة ---------------- */
  var TOPIC_IMAGES = {
    market_up:   'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=900&q=80',
    wall_street: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=900&q=80',
    ai_chips:    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
    biotech_fda: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=900&q=80',
    pharma_lab:  'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&q=80',
    merger_deal: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80',
    earnings:    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80',
    fed_macro:   'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=900&q=80',
    warning_red: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=900&q=80',
    traders:     'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?auto=format&fit=crop&w=900&q=80'
  };

  function pickImageForArticle(title, cat, idx) {
    var t = String(title || '').toLowerCase();
    if (/fda|clinical|trial|drug|biotech|pharma|phase|أدوية|طبي|سريري/.test(t) || cat === 'fda') {
      return idx % 2 === 0 ? TOPIC_IMAGES.biotech_fda : TOPIC_IMAGES.pharma_lab;
    }
    if (/ai|chip|nvidia|semiconductor|tech|cloud|رقائق|ذكاء|تكنولوجيا|إنفيديا/.test(t)) {
      return TOPIC_IMAGES.ai_chips;
    }
    if (/acqui|merger|deal|contract|agreement|buyout|استحواذ|صفقة|عقد|اندماج/.test(t) || cat === 'ma') {
      return TOPIC_IMAGES.merger_deal;
    }
    if (/earnings|revenue|profit|quarter|beat|أرباح|إيرادات|نتائج/.test(t) || cat === 'earnings') {
      return TOPIC_IMAGES.earnings;
    }
    if (/offering|dilution|drop|plunge|loss|طرح|هبوط|خسائر/.test(t) || cat === 'offering') {
      return TOPIC_IMAGES.warning_red;
    }
    if (/fed|inflation|ppi|cpi|bond|treasury|nasdaq|سندات|تضخم|نازداك|الفيدرالي/.test(t) || cat === 'macro') {
      return idx % 2 === 0 ? TOPIC_IMAGES.traders : TOPIC_IMAGES.fed_macro;
    }
    var pool = [TOPIC_IMAGES.traders, TOPIC_IMAGES.market_up, TOPIC_IMAGES.wall_street, TOPIC_IMAGES.ai_chips];
    return pool[idx % pool.length];
  }

  // توليد رابط مصدر موثوق للسهم إذا لم يكن هناك رابط RSS مباشر
  function getDefaultSourceUrl(sym) {
    if (!sym) return 'https://finance.yahoo.com/topic/stock-market-news/';
    return 'https://finance.yahoo.com/quote/' + encodeURIComponent(sym) + '/news/';
  }

  /* ---------------- 2. حقن تنسيقات اللوحات وزر "اقرأ من المصدر" ---------------- */
  function injectExtraStyles() {
    if (document.getElementById('momo-cat-extra-css')) return;
    var st = document.createElement('style');
    st.id = 'momo-cat-extra-css';
    st.textContent = `
      #catalystPanels {
        background: #070b14;
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 10px;
      }
      .cat-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(200px, 1fr));
        gap: 6px;
      }
      @media (max-width: 1600px) { .cat-grid { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 992px)  { .cat-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 600px)  { .cat-grid { grid-template-columns: 1fr; } }

      .cat-panel {
        display: flex;
        flex-direction: column;
        height: 235px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.14);
        border-top: 3px solid var(--pc, #38bdf8);
        background: var(--rbg, linear-gradient(160deg, #0f172a, #1e293b));
      }
      .cat-ph {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 8px;
        background: rgba(0,0,0,0.75);
        color: #ffffff;
        font-size: 10.5px;
        font-weight: 900;
      }
      .cat-pb { flex: 1; overflow-y: auto; scrollbar-width: thin; }
      .cat-pt { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      .cat-pt thead th {
        position: sticky;
        top: 0;
        background: #090d16;
        color: #cbd5e1;
        font-size: 9.5px;
        font-weight: 800;
        padding: 4px 5px;
        text-align: right;
      }
      .cat-pt thead th:first-child { text-align: left; color: #38bdf8; }
      .cat-pt tbody tr { cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.07); }
      .cat-pt tbody tr:hover { background: rgba(255,255,255,0.18) !important; }
      .cat-pt tbody td {
        padding: 3.5px 5px;
        text-align: right;
        color: #ffffff !important;
        font-weight: 700;
        white-space: nowrap;
      }
      .cat-pt tbody td.sy {
        text-align: left;
        font-weight: 900;
        border-left: 3px solid var(--pc, #38bdf8);
        padding-left: 5px;
      }
      .up-pill {
        color: #4ade80 !important;
        background: rgba(22, 163, 74, 0.25);
        border: 1px solid rgba(74, 222, 128, 0.35);
        padding: 1px 5px;
        border-radius: 4px;
        font-weight: 900;
      }
      .down-pill {
        color: #fda4af !important;
        background: rgba(225, 29, 72, 0.28);
        border: 1px solid rgba(251, 113, 133, 0.35);
        padding: 1px 5px;
        border-radius: 4px;
        font-weight: 900;
      }
      .cat-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 5px;
        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
      }
      .cb-fda      { background: linear-gradient(135deg, #059669, #10b981); color: #fff; }
      .cb-ma       { background: linear-gradient(135deg, #d97706, #f59e0b); color: #000; }
      .cb-earnings { background: linear-gradient(135deg, #2563eb, #38bdf8); color: #fff; }
      .cb-upgrade  { background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff; }
      .cb-squeeze  { background: linear-gradient(135deg, #dc2626, #ea580c); color: #fde047; border: 1px solid #fde047; }
      .cb-offering { background: #450a0a; color: #fda4af; border: 1px solid #f43f5e; }

      .tp-mini-grid { display: flex; flex-wrap: wrap; gap: 4px; font-size: 11px; font-weight: 800; }
      .tp-chip { padding: 2px 6px; border-radius: 4px; background: #0f172a; border: 1px solid rgba(255,255,255,0.12); }

      .sniper-news-hud {
        background: linear-gradient(145deg, #070b14 0%, #0f172a 100%);
        border: 1px solid #38bdf8;
        border-top: 4px solid #facc15;
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 10px;
      }
      .sniper-t-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
        margin-top: 10px;
      }
      @media (max-width: 992px) { .sniper-t-grid { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 600px) { .sniper-t-grid { grid-template-columns: repeat(2, 1fr); } }
      .sniper-box { background: #090d16; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; padding: 8px 10px; }

      /* تصميم زر "اقرأ من المصدر" */
      .source-link-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(56, 189, 248, 0.14);
        color: #38bdf8 !important;
        border: 1px solid rgba(56, 189, 248, 0.4);
        padding: 3px 10px;
        border-radius: 6px;
        font-size: 0.76rem;
        font-weight: 800;
        text-decoration: none !important;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      .source-link-btn:hover {
        background: #0284c7;
        color: #ffffff !important;
        border-color: #7dd3fc;
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.45);
        transform: translateY(-1px);
      }
      .source-link-btn.finviz-btn {
        background: rgba(250, 204, 21, 0.12);
        color: #fde047 !important;
        border-color: rgba(250, 204, 21, 0.4);
      }
      .source-link-btn.finviz-btn:hover {
        background: #ca8a04;
        color: #000000 !important;
      }
    `;
    document.head.appendChild(st);
  }
  injectExtraStyles();

  /* ---------------- 3. دوال مساعدة ---------------- */
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
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return n.toFixed(0);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* ---------------- 4. المترجم المالي الذكي إلى العربية ---------------- */
  function translateHeadlineToArabic(enText, stockObj) {
    if (!enText) return '';
    if (/[\u0600-\u06FF]/.test(enText)) return enText;

    var sym = stockObj ? stockObj.symbol : '';
    var chg = stockObj ? (num(stockObj.changePct) || 0) : 0;
    var chgStr = (chg >= 0 ? '+' : '') + fmt(chg, 1) + '%';
    var t = enText;
    var prefix = sym ? ('سهم ' + sym + ' (' + chgStr + '): ') : '';

    if (/fda.*approv|approv.*fda|clearance/i.test(t)) {
      return prefix + 'يحصل على موافقة رسمية من هيئة الغذاء والدواء الأمريكية (FDA) وسط تدفق سيولة قياسي';
    }
    if (/phase\s*1|phase\s*2|phase\s*3|clinical\s*trial|positive.*data/i.test(t)) {
      return prefix + 'يعلن عن نتائج إيجابية قوية في التجارب السريرية تقود السهم لاختراق سعري';
    }
    if (/acqui|merger|buyout/i.test(t)) {
      return prefix + 'يشتعل بعد الإعلان عن صفقة استحواذ واندماج استراتيجية في وول ستريت';
    }
    if (/contract|award|partnership|agreement|deal/i.test(t)) {
      return prefix + 'يفوز بعقد تجاري واتفاقية شراكة كبرى تعزز الإيرادات المستقبلية للشركة';
    }
    if (/earnings|revenue|eps|q[1234]|beat|guidance/i.test(t)) {
      return prefix + 'يتفوق على توقعات المحللين في نتائج الأرباح الفصلية ويرفع التوقعات المالية';
    }
    if (/upgrade|price\s*target|buy\s*rating|initiates/i.test(t)) {
      return prefix + 'بنوك استثمارية ترفع السعر المستهدف والتوصية على السهم إلى "شراء قوي"';
    }
    if (/offering|private\s*placement|dilution/i.test(t)) {
      return prefix + '⚠️ يعلن عن طرح أسهم جديدة لجمع السيولة (احذر من التذبذب العنيف أو الضغط البيعي)';
    }

    return prefix + t;
  }

  function asyncTranslateToArabic(enText, callback) {
    if (!enText || /[\u0600-\u06FF]/.test(enText)) {
      callback(enText);
      return;
    }
    var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=' + encodeURIComponent(enText);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res[0]) {
          var ar = res[0].map(function (seg) { return seg[0]; }).join('');
          callback(ar);
        }
      })
      .catch(function () {});
  }

  /* ---------------- 5. تصنيف الخبطة وحساب الأهداف (TP1 / TP2 / TP3 / SL) ---------------- */
  var CATALYST_RULES = [
    { cat: 'fda', badge: '🧬 موافقة FDA / طبي', cls: 'cb-fda', boost: 25,
      regex: /\b(fda|clinical|phase\s*[123]|trial|drug|therapy|biotech|patent|nda|clearance|treatment|oncology)\b/i },
    { cat: 'ma', badge: '🤝 استحواذ / عقد ضخم', cls: 'cb-ma', boost: 22,
      regex: /\b(acqui|merger|buyout|contract|award|partnership|agreement|deal|billion|million\s+order|government|strategic)\b/i },
    { cat: 'earnings', badge: '💰 مفاجأة أرباح (Earnings)', cls: 'cb-earnings', boost: 18,
      regex: /\b(earnings|revenue|eps|quarter|q[1234]|guidance|beat|record\s+sales|profit|financial\s+results)\b/i },
    { cat: 'upgrade', badge: '📈 رفع توصية (Upgrade)', cls: 'cb-upgrade', boost: 15,
      regex: /\b(upgrade|price\s+target|buy\s+rating|outperform|overweight|initiates|analyst)\b/i },
    { cat: 'offering', badge: '⚠️ طرح أسهم (Offering)', cls: 'cb-offering', boost: -30,
      regex: /\b(offering|dilution|registered\s+direct|private\s+placement|warrants|shelf)\b/i }
  ];

  function classifyAndScoreStock(s, rawHeadline, arHeadlineCustom, pubTimeStr, imgUrl, sourceUrl) {
    var price = num(s.price) || 0;
    var chg = num(s.changePct) || 0;
    var vol = num(s.volume) || 0;
    var avgVol = num(s.avgVolume3M) || 0;
    var rvol = avgVol > 0 ? vol / avgVol : (num(s.relVol10D) || 1);
    var floatS = num(s.floatShares) || 0;
    var w52 = num(s.week52Pos) || 50;
    var sector = String(s.sector || s.industry || '');

    var matchedRule = null;
    if (rawHeadline) {
      for (var i = 0; i < CATALYST_RULES.length; i++) {
        if (CATALYST_RULES[i].regex.test(rawHeadline)) {
          matchedRule = CATALYST_RULES[i];
          break;
        }
      }
    }

    var cat = 'squeeze';
    var badge = '🚀 انفجار سيولة (Squeeze)';
    var cls = 'cb-squeeze';
    var enTitle = rawHeadline || '';
    var arTitle = arHeadlineCustom || '';

    if (matchedRule) {
      cat = matchedRule.cat;
      badge = matchedRule.badge;
      cls = matchedRule.cls;
      arTitle = arTitle || translateHeadlineToArabic(enTitle, s);
    } else if (/health|biotech|pharma|med/i.test(sector) && chg >= 6) {
      cat = 'fda';
      badge = '🧬 زخم قطاع الأدوية (Biotech)';
      cls = 'cb-fda';
      enTitle = enTitle || (s.symbol + ' surges +' + fmt(chg, 1) + '% on heavy Biotech volume (' + fmt(rvol, 1) + 'x RVOL)');
      arTitle = arTitle || ('سهم ' + s.symbol + ' يقفز بنسبة +' + fmt(chg, 1) + '% وسط تدفق سيولة قوي في قطاع الأدوية والبيوتك (' + fmt(rvol, 1) + 'x RVOL)');
    } else if (floatS > 0 && floatS <= 12e6 && chg >= 8) {
      cat = 'squeeze';
      badge = '🌌 ضغط شورت (Low Float)';
      cls = 'cb-squeeze';
      enTitle = enTitle || ('Low-Float Alert: ' + s.symbol + ' (' + fmtBig(floatS) + ' Float) exploding +' + fmt(chg, 1) + '% on ' + fmt(rvol, 1) + 'x RVOL');
      arTitle = arTitle || ('انفجار سعري في سهم ' + s.symbol + ' ذو الفلوت الخفيف (' + fmtBig(floatS) + ') بصعود +' + fmt(chg, 1) + '% وسيولة ' + fmt(rvol, 1) + ' أضعاف المتوسط');
    } else if (chg <= -10) {
      cat = 'offering';
      badge = '⚠️ نزيف سعري / طرح محتمل';
      cls = 'cb-offering';
      enTitle = enTitle || (s.symbol + ' drops ' + fmt(chg, 1) + '% on heavy selling volume — watch for Offering/Dilution');
      arTitle = arTitle || ('⚠️ هبوط حاد لسهم ' + s.symbol + ' بنسبة ' + fmt(chg, 1) + '% وسط ضغط بيعي مرتفع (احذر من أخبار طرح الأسهم)');
    } else {
      cat = 'ma';
      badge = '💥 خبطة سيولة (Major Mover)';
      cls = 'cb-ma';
      enTitle = enTitle || (s.symbol + ' rallies +' + fmt(chg, 1) + '% with ' + fmtBig(vol) + ' shares traded in heavy institutional action');
      arTitle = arTitle || ('سهم ' + s.symbol + ' ينطلق بقوة +' + fmt(chg, 1) + '% بتداولات تجاوزت ' + fmtBig(vol) + ' سهم وزخم شرائي نشط');
    }

    var impact = 52;
    if (rvol >= 10) impact += 24;
    else if (rvol >= 5) impact += 18;
    else if (rvol >= 2.5) impact += 12;

    if (chg >= 25) impact += 20;
    else if (chg >= 10) impact += 14;
    else if (chg < 0) impact -= 15;

    if (floatS > 0 && floatS <= 12e6) impact += 10;
    if (w52 >= 90) impact += 5;
    if (matchedRule) impact += (matchedRule.boost > 0 ? 10 : -20);
    impact = Math.max(10, Math.min(99, Math.round(impact)));

    var dec = price < 1 ? 4 : 2;
    var baseMove = Math.min(0.35, Math.max(Math.abs(chg) / 100, 0.06));
    var boost = (floatS > 0 && floatS <= 12e6) ? 1.3 : 1.0;

    var tp1 = price * (1 + Math.min(0.16, Math.max(0.04, baseMove * 0.50 * boost)));
    var tp2 = price * (1 + Math.min(0.32, Math.max(0.09, baseMove * 1.00 * boost)));
    var tp3 = price * (1 + Math.min(0.55, Math.max(0.16, baseMove * 1.75 * boost)));
    var sl  = price * (1 - Math.min(0.09, Math.max(0.03, baseMove * 0.32)));
    var rr  = ((tp2 - price) / Math.max(0.0001, price - sl)).toFixed(1);

    s._cat = {
      category: cat,
      badge: badge,
      cls: cls,
      enTitle: enTitle,
      arTitle: arTitle,
      pubTime: pubTimeStr || 'مباشر الآن',
      img: imgUrl || pickImageForArticle(enTitle, cat, Math.abs(s.symbol.charCodeAt(0))),
      url: sourceUrl || getDefaultSourceUrl(s.symbol),
      finvizUrl: 'https://finviz.com/quote.ashx?t=' + encodeURIComponent(s.symbol),
      impact: impact,
      rvol: rvol,
      tp1: tp1,
      tp2: tp2,
      tp3: tp3,
      sl: sl,
      rr: rr,
      dec: dec
    };
    return s._cat;
  }

  /* ---------------- 6. بناء قسم المجلة المصورة مع زر "اقرأ من المصدر" ---------------- */
  function buildVisualArticlesList() {
    var q = (nfSearch ? nfSearch.value : '').trim().toUpperCase();
    var list = [];

    visualArticles.forEach(function (art) {
      if (activeCategory !== 'all' && activeCategory !== 'macro' && art.cat !== activeCategory) return;
      if (q && (art.arTitle + ' ' + art.enTitle + ' ' + (art.sym || '')).toUpperCase().indexOf(q) === -1) return;
      list.push(art);
    });

    allCatalystStocks.slice(0, 24).forEach(function (s, idx) {
      var c = s._cat;
      if (!c) return;
      if (activeCategory !== 'all' && activeCategory !== 'stocks' && c.category !== activeCategory) return;
      if (q && (s.symbol + ' ' + c.arTitle + ' ' + c.enTitle).toUpperCase().indexOf(q) === -1) return;

      var chg = num(s.changePct) || 0;
      list.push({
        sym: s.symbol,
        arTitle: c.arTitle,
        enTitle: c.enTitle,
        desc: 'يتداول سهم ' + s.symbol + ' (' + (s.name || '') + ') عند سعر $' + fmt(s.price, c.dec) + ' بارتفاع ' + (chg >= 0 ? '+' : '') + fmt(chg, 1) + '% وسيولة نسبية ' + fmt(c.rvol, 1) + 'x. أهداف القناص الفنية تشير إلى TP1 عند $' + fmt(c.tp1, c.dec) + ' و TP2 عند $' + fmt(c.tp2, c.dec) + ' و TP3 عند $' + fmt(c.tp3, c.dec) + ' مع وقف خسارة عند $' + fmt(c.sl, c.dec) + '.',
        img: c.img || pickImageForArticle(c.enTitle, c.category, idx),
        url: c.url || getDefaultSourceUrl(s.symbol),
        badge: c.badge,
        time: c.pubTime,
        chgStr: (chg >= 0 ? '+' : '') + fmt(chg, 1) + '%',
        isUp: chg >= 0,
        cat: c.category
      });
    });

    return list;
  }

  function renderVisualMagazine() {
    if (!heroContainer || !subGridContainer) return;
    var items = buildVisualArticlesList();

    if (!items.length) {
      heroContainer.innerHTML = '';
      subGridContainer.innerHTML = '';
      if (moreNewsContainer) moreNewsContainer.innerHTML = '';
      return;
    }

    // 1. الخبر الرئيسي الضخم (Hero Story) + زر اقرأ من المصدر
    var hero = items[0];
    var heroUrl = hero.url || getDefaultSourceUrl(hero.sym);
    heroContainer.innerHTML =
      '<div class="hero-news-card" data-symbol="' + esc(hero.sym || '') + '">' +
        '<div class="row g-0">' +
          '<div class="col-lg-5">' +
            '<div class="hero-img-wrap">' +
              '<img src="' + esc(hero.img) + '" alt="news">' +
              (hero.sym ? '<span class="nvc-sym-pill">' + esc(hero.sym) + ' (' + esc(hero.chgStr) + ')</span>' : '') +
              '<span class="nvc-tag">' + esc(hero.badge || '🔥 خبر رئيسي عاجل') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="col-lg-7">' +
            '<div class="hero-content">' +
              '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">' +
                '<div class="d-flex align-items-center gap-2">' +
                  '<span class="badge bg-danger">عاجل — وول ستريت</span>' +
                  '<small class="text-info fw-bold">🕒 ' + esc(hero.time) + '</small>' +
                  (hero.sym ? '<span class="badge bg-dark border border-info text-info" dir="ltr">Ticker: ' + esc(hero.sym) + '</span>' : '') +
                '</div>' +
                '<a href="' + esc(heroUrl) + '" target="_blank" rel="noopener noreferrer" class="source-link-btn">🔗 اقرأ من المصدر ↗</a>' +
              '</div>' +
              '<h2 class="hero-title">' + esc(hero.arTitle) + '</h2>' +
              '<p class="hero-desc">' + esc(hero.desc) + '</p>' +
              '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-auto pt-2 border-top border-secondary">' +
                '<small class="text-secondary" dir="ltr">' + esc(hero.enTitle).slice(0, 85) + '</small>' +
                '<div class="d-flex align-items-center gap-2">' +
                  '<a href="' + esc(heroUrl) + '" target="_blank" rel="noopener noreferrer" class="source-link-btn">📰 المصدر الأصلي للخبر ↗</a>' +
                  (hero.sym ? '<span class="btn btn-sm btn-info fw-bold text-dark">📊 افتح الشارت والأهداف ↵</span>' : '') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // 2. شريط الكروت الأربعة المصورة + زر اقرأ من المصدر في كل كارت
    var subPool = items.slice(1);
    if (carouselOffset >= subPool.length) carouselOffset = 0;
    var fourCards = subPool.slice(carouselOffset, carouselOffset + 4);
    if (fourCards.length < 4 && subPool.length >= 4) {
      fourCards = subPool.slice(0, 4);
    }

    subGridContainer.innerHTML = fourCards.map(function (art) {
      var artUrl = art.url || getDefaultSourceUrl(art.sym);
      return '<div class="news-visual-card" data-symbol="' + esc(art.sym || '') + '">' +
        '<div class="nvc-img-box">' +
          '<img src="' + esc(art.img) + '" alt="card">' +
          (art.sym ? '<span class="nvc-sym-pill">' + esc(art.sym) + ' ' + esc(art.chgStr || '') + '</span>' : '') +
          '<span class="nvc-tag">' + esc(art.badge || 'أخبار السوق') + '</span>' +
        '</div>' +
        '<div class="nvc-body">' +
          '<div class="nvc-title">' + esc(art.arTitle) + '</div>' +
          '<div class="nvc-meta">' +
            '<span>🕒 ' + esc(art.time) + '</span>' +
            '<div class="d-flex align-items-center gap-2">' +
              '<a href="' + esc(artUrl) + '" target="_blank" rel="noopener noreferrer" class="source-link-btn" style="padding:1px 7px;font-size:0.7rem;">🔗 اقرأ من المصدر ↗</a>' +
              (art.sym ? ('<span class="text-info fw-bold" style="font-size:0.72rem;">شارت ❯</span>') : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // 3. قائمة أخبار مصورة إضافية + زر اقرأ من المصدر
    if (moreNewsContainer) {
      var extra = subPool.slice(carouselOffset + 4, carouselOffset + 10);
      moreNewsContainer.innerHTML = extra.map(function (art) {
        var artUrl = art.url || getDefaultSourceUrl(art.sym);
        return '<div class="mini-news-item" data-symbol="' + esc(art.sym || '') + '">' +
          '<img class="mini-news-img" src="' + esc(art.img) + '" alt="thumb">' +
          '<div class="d-flex flex-column justify-content-between flex-grow-1">' +
            '<div class="fw-bold text-white" style="font-size:0.92rem;line-height:1.4">' + esc(art.arTitle) + '</div>' +
            '<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 small text-secondary mt-1">' +
              '<span>' + esc(art.badge) + ' • ' + esc(art.time) + '</span>' +
              '<div class="d-flex align-items-center gap-2">' +
                '<a href="' + esc(artUrl) + '" target="_blank" rel="noopener noreferrer" class="source-link-btn" style="padding:1px 8px;font-size:0.7rem;">🔗 اقرأ من المصدر ↗</a>' +
                (art.sym ? '<span class="badge bg-dark border border-info text-info" dir="ltr">' + esc(art.sym) + ' ' + esc(art.chgStr) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  /* ---------------- 7. جلب أخبار السوق الحية مع روابط المصدر (RSS Link) ---------------- */
  function fetchGeneralMarketArabicNews() {
    var rssUrl = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=NVDA,TSLA,AAPL,AMD,SPY,QQQ&region=US&lang=en-US';
    var proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(rssUrl);

    fetch(proxyUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.contents) return;
        var parser = new DOMParser();
        var xml = parser.parseFromString(data.contents, 'text/xml');
        var items = Array.from(xml.querySelectorAll('item')).slice(0, 6);

        items.forEach(function (item, idx) {
          var title = item.querySelector('title') ? item.querySelector('title').textContent : '';
          var desc = item.querySelector('description') ? item.querySelector('description').textContent : '';
          var link = item.querySelector('link') ? item.querySelector('link').textContent.trim() : '';
          var pubDate = item.querySelector('pubDate') ? item.querySelector('pubDate').textContent : '';
          var timeStr = 'اليوم';
          if (pubDate) {
            var d = new Date(pubDate);
            if (!isNaN(d.getTime())) timeStr = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
          }

          if (title) {
            var guessedSym = /nvidia|nvda/i.test(title) ? 'NVDA' : (/tesla|tsla/i.test(title) ? 'TSLA' : (/apple|aapl/i.test(title) ? 'AAPL' : 'QQQ'));
            asyncTranslateToArabic(title, function (arTranslated) {
              var cleanDesc = desc ? desc.replace(/<[^>]+>/g, '').slice(0, 200) : title;
              asyncTranslateToArabic(cleanDesc, function (arDesc) {
                visualArticles.push({
                  sym: guessedSym,
                  arTitle: arTranslated,
                  enTitle: title,
                  desc: arDesc || arTranslated,
                  img: pickImageForArticle(title, 'macro', idx),
                  url: link || getDefaultSourceUrl(guessedSym),
                  badge: '🏛️ أخبار وول ستريت والمؤشرات',
                  time: timeStr,
                  chgStr: 'Market',
                  isUp: true,
                  cat: 'macro'
                });
                renderVisualMagazine();
              });
            });
          }
        });
      })
      .catch(function () {});
  }

  function fetchRealNewsForTopCatalysts(stocks) {
    stocks.slice(0, 10).forEach(function (s, idx) {
      if (stockRealNewsMap[s.symbol]) return;
      var rssUrl = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=' + encodeURIComponent(s.symbol) + '&region=US&lang=en-US';
      var proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(rssUrl);

      fetch(proxyUrl)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data || !data.contents) return;
          var parser = new DOMParser();
          var xml = parser.parseFromString(data.contents, 'text/xml');
          var item = xml.querySelector('item');
          if (!item) return;

          var title = item.querySelector('title') ? item.querySelector('title').textContent : '';
          var link = item.querySelector('link') ? item.querySelector('link').textContent.trim() : '';
          var pubDate = item.querySelector('pubDate') ? item.querySelector('pubDate').textContent : '';
          var timeFormatted = 'اليوم';
          if (pubDate) {
            var d = new Date(pubDate);
            if (!isNaN(d.getTime())) timeFormatted = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
          }

          if (title) {
            asyncTranslateToArabic(title, function (arText) {
              var fullAr = 'سهم ' + s.symbol + ': ' + arText;
              var imgPicked = pickImageForArticle(title, s._cat ? s._cat.category : 'stocks', idx);
              var finalUrl = link || getDefaultSourceUrl(s.symbol);
              stockRealNewsMap[s.symbol] = {
                en: title,
                ar: fullAr,
                time: timeFormatted,
                img: imgPicked,
                url: finalUrl
              };
              classifyAndScoreStock(s, title, fullAr, timeFormatted, imgPicked, finalUrl);
              renderAll();
            });
          }
        })
        .catch(function () {});
    });
  }

  /* ---------------- 8. رسم اللوحات الـ 6 والجدول التفصيلي ---------------- */
  var CAT_PANELS = [
    { id: 'explosive', title: '1. EXPLOSIVE CATALYSTS (أقوى الخبطات)', color: '#facc15',
      rbg: 'linear-gradient(160deg, #422006 0%, #854d0e 100%)',
      test: function (s) { return s._cat.impact >= 74 && num(s.changePct) > 0; },
      sort: function (a, b) { return b._cat.impact - a._cat.impact; } },

    { id: 'fda_bio', title: '2. FDA & BIOTECH (خبطات الأدوية)', color: '#10b981',
      rbg: 'linear-gradient(160deg, #022c22 0%, #047857 100%)',
      test: function (s) { return s._cat.category === 'fda' || /health|bio|pharma/i.test(s.sector || ''); },
      sort: function (a, b) { return (num(b.changePct) || 0) - (num(a.changePct) || 0); } },

    { id: 'ma_deals', title: '3. M&A / CONTRACTS (عقود واستحواذ)', color: '#fb923c',
      rbg: 'linear-gradient(160deg, #431407 0%, #9a3412 100%)',
      test: function (s) { return s._cat.category === 'ma' || s._cat.category === 'earnings'; },
      sort: function (a, b) { return b._cat.rvol - a._cat.rvol; } },

    { id: 'lowfloat_sq', title: '4. LOW FLOAT SQUEEZE (فلوت خفيف)', color: '#38bdf8',
      rbg: 'linear-gradient(160deg, #082f49 0%, #0369a1 100%)',
      test: function (s) { var f = num(s.floatShares) || 0; return f > 0 && f <= 15e6 && (num(s.changePct) || 0) >= 5; },
      sort: function (a, b) { return (num(b.changePct) || 0) - (num(a.changePct) || 0); } },

    { id: 'whale_vol', title: '5. WHALE VOLUME (سيولة الحيتان)', color: '#c084fc',
      rbg: 'linear-gradient(160deg, #2e1065 0%, #581c87 100%)',
      test: function (s) { return s._cat.rvol >= 3 && (num(s.changePct) || 0) > 0; },
      sort: function (a, b) { return b._cat.rvol - a._cat.rvol; } },

    { id: 'dilution_trap', title: '6. OFFERING / DUMP (تحذير طرح/انهيار)', color: '#fb7185',
      rbg: 'linear-gradient(160deg, #4c0519 0%, #881337 100%)',
      test: function (s) { return s._cat.category === 'offering' || (num(s.changePct) || 0) <= -6; },
      sort: function (a, b) { return (num(a.changePct) || 0) - (num(b.changePct) || 0); } }
  ];

  function renderCatalystPanels(rows) {
    if (!panelsEl) return;
    panelsEl.innerHTML = '<div class="cat-grid">' + CAT_PANELS.map(function (p) {
      var list = rows.filter(p.test).sort(p.sort).slice(0, 8);
      var body = list.length ? list.map(function (s) {
        var c = num(s.changePct) || 0;
        var pr = num(s.price) || 0;
        return '<tr data-symbol="' + esc(s.symbol) + '">' +
          '<td class="sy">' + esc(s.symbol) + '</td>' +
          '<td>$' + fmt(pr, pr < 1 ? 4 : 2) + '</td>' +
          '<td><span class="' + (c >= 0 ? 'up-pill' : 'down-pill') + '">' + (c >= 0 ? '+' : '') + fmt(c, 0) + '%</span></td>' +
          '<td style="color:#7dd3fc !important">' + fmt(s._cat.rvol, 1) + 'x</td>' +
          '<td style="color:#fde047 !important">' + s._cat.impact + '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8 !important">لا توجد نتائج</td></tr>';

      return '<div class="cat-panel" style="--pc:' + p.color + ';--rbg:' + p.rbg + '">' +
        '<div class="cat-ph"><span>' + esc(p.title) + '</span><span class="badge bg-dark">' + list.length + '</span></div>' +
        '<div class="cat-pb"><table class="cat-pt">' +
          '<thead><tr><th>SYMBOL</th><th>PRICE</th><th>GAP%</th><th>RVOL</th><th>IMPACT</th></tr></thead>' +
          '<tbody>' + body + '</tbody>' +
        '</table></div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderCatalystTable(rows) {
    if (!tbody) return;
    var q = (nfSearch ? nfSearch.value : '').trim().toUpperCase();

    var filtered = rows.filter(function (s) {
      if (activeCategory !== 'all' && activeCategory !== 'stocks' && activeCategory !== 'macro') {
        if (s._cat.category !== activeCategory) return false;
      }
      if (q) {
        var hay = (s.symbol + ' ' + s._cat.arTitle + ' ' + s._cat.enTitle).toUpperCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (totalCountEl) totalCountEl.textContent = filtered.length + ' فرصة نشطة';

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-secondary">لا توجد أخبار مطابقة للبحث الحالي</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.slice(0, 50).map(function (s) {
      var cat = s._cat;
      var price = num(s.price) || 0;
      var chg = num(s.changePct) || 0;
      var dec = cat.dec;
      var impColor = cat.impact >= 80 ? '#facc15' : cat.impact >= 65 ? '#4ade80' : '#38bdf8';

      return '<tr data-symbol="' + esc(s.symbol) + '">' +
        '<td>' +
          '<div class="d-flex align-items-center gap-2">' +
            '<img src="' + esc(cat.img) + '" style="width:46px;height:36px;object-fit:cover;border-radius:5px;" alt="img">' +
            '<div>' +
              '<div class="fw-black fs-6 text-white">' + esc(s.symbol) + '</div>' +
              '<span class="badge bg-dark border border-secondary text-info" style="font-size:9.5px">🕒 ' + esc(cat.pubTime) + '</span>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="cat-badge ' + cat.cls + '">' + esc(cat.badge) + '</span></td>' +
        '<td>' +
          '<div class="fw-bold text-white mb-1" style="font-size:0.95rem;">' + esc(cat.arTitle) + '</div>' +
          '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-1">' +
            '<span class="small text-secondary" dir="ltr" style="text-align:left;font-size:0.76rem;">' + esc(cat.enTitle).slice(0, 90) + '</span>' +
            '<div class="d-flex align-items-center gap-1">' +
              '<a href="' + esc(cat.url) + '" target="_blank" rel="noopener noreferrer" class="source-link-btn">🔗 اقرأ من المصدر (Yahoo) ↗</a>' +
              '<a href="' + esc(cat.finvizUrl) + '" target="_blank" rel="noopener noreferrer" class="source-link-btn finviz-btn">Finviz ↗</a>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td class="text-end fw-black text-white" dir="ltr">$' + fmt(price, dec) + '</td>' +
        '<td class="text-end" dir="ltr"><span class="' + (chg >= 0 ? 'up-pill' : 'down-pill') + '">' + (chg >= 0 ? '+' : '') + fmt(chg, 2) + '%</span></td>' +
        '<td class="text-end" dir="ltr">' +
          '<div class="fw-bold text-white">' + fmtBig(s.volume) + '</div>' +
          '<small class="text-info fw-bold">RVOL: ' + fmt(cat.rvol, 1) + 'x</small>' +
        '</td>' +
        '<td class="text-end fw-bold text-warning" dir="ltr">' + (isNum(s.floatShares) && s.floatShares > 0 ? fmtBig(s.floatShares) : '—') + '</td>' +
        '<td class="text-center">' +
          '<div class="fw-black fs-6" style="color:' + impColor + '">' + cat.impact + '%</div>' +
        '</td>' +
        '<td dir="ltr">' +
          '<div class="tp-mini-grid">' +
            '<span class="tp-chip" style="color:#4ade80">TP1: $' + fmt(cat.tp1, dec) + '</span>' +
            '<span class="tp-chip" style="color:#38bdf8">TP2: $' + fmt(cat.tp2, dec) + '</span>' +
            '<span class="tp-chip" style="color:#fde047">🌌 TP3: $' + fmt(cat.tp3, dec) + '</span>' +
            '<span class="tp-chip" style="color:#fb7185">SL: $' + fmt(cat.sl, dec) + '</span>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function renderAll() {
    renderVisualMagazine();
    renderCatalystPanels(allCatalystStocks);
    renderCatalystTable(allCatalystStocks);
  }

  /* ---------------- 9. فتح الشارت الفوري وأهداف القناص + زر المصدر ---------------- */
  function openStockSniperView(sym) {
    if (!sym) return;
    currentChartSym = sym;

    var s = allCatalystStocks.find(function (r) { return r.symbol === sym; });
    var sec = document.getElementById('newsSniperSection');
    var hud = document.getElementById('newsSniperHud');
    var badge = document.getElementById('newsChartBadge');
    if (!sec || !hud) return;

    sec.hidden = false;
    if (badge) badge.textContent = sym;

    if (s && s._cat) {
      var cat = s._cat;
      var p = num(s.price) || 0;
      var dec = cat.dec;
      hud.innerHTML =
        '<div class="sniper-news-hud">' +
          '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 pb-2 border-bottom border-secondary">' +
            '<div class="d-flex align-items-center gap-2 flex-wrap">' +
              '<span class="badge bg-warning text-dark fs-5 fw-black">' + esc(s.symbol) + '</span>' +
              '<span class="cat-badge ' + cat.cls + '">' + esc(cat.badge) + '</span>' +
              '<span class="text-white fw-bold">' + esc(cat.arTitle) + '</span>' +
            '</div>' +
            '<div class="d-flex align-items-center gap-2">' +
              '<a href="' + esc(cat.url) + '" target="_blank" rel="noopener noreferrer" class="source-link-btn">🔗 اقرأ الخبر من المصدر ↗</a>' +
              '<a href="' + esc(cat.finvizUrl) + '" target="_blank" rel="noopener noreferrer" class="source-link-btn finviz-btn">أخبار Finviz ↗</a>' +
              '<span class="badge bg-dark border border-warning text-warning fs-6">قوة الخبطة: ' + cat.impact + '% | R:R 1:' + cat.rr + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="sniper-t-grid" dir="ltr">' +
            '<div class="sniper-box" style="border-left:3px solid #38bdf8"><small class="text-secondary d-block fw-bold">⚡ ENTRY PRICE</small><b class="fs-5 text-white">$' + fmt(p, dec) + '</b></div>' +
            '<div class="sniper-box" style="border-left:3px solid #4ade80"><small class="text-secondary d-block fw-bold">🎯 TARGET 1 (Scalp)</small><b class="fs-5" style="color:#4ade80">$' + fmt(cat.tp1, dec) + '</b></div>' +
            '<div class="sniper-box" style="border-left:3px solid #38bdf8"><small class="text-secondary d-block fw-bold">🚀 TARGET 2 (Momentum)</small><b class="fs-5" style="color:#38bdf8">$' + fmt(cat.tp2, dec) + '</b></div>' +
            '<div class="sniper-box" style="border-left:3px solid #fde047"><small class="text-secondary d-block fw-bold">🌌 TARGET 3 (Moonshot)</small><b class="fs-5" style="color:#fde047">$' + fmt(cat.tp3, dec) + '</b></div>' +
            '<div class="sniper-box" style="border-left:3px solid #fb7185"><small class="text-secondary d-block fw-bold">🛡️ STOP LOSS</small><b class="fs-5" style="color:#fb7185">$' + fmt(cat.sl, dec) + '</b></div>' +
            '<div class="sniper-box" style="border-left:3px solid #c084fc"><small class="text-secondary d-block fw-bold">💎 FLOAT / RVOL</small><b class="fs-6 text-warning">' + fmtBig(s.floatShares) + ' / ' + fmt(cat.rvol, 1) + 'x</b></div>' +
          '</div>' +
        '</div>';
    } else {
      hud.innerHTML = '';
    }

    renderTvWidget(sym, currentTf);
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderTvWidget(sym, interval) {
    var container = document.getElementById('news_tv_container');
    if (!container) return;
    container.innerHTML = '<div id="news_tv_inner" style="height:500px;width:100%;"></div>';

    var build = function () {
      if (typeof TradingView === 'undefined') return;
      new TradingView.widget({
        autosize: true,
        symbol: sym,
        interval: interval,
        timezone: "America/New_York",
        theme: "dark",
        style: "1",
        locale: "ar_AE",
        toolbar_bg: "#090d16",
        enable_publishing: false,
        withdateranges: true,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        studies: ["VWAP@tv-basicstudies", "Volume@tv-basicstudies"],
        container_id: "news_tv_inner"
      });
    };

    if (typeof TradingView === 'undefined') {
      var sc = document.getElementById('tv-lib-news');
      if (!sc) {
        sc = document.createElement('script');
        sc.id = 'tv-lib-news';
        sc.src = 'https://s3.tradingview.com/tv.js';
        sc.async = true;
        sc.onload = build;
        document.head.appendChild(sc);
      } else {
        sc.addEventListener('load', build);
      }
    } else {
      build();
    }
  }

  /* ---------------- 10. مسح السوق عبر الـ Worker ---------------- */
  function postScan(filters, sortBy, sortOrder, limit) {
    return fetch(WORKER_BASE + '/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: filters,
        sort: { sortBy: sortBy, sortOrder: sortOrder },
        range: [0, limit]
      })
    }).then(function (r) { return r.json(); }).then(function (j) { return (j && j.data) ? j.data : []; });
  }

  var scanning = false;
  function scanCatalysts() {
    if (scanning) return;
    scanning = true;
    if (nfScanBtn) nfScanBtn.disabled = true;
    if (statusEl) statusEl.textContent = '⏳ جاري جلب الأخبار المصورة ومسح خبطات السوق...';

    var baseFilters = [
      { left: 'close', operation: 'in_range', right: [0.01, 50] },
      { left: 'volume', operation: 'greater', right: 150000 },
      { left: 'type', operation: 'equal', right: 'stock' }
    ];

    Promise.all([
      postScan(baseFilters, 'change', 'desc', 100),
      postScan(baseFilters, 'relative_volume_10d_calc', 'desc', 80).catch(function () { return []; }),
      postScan(baseFilters, 'change', 'asc', 35).catch(function () { return []; })
    ])
      .then(function (parts) {
        var map = {};
        var merged = [];
        parts.forEach(function (arr) {
          arr.forEach(function (s) {
            if (!s || !s.symbol || map[s.symbol]) return;
            map[s.symbol] = true;
            var cached = stockRealNewsMap[s.symbol];
            classifyAndScoreStock(
              s,
              cached ? cached.en : '',
              cached ? cached.ar : '',
              cached ? cached.time : 'مباشر الآن',
              cached ? cached.img : '',
              cached ? cached.url : ''
            );
            merged.push(s);
          });
        });

        merged.sort(function (a, b) { return b._cat.impact - a._cat.impact; });
        allCatalystStocks = merged;

        renderAll();
        fetchRealNewsForTopCatalysts(merged);

        var now = new Date();
        if (lastUpdateEl) lastUpdateEl.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
        if (statusEl) statusEl.textContent = '✅ البوابة محدثة (' + merged.length + ' خبر ومحفز نشط باللغة العربية)';
      })
      .catch(function (e) {
        if (statusEl) statusEl.textContent = '❌ تعذر التحديث: ' + (e.message || '');
      })
      .finally(function () {
        scanning = false;
        if (nfScanBtn) nfScanBtn.disabled = false;
      });
  }

  /* ---------------- 11. تفاعلات الصفحة والتبويبات ---------------- */
  document.addEventListener('click', function (e) {
    // السماح لزر "اقرأ من المصدر" بفتح الرابط في نافذة جديدة دون تفعيل نقر الكارت
    if (e.target.closest('.source-link-btn')) {
      e.stopPropagation();
      return;
    }

    var tab = e.target.closest('.mkt-tab');
    if (tab) {
      document.querySelectorAll('.mkt-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      activeCategory = tab.getAttribute('data-cat') || 'all';
      carouselOffset = 0;
      renderAll();
      return;
    }

    if (e.target.closest('#carouselNextBtn')) {
      carouselOffset += 4;
      renderVisualMagazine();
      return;
    }
    if (e.target.closest('#carouselPrevBtn')) {
      carouselOffset = Math.max(0, carouselOffset - 4);
      renderVisualMagazine();
      return;
    }

    var symEl = e.target.closest('[data-symbol]');
    if (symEl) {
      var sym = symEl.getAttribute('data-symbol');
      if (sym) openStockSniperView(sym);
      return;
    }

    var tfBtn = e.target.closest('.chart-tf-btn');
    if (tfBtn) {
      document.querySelectorAll('.chart-tf-btn').forEach(function (b) { b.classList.remove('active'); });
      tfBtn.classList.add('active');
      currentTf = tfBtn.getAttribute('data-tf');
      if (currentChartSym) renderTvWidget(currentChartSym, currentTf);
      return;
    }

    if (e.target.closest('#closeNewsChartBtn')) {
      var sec = document.getElementById('newsSniperSection');
      if (sec) sec.hidden = true;
      return;
    }

    if (e.target.closest('#sendToMainCalcBtn')) {
      if (currentChartSym) {
        localStorage.setItem('mh_cached_symbol', currentChartSym);
        window.location.href = 'index.html';
      }
    }
  });

  if (nfSearch) nfSearch.addEventListener('input', renderAll);
  if (nfScanBtn) nfScanBtn.addEventListener('click', scanCatalysts);

  function manageAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (nfAuto && nfAuto.checked) {
      autoTimer = setInterval(scanCatalysts, 15000);
    }
  }
  if (nfAuto) nfAuto.addEventListener('change', manageAuto);

  fetchGeneralMarketArabicNews();
  scanCatalysts();
  manageAuto();
})();