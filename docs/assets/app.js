// Execution Lab: router, overview and about pages.
import { store, C, $, $$, esc, f0, f1, f2, money, shares, longDate, pageHead, shortBox, tag, findInst } from "./ui.js";
import * as E from "./engine.js";
import { market, regime, timing, regimeAdvice } from "./pages-market.js";
import { flow, execution, operations, opsData } from "./pages-sim.js";

const ROUTES = [
  ["/", "Overview", overview], ["/market", "Market structure", market], ["/regime", "Sentiment", regime], ["/timing", "Timing", timing],
  ["/flow", "Order flow", flow], ["/execution", "Execution lab", execution], ["/operations", "Operations", operations], ["/about", "About", about],
];
const TESTS = 15;

// ---------------------------------------------------------------- overview
function overview() {
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
  const q = (n, title, ans, href) => `<a class="card" href="#${href}"><div class="q-n">QUESTION ${n}</div><div class="q">${title}</div><p class="q-a">${ans}</p><span class="go">Open →</span></a>`;
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
  const html = `
  <section class="hero">
    <div>
      <div class="eyebrow">A demonstration for the Quantitative Trader role · Capital Markets</div>
      <h1>Trade large orders quietly. Know the market before you touch it.</h1>
      <p class="lead">A working lab for Canadian and US equities: real market statistics, a simulated order book with hidden participants to find, and execution algorithms tested on hundreds of simulated days. I designed and built it to show how I would do this job.</p>
      <div class="btn-row"><a class="btn" href="#/execution">Open the execution lab</a><a class="btn ghost" href="#/flow">Watch the order flow</a></div>
    </div>
    <aside class="glance" aria-label="At a glance">
      <h3>At a glance</h3>
      <dl>
        <dt>Market data through</dt><dd>${longDate(D.asof)}</dd>
        <dt>TSX names measured</dt><dd>${f0(D.counts.ca_universe)} of ${f0(D.counts.ca_files)}</dd>
        <dt>US coverage</dt><dd>${D.us_table.length} stocks, ${D.counts.us_etfs} ETFs, VIX</dd>
        <dt>Canada today</dt><dd>${R.ca.label} · ${f0(R.ca.score)}/100</dd>
        <dt>United States today</dt><dd>${R.us.label} · ${f0(R.us.score)}/100</dd>
        <dt>Execution algorithms</dt><dd>${E.ALGOS.length}</dd>
        <dt>Automated tests</dt><dd>${TESTS} passing</dd>
      </dl>
      <p class="small muted" style="margin:14px 0 0">${tag("Real", "real")} daily prices and volumes &nbsp; ${tag("Simulated", "simu")} order book and fills</p>
    </aside>
  </section>

  <h2>What it answers, in six questions</h2>
  <p class="sub">Each card shows one live result from the lab. Click through for the page behind it.</p>
  <div class="grid g3 mt">
    ${q(1, "How liquid is this stock, really?", `<b>${esc(ry.name)}</b> trades ${money(ry.adv_val, "C$")} a day. A C$10M order is ${f1((1e7 / ry.adv_val) * 100)}% of that. In the 150th most-traded name it is ${f0((1e7 / D.table[149].adv_val) * 100)}%.`, "/market")}
    ${q(2, "What mood is the market in?", `Canada reads <b>${R.ca.label.toLowerCase()}</b> (${f0(R.ca.score)}/100): volatility at ${f1(R.ca.vol)}% a year, higher than ${f0(R.ca.vol_pct)}% of the last five years. VIX is ${f1(R.us.vix)}.`, "/regime")}
    ${q(3, "Which days are cheap to trade?", `Quarterly rebalance days carry <b>${f0(ev["Quarterly expiry and index rebalance"].rel_vol)}%</b> of normal TSX volume. When the US is closed, <b>${f0(ev["US market closed, TSX open"].rel_vol)}%</b>. The weekday itself barely matters in Canada.`, "/timing")}
    ${q(4, "Who else is in the book?", `In 20 simulated sessions the detectors found <b>${det.c} of ${det.n}</b> hidden participants (icebergs, sliced orders, aggressive bursts) from public data alone, with ${det.f} false alarms.`, "/flow")}
    ${q(5, "What will this order cost?", `Buying 5% of a day in ${esc(ry.sym)} (${money(qty * ry.px, "C$")}): <b>${nameOf(ranked[0].algo)}</b> averages ${f1(ranked[0].mean)} bps over 200 simulated days; trading it all at the close, ${f1(mc.moc.mean)} bps.`, "/execution")}
    ${q(6, "Is the algorithm behaving today?", `Over 60 simulated days the control charts caught <b>${caught} of ${planted}</b> planted problem days: a stale volume forecast and a volatility shock.`, "/operations")}
  </div>

  <h2>The role, line by line</h2>
  <p class="sub">What the posting asks for, and where this lab shows it.</p>
  <div class="tbl-wrap mt"><table><thead><tr><th class="l wrapc" style="width:36%">The posting asks for</th><th class="l wrapc">In the lab</th><th class="l">Where</th></tr></thead><tbody>
    ${map.map((m) => `<tr><td class="l wrapc">${m[0]}</td><td class="l wrapc">${m[1]}</td><td class="l"><a href="#${m[2]}">${m[3]}</a>${m[4] ? `<br><a href="#${m[4]}">${m[5]}</a>` : ""}</td></tr>`).join("")}
  </tbody></table></div>

  <h2>Who built this</h2>
  <div class="two mt">
    <div class="card linen">
      <h3>Tiago Costa</h3>
      <p style="margin-top:8px">I have been in the markets since February 2009, close to 18 years, trading Brazilian, US and Canadian equities. Since 2017 I have traded my own capital full time with systematic strategies that I research, code and run myself.</p>
      <p>Some of those strategies are intraday and built on order flow: they read how other participants are behaving in the book and on the tape, and trade around it. Running several systems every day has taught me which days suit entering a position and which suit unwinding one, how volatility changes the shape of the trading day, and how money flow moves prices.</p>
      <p>I also wrote the order management system that sends my orders to B3, the Brazilian exchange, with the pre-trade checks and limits that keep it safe.</p>
      <div class="btn-row" style="margin-top:14px"><a class="btn sm" href="#/about">More about me and the build</a><a class="btn sm ghost" href="https://www.linkedin.com/in/tiagonbc" target="_blank" rel="noopener">LinkedIn</a></div>
    </div>
    <div class="card">
      <h3>I built it, so I can change it</h3>
      <p class="muted" style="margin-top:8px">Every part of this lab is mine to adapt. If the desk wants something different, these are afternoon changes, not projects:</p>
      <ul style="margin:0;padding-left:20px">
        <li>Swap the impact model, or re-fit its coefficients to real fills.</li>
        <li>Load real venue fee schedules and routing rules as configuration.</li>
        <li>Point the detectors at a live depth-and-trades feed.</li>
        <li>Add an algorithm, a benchmark, or a new control limit.</li>
        <li>Change a chart, a page or the whole design.</li>
      </ul>
      <p class="small muted" style="margin-top:12px">Built with Python, JavaScript and an AI coding agent (Claude Code), under a test suite I wrote the cases for.</p>
    </div>
  </div>`;
  return { html };
}

