// /* ============================================================
//    LIVE TRADINGVIEW CHART CONTROLLER (assets/js/chart.js)
// ============================================================ */
// (function () {
//   "use strict";

//   let currentSymbol = '';
//   let currentInterval = localStorage.getItem('mh_chart_interval') || '5';

//   // استنتاج الثيم الحالي من الصفحة
//   function getTheme() {
//     return document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';
//   }

//   // بناء وتحديث شارت TradingView
//   function renderLiveChart(symbol, scrollToChart = false) {
//     if (!symbol) return;
//     const cleanSym = String(symbol).trim().toUpperCase();
//     if (!cleanSym) return;

//     currentSymbol = cleanSym;

//     const section = document.getElementById('chartSection');
//     const container = document.getElementById('tv_chart_container');
//     const badge = document.getElementById('chartSymbolBadge');
//     const tvLink = document.getElementById('tvExternalLink');

//     if (!section || !container) return;

//     // إظهار قسم الشارت وتحديث العناوين
//     section.hidden = false;
//     if (badge) badge.textContent = cleanSym;
//     if (tvLink) tvLink.href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(cleanSym)}`;

//     // تفريغ الحاوية لإعادة بناء الشارت بالسهم الجديد
//     container.innerHTML = '<div id="tv_widget_inner" style="height:100%;width:100%;"></div>';

//     const createWidget = () => {
//       if (typeof TradingView === 'undefined') return;
//       new TradingView.widget({
//         autosize: true,
//         symbol: cleanSym,
//         interval: currentInterval,
//         timezone: "America/New_York", // توقيت السوق الأمريكي للشموع
//         theme: getTheme(),
//         style: "1", // شموع يابانية
//         locale: "ar_AE",
//         toolbar_bg: "#f1f3f6",
//         enable_publishing: false,
//         withdateranges: true,
//         hide_side_toolbar: false,
//         allow_symbol_change: true,
//         save_image: true,
//         details: true,
//         hotlist: false,
//         calendar: false,
//         studies: [
//           "VWAP@tv-basicstudies",
//           "Volume@tv-basicstudies"
//         ],
//         container_id: "tv_widget_inner"
//       });
//     };

//     // تحميل مكتبة TradingView مرة واحدة فقط عند الحاجة
//     if (typeof TradingView === 'undefined') {
//       let script = document.getElementById('tv- library-script');
//       if (!script) {
//         script = document.createElement('script');
//         script.id = 'tv-library-script';
//         script.src = 'https://s3.tradingview.com/tv.js';
//         script.async = true;
//         script.onload = createWidget;
//         document.head.appendChild(script);
//       } else {
//         script.addEventListener('load', createWidget);
//       }
//     } else {
//       createWidget();
//     }

//     // الانتقال السلس للشارت عند اختيار السهم
//     if (scrollToChart) {
//       setTimeout(() => {
//         section.scrollIntoView({ behavior: 'smooth', block: 'start' });
//       }, 100);
//     }
//   }

//   // إتاحة الدالة بشكل عام لملفي scanner.js و calculator.js
//   window.updateLiveChart = renderLiveChart;

//   // تفعيل أزرار الفريمات الزمنية (1m, 5m, 15m, 1H, D)
//   document.querySelectorAll('.chart-tf').forEach(btn => {
//     if (btn.getAttribute('data-tf') === currentInterval) {
//       btn.classList.add('active');
//     } else {
//       btn.classList.remove('active');
//     }

//     btn.addEventListener('click', function () {
//       document.querySelectorAll('.chart-tf').forEach(b => b.classList.remove('active'));
//       this.classList.add('active');
//       currentInterval = this.getAttribute('data-tf');
//       localStorage.setItem('mh_chart_interval', currentInterval);
//       if (currentSymbol) renderLiveChart(currentSymbol, false);
//     });
//   });

