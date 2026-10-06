(function () {
  "use strict";

  const symbolEl = document.getElementById("symbol");
  const workerEl = document.getElementById("workerUrl");
  const btn = document.getElementById("fetchBtn");
  const statusEl = document.getElementById("status");
  const cardsEl = document.getElementById("cards");
  const readyEl = document.getElementById("ready");
  const rawEl = document.getElementById("rawJson");

  const PROXIES = [
    {
      name: "corsproxy.io",
      build: (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
    },
    {
      name: "allorigins.win",
      build: (u) =>
        "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    },
  ];
  const LOW = 20,
    HIGH = 50; // حدود الـ Free Float بالمليون سهم (نفس المحلل)

  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  workerEl.value =
    lsGet("sf-worker") ||
    "https://small-disk-18d3stock-proxy.osamaanit.workers.dev";
  workerEl.addEventListener("input", () =>
    lsSet("sf-worker", workerEl.value.trim()),
  );

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (type ? " " + type : "");
  }
  function esc(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function isNum(n) {
    return n !== null && n !== undefined && Number.isFinite(Number(n));
  }
  function fmtNum(n, d = 2) {
    return isNum(n)
      ? Number(n).toLocaleString("en-US", {
          maximumFractionDigits: d,
          minimumFractionDigits: d,
        })
      : null;
  }
  function fmtBig(n) {
    if (!isNum(n)) return null;
    n = Number(n);
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + " T";
    if (a >= 1e9) return (n / 1e9).toFixed(2) + " B";
    if (a >= 1e6) return (n / 1e6).toFixed(2) + " M";
    if (a >= 1e3) return (n / 1e3).toFixed(2) + " K";
    return n.toFixed(2);
  }
  function card(label, value, cls) {
    if (value === null || value === undefined || value === "") {
      value = "—";
      cls = "muted";
    }
    return (
      '<div class="card"><div class="label">' +
      esc(label) +
      '</div><div class="value ' +
      (cls || "") +
      '">' +
      esc(value) +
      "</div></div>"
    );
  }
  function getNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "object" && v.raw !== undefined) return getNumber(v.raw);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function timedFetch(url, ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
      return await fetch(url, { cache: "no-store", signal: c.signal });
    } finally {
      clearTimeout(t);
    }
  }

  function reason(e) {
    if (e && e.name === "AbortError") return "انتهت المهلة";
    if (e && e.name === "TypeError") return "الاتصال اتمنع (CORS أو الشبكة)";
    return (e && e.message) || "خطأ غير معروف";
  }

  /* ---------- المصدر 1: Worker الخاص بك (Float كامل) ---------- */
  async function viaWorker(symbol) {
    let base = workerEl.value.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(base)) base = "https://" + base;
    if (/(^|\/\/|\.)(yahoo|google)\./i.test(base)) {
      throw new Error(
        "الخانة دي لرابط الـ Worker بتاعك (بينتهي بـ workers.dev) مش رابط صفحة Yahoo. اعمل الـ Worker من الخطوات تحت، أو سيب الخانة فاضية.",
      );
    }
    let res;
    try {
      res = await timedFetch(
        base + "/quote?symbol=" + encodeURIComponent(symbol),
        12000,
      );
    } catch (e) {
      throw new Error("الـ Worker: " + reason(e) + " (راجع الرابط)");
    }
    let body = null;
    try {
      body = await res.json();
    } catch (e) {}
    if (!res.ok || !body || !body.ok) {
      throw new Error(
        "الـ Worker: " + ((body && body.error) || "HTTP " + res.status),
      );
    }
    return {
      source: "Trading View عبر الـ Worker الخاص بك",
      data: body.data,
      raw: body,
    };
  }

  /* ---------- المصدر 2: بروكسيات عامة (سعر وفوليوم بس) ---------- */
  async function viaProxies(symbol) {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?interval=1d&range=5d";
    const problems = [];
    for (const p of PROXIES) {
      try {
        const res = await timedFetch(p.build(url), 8000);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          throw new Error("الرد مش JSON");
        }
        const r =
          json && json.chart && json.chart.result && json.chart.result[0];
        if (!r || !r.meta || !r.meta.symbol) {
          throw new Error(
            (json &&
              json.chart &&
              json.chart.error &&
              json.chart.error.description) ||
              "السهم غير موجود",
          );
        }
        const m = r.meta;
        const price = getNumber(m.regularMarketPrice);
        const prev =
          getNumber(m.chartPreviousClose) ?? getNumber(m.previousClose);
        const change = price !== null && prev !== null ? price - prev : null;
        return {
          source: "بروكسي عام (" + p.name + ") — بدون Float",
          raw: json,
          data: {
            symbol: m.symbol,
            name: m.shortName || m.longName || m.symbol,
            currency: m.currency || "",
            exchange: m.fullExchangeName || m.exchangeName || "",
            marketState: m.marketState || null,
            price,
            previousClose: prev,
            change,
            changePct: change !== null && prev ? (change / prev) * 100 : null,
            dayHigh: getNumber(m.regularMarketDayHigh),
            dayLow: getNumber(m.regularMarketDayLow),
            volume: getNumber(m.regularMarketVolume),
            avgVolume3M: null,
            avgVolume10D: null,
            marketCap: null,
            sharesOutstanding: null,
            floatShares: null,
            fiftyTwoHigh: getNumber(m.fiftyTwoWeekHigh),
            fiftyTwoLow: getNumber(m.fiftyTwoWeekLow),
          },
        };
      } catch (e) {
        problems.push(p.name + " ← " + reason(e));
      }
    }
    const err = new Error("البروكسيات العامة فشلت: " + problems.join(" · "));
    err.problems = problems;
    throw err;
  }

  async function getStock(symbol) {
    if (workerEl.value.trim()) return viaWorker(symbol);
    try {
      return await viaProxies(symbol);
    } catch (e) {
      throw new Error(
        e.message +
          " — الحل: ابنِ الـ Worker (الخطوات تحت) والصق رابطه في الخانة فوق.",
      );
    }
  }

  /* ---------- عرض ---------- */
  function readyBlock(d) {
    const ffM = isNum(d.floatShares) ? d.floatShares / 1e6 : null;
    const volM = isNum(d.volume) ? d.volume / 1e6 : null;
    const avgM = isNum(d.avgVolume3M) ? d.avgVolume3M / 1e6 : null;
    const mc = isNum(d.marketCap) ? d.marketCap : null;
    const mcTxt =
      mc === null
        ? "—"
        : mc >= 1e9
          ? (mc / 1e9).toFixed(2) + " B"
          : (mc / 1e6).toFixed(2) + " M";
    const rvol = volM !== null && avgM ? volM / avgM : null;
    const rot = volM !== null && ffM ? volM / ffM : null;

    let verdict = "اكتب الـ Float يدويًا لأن المصدر ما رجّعوش";
    let cls = "muted";
    if (ffM !== null) {
      if (ffM <= LOW) {
        verdict =
          "Float خفيف (" +
          ffM.toFixed(2) +
          "M) — صفقة كويسة من ناحية الـ float";
        cls = "good";
      } else if (ffM <= HIGH) {
        verdict = "Float متوسط (" + ffM.toFixed(2) + "M) — صفقة متوسطة";
        cls = "mid";
      } else {
        verdict = "Float كبير (" + ffM.toFixed(2) + "M) — صفقة خطر";
        cls = "bad";
      }
    }

    const line =
      "Market Cap " +
      mcTxt +
      " | Price " +
      (fmtNum(d.price) || "—") +
      " | Free Float " +
      (ffM !== null ? ffM.toFixed(2) + " M" : "—") +
      " | Vol " +
      (volM !== null ? volM.toFixed(2) + " M" : "—") +
      " | Avg Vol " +
      (avgM !== null ? avgM.toFixed(2) + " M" : "—");

    readyEl.innerHTML =
      '<div class="ready"><h2>جاهز للمحلل</h2>' +
      '<div class="line">' +
      esc(line) +
      "</div>" +
      '<div class="line">RVOL ' +
      (rvol !== null ? rvol.toFixed(2) + "x" : "—") +
      " | Float Rot " +
      (rot !== null ? rot.toFixed(2) + "x" : "—") +
      "</div>" +
      '<div class="verdict ' +
      cls +
      '">' +
      esc(verdict) +
      "</div>" +
      '<div><button class="ghost" id="copyBtn" type="button">نسخ الأرقام</button></div></div>';

    const cb = document.getElementById("copyBtn");
    cb.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(line);
        cb.textContent = "✅ اتنسخ";
      } catch (e) {
        cb.textContent = "انسخها يدويًا من السطر اللي فوق";
      }
    });
  }

  function render(d) {
    const up = isNum(d.change) ? d.change >= 0 : null;
    let html = "";
    html += card("Symbol", d.symbol);
    html += card("Name", d.name);
    html += card(
      "Price",
      isNum(d.price) ? fmtNum(d.price) + " " + d.currency : null,
      "good",
    );
    html += card(
      "Change",
      fmtNum(d.change),
      up === null ? "muted" : up ? "good" : "bad",
    );
    html += card(
      "Change %",
      isNum(d.changePct) ? fmtNum(d.changePct) + "%" : null,
      up === null ? "muted" : up ? "good" : "bad",
    );
    html += card("Previous Close", fmtNum(d.previousClose));
    html += card("Day High", fmtNum(d.dayHigh));
    html += card("Day Low", fmtNum(d.dayLow));
    html += card("Volume", fmtBig(d.volume));
    html += card("Avg Volume (3M)", fmtBig(d.avgVolume3M));
    html += card("Market Cap", fmtBig(d.marketCap));
    html += card("Shares Float", fmtBig(d.floatShares));
    html += card("Shares Outstanding", fmtBig(d.sharesOutstanding));
    html += card("Market State", d.marketState);
    html += card("Exchange", d.exchange);
    html += card("52W High", fmtNum(d.fiftyTwoHigh));
    html += card("52W Low", fmtNum(d.fiftyTwoLow));
    cardsEl.innerHTML = html;
    readyBlock(d);
  }

  async function doFetch() {
    const sym = symbolEl.value.trim().toUpperCase();
    if (!sym) {
      setStatus("اكتب رمز السهم الأول", "err");
      return;
    }
    btn.disabled = true;
    setStatus("⏳ بيجيب أحدث البيانات...", "");
    cardsEl.innerHTML = "";
    readyEl.innerHTML = "";
    rawEl.textContent = "";
    try {
      const out = await getStock(sym);
      render(out.data);
      rawEl.textContent = JSON.stringify(out.raw, null, 2);
      setStatus("✅ " + out.data.symbol + " — المصدر: " + out.source, "ok");
    } catch (e) {
      setStatus("❌ " + e.message, "err");
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", doFetch);
  symbolEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doFetch();
  });
  doFetch();
})();