// ---------------------------------------------------------------- about
function contrast(a, b) {
  const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function about() {
  const D = store.D;
  const pairs = [["Body text on page", "#32302f", "#fcfcfc"], ["Secondary text on page", "#686664", "#fcfcfc"], ["Secondary text on linen", "#686664", "#f5f3ef"], ["Button text on button", "#ffffff", "#32302f"], ["Chart blue on white", "#1f7db5", "#ffffff"], ["Chart orange on white", "#d17509", "#ffffff"]];
  const sw = [["#32302f", "Text and buttons"], ["#fcfcfc", "Page"], ["#f5f3ef", "Linen panels"], ["#e4e2e1", "Hairlines"], ["#1f7db5", "Chart 1"], ["#d17509", "Chart 2"], ["#7a5ea8", "Chart 3"], ["#4f8a3c", "Chart 4"], ["#3d7a34", "Buy"], ["#c2451e", "Sell"]];
  const gl = [
    ["ADV", "average daily volume: how many shares of a stock trade on a normal day."], ["Basis point (bp)", "one hundredth of one percent. On a $1M order, 1 bp is $100."],
    ["Spread", "the gap between the best price to buy and the best price to sell."], ["Market impact", "the price move an order causes against itself by demanding liquidity."],
    ["Implementation shortfall", "the cost of an order measured from the price when it arrived to the average price actually paid."], ["TWAP", "an algorithm that trades equal slices over time."],
    ["VWAP", "the volume-weighted average price; also an algorithm that trades in step with the usual volume curve."], ["POV", "an algorithm that takes a fixed share of the volume as it appears."],
    ["Closing auction (MOC)", "a single match at the end of the day that sets the official closing price."], ["Iceberg order", "a large order that shows only a small part of its size and reloads as it trades."],
    ["Parent and child orders", "a large (parent) order cut into many small (child) orders sent over time."], ["Sweep", "one order that takes all the size at the best price and continues to the next price."],
    ["Flow toxicity", "order flow that tends to be followed by the price moving against whoever traded with it."], ["VPIN", "a gauge of how one-sided recent volume has been."],
    ["Tick rule", "labelling a trade as a buy if the price ticked up and a sell if it ticked down."], ["Order Protection Rule", "Canada's rule that a better-priced visible order must be filled before a worse one."],
    ["Breadth", "how many stocks are taking part in a market move."], ["Realised volatility", "how much prices have actually been moving, expressed per year."],
    ["Monte Carlo", "running a model on many random scenarios to see the range of outcomes."], ["Control limit", "the edge of the normal range; a result beyond it is investigated."],
  ];
  const html = `
  ${pageHead("About", "Who built this, how, and what is real", "The short version: the market statistics are real, the order book is simulated and says so, the code is tested, and I can change any of it.")}
  ${shortBox([["Feb 2009", "when I started trading: close to 18 years in the markets"], ["3 markets", "Brazil, the United States and Canada"], [`${TESTS} tests`, "check the engine behind every number on the simulated pages"]])}

  <h2>About me</h2>
  <div class="two mt">
    <div class="card">
      <p>I am an electrical engineer who became a trader. I started in the markets in February 2009, worked on a utility's energy trading desk in Brazil, and since 2017 have traded my own capital full time with systematic strategies in Brazilian, US and Canadian equities and ETFs.</p>
      <p>My strategies range from longer-horizon models built on fundamentals and trend to short-term and intraday ones. The intraday ones are order-flow strategies: they track what other participants are doing in the book and on the tape, and trade around that behaviour. I research them, code them, and run them every day.</p>
      <p>That daily practice is where my feel for execution comes from: which days suit entering a position and which suit unwinding one, how volatility reshapes the trading day, how money flow moves prices, and how the psychology of the crowd shows up in the open, the close and the days around events.</p>
      <p>I also built the systems around the strategies: an order management system connected to B3 (Brazil's exchange) with dry-run mode, account allow-list, throttling, duplicate-order guard and exposure cap; a real-time tracker of ETF prices against their baskets; and the tools that reconcile my positions each day.</p>
      <p style="margin:0">I am based in Waterloo, Ontario, and I am a Level I candidate in the CFA Program (May 2027 exam).</p>
    </div>
    <div class="card linen">
      <h3>I built this lab, and I can adapt it</h3>
      <p style="margin-top:8px">I designed the pages, chose the models, wrote the test cases and built the code with an AI coding agent (Claude Code). Working that way is how I build everything now, and it means changes are fast.</p>
      <p>If you would like to see it do something else, tell me what, and I will change it: different stocks, another impact model, your own fee table, a different benchmark, another design.</p>
      <dl class="kv" style="grid-template-columns:120px 1fr;font-size:14.5px">
        <dt>Data layer</dt><dd>Python, pandas, NumPy: reads raw price files, writes statistics</dd>
        <dt>Engine</dt><dd>JavaScript, no dependencies: day simulator, six algorithms, order-book simulator, detectors, router</dd>
        <dt>Tests</dt><dd>${TESTS} automated tests (Node test runner)</dd>
        <dt>Site</dt><dd>Static pages, so it loads anywhere with no server</dd>
      </dl>
      <div class="btn-row" style="margin-top:14px"><a class="btn sm" href="https://www.linkedin.com/in/tiagonbc" target="_blank" rel="noopener">LinkedIn</a></div>
    </div>
  </div>

  <h2>What is real and what is simulated</h2>
  <div class="tbl-wrap mt"><table><thead><tr><th class="l">Part</th><th class="l">Status</th><th class="l wrapc">Detail</th></tr></thead><tbody>
    <tr><td class="l"><b>Prices, volumes, volatility (Canada)</b></td><td class="l">${tag("Real", "real")}</td><td class="l wrapc">Daily bars for ${f0(D.counts.ca_files)} TSX-listed symbols from my research database, through ${longDate(D.asof)}. The ${D.counts.ca_universe} most traded are used. Only derived statistics are published.</td></tr>
    <tr><td class="l"><b>US indices, ETFs, VIX</b></td><td class="l">${tag("Real", "real")}</td><td class="l wrapc">Daily closes from Norgate Data for ${D.counts.us_etfs} ETFs, the S&P 500 and VIX; daily bars for ${D.us_table.length} US stocks and ETFs in the same research database.</td></tr>
    <tr><td class="l"><b>Sentiment, timing and statistics pages</b></td><td class="l">${tag("Real", "real")}</td><td class="l wrapc">Computed from the data above. Forecasts are scored on data they were not built on.</td></tr>
    <tr><td class="l"><b>Bid-ask spread</b></td><td class="l">${tag("Model", "simu")}</td><td class="l wrapc">Daily bars carry no quotes. The spread is one tick at least, wider with volatility, narrower with traded value.</td></tr>
    <tr><td class="l"><b>Intraday volume and volatility shape</b></td><td class="l">${tag("Model", "simu")}</td><td class="l wrapc">A standard U shape plus a closing auction share you can change. With intraday data this becomes a measured curve per stock.</td></tr>
    <tr><td class="l"><b>Order book, icebergs, big orders, bursts</b></td><td class="l">${tag("Simulated", "simu")}</td><td class="l wrapc">Generated, with size and volatility taken from each stock's real statistics. Order-by-order exchange data is a paid feed that cannot be republished.</td></tr>
    <tr><td class="l"><b>Fills and costs</b></td><td class="l">${tag("Simulated", "simu")}</td><td class="l wrapc">A published impact model with literature coefficients, not a fit to anyone's trades.</td></tr>
    <tr><td class="l"><b>Venue fees</b></td><td class="l">${tag("Illustrative", "simu")}</td><td class="l wrapc">Round numbers that show the mechanics. Real schedules are public and would be loaded as configuration.</td></tr>
  </tbody></table></div>
  <p class="small muted mt">The universe is today's ${D.counts.ca_universe} most-traded names followed back in time, so names that were delisted are missing from the history (survivorship). For liquidity and calendar statistics this matters little; I would not use it to test a stock-picking strategy.</p>

  <h2>Design check</h2>
  <p class="sub">The look follows Wealthsimple's public site, read from its stylesheet: warm off-white pages, near-black text, a serif for headlines and a geometric sans for the rest, pill buttons, generous rounding. No logo or wordmark is used.</p>
  <div class="two mt">
    <div class="card"><h3>Palette</h3><div class="swatches">${sw.map(([c, n]) => `<div class="sw"><i style="background:${c}"></i>${n}<br>${c}</div>`).join("")}</div>
      <dl class="kv" style="grid-template-columns:150px 1fr;font-size:14.5px"><dt>Headline font</dt><dd>Source Serif 4, an open stand-in for the site's Tiempos</dd><dt>Text font</dt><dd>DM Sans, an open stand-in for Wealthsimple Sans</dd><dt>Buttons</dt><dd>Fully rounded, dark on light</dd><dt>Charts</dt><dd>Four hues checked for colour-blind separation; buy and sell always carry a label, never colour alone</dd></dl></div>
    <div class="card"><h3>Readability, measured</h3><div class="tbl-wrap mt"><table><thead><tr><th class="l">Pair</th><th>Contrast</th><th class="l">Standard</th></tr></thead><tbody>
      ${pairs.map(([n, a, b]) => { const r = contrast(a, b); return `<tr><td class="l">${n}</td><td>${r.toFixed(1)} : 1</td><td class="l">${r >= 4.5 ? tag("Passes text (4.5)", "good") : r >= 3 ? tag("Passes graphics (3.0)", "good") : tag("Below 3.0", "bad")}</td></tr>`; }).join("")}
    </tbody></table></div><p class="how">Computed live with the WCAG contrast formula. The pages are also checked at phone width, by keyboard, and with reduced motion.</p></div>
  </div>

  <h2>Plain-language glossary</h2>
  <div class="gloss">${gl.map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`).join("")}</div>`;
  return { html };
}

// ---------------------------------------------------------------- router
let current = null;
function render() {
  const path = (location.hash || "#/").slice(1).split("?")[0] || "/";
  const i = Math.max(0, ROUTES.findIndex((r) => r[0] === path));
  current?.unmount?.();
  const page = ROUTES[i][2]();
  const prev = ROUTES[i - 1], next = ROUTES[i + 1];
  const main = $("#main");
  main.innerHTML = page.html + `<div class="pager">${prev ? `<a href="#${prev[0]}"><span>Previous</span>← ${prev[1]}</a>` : "<span></span>"}${next ? `<a href="#${next[0]}" style="text-align:right"><span>Next</span>${next[1]} →</a>` : "<span></span>"}</div>`;
  $("#nav").innerHTML = ROUTES.map((r, k) => `<a href="#${r[0]}" ${k === i ? 'aria-current="page"' : ""}>${r[1]}</a>`).join("");
  $("#nav").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  document.title = (i === 0 ? "" : ROUTES[i][1] + " · ") + "Execution Lab · Tiago Costa";
  current = page;
  window.scrollTo(0, 0);
  page.mount?.();
}
async function start() {
  try {
    const r = await fetch("data/market.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    store.D = await r.json();
  } catch (e) {
    $("#main").innerHTML = `<p class="loading">The market data file did not load (${esc(e.message)}). Serve the docs folder over HTTP and reload.</p>`;
    return;
  }
  const wait = () => (window.Plotly ? render() : setTimeout(wait, 40));
  wait();
  window.addEventListener("hashchange", render);
  $("#menuBtn").addEventListener("click", () => { const o = $("#nav").classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", String(o)); });
}
start();