//   // زر إخفاء/طي الشارت
//   const toggleBtn = document.getElementById('toggleChartBtn');
//   const chartBody = document.getElementById('chartCardBody');
//   if (toggleBtn && chartBody) {
//     toggleBtn.addEventListener('click', () => {
//       const isHidden = chartBody.hidden;
//       chartBody.hidden = !isHidden;
//       toggleBtn.textContent = isHidden ? '🔼 طي الشارت' : '🔽 إظهار الشارت';
//     });
//   }

//   // تحديث مظهر الشارت تلقائياً عند الضغط على زر تبديل الثيم (Dark/Light)
//   const themeBtn = document.getElementById('themeToggle');
//   if (themeBtn) {
//     themeBtn.addEventListener('click', () => {
//       setTimeout(() => {
//         if (currentSymbol) renderLiveChart(currentSymbol, false);
//       }, 50);
//     });
//   }

//   // الاستماع لحدث البحث في الحاسبة
//   const getBtn = document.getElementById('get');
//   if (getBtn) {
//     getBtn.addEventListener('click', () => {
//       const sym = document.getElementById('sym')?.value.trim().toUpperCase();
//       if (sym) renderLiveChart(sym, false);
//     });
//   }

//   // الاستماع لحدث مسح الكاش لإخفاء الشارت
//   const clearBtn = document.getElementById('clearCache');
//   if (clearBtn) {
//     clearBtn.addEventListener('click', () => {
//       currentSymbol = '';
//       const section = document.getElementById('chartSection');
//       const container = document.getElementById('tv_chart_container');
//       if (section) section.hidden = true;
//       if (container) container.innerHTML = '';
//     });
//   }

//   // الاستماع المباشر للنقر على أي سهم في الاسكانر (الجداول أو اللوحات الـ 19)
//   const scannerSection = document.getElementById('scannerSection');
//   if (scannerSection) {
//     scannerSection.addEventListener('click', (e) => {
//       const tr = e.target.closest('tr[data-symbol]');
//       if (tr) {
//         const sym = tr.getAttribute('data-symbol');
//         if (sym) renderLiveChart(sym, true);
//       }
//     });
//   }

//   // تحميل السهم المحفوظ في الكاش عند فتح الصفحة
//   window.addEventListener('DOMContentLoaded', () => {
//     const savedSym = localStorage.getItem('mh_cached_symbol');
//     if (savedSym) {
//       renderLiveChart(savedSym, false);
//     }
//   });
// })();

















