/* ============================================================
   LIVE TRADINGVIEW CHART CONTROLLER (assets/js/chart.js)
============================================================ */
(function () {
  "use strict";

  let currentSymbol = '';
  let currentInterval = localStorage.getItem('mh_chart_interval') || '5';

  // استنتاج الثيم الحالي من الصفحة
  function getTheme() {
    return document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';
  }

  // بناء وتحديث شارت TradingView
  function renderLiveChart(symbol, scrollToChart = false) {
    if (!symbol) return;
    const cleanSym = String(symbol).trim().toUpperCase();
    if (!cleanSym) return;

    currentSymbol = cleanSym;

    const section = document.getElementById('chartSection');
    const container = document.getElementById('tv_chart_container');
    const badge = document.getElementById('chartSymbolBadge');
    const tvLink = document.getElementById('tvExternalLink');

    if (!section || !container) return;

    // إظهار قسم الشارت وتحديث العناوين
    section.hidden = false;
    if (badge) badge.textContent = cleanSym;
    if (tvLink) tvLink.href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(cleanSym)}`;

    // تفريغ الحاوية لإعادة بناء الشارت بالسهم الجديد
    container.innerHTML = '<div id="tv_widget_inner" style="height:100%;width:100%;"></div>';

    const createWidget = () => {
      if (typeof TradingView === 'undefined') return;
      new TradingView.widget({
        autosize: true,
        symbol: cleanSym,
        interval: currentInterval,
        timezone: "America/New_York", // توقيت السوق الأمريكي للشموع
        theme: getTheme(),
        style: "1", // شموع يابانية
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
    };

    // تحميل مكتبة TradingView مرة واحدة فقط عند الحاجة
    if (typeof TradingView === 'undefined') {
      let script = document.getElementById('tv- library-script');
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

    // الانتقال السلس للشارت عند اختيار السهم
    if (scrollToChart) {
      setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  // إتاحة الدالة بشكل عام لملفي scanner.js و calculator.js
  window.updateLiveChart = renderLiveChart;

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
      if (currentSymbol) renderLiveChart(currentSymbol, false);
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

  // تحديث مظهر الشارت تلقائياً عند الضغط على زر تبديل الثيم (Dark/Light)
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (currentSymbol) renderLiveChart(currentSymbol, false);
      }, 50);
    });
  }

  // الاستماع لحدث البحث في الحاسبة
  const getBtn = document.getElementById('get');
  if (getBtn) {
    getBtn.addEventListener('click', () => {
      const sym = document.getElementById('sym')?.value.trim().toUpperCase();
      if (sym) renderLiveChart(sym, false);
    });
  }

  // الاستماع لحدث مسح الكاش لإخفاء الشارت
  const clearBtn = document.getElementById('clearCache');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      currentSymbol = '';
      const section = document.getElementById('chartSection');
      const container = document.getElementById('tv_chart_container');
      if (section) section.hidden = true;
      if (container) container.innerHTML = '';
    });
  }

  // الاستماع المباشر للنقر على أي سهم في الاسكانر (الجداول أو اللوحات الـ 19)
  const scannerSection = document.getElementById('scannerSection');
  if (scannerSection) {
    scannerSection.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-symbol]');
      if (tr) {
        const sym = tr.getAttribute('data-symbol');
        if (sym) renderLiveChart(sym, true);
      }
    });
  }

  // تحميل السهم المحفوظ في الكاش عند فتح الصفحة
  window.addEventListener('DOMContentLoaded', () => {
    const savedSym = localStorage.getItem('mh_cached_symbol');
    if (savedSym) {
      renderLiveChart(savedSym, false);
    }
  });
})();