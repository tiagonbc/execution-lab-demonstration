// Home and single-stock pages: a headline number over a scrubbing chart, list cards, and an order ticket.
import { store, C, $, $$, esc, f0, f1, f2, money, shares, cur, clock, longDate, signed, ic, tile, iconTile, scrub, seg, onSeg, tag, findInst, instKey, instruments, watch } from "./ui.js";
import * as E from "./engine.js";
import { opsData } from "./pages-sim.js";

const TESTS = 15;
const shortDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
const RANGE_WORD = { "1M": "past month", "3M": "past 3 months", "6M": "past 6 months", YTD: "year to date", "1Y": "past year", "3Y": "past 3 years" };

// ================================================================= HOME
const METRICS = {
  ca: [
    ["vol", "Volatility", "xiu_vol", "% a year", 1, -1, "TSX volatility: how much the TSX 60 has moved over the last 20 days, as a yearly rate. Calmer markets are cheaper to trade, so a fall shows in green."],
    ["b50", "Uptrends", "b50", "% of names", 0, 1, "Share of the 240 most-traded TSX names trading above their 50-day average price. More names taking part means deeper, steadier liquidity."],
    ["flow", "Money flow", "flow", "% into risers", 1, 1, "Of every dollar traded on the TSX over ten days, the share that went through stocks that closed up. Above 50%, buyers are paying up."],
  ],
  us: [
    ["vol", "Volatility", "spy_vol", "% a year", 1, -1, "US volatility: how much the S&P 500 has moved over the last 20 days, as a yearly rate. Calmer markets are cheaper to trade, so a fall shows in green."],
    ["b50", "Uptrends", "us_b50", "% of ETFs", 0, 1, "Share of 21 broad, style and sector ETFs trading above their 50-day average price."],
    ["b200", "Long trends", "us_b200", "% of ETFs", 0, 1, "Share of the same ETFs trading above their 200-day average price."],
  ],
};
const hs = { mkt: "ca", metric: "vol", range: "6M", tab: "top", listMkt: "CA", sort: 0, promo: 0 };
export const homeState = hs;
const SORTS = [["adv_val", -1, "by value traded per day"], ["vol_ann", -1, "most volatile first"], ["vol_ann", 1, "calmest first"]];

function upcoming() {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const out = [], nth = (y, m, wd, n) => { const d = new Date(y, m, 1, 12); let c = 0; while (true) { if (d.getDay() === wd && ++c === n) return new Date(d); d.setDate(d.getDate() + 1); } };
  const lastWd = (y, m, wd) => { const d = new Date(y, m + 1, 0, 12); while (d.getDay() !== wd) d.setDate(d.getDate() - 1); return d; };
  for (let k = 0; k < 5; k++) {
    const y = today.getFullYear() + Math.floor((today.getMonth() + k) / 12), m = (today.getMonth() + k) % 12;
    const third = nth(y, m, 5, 3), q = [2, 5, 8, 11].includes(m);
    out.push({ d: third, cls: q ? "q" : "", tagText: q ? "Reb" : "Exp", what: q ? "Quarterly expiry and index rebalance: about twice the normal TSX volume" : "Monthly options expiry" });
    const end = new Date(y, m + 1, 0, 12); while ([0, 6].includes(end.getDay())) end.setDate(end.getDate() - 1);
    out.push({ d: end, cls: "m", tagText: "End", what: "Month-end: funds rebalance into the close" });
    const us = { 0: nth(y, 0, 1, 3), 4: lastWd(y, 4, 1), 5: new Date(y, 5, 19, 12), 6: new Date(y, 6, 4, 12), 10: nth(y, 10, 4, 4) }[m];
    if (us && ![0, 6].includes(us.getDay())) out.push({ d: us, cls: "h", tagText: "US", what: "US market closed, TSX open: about a third of normal TSX volume" });
  }
  return out.filter((e) => e.d >= today).sort((a, b) => a.d - b.d).slice(0, 8);
}