/* ============================================================================
   LIVE TRADINGVIEW CHART + AI SNIPER SIGNAL HUD (assets/js/chart.js) - FIXED
   يفصل لوحة التوصيات عن حاوية الشارت ويضمن ظهور الشارت بارتفاع كامل دائماً
============================================================================ */
(function () {
  "use strict";

  let currentSymbol = '';
  let currentInterval = localStorage.getItem('mh_chart_interval') || '5';
  let lastSignalPayload = null;
  let lastRenderedKey = ''; // لمنع هدم الشارت وإعادة بنائه مرتين في نفس اللحظة

  function getTheme() {
    return document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';
  }

  function isNum(n) { return n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)); }
  function fmt(n, d) {
    if (!isNum(n)) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* ---------------- 1. حقن تصميم لوحة التوصيات + تأمين ارتفاع الشارت ---------------- */
  function injectChartHudStyles() {
    if (document.getElementById('sniper-chart-hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'sniper-chart-hud-styles';
    style.textContent = `
      /* ضمان ظهور الشارت دائماً بارتفاع واضح وعدم اختفائه أبداً */
      #tv_chart_container {
        min-height: 520px !important;
        height: 520px !important;
        width: 100% !important;
        display: block !important;
        position: relative !important;
      }
      #tv_widget_inner {
        height: 520px !important;
        width: 100% !important;
      }

      /* تصميم لوحة القناص (TP1 / TP2 / TP3 / SL) */
      .sniper-hud-box {
        background: linear-gradient(145deg, #070b14 0%, #0f172a 100%);
        border: 1px solid #1e293b;
        border-top: 3px solid #38bdf8;
        border-radius: 10px;
        padding: 12px 14px;
        margin-bottom: 12px;
        color: #ffffff;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        box-shadow: 0 12px 32px rgba(0,0,0,0.65);
      }
      .sniper-hud-box.grade-s { border-top-color: #facc15; box-shadow: 0 0 25px rgba(250, 204, 21, 0.18); }
      .sniper-hud-box.grade-a { border-top-color: #4ade80; }
      .sniper-hud-box.grade-danger { border-top-color: #f43f5e; }

      .sniper-top-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.09);
      }
      .sniper-title-grp { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .sniper-sym-badge {
        font-size: 18px;
        font-weight: 900;
        color: #ffffff;
        background: #1e293b;
        padding: 3px 10px;
        border-radius: 6px;
        border: 1px solid #38bdf8;
        letter-spacing: 0.5px;
      }
      .sniper-verdict-badge {
        font-size: 13px;
        font-weight: 900;
        padding: 4px 12px;
        border-radius: 6px;
        letter-spacing: 0.3px;
      }
      .sv-sniper { background: linear-gradient(135deg, #f59e0b, #dc2626); color: #fff; box-shadow: 0 0 14px rgba(245,158,11,0.5); }
      .sv-enter  { background: linear-gradient(135deg, #16a34a, #059669); color: #fff; }
      .sv-watch  { background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; }
      .sv-wait   { background: #334155; color: #e2e8f0; }
      .sv-danger { background: linear-gradient(135deg, #be123c, #991b1b); color: #fff; }

      .sniper-power-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #090d16;
        padding: 5px 12px;
        border-radius: 6px;
        border: 1px solid #1e293b;
      }
      .sniper-power-bar {
        width: 90px;
        height: 8px;
        background: #1e293b;
        border-radius: 4px;
        overflow: hidden;
      }
      .sniper-power-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
      }

      .sniper-targets-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(120px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      @media (max-width: 1100px) { .sniper-targets-grid { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 640px)  { .sniper-targets-grid { grid-template-columns: repeat(2, 1fr); } }

      .sniper-t-card {
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        transition: transform 0.12s, border-color 0.12s;
      }
      .sniper-t-card:hover { transform: translateY(-2px); border-color: #38bdf8; }
      .sniper-t-card.c-entry { border-left: 3px solid #38bdf8; }
      .sniper-t-card.c-tp1   { border-left: 3px solid #4ade80; cursor: pointer; }
      .sniper-t-card.c-tp2   { border-left: 3px solid #22d3ee; cursor: pointer; }
      .sniper-t-card.c-tp3   { border-left: 3px solid #facc15; background: linear-gradient(160deg, rgba(66,32,6,0.45), rgba(15,23,42,0.9)); cursor: pointer; }
      .sniper-t-card.c-sl    { border-left: 3px solid #fb7185; cursor: pointer; }
      .sniper-t-card.c-rr    { border-left: 3px solid #c084fc; }

      .st-lbl { font-size: 10.5px; font-weight: 800; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
      .st-val { font-size: 16px; font-weight: 900; color: #ffffff; margin: 3px 0; font-variant-numeric: tabular-nums; }
      .st-pct { font-size: 11px; font-weight: 800; }
      .st-apply-hint { font-size: 9.5px; color: #38bdf8; opacity: 0.9; }

      .sniper-signals-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed rgba(255,255,255,0.1);
      }
      .cosmic-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 800;
        padding: 3px 9px;
        border-radius: 5px;
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid #334155;
      }
      .cosmic-pill.sig-gold {
        background: linear-gradient(135deg, #422006, #713f12);
        color: #fde047;
        border-color: #eab308;
      }
      .cosmic-pill.sig-bull {
        background: rgba(22, 163, 74, 0.22);
        color: #4ade80;
        border-color: rgba(74, 222, 128, 0.4);
      }
      .cosmic-pill.sig-warn {
        background: rgba(225, 29, 72, 0.22);
        color: #fda4af;
        border-color: rgba(251, 113, 133, 0.4);
      }
    `;
    document.head.appendChild(style);
  }
  injectChartHudStyles();

  /* ---------------- 2. حساب وبناء لوحة التوصيات (TP1, TP2, TP3, SL) ---------------- */
  function buildSignalFromInputsOrData(sym, customData) {
    if (customData && isNum(customData.tp1) && isNum(customData.price)) return customData;

    const buyEl = document.getElementById('buy');
    const price = (customData && isNum(customData.price)) ? Number(customData.price) : (buyEl ? parseFloat(buyEl.value) : 0);
    if (!price || price <= 0) return null;

    const chg = (customData && isNum(customData.chg)) ? Number(customData.chg) : 6;
    const volPct = Math.min(0.35, Math.max(Math.abs(chg) / 100, 0.05));

    const tp1 = price * (1 + Math.max(0.04, volPct * 0.55));
    const tp2 = price * (1 + Math.max(0.09, volPct * 1.10));
    const tp3 = price * (1 + Math.max(0.16, volPct * 1.85));
    const sl  = price * (1 - Math.min(0.09, Math.max(0.025, volPct * 0.35)));
    const risk = Math.max(0.0001, price - sl);
    const rr = ((tp2 - price) / risk).toFixed(1);
    const dec = price < 1 ? 4 : 2;

    return {
      symbol: sym,
      price: price,
      entryZone: `${fmt(price * 0.995, dec)} - ${fmt(price, dec)}`,
      tp1: tp1,
      tp2: tp2,
      tp3: tp3,
      sl: sl,
      rr: rr,
      momo: customData?.momo || 75,
      setupName: 'VWAP & Momentum Breakout',
      label: '🎯 توصية فنية نشطة',
      cls: 'enter',
      cosmicSignals: ['📈 تحديد أهداف تلقائي بناءً على التذبذب', '🟢 راقب ثبات السهم أعلى خط VWAP على الشارت'],
      risks: []
    };
  }

  function renderChartSignalHud(sym, rawSignal) {
    const section = document.getElementById('chartSection');
    const container = document.getElementById('tv_chart_container');
    if (!section || !container) return;

    // وضع لوحة التوصيات قبل حاوية الشارت مباشرة بدون التأثير على أبعاد الشارت
    let hudContainer = document.getElementById('chartSniperHud');
    if (!hudContainer) {
      hudContainer = document.createElement('div');
      hudContainer.id = 'chartSniperHud';
      container.parentNode.insertBefore(hudContainer, container);
    }

    const sourceSig = rawSignal || (window.__lastScannerSignal && window.__lastScannerSignal[sym]) || null;
    const sig = buildSignalFromInputsOrData(sym, sourceSig);
    if (!sig || !sig.price) {
      hudContainer.innerHTML = '';
      return;
    }
    lastSignalPayload = sig;

    const p = Number(sig.price);
    const dec = p < 1 ? 4 : 2;
    const tp1 = Number(sig.tp1 || p * 1.05);
    const tp2 = Number(sig.tp2 || p * 1.10);
    const tp3 = Number(sig.tp3 || p * 1.18);
    const sl  = Number(sig.sl  || p * 0.96);

    const tp1Pct = (((tp1 - p) / p) * 100).toFixed(1);
    const tp2Pct = (((tp2 - p) / p) * 100).toFixed(1);
    const tp3Pct = (((tp3 - p) / p) * 100).toFixed(1);
    const slPct  = (((p - sl) / p) * 100).toFixed(1);

    const badgeCls = sig.cls === 'sniper' ? 'sv-sniper' :
                     sig.cls === 'enter'  ? 'sv-enter' :
                     sig.cls === 'watch'  ? 'sv-watch' :
                     (sig.cls === 'danger' || sig.cls === 'unstable') ? 'sv-danger' : 'sv-wait';

    const boxCls = sig.cls === 'sniper' ? 'grade-s' :
                   sig.cls === 'enter'  ? 'grade-a' :
                   sig.cls === 'danger' ? 'grade-danger' : '';

    const momoScore = Number(sig.momo) || 70;
    const barColor = momoScore >= 80 ? '#facc15' : momoScore >= 68 ? '#4ade80' : momoScore >= 50 ? '#38bdf8' : '#fb7185';

    const cosmicList = sig.cosmicSignals || sig.signals || [];
    const cosmicHtml = cosmicList.map((s, idx) =>
      `<span class="cosmic-pill ${idx === 0 && momoScore >= 78 ? 'sig-gold' : 'sig-bull'}">${esc(s)}</span>`
    ).join('');

    const risksHtml = (sig.risks || []).map(r =>
      `<span class="cosmic-pill sig-warn">${esc(r)}</span>`
    ).join('');

    hudContainer.innerHTML = `
      <div class="sniper-hud-box ${boxCls}" dir="rtl">
        <div class="sniper-top-row">
          <div class="sniper-title-grp">
            <span class="sniper-sym-badge">${esc(sym)}</span>
            <span class="sniper-verdict-badge ${badgeCls}">${esc(sig.label || '🎯 إشارة نشطة')}</span>
            <span style="font-size:12px;color:#cbd5e1;font-weight:700">
              الاستراتيجية: <b style="color:#38bdf8">${esc(sig.setupName || 'VWAP & Momentum Breakout')}</b>
            </span>
          </div>
          <div class="sniper-power-wrap">
            <span style="font-size:11px;color:#94a3b8;font-weight:800">قوة الإشارة الكونية:</span>
            <div class="sniper-power-bar">
              <div class="sniper-power-fill" style="width:${momoScore}%;background:${barColor}"></div>
            </div>
            <b style="color:${barColor};font-size:13px">${momoScore}%</b>
          </div>
        </div>

        <div class="sniper-targets-grid" dir="ltr">
          <div class="sniper-t-card c-entry">
            <div class="st-lbl"><span>⚡ ENTRY ZONE</span><span>منطقة الدخول</span></div>
            <div class="st-val">$${fmt(p, dec)}</div>
            <div class="st-pct" style="color:#38bdf8">Zone: $${esc(sig.entryZone || fmt(p, dec))}</div>
          </div>

          <div class="sniper-t-card c-tp1" data-apply-target="${tp1.toFixed(dec)}" title="اضغط لإرسال TP1 إلى الحاسبة">
            <div class="st-lbl"><span>🎯 TARGET 1 (Scalp)</span><span class="st-apply-hint">تطبيق ↵</span></div>
            <div class="st-val" style="color:#4ade80">$${fmt(tp1, dec)}</div>
            <div class="st-pct" style="color:#4ade80">+${tp1Pct}% (بيع 40%)</div>
          </div>

          <div class="sniper-t-card c-tp2" data-apply-target="${tp2.toFixed(dec)}" title="اضغط لإرسال TP2 إلى الحاسبة">
            <div class="st-lbl"><span>🚀 TARGET 2 (Momentum)</span><span class="st-apply-hint">تطبيق ↵</span></div>
            <div class="st-val" style="color:#22d3ee">$${fmt(tp2, dec)}</div>
            <div class="st-pct" style="color:#22d3ee">+${tp2Pct}% (بيع 40%)</div>
          </div>

          <div class="sniper-t-card c-tp3" data-apply-target="${tp3.toFixed(dec)}" title="اضغط لإرسال TP3 إلى الحاسبة">
            <div class="st-lbl"><span style="color:#fde047">🌌 TARGET 3 (Moonshot)</span><span class="st-apply-hint">تطبيق ↵</span></div>
            <div class="st-val" style="color:#facc15">$${fmt(tp3, dec)}</div>
            <div class="st-pct" style="color:#fde047">+${tp3Pct}% (بيع 20%)</div>
          </div>

          <div class="sniper-t-card c-sl" data-apply-target="${sl.toFixed(dec)}" title="اضغط لتجربة وقف الخسارة في الحاسبة">
            <div class="st-lbl"><span>🛡️ STOP LOSS (وقف خسارة)</span><span class="st-apply-hint">تطبيق ↵</span></div>
            <div class="st-val" style="color:#fb7185">$${fmt(sl, dec)}</div>
            <div class="st-pct" style="color:#fda4af">-${slPct}% (كسر الدعم)</div>
          </div>

          <div class="sniper-t-card c-rr">
            <div class="st-lbl"><span>⚖️ RISK / REWARD</span><span>العائد للمخاطرة</span></div>
            <div class="st-val" style="color:#c084fc">1 : ${esc(sig.rr || '2.8')}</div>
            <div class="st-pct" style="color:#e2e8f0">ارفع الوقف للدخول بعد TP1</div>
          </div>
        </div>

        <div class="sniper-signals-row">
          <span style="font-size:11px;color:#94a3b8;font-weight:800">⚡ الإشارات الكونية:</span>
          ${cosmicHtml || '<span class="cosmic-pill sig-bull">📊 حركة سعرية نشطة</span>'}
          ${risksHtml}
        </div>
      </div>
    `;

    hudContainer.querySelectorAll('[data-apply-target]').forEach(card => {
      card.addEventListener('click', function () {
        const targetVal = this.getAttribute('data-apply-target');
        const buyInp = document.getElementById('buy');
        const sellInp = document.getElementById('sell');
        if (buyInp && (!buyInp.value || parseFloat(buyInp.value) <= 0)) {
          buyInp.value = p;
        }
        if (sellInp && targetVal) {
          sellInp.value = targetVal;
          if (typeof window.calc === 'function') window.calc();
          sellInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }

  /* ---------------- 3. بناء وتحديث شارت TradingView بدون اختفاء ---------------- */
  function renderLiveChart(symbol, scrollToChart = false, signalData = null, forceRebuild = false) {
    if (!symbol) return;
    const cleanSym = String(symbol).trim().toUpperCase();
    if (!cleanSym) return;

    currentSymbol = cleanSym;

    const section = document.getElementById('chartSection');
    const chartBody = document.getElementById('chartCardBody');
    const container = document.getElementById('tv_chart_container');
    const badge = document.getElementById('chartSymbolBadge');
    const tvLink = document.getElementById('tvExternalLink');
    const toggleBtn = document.getElementById('toggleChartBtn');

    if (!section || !container) return;

    // التأكد من إظهار قسم الشارت وجسم البطاقة حتى لو كان مطوياً
    section.hidden = false;
    section.style.display = '';
    if (chartBody && chartBody.hidden) {
      chartBody.hidden = false;
      if (toggleBtn) toggleBtn.textContent = '🔼 طي الشارت';
    }

    if (badge) badge.textContent = cleanSym;
    if (tvLink) tvLink.href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(cleanSym)}`;

    // تحديث لوحة التوصيات دائماً
    renderChartSignalHud(cleanSym, signalData);

    // منع إعادة بناء الـ iframe إذا كان نفس السهم ونفس الفريم ونفس الثيم مفتوحاً بالفعل
    const renderKey = `${cleanSym}_${currentInterval}_${getTheme()}`;
    const hasIframe = container.querySelector('iframe');
    if (!forceRebuild && renderKey === lastRenderedKey && hasIframe) {
      if (scrollToChart) {
        setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
      return;
    }
    lastRenderedKey = renderKey;

    // إعطاء ارتفاع صريح بالبيكسل للحاوية الداخلية لضمان عدم اختفاء الشارت
    container.innerHTML = '<div id="tv_widget_inner" style="height:520px;width:100%;"></div>';

    const createWidget = () => {
      if (typeof TradingView === 'undefined' || ! TradingView.widget) return;
      try {
        new TradingView.widget({
          autosize: true,
          symbol: cleanSym,
          interval: currentInterval,
          timezone: "America/New_York",
          theme: getTheme(),
          style: "1",
          locale: "ar_AE",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          save_image: true,
          details: true,
          hotlist: false,
          calendar: false,
          studies: [
            "VWAP@tv-basicstudies",
            "Volume@tv-basicstudies"
          ],
          container_id: "tv_widget_inner"
        });
      } catch (err) {
        console.error('TradingView Widget Error:', err);
      }
    };

    if (typeof TradingView === 'undefined') {
      let script = document.getElementById('tv-library-script');
      if (!script) {
        script = document.createElement('script');
        script.id = 'tv-library-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = createWidget;
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', createWidget);
      }
    } else {
      createWidget();
    }

    if (scrollToChart) {
      setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  window.updateLiveChart = renderLiveChart;
  window.updateChartSignals = renderChartSignalHud;

  // تفعيل أزرار الفريمات الزمنية (1m, 5m, 15m, 1H, D)
  document.querySelectorAll('.chart-tf').forEach(btn => {
    if (btn.getAttribute('data-tf') === currentInterval) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', function () {
      document.querySelectorAll('.chart-tf').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentInterval = this.getAttribute('data-tf');
      localStorage.setItem('mh_chart_interval', currentInterval);
      if (currentSymbol) renderLiveChart(currentSymbol, false, lastSignalPayload, true);
    });
  });

  // زر إخفاء/طي الشارت
  const toggleBtn = document.getElementById('toggleChartBtn');
  const chartBody = document.getElementById('chartCardBody');
  if (toggleBtn && chartBody) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = chartBody.hidden;
      chartBody.hidden = !isHidden;
      toggleBtn.textContent = isHidden ? '🔼 طي الشارت' : '🔽 إظهار الشارت';
    });
  }

  // تحديث مظهر الشارت تلقائياً عند الضغط على زر تبديل الثيم
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (currentSymbol) renderLiveChart(currentSymbol, false, lastSignalPayload, true);
      }, 50);
    });
  }

  // الاستماع لحدث البحث في الحاسبة
  const getBtn = document.getElementById('get');
  if (getBtn) {
    getBtn.addEventListener('click', () => {
      const sym = document.getElementById('sym')?.value.trim().toUpperCase();
      if (sym) {
        const sigData = window.__lastScannerSignal ? window.__lastScannerSignal[sym] : null;
        renderLiveChart(sym, false, sigData, false);
        // تحديث الأهداف مرة أخرى بعد جلب السعر من الـ API الخاص بالحاسبة
        setTimeout(() => renderChartSignalHud(sym, window.__lastScannerSignal?.[sym] || null), 600);
      }
    });
  }

  // الاستماع لحدث مسح الكاش لإخفاء الشارت
  const clearBtn = document.getElementById('clearCache');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      currentSymbol = '';
      lastSignalPayload = null;
      lastRenderedKey = '';
      const section = document.getElementById('chartSection');
      const container = document.getElementById('tv_chart_container');
      const hud = document.getElementById('chartSniperHud');
      if (section) section.hidden = true;
      if (container) container.innerHTML = '';
      if (hud) hud.innerHTML = '';
    });
  }

  // الاستماع المباشر للنقر على أي سهم في الاسكانر
  const scannerSection = document.getElementById('scannerSection');
  if (scannerSection) {
    scannerSection.addEventListener('click', (e) => {
      const tr = e.target.closest('[data-symbol]');
      if (tr) {
        const sym = tr.getAttribute('data-symbol');
        if (sym) {
          const sigData = window.__lastScannerSignal ? window.__lastScannerSignal[sym] : null;
          renderLiveChart(sym, true, sigData, false);
        }
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    const savedSym = localStorage.getItem('mh_cached_symbol');
    if (savedSym) {
      renderLiveChart(savedSym, false);
    }
  });
})();