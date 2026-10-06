/**
 * Cloudflare Worker: وسيط بسيط بين صفحتك و Yahoo Finance.
 * بيحل مشكلتين: CORS (المتصفح بيمنع الاتصال المباشر)، و Yahoo بقى بيطلب cookie + crumb.
 *
 * الاستخدام بعد النشر:  https://اسم-الـworker.workers.dev/quote?symbol=NVDA
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SYMBOL_OK = /^[A-Za-z0-9.\-^=]{1,15}$/;
let sess = null; // { cookie, crumb, at }

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders() });
}

async function newSession() {
  const r = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual" });
  let cookies = [];
  if (typeof r.headers.getSetCookie === "function") cookies = r.headers.getSetCookie();
  else {
    const sc = r.headers.get("set-cookie");
    if (sc) cookies = sc.split(/,(?=[^;]+=)/);
  }
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("Yahoo لم يرجع cookie");

  const cr = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, "Cookie": cookie }
  });
  const crumb = (await cr.text()).trim();
  if (!cr.ok || !crumb || crumb.includes("<")) throw new Error("فشل جلب crumb: HTTP " + cr.status);

  sess = { cookie, crumb, at: Date.now() };
  return sess;
}

async function getSession(force) {
  if (!force && sess && Date.now() - sess.at < 25 * 60 * 1000) return sess;
  return newSession();
}

// بيجرب مرتين: لو Yahoo رفض الجلسة (401/403) بيعمل جلسة جديدة
async function yget(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await getSession(attempt > 0);
    const u = url + (url.includes("?") ? "&" : "?") + "crumb=" + encodeURIComponent(s.crumb);
    const r = await fetch(u, { headers: { "User-Agent": UA, "Cookie": s.cookie, "Accept": "application/json" } });
    if (r.status === 401 || r.status === 403) continue;
    if (!r.ok) throw new Error("Yahoo HTTP " + r.status);
    return r.json();
  }
  throw new Error("Yahoo رفض الجلسة (401/403)");
}

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

    const url = new URL(req.url);
    if (url.pathname === "/") return json({ ok: true, usage: "/quote?symbol=NVDA" });
    if (url.pathname !== "/quote") return json({ ok: false, error: "not found" }, 404);

    const sym = (url.searchParams.get("symbol") || "").trim().toUpperCase();
    if (!SYMBOL_OK.test(sym)) return json({ ok: false, error: "رمز السهم غير صالح" }, 400);

    try {
      const q = await yget("https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + encodeURIComponent(sym));
      const r = q && q.quoteResponse && q.quoteResponse.result && q.quoteResponse.result[0];
      if (!r) return json({ ok: false, error: "السهم غير موجود أو البيانات غير متاحة" }, 404);

      // الـ float مش دايمًا في quote، فنجرب quoteSummary كخطة بديلة
      let floatShares = r.floatShares != null ? r.floatShares : null;
      if (floatShares == null) {
        try {
          const s = await yget(
            "https://query2.finance.yahoo.com/v10/finance/quoteSummary/" + encodeURIComponent(sym) +
            "?modules=defaultKeyStatistics"
          );
          const ks = s && s.quoteSummary && s.quoteSummary.result && s.quoteSummary.result[0] &&
            s.quoteSummary.result[0].defaultKeyStatistics;
          floatShares = ks && ks.floatShares && ks.floatShares.raw != null ? ks.floatShares.raw : null;
        } catch (e) { /* اختياري */ }
      }

      return json({
        ok: true,
        data: {
          symbol: r.symbol,
          name: r.shortName || r.longName || r.symbol,
          currency: r.currency || "",
          exchange: r.fullExchangeName || r.exchange || "",
          marketState: r.marketState || null,
          price: r.regularMarketPrice ?? null,
          previousClose: r.regularMarketPreviousClose ?? null,
          change: r.regularMarketChange ?? null,
          changePct: r.regularMarketChangePercent ?? null,
          dayHigh: r.regularMarketDayHigh ?? null,
          dayLow: r.regularMarketDayLow ?? null,
          volume: r.regularMarketVolume ?? null,
          avgVolume3M: r.averageDailyVolume3Month ?? null,
          avgVolume10D: r.averageDailyVolume10Day ?? null,
          marketCap: r.marketCap ?? null,
          sharesOutstanding: r.sharesOutstanding ?? null,
          floatShares: floatShares,
          fiftyTwoHigh: r.fiftyTwoWeekHigh ?? null,
          fiftyTwoLow: r.fiftyTwoWeekLow ?? null
        }
      });
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 502);
    }
  }
};