export function home() {
  const D = store.D, R = D.regime, T = D.timing, ry = findInst("CA:RY");
  const ev = Object.fromEntries(T.events.map((e) => [e.k, e]));
  const qty = Math.round(ry.adv_sh * 0.05), o = { side: 1, qty, start: 0, end: 390 };
  const mc = E.monteCarlo(ry, o, E.ALGOS.map((a) => a.id), 200, 17, { signalQ: 0.1 }, { useClose: true });
  const ranked = Object.values(mc).sort((a, b) => a.mean - b.mean), nameOf = (id) => E.ALGOS.find((a) => a.id === id).name;
  const det = { c: 0, n: 0, f: 0 };
  for (let s = 1; s <= 20; s++) {
    const x = E.simulateFlow(ry, {}, s), sc = E.scoreFlow(x, E.detectIcebergs(x.prints), E.detectParents(x.prints), E.detectBursts(x.prints, x.T));
    det.c += sc.ice.caught + sc.par.caught + sc.tox.caught; det.n += sc.ice.detectable + sc.par.detectable + 1; det.f += sc.ice.falseAlarms + sc.par.falseAlarms + sc.tox.falseAlarms;
  }
  const O = opsData(), planted = Object.keys(O.incidents).length, caught = Object.keys(O.incidents).filter((d) => O.alerts.some((a) => a.d === +d)).length;
  const qrow = (icon, title, ans, val, sub, href) => `<a class="row wrapt" href="#${href}">${iconTile(icon)}<span><span class="r-t">${title}</span><span class="r-s">${ans}</span></span><span class="r-v">${val}<small>${sub}</small></span></a>`;
  const map = [
    ["Build quantitative models that describe and predict how markets move: liquidity profiles, price movement, market microstructure", "Liquidity map for 240 TSX names and US names; volatility, range and volume forecasts scored on unseen data", "/market", "Market structure", "/timing", "Timing"],
    ["Model the characteristics of order flow, including flow toxicity and classification of activity", "Simulated book with iceberg, sliced-order and aggressive-burst detectors, a one-sidedness gauge, and buy/sell classification", "/flow", "Order flow"],
    ["Develop trading algorithms that decide how orders are generated and routed", "Six execution algorithms, a pre-trade cost model, and a multi-venue router that respects the best-price rule", "/execution", "Execution lab", "/market", "Router"],
    ["Manage the daily trading operations of algorithmic trading systems", "Daily routine, control charts that catch planted problem days, limits and kill switch", "/operations", "Operations"],
    ["Respond to changing market conditions", "A daily market-mood score for Canada and the US, translated into what to change in the algorithms", "/regime", "Sentiment"],
    ["Design and maintain simulation frameworks to validate algorithm performance", `Every algorithm runs on the same 300 simulated days; ${TESTS} automated tests check the engine`, "/execution", "Execution lab", "/about", "How it is built"],
    ["Understanding of Canadian equity market structure", "Canada and the US side by side: venues, best-price rules, auctions, tick sizes, dark trading", "/market", "Market structure"],
    ["Excellent Python; statistics, probability and stochastic processes", "Python pipeline (pandas, NumPy) from raw price files to statistics; simulated price paths, Monte Carlo, estimators with error bars", "/about", "How it is built"],
  ];
  const promos = [
    ["Trade large orders quietly. Know the market before you touch it.", "A working lab for Canadian and US equities, built for the Quantitative Trader role.", "About the build", "/about"],
    ["Try the order ticket", "Open any stock, size an order, and see what it should cost before it trades.", "Open Royal Bank", "/stock/CA:RY"],
    ["Real statistics, simulated book", "Daily prices and volumes are real. The order book is simulated, and every page says so.", "What is real", "/about"],
  ];
  const events = upcoming();
  const meter = (v) => `<span class="meter" aria-hidden="true"><i style="width:${Math.max(4, Math.min(100, v))}%"></i></span>`;

  const html = `
  <div class="cols">
    <div>
      <div class="eyebrow" id="hm-eyebrow"></div>
      <div class="hero-num"><span id="hm-num"></span><small id="hm-unit"></small></div>
      <a class="hero-chg" id="hm-chg" href="#/regime"></a>
      <div class="scrub" id="hm-chart"></div>
      <div class="range-row">
        ${seg("hm-range", Object.keys(RANGE_WORD).map((r) => [r, r]), hs.range)}
        <span id="hm-metric-slot"></span>
      </div>
      <p class="hero-cap" id="hm-cap"></p>

      <div class="stats">
        <a class="stat" href="#/regime"><span><b>Canada mood</b><span>${f0(R.ca.score)}/100 · ${esc(R.ca.label)}</span></span>${meter(R.ca.score)}</a>
        <a class="stat" href="#/regime"><span><b>United States mood</b><span>${f0(R.us.score)}/100 · ${esc(R.us.label)}</span></span>${meter(R.us.score)}</a>
      </div>

      <div class="sec-h"><h2>What the lab answers</h2><span class="small muted">Data through ${longDate(D.asof)}</span></div>
      <div class="list">
        ${qrow("market", "How liquid is this stock, really?", `${esc(ry.name)}: a C$10M order is ${f1((1e7 / ry.adv_val) * 100)}% of its day. In the 150th most-traded name it is ${f0((1e7 / D.table[149].adv_val) * 100)}%.`, money(ry.adv_val, "C$"), "traded a day", "/market")}
        ${qrow("mood", "What mood is the market in?", `Canada reads ${R.ca.label.toLowerCase()}: volatility is higher than ${f0(R.ca.vol_pct)}% of the last five years. VIX is ${f1(R.us.vix)}.`, `${f0(R.ca.score)}/100`, esc(R.ca.label), "/regime")}
        ${qrow("timing", "Which days are cheap to trade?", `Quarterly rebalance days carry far more volume; days when the US is closed carry ${f0(ev["US market closed, TSX open"].rel_vol)}%. The weekday barely matters.`, `${f0(ev["Quarterly expiry and index rebalance"].rel_vol)}%`, "of normal volume", "/timing")}
        ${qrow("flow", "Who else is in the book?", `Hidden participants found in 20 simulated sessions, from public data alone, with ${det.f} false alarms.`, `${det.c} of ${det.n}`, "found", "/flow")}
        ${qrow("exec", "What will this order cost?", `Buying 5% of a day in ${esc(ry.sym)} (${money(qty * ry.px, "C$")}) over 200 simulated days. Trading it all at the close: ${f1(mc.moc.mean)} bps.`, `${f1(ranked[0].mean)} bps`, esc(nameOf(ranked[0].algo)), "/execution")}
        ${qrow("ops", "Is the algorithm behaving today?", "Planted problem days caught by the control charts over 60 simulated days.", `${caught} of ${planted}`, "caught", "/operations")}
      </div>

      <div class="sec-h"><h2>The role, line by line</h2><span class="small muted">What the posting asks for, and where it is shown</span></div>
      <div class="tbl-wrap"><table><thead><tr><th class="l wrapc" style="width:38%">The posting asks for</th><th class="l wrapc">In the lab</th><th class="l">Where</th></tr></thead><tbody>
        ${map.map((m) => `<tr><td class="l wrapc" style="font-weight:700">${m[0]}</td><td class="l wrapc">${m[1]}</td><td class="l"><a href="#${m[2]}">${m[3]}</a>${m[4] ? `<br><a href="#${m[4]}">${m[5]}</a>` : ""}</td></tr>`).join("")}
      </tbody></table></div>

      <div class="sec-h"><h2>Who built this</h2></div>
      <div class="aboutbox">
        <p>I am Tiago Costa. I have been in the markets since February 2009, close to 18 years, trading Brazilian, US and Canadian equities. Since 2017 I have traded my own capital full time with systematic strategies that I research, code and run myself. Some are intraday and built on order flow: they read how other participants behave in the book and on the tape, and trade around it.</p>
        <div class="meta"><a href="#/about">${ic("info", "s")}More about me and the build</a><a href="https://www.linkedin.com/in/tiagonbc" target="_blank" rel="noopener">${ic("ext", "s")}LinkedIn</a><span>${ic("code", "s")}${TESTS} automated tests</span></div>
      </div>
      <div class="card mt">
        <h3>I built it, so I can change it</h3>
        <p class="muted" style="margin-top:6px">Every part of this lab is mine to adapt. If the desk wants something different, these are afternoon changes, not projects:</p>
        <ul style="margin:0;padding-left:20px">
          <li>Swap the impact model, or re-fit its coefficients to real fills.</li>
          <li>Load real venue fee schedules and routing rules as configuration.</li>
          <li>Point the detectors at a live depth-and-trades feed.</li>
          <li>Add an algorithm, a benchmark, or a new control limit.</li>
          <li>Change a chart, a page or the whole design.</li>
        </ul>
        <p class="small muted" style="margin:12px 0 0">Built with Python, JavaScript and an AI coding agent (Claude Code), under a test suite I wrote the cases for.</p>
      </div>
    </div>

    <aside class="side" aria-label="Shortcuts and lists">
      <div>
        <div class="sec-h"><h2>For you</h2><span class="nav"><button type="button" id="hm-pprev" aria-label="Previous card">${ic("back", "s")}</button><button type="button" id="hm-pnext" aria-label="Next card">${ic("next", "s")}</button></span></div>
        <div class="promo-stack" id="hm-promo" aria-live="polite"></div>
      </div>
      <div class="list" style="padding-top:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          ${seg("hm-tab", [["top", "Most traded"], ["watch", "Watchlist"]], hs.tab, "tabs")}
          <span style="display:flex;gap:4px"><button type="button" class="mini-btn" id="hm-lmkt" aria-label="Switch between Canada and the United States"></button><button type="button" class="mini-btn" id="hm-lsort" aria-label="Change the sort order">${ic("sort")}</button><a class="mini-btn" href="#/market" aria-label="Open the full table">${ic("expand")}</a></span>
        </div>
        <p class="r-s" id="hm-lcap" style="margin:4px 0 2px"></p>
        <div id="hm-list"></div>
      </div>
      <div>
        <div class="sec-h"><h2><a href="#/timing" style="text-decoration:none">Calendar ›</a></h2><span class="nav"><button type="button" id="hm-cprev" aria-label="Earlier dates">${ic("back", "s")}</button><button type="button" id="hm-cnext" aria-label="Later dates">${ic("next", "s")}</button></span></div>
        <div class="cal" id="hm-cal">${events.map((e) => `<a href="#/timing" title="${esc(e.what)}"><b>${e.d.getDate()}</b><span>${e.d.toLocaleDateString("en-CA", { month: "short" })}</span><i class="${e.cls}">${e.tagText}</i><span class="vh">${esc(e.what)}</span></a>`).join("")}</div>
        <p class="r-s" style="white-space:normal;margin:8px 0 0">Reb: quarterly expiry and index rebalance. Exp: monthly expiry. US: US closed, TSX open. End: month-end.</p>
      </div>
    </aside>
  </div>`;

  let chart = null;
  const metricsFor = () => METRICS[hs.mkt];
  function series() {
    const m = metricsFor().find((x) => x[0] === hs.metric) || metricsFor()[0], ts = D.regime_ts[m[2]];
    const n = ts.d.length, year = ts.d[n - 1].slice(0, 4);
    const from = { "1M": n - 22, "3M": n - 64, "6M": n - 127, "1Y": n - 253, "3Y": 0, YTD: Math.max(0, ts.d.findIndex((d) => d.startsWith(year)) - 1) }[hs.range];
    const a = Math.max(0, from);
    return { m, d: ts.d.slice(a), v: ts.v.slice(a) };
  }
  function readout(s, i) {
    const { m, d, v } = s, dec = m[4], k = i ?? v.length - 1, chg = v[k] - v[0], good = Math.sign(chg) * m[5];
    $("#hm-num").textContent = v[k].toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + "%";
    $("#hm-unit").textContent = m[3].replace(/^% ?/, "");
    const c = $("#hm-chg");
    c.className = "hero-chg " + (good > 0 ? "up" : good < 0 ? "down" : "flat");
    c.textContent = `${signed(chg, dec)} pts ${i == null ? RANGE_WORD[hs.range] : "since " + shortDate(d[0])} →`;
  }
  function drawHero() {
    if (!metricsFor().some((x) => x[0] === hs.metric)) hs.metric = "vol";
    const s = series(), { m, d, v } = s, good = Math.sign(v[v.length - 1] - v[0]) * m[5];
    $("#hm-eyebrow").textContent = `Market conditions · ${hs.mkt === "ca" ? "Canada" : "United States"} · real data`;
    $("#hm-cap").textContent = m[6];
    $("#hm-metric-slot").innerHTML = seg("hm-metric", metricsFor().map((x) => [x[0], x[1]]), hs.metric);
    onSeg("hm-metric", (val) => { hs.metric = val; drawHero(); });
    chart?.destroy();
    chart = scrub($("#hm-chart"), { labels: d.map(shortDate), values: v, color: good < 0 ? C.down : C.up, name: `${m[1]}, ${hs.mkt === "ca" ? "Canada" : "United States"}`, format: (x) => x + "%", onMove: (i) => readout(s, i) });
    readout(s, null);
  }
  function drawPromo() {
    const p = promos[hs.promo];
    $("#hm-promo").innerHTML = `<a class="promo" href="#${p[3]}"><b>${p[0]}</b><span>${p[1]}</span><span class="go">${p[2]} →</span></a>`;
  }
  function drawList() {
    const c = hs.listMkt === "US" ? "US$" : "C$";
    $("#hm-lmkt").textContent = hs.listMkt;
    let rows, cap;
    if (hs.tab === "watch") {
      rows = watch.get().map(findInst).filter(Boolean); cap = rows.length ? "Saved in this browser only" : "";
    } else {
      const [k, dir, label] = SORTS[hs.sort];
      rows = [...(hs.listMkt === "US" ? D.us_table : D.table.slice(0, 40))].sort((a, b) => (a[k] - b[k]) * dir).slice(0, 8); cap = `${hs.listMkt === "US" ? "United States" : "Canada"}, ${label}`;
    }
    $("#hm-lcap").textContent = cap;
    $("#hm-lmkt").style.visibility = $("#hm-lsort").style.visibility = hs.tab === "watch" ? "hidden" : "visible";
    $("#hm-list").innerHTML = rows.map((x) => {
      const h = D.hist[x.sym], last = h && h.vol[h.vol.length - 1], prev = h && h.vol[h.vol.length - 5], dv = last != null && prev != null ? last - prev : null;
      return `<a class="row" href="#/stock/${instKey(x)}">${tile(x)}<span><span class="r-t">${esc(x.sym)}</span><span class="r-s">${esc(x.name || "")}</span></span><span class="r-v">${money(x.adv_val, x.mkt === "US" ? "US$" : c)}<small class="${dv == null || dv === 0 ? "" : dv < 0 ? "up" : "down"}">vol ${f1(x.vol_ann)}%${dv == null ? "" : ` (${signed(dv, 1)})`}</small></span></a>`;
    }).join("") || `<p class="empty">Nothing saved yet. Open a stock and press the bookmark at the top of its page.</p>`;
  }
  function mount() {
    drawHero(); drawPromo(); drawList();
    onSeg("hm-range", (v) => { hs.range = v; drawHero(); });
    onSeg("hm-tab", (v) => { hs.tab = v; drawList(); });
    $("#hm-lmkt").addEventListener("click", () => { hs.listMkt = hs.listMkt === "CA" ? "US" : "CA"; drawList(); });
    $("#hm-lsort").addEventListener("click", () => { hs.sort = (hs.sort + 1) % SORTS.length; drawList(); });
    $("#hm-pprev").addEventListener("click", () => { hs.promo = (hs.promo + promos.length - 1) % promos.length; drawPromo(); });
    $("#hm-pnext").addEventListener("click", () => { hs.promo = (hs.promo + 1) % promos.length; drawPromo(); });
    $("#hm-cprev").addEventListener("click", () => { $("#hm-cal").scrollLeft -= 164; });
    $("#hm-cnext").addEventListener("click", () => { $("#hm-cal").scrollLeft += 164; });
  }
  const menu = `<div class="menu-wrap"><button type="button" class="pill" id="mkt-btn" aria-haspopup="true" aria-expanded="false"><span id="mkt-lbl">${hs.mkt === "ca" ? "Canada" : "United States"}</span>${ic("down", "s")}</button>
    <div class="menu-pop" id="mkt-pop" role="menu"><button type="button" role="menuitemradio" data-m="ca" aria-checked="${hs.mkt === "ca"}">Canada <span class="muted small">TSX</span></button><button type="button" role="menuitemradio" data-m="us" aria-checked="${hs.mkt === "us"}">United States <span class="muted small">S&amp;P 500, ETFs</span></button></div></div>`;
  function barMount() {
    const btn = $("#mkt-btn"), pop = $("#mkt-pop"); if (!btn) return;
    const close = () => { pop.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", (e) => { e.stopPropagation(); const o = pop.classList.toggle("open"); btn.setAttribute("aria-expanded", String(o)); });
    pop.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; hs.mkt = b.dataset.m; hs.listMkt = hs.mkt === "us" ? "US" : "CA"; $("#mkt-lbl").textContent = hs.mkt === "ca" ? "Canada" : "United States"; $$("button", pop).forEach((x) => x.setAttribute("aria-checked", x === b)); close(); drawHero(); drawList(); });
    document.addEventListener("click", close);
    barMount.off = () => document.removeEventListener("click", close);
  }
  return { html, mount: () => { mount(); barMount(); }, unmount: () => { chart?.destroy(); barMount.off?.(); }, bar: { title: `<span>Execution Lab</span><span class="nm2">by Tiago Costa</span>`, acts: menu } };
}

// ================================================================= ONE STOCK
const WINDOWS = { day: [0, 390, "All day", "9:30 to 16:00"], am: [0, 120, "First two hours", "9:30 to 11:30"], mid: [30, 330, "Midday", "10:00 to 15:00"], pm: [270, 390, "Last two hours", "14:00 to 16:00"] };
const ss = { range: "1Y", metric: "vol" };

export function stock(key) {
  const D = store.D, inst = findInst(key);
  if (!inst) return { html: `<p class="loading">No stock called ${esc(key)} in the lab. <a href="#/market">Open the full table</a>.</p>`, bar: { back: "#/market", title: "Not found" } };
  const c = cur(inst), k = instKey(inst), ca = inst.mkt === "CA";
  const list = ca ? D.table : D.us_table, rank = [...list].sort((a, b) => b.adv_val - a.adv_val).findIndex((x) => x.sym === inst.sym) + 1;
  const h = D.hist[inst.sym], hasHist = h && h.vol.filter((x) => x != null).length > 20 && h.d[h.d.length - 1] >= String(+D.asof.slice(0, 4) - 1);
  const inLab = instruments().some((x) => instKey(x) === k);
  const t = { side: 1, algo: "vwap", unit: "pct", amt: "", win: "day", useClose: true };
  const sizes = [2.5e5, 1e6, 5e6, 2.5e7];
  const reading = (pct) => (pct > 40 ? "Too large for one day" : pct > 10 ? "Heavy: visible in the tape" : pct > 3 ? "Workable over the day" : "Comfortable");
  const about = `${esc(inst.name || inst.sym)} is number ${rank} of the ${list.length} ${ca ? "TSX" : "US"} names measured here, by value traded. About ${money(inst.adv_val, c)} changes hands on a normal day, and the price typically travels ${f0(inst.range_bps)} basis points between its high and its low.${inst.on_share != null ? ` ${f0(inst.on_share)}% of its risk arrives overnight, when nobody can trade it.` : ""}`;

  const html = `
  <div class="cols">
    <div>
      ${hasHist ? `
      <div class="eyebrow" id="sk-eyebrow"></div>
      <div class="hero-num"><span id="sk-num"></span><small id="sk-unit"></small></div>
      <span class="hero-chg" id="sk-chg"></span>
      <div class="scrub" id="sk-chart"></div>
      <div class="range-row">${seg("sk-range", [["3M", "3M"], ["6M", "6M"], ["1Y", "1Y"], ["3Y", "3Y"]], ss.range)}${seg("sk-metric", [["vol", "Volatility"], ["rv", "Volume"]], ss.metric)}</div>
      <p class="hero-cap" id="sk-cap"></p>` : `
      <div class="eyebrow">Value traded per day · real data</div>
      <div class="hero-num"><span>${money(inst.adv_val, c)}</span><small>a day</small></div>
      <span class="hero-chg flat">Number ${rank} of ${list.length} by value traded</span>
      <p class="hero-cap">Weekly history is drawn for the 40 most-traded TSX names and the US list. The statistics below are measured for every name.</p>`}

      <div class="tbl-wrap" style="margin-top:34px"><table>
        <thead><tr><th class="l">Order size</th><th>Shares</th><th>Share of a day</th><th>Estimated cost</th><th>In dollars</th><th class="l">Reading</th></tr></thead>
        <tbody>${sizes.map((s) => { const q = s / inst.px, pct = (s / inst.adv_val) * 100, pre = E.preTrade(inst, q, { windowShare: 0.92 }); return `<tr><td class="l" style="font-weight:700">${money(s, c)}</td><td>${f0(q)}</td><td>${pct >= 100 ? f0(pct) : pct < 1 ? f2(pct) : f1(pct)}%</td><td>${pct > 40 ? "–" : `<span class="pc">${f1(pre.bps)} bps</span>`}</td><td>${pct > 40 ? "–" : money((s * pre.bps) / 1e4, c)}</td><td class="l">${reading(pct)}</td></tr>`; }).join("")}</tbody>
      </table></div>
      <p class="small muted mt">${tag("Model", "simu")} Cost of working each order across the whole day, from the impact model on the Execution lab page and this stock's real price, volume and volatility.</p>

      <div class="feature">
        <div class="art" aria-hidden="true"><svg width="62" height="62" viewBox="0 0 62 62"><rect x="6" y="34" width="12" height="20" rx="3" fill="#b9c8b4"/><rect x="25" y="20" width="12" height="34" rx="3" fill="#d9c7a3"/><rect x="44" y="8" width="12" height="46" rx="3" fill="#c5b5cf"/></svg></div>
        <div><b>Who else is trading ${esc(inst.sym)}?</b><p>Watch a simulated order book for this stock and see the detectors find hidden buyers and sellers.</p><a class="btn sm" href="#/flow?inst=${k}">Open order flow</a></div>
      </div>

      <h2>Market details</h2>
      <dl class="dgrid">
        <div><dt>Last close</dt><dd>${c}${f2(inst.px)}</dd></div><div><dt>Value per day</dt><dd>${money(inst.adv_val, c)}</dd></div><div><dt>Shares per day</dt><dd>${shares(inst.adv_sh)}</dd></div><div><dt>Rank by value</dt><dd>${rank} of ${list.length}</dd></div>
        <div><dt>Daily volatility</dt><dd>${f2(inst.vol_d)}%</dd></div><div><dt>Yearly volatility</dt><dd>${f1(inst.vol_ann)}%</dd></div><div><dt>Typical day range</dt><dd>${f0(inst.range_bps)} bps</dd></div><div><dt>Overnight share of risk</dt><dd>${inst.on_share == null ? "–" : f0(inst.on_share) + "%"}</dd></div>
        <div><dt>Market</dt><dd>${ca ? "TSX" : "United States"}</dd></div><div><dt>Data through</dt><dd>${shortDate(D.asof)}</dd></div>
      </dl>
      <h2>Trading costs</h2>
      <dl class="dgrid">
        <div><dt>Spread (model)</dt><dd>${f1(inst.spread_bps)} bps</dd></div><div><dt>Price step</dt><dd>${c}${inst.tick}</dd></div><div><dt>Price step in bps</dt><dd>${f1(inst.tick_bps)}</dd></div><div><dt>Price move per $1M traded</dt><dd>${inst.amihud == null ? "–" : f2(inst.amihud) + " bps"}</dd></div>
      </dl>

      <h2>About ${esc(inst.sym)}</h2>
      <div class="aboutbox"><p>${about}</p>
        <div class="meta"><span>${ic("flag", "s")}${ca ? "Canada" : "United States"}</span><span>${ic("layers", "s")}Real daily data, 60-day statistics</span><a href="#/market">${ic("market", "s")}Compare with other stocks</a></div></div>

      <div class="sec-h" style="margin-top:44px"><h2 style="font-size:18px">Recent activity</h2><a class="view-all" href="#/flow?inst=${k}">View all <i>${ic("arrow", "s")}</i></a></div>
      <p class="day-h" style="margin-top:4px">Simulated session, 30 minutes</p>
      <div id="sk-acts"></div>
      <p class="small muted mt">${tag("Simulated", "simu")} The book is generated from this stock's real statistics. Each row is something a detector flagged using only what a public feed shows.</p>
    </div>

    <aside class="side" aria-label="Order ticket">
      <div class="ticket-shell">
        <div class="ticket">
          <div class="t-tabs" id="tk-side" role="group" aria-label="Side"><button type="button" data-v="1" aria-pressed="true">Buy</button><button type="button" data-v="-1" aria-pressed="false">Sell</button></div>
          <div class="t-row" style="margin-top:12px"><label for="tk-algo">Algorithm</label><select id="tk-algo">${E.ALGOS.map((a) => `<option value="${a.id}" ${a.id === t.algo ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div>
          <div class="t-row"><label for="tk-unit"><span id="tk-verb">Buy</span> in</label><select id="tk-unit"><option value="pct">% of a day</option><option value="sh">Shares</option><option value="val">Dollars</option></select></div>
          <div class="t-row"><label for="tk-amt" id="tk-amt-l">% of a day</label><div class="t-field"><input id="tk-amt" type="text" inputmode="decimal" placeholder="0" autocomplete="off"><button type="button" id="tk-quick">5% day</button></div></div>
          <div class="t-row line fit"><span>Closing auction<span class="newtag">MOC</span></span><button type="button" class="switch" id="tk-close" role="switch" aria-checked="true" aria-label="Use the closing auction"></button></div>
          <div class="t-row sum line"><span>Estimated cost</span><b id="tk-est">–</b></div>
          <div class="t-out" id="tk-out" hidden></div>
        </div>
        <button type="button" class="btn block" id="tk-run" style="margin-top:14px" disabled>Simulate</button>
        <button type="button" class="t-acct" id="tk-win" aria-label="Change the trading window"><span><b id="tk-win-n"></b><span id="tk-win-t"></span></span>${ic("pick", "s")}</button>
      </div>
      <p class="small muted" style="margin:0 8px">${tag("Simulation", "simu")} Nothing here sends an order. The ticket runs the lab's models on this stock's real statistics.</p>
    </aside>
  </div>`;

  // ---- hero
  let chart = null;
  function heroSeries() {
    const n = h.d.length, take = { "3M": 13, "6M": 26, "1Y": 52, "3Y": n }[ss.range], a = Math.max(0, n - take);
    return { d: h.d.slice(a), v: (ss.metric === "vol" ? h.vol : h.rv).slice(a) };
  }
  function heroRead(s, i) {
    const vol = ss.metric === "vol", vals = s.v, first = vals.find((x) => x != null), kk = i ?? vals.length - 1, cur2 = vals[kk], chg = cur2 - first, good = -Math.sign(chg);
    $("#sk-num").textContent = vol ? f1(cur2) + "%" : f2(cur2) + "×";
    $("#sk-unit").textContent = vol ? "volatility a year" : "its normal volume";
    const el = $("#sk-chg");
    el.className = "hero-chg " + (!vol || chg === 0 ? "flat" : good > 0 ? "up" : "down");
    el.textContent = `${signed(chg, vol ? 1 : 2)}${vol ? " pts" : "×"} ${i == null ? RANGE_WORD[ss.range] : "since " + shortDate(s.d[0])}`;
  }
  function drawHero() {
    const s = heroSeries(), vol = ss.metric === "vol", first = s.v.find((x) => x != null), last = s.v[s.v.length - 1];
    $("#sk-eyebrow").textContent = `${vol ? "Volatility" : "Volume against normal"} · weekly · real data`;
    $("#sk-cap").textContent = vol ? "How much the price has moved over the last 20 days, as a yearly rate. A fall shows in green because a calmer stock is cheaper to trade." : "This week's volume against the 60-day average. Above 1.00× there is more room than usual to hide an order.";
    chart?.destroy();
    chart = scrub($("#sk-chart"), { labels: s.d.map(shortDate), values: s.v, color: vol ? (last > first ? C.down : C.up) : C.c1, name: `${inst.sym} ${vol ? "volatility" : "volume against normal"}`, format: (x) => (vol ? x + "%" : x + " times normal"), onMove: (i) => heroRead(s, i) });
    heroRead(s, null);
  }

  // ---- ticket
  const qtyOf = () => { const a = parseFloat(String(t.amt).replace(/,/g, "")); if (!a || a <= 0) return 0; return Math.round(t.unit === "pct" ? (inst.adv_sh * a) / 100 : t.unit === "val" ? a / inst.px : a); };
  const useClose = () => (t.algo === "moc" ? true : t.useClose) && WINDOWS[t.win][1] === 390;
  function windowShare() { const w = WINDOWS[t.win], cv = E.volumeCurve(0.08); let s = 0; for (let m = w[0]; m < w[1]; m++) s += cv[m]; if (useClose()) s += cv[390]; return s; }
  function drawTicket() {
    const q = qtyOf(), w = WINDOWS[t.win], pct = (q / inst.adv_sh) * 100;
    $("#tk-verb").textContent = t.side > 0 ? "Buy" : "Sell";
    $("#tk-amt-l").textContent = { pct: "% of a day", sh: "Shares", val: `Dollars (${c})` }[t.unit];
    $("#tk-win-n").textContent = w[2]; $("#tk-win-t").textContent = w[3] + (useClose() ? ", with the close" : "");
    $("#tk-close").setAttribute("aria-checked", String(useClose()));
    $("#tk-close").disabled = t.algo === "moc" || w[1] !== 390;
    const run = $("#tk-run");
    if (!q) { $("#tk-est").textContent = "–"; run.disabled = true; run.textContent = "Simulate"; return; }
    const pre = E.preTrade(inst, q, { windowShare: windowShare(), dayShare: (w[1] - w[0]) / 390, cross: E.CROSS[t.algo] });
    $("#tk-est").textContent = pct > 40 ? "Too large for one day" : `${f1(pre.bps)} bps · ${money((q * inst.px * pre.bps) / 1e4, c)}`;
    run.disabled = pct > 40; run.textContent = `Simulate ${t.side > 0 ? "buying" : "selling"} ${shares(q)}`;
  }
  function runTicket() {
    const q = qtyOf(), w = WINDOWS[t.win], algos = [...new Set([t.algo, "vwap"])], name = E.ALGOS.find((a) => a.id === t.algo).name;
    const mc = E.monteCarlo(inst, { side: t.side, qty: q, start: w[0], end: w[1] }, algos, 200, 17, { signalQ: 0.1 }, { useClose: useClose(), rate: 0.1 });
    const r = mc[t.algo], notional = q * inst.px, pct = Math.min(30, Math.max(0.5, Math.round(((q / inst.adv_sh) * 100) * 2) / 2));
    const out = $("#tk-out"); out.hidden = false;
    out.innerHTML = `<dl>
      <dt>${esc(name)}, 200 simulated days</dt><dd>${f1(r.mean)} bps</dd>
      <dt>In dollars</dt><dd>${money((notional * r.mean) / 1e4, c)}</dd>
      <dt>Day-to-day risk</dt><dd>±${f0(r.sd)} bps</dd>
      <dt>A bad day (1 in 20)</dt><dd>${f0(r.p95)} bps</dd>
      ${t.algo === "vwap" ? "" : `<dt>Against VWAP</dt><dd class="${r.mean < mc.vwap.mean ? "up" : "down"}">${signed(r.mean - mc.vwap.mean, 1)} bps</dd>`}
      <dt>Peak share of volume</dt><dd>${f0(r.peak)}%</dd></dl>
      ${inLab ? `<a class="view-all" href="#/execution?inst=${k}&side=${t.side}&pct=${pct}&win=${t.win}">Compare all six algorithms <i>${ic("arrow", "s")}</i></a>` : ""}`;
  }
  function drawActs() {
    const sim = E.simulateFlow(inst, { icebergs: 3, parents: 2 }, 7), dec = sim.tick < 0.01 ? 3 : 2, px = (x) => (x * sim.tick).toFixed(dec);
    const ice = E.detectIcebergs(sim.prints), par = E.detectParents(sim.prints), bursts = E.detectBursts(sim.prints, sim.T), items = [];
    ice.forEach((d) => items.push({ t: d.tFlag, kind: "Iceberg", head: `Hidden ${d.side === "bid" ? "buyer" : "seller"} at ${c}${px(d.px)}`, val: `${f0(d.vol)} sh`, body: `Size reloaded ${d.refills} times in clips of ${f0(d.clip)} shares.`, act: d.side === "bid" ? "Selling: this bid absorbs size without the price dropping. Buying: expect support here until it is gone." : "Buying: this offer absorbs size without the price rising. Selling: expect a ceiling here until it is gone." }));
    par.forEach((d) => items.push({ t: d.tFlag, kind: d.side > 0 ? "Sliced buy" : "Sliced sell", head: `${d.side > 0 ? "Buy" : "Sell"} order on a clock`, val: `${f0(d.vol)} sh`, body: `${f0(d.clip)} shares about every ${f0(d.interval)} seconds; ${d.prints} slices seen.`, act: d.side > 0 ? "A buyer is working size. Buying alongside costs more; a seller can rest offers into the steady demand." : "A seller is working size. Selling alongside costs more; a buyer can rest bids into the steady supply." }));
    bursts.events.forEach((e) => items.push({ t: e.t0, kind: "Burst", head: `Aggressive ${e.side > 0 ? "buying" : "selling"}`, val: `${f0(e.peak)} sweeps`, body: `${f0(e.peak)} sweeps of the best price in ${bursts.w} seconds.`, act: `Pull passive ${e.side > 0 ? "offers" : "bids"} and wait for the book to refill before resuming.` }));
    items.sort((a, b) => a.t - b.t);
    $("#sk-acts").innerHTML = items.map((i) => `<details class="act"><summary>${tile(inst)}<span><span class="a-t">${esc(i.head)}</span><span class="a-s"><b>${i.kind}</b><span>${clock(i.t)} into the session</span></span></span><span class="a-v">${i.val}</span>${ic("down", "s chev")}</summary><div class="a-body"><p>${i.body}</p><p><b>What I would do:</b> ${i.act}</p></div></details>`).join("") || `<p class="empty">The detectors flagged nothing in this session.</p>`;
  }
  function mount() {
    if (hasHist) {
      drawHero();
      onSeg("sk-range", (v) => { ss.range = v; drawHero(); });
      onSeg("sk-metric", (v) => { ss.metric = v; drawHero(); });
    }
    drawTicket(); drawActs();
    onSeg("tk-side", (v) => { t.side = +v; drawTicket(); if (!$("#tk-out").hidden) runTicket(); });
    $("#tk-algo").addEventListener("change", (e) => { t.algo = e.target.value; $("#tk-out").hidden = true; drawTicket(); });
    $("#tk-unit").addEventListener("change", (e) => { const q = qtyOf(); t.unit = e.target.value; t.amt = q ? String(t.unit === "pct" ? +((q / inst.adv_sh) * 100).toFixed(2) : t.unit === "val" ? Math.round(q * inst.px) : q) : ""; $("#tk-amt").value = t.amt; drawTicket(); });
    $("#tk-amt").addEventListener("input", (e) => { t.amt = e.target.value; $("#tk-out").hidden = true; drawTicket(); });
    $("#tk-amt").addEventListener("keydown", (e) => { if (e.key === "Enter" && !$("#tk-run").disabled) runTicket(); });
    $("#tk-quick").addEventListener("click", () => { const q = Math.round(inst.adv_sh * 0.05); t.amt = String(t.unit === "pct" ? 5 : t.unit === "val" ? Math.round(q * inst.px) : q); $("#tk-amt").value = t.amt; $("#tk-out").hidden = true; drawTicket(); });
    $("#tk-close").addEventListener("click", () => { t.useClose = !t.useClose; $("#tk-out").hidden = true; drawTicket(); });
    $("#tk-win").addEventListener("click", () => { const ks = Object.keys(WINDOWS); t.win = ks[(ks.indexOf(t.win) + 1) % ks.length]; $("#tk-out").hidden = true; drawTicket(); });
    $("#tk-run").addEventListener("click", runTicket);
    const bm = $("#bm-btn");
    bm?.addEventListener("click", () => { const on = watch.toggle(k); bm.setAttribute("aria-pressed", String(on)); bm.setAttribute("aria-label", on ? "Remove from watchlist" : "Add to watchlist"); });
  }
  const on = watch.has(k);
  return {
    html, mount, unmount: () => chart?.destroy(), title: inst.sym,
    bar: {
      back: "#/market",
      title: `${tile(inst, "lg")}<span>${esc(inst.sym)}</span><span class="nm2">${esc(inst.name || "")}</span><span class="live" style="color:var(--ink)">${c}${f2(inst.px)}</span>`,
      acts: `<button type="button" class="pill icon" id="bm-btn" aria-pressed="${on}" aria-label="${on ? "Remove from watchlist" : "Add to watchlist"}">${ic("bookmark")}</button>${inLab ? `<a class="pill" href="#/execution?inst=${k}">${ic("expand", "s")}Advanced</a>` : ""}`,
    },
  };
}
