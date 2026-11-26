// Execution Lab: app shell (icon rail, top bar, search, keyboard shortcuts), router and the About page.
import { store, $, $$, esc, f0, longDate, pageHead, shortBox, tag, ic, tile, iconTile, instKey } from "./ui.js";
import { market, regime, timing } from "./pages-market.js";
import { flow, execution, operations } from "./pages-sim.js";
import { home, stock } from "./pages-home.js";

// path, name, page, icon, shortcut key
const ROUTES = [
  ["/", "Home", home, "home", "h"], ["/market", "Market structure", market, "market", "m"], ["/regime", "Sentiment", regime, "mood", "s"], ["/timing", "Timing", timing, "timing", "t"],
  ["/flow", "Order flow", flow, "flow", "f"], ["/execution", "Execution lab", execution, "exec", "e"], ["/operations", "Operations", operations, "ops", "o"], ["/about", "About", about, "about", "a"],
];
const TESTS = 15;
const REPO = "https://github.com/tiagonbc/execution-lab-demonstration";
const BANNER = `<div class="banner" role="note">${ic("info")}<span><b>Demonstration software by Tiago Costa.</b> Daily market statistics are real; order flow is simulated. Not affiliated with or endorsed by Wealthsimple.</span></div>`;
const SOURCE = `<a class="pill wide" href="${REPO}" target="_blank" rel="noopener" aria-label="Source code on GitHub">${ic("code", "s")}<span class="t">Source code</span></a>`;

// ---------------------------------------------------------------- about
function contrast(a, b) {
  const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function about() {
  const D = store.D;
  const pairs = [["Body text on page", "#000000", "#f2f2f2"], ["Secondary text on page", "#5e5e5e", "#f2f2f2"], ["Secondary text on card", "#5e5e5e", "#fbfbfb"], ["Button text on button", "#ffffff", "#000000"], ["Gain green on page", "#357941", "#f2f2f2"], ["Loss red on page", "#b8352a", "#f2f2f2"], ["Chart blue on card", "#1f7db5", "#fbfbfb"], ["Chart orange on card", "#d17509", "#fbfbfb"]];
  const sw = [["#000000", "Text and buttons"], ["#f2f2f2", "Page"], ["#fbfbfb", "Cards"], ["#e4e4e4", "Quiet panels"], ["#357941", "Better, buy"], ["#b8352a", "Worse, sell"], ["#1f7db5", "Chart 1"], ["#d17509", "Chart 2"], ["#7a5ea8", "Chart 3"], ["#4f8a3c", "Chart 4"]];
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
  const keys = [["/", "Search stocks and pages"], ...ROUTES.map((r) => [r[4].toUpperCase(), r[1]]), ["← →", "Read a chart point by point, once the chart has focus"]];
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
      <dl class="kv" style="grid-template-columns:120px 1fr">
        <dt>Data layer</dt><dd>Python, pandas, NumPy: reads raw price files, writes statistics</dd>
        <dt>Engine</dt><dd>JavaScript, no dependencies: day simulator, six algorithms, order-book simulator, detectors, router</dd>
        <dt>Tests</dt><dd>${TESTS} automated tests (Node test runner)</dd>
        <dt>Site</dt><dd>Static pages, so it loads anywhere with no server</dd>
      </dl>
      <div class="btn-row"><a class="btn sm" href="https://www.linkedin.com/in/tiagonbc" target="_blank" rel="noopener">LinkedIn</a><a class="btn sm ghost" href="${REPO}" target="_blank" rel="noopener">Source code</a></div>
    </div>
  </div>

  <h2>What is real and what is simulated</h2>
  <div class="tbl-wrap mt"><table><thead><tr><th class="l">Part</th><th class="l">Status</th><th class="l wrapc">Detail</th></tr></thead><tbody>
    <tr><td class="l"><b>Prices, volumes, volatility (Canada)</b></td><td class="l">${tag("Real", "real")}</td><td class="l wrapc">Daily bars for ${f0(D.counts.ca_files)} TSX-listed symbols from my research database, through ${longDate(D.asof)}. The ${D.counts.ca_universe} most traded are used. Only derived statistics are published.</td></tr>
    <tr><td class="l"><b>US indices, ETFs, VIX</b></td><td class="l">${tag("Real", "real")}</td><td class="l wrapc">Daily closes from Norgate Data for ${D.counts.us_etfs} ETFs, the S&P 500 and VIX; daily bars for ${D.us_table.length} US stocks and ETFs in the same research database.</td></tr>
    <tr><td class="l"><b>Home, sentiment, timing and statistics pages</b></td><td class="l">${tag("Real", "real")}</td><td class="l wrapc">Computed from the data above. Forecasts are scored on data they were not built on.</td></tr>
    <tr><td class="l"><b>Bid-ask spread</b></td><td class="l">${tag("Model", "simu")}</td><td class="l wrapc">Daily bars carry no quotes. The spread is one tick at least, wider with volatility, narrower with traded value.</td></tr>
    <tr><td class="l"><b>Intraday volume and volatility shape</b></td><td class="l">${tag("Model", "simu")}</td><td class="l wrapc">A standard U shape plus a closing auction share you can change. With intraday data this becomes a measured curve per stock.</td></tr>
    <tr><td class="l"><b>Order book, icebergs, big orders, bursts</b></td><td class="l">${tag("Simulated", "simu")}</td><td class="l wrapc">Generated, with size and volatility taken from each stock's real statistics. Order-by-order exchange data is a paid feed that cannot be republished.</td></tr>
    <tr><td class="l"><b>Order ticket, fills and costs</b></td><td class="l">${tag("Simulated", "simu")}</td><td class="l wrapc">The ticket on each stock page sends nothing. It runs a published impact model with literature coefficients, not a fit to anyone's trades.</td></tr>
    <tr><td class="l"><b>Venue fees</b></td><td class="l">${tag("Illustrative", "simu")}</td><td class="l wrapc">Round numbers that show the mechanics. Real schedules are public and would be loaded as configuration.</td></tr>
  </tbody></table></div>
  <p class="small muted mt">The universe is today's ${D.counts.ca_universe} most-traded names followed back in time, so names that were delisted are missing from the history (survivorship). For liquidity and calendar statistics this matters little; I would not use it to test a stock-picking strategy.</p>

  <h2>Design check</h2>
  <p class="sub">The interface follows the layout of Wealthsimple's web app, which I use as a client: a slim icon rail, a headline number over a chart you can read point by point, range buttons, list rows, a search panel and an order ticket. The typeface and icons are open stand-ins that I chose or drew. No logo, wordmark or artwork is used.</p>
  <div class="two mt">
    <div class="card"><h3>Palette</h3><div class="swatches">${sw.map(([c, n]) => `<div class="sw"><i style="background:${c}"></i>${n}<br>${c}</div>`).join("")}</div>
      <dl class="kv" style="grid-template-columns:150px 1fr"><dt>Typeface</dt><dd>Hanken Grotesk, an open stand-in for Wealthsimple Sans</dd><dt>Buttons</dt><dd>Fully rounded, black on white</dd><dt>Green and red</dt><dd>Green means better for the trader (calmer, cheaper), red means worse. Every coloured figure also carries a sign or a label</dd><dt>Charts</dt><dd>Four hues checked for colour-blind separation</dd></dl></div>
    <div class="card"><h3>Readability, measured</h3><div class="tbl-wrap mt"><table><thead><tr><th class="l">Pair</th><th>Contrast</th><th class="l">Standard</th></tr></thead><tbody>
      ${pairs.map(([n, a, b]) => { const r = contrast(a, b); return `<tr><td class="l">${n}</td><td>${r.toFixed(1)} : 1</td><td class="l">${r >= 4.5 ? tag("Passes text (4.5)", "good") : r >= 3 ? tag("Passes graphics (3.0)", "good") : tag("Below 3.0", "bad")}</td></tr>`; }).join("")}
    </tbody></table></div><p class="how">Computed live with the WCAG contrast formula. The pages are also checked at phone width, by keyboard, and with reduced motion.</p></div>
  </div>

  <h2>Keyboard</h2>
  <div class="tbl-wrap mt"><table><thead><tr><th class="l" style="width:120px">Key</th><th class="l">What it does</th></tr></thead><tbody>
    ${keys.map(([k, v]) => `<tr><td class="l"><span class="pc">${k}</span></td><td class="l">${v}</td></tr>`).join("")}
  </tbody></table></div>

  <h2>Plain-language glossary</h2>
  <div class="gloss">${gl.map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`).join("")}</div>`;
  return { html };
}

// ---------------------------------------------------------------- rail
function drawRail(i) {
  $("#rail").innerHTML = `<a class="mark" href="#/" aria-label="Execution Lab home">${ic("mark")}</a>
    <button type="button" class="ri keep" id="searchBtn" aria-label="Search">${ic("search")}<span class="tip">Search <kbd>/</kbd></span></button>
    <div class="nav-items" id="navItems">${ROUTES.map((r, k) => `<a class="ri ${r[0] === "/about" ? "end" : ""}" href="#${r[0]}" ${k === i ? 'aria-current="page"' : ""} aria-label="${r[1]}">${ic(r[3])}<span class="tip">${k === i ? "" : '<span class="pre">Go to&nbsp;</span>'}${r[1]} <kbd>${r[4].toUpperCase()}</kbd></span></a>`).join("")}</div>
    <a class="ri avatar-link" href="#/about" aria-label="About Tiago Costa"><span class="avatar">T</span><span class="tip">Tiago Costa</span></a>
    <button type="button" class="ri rail-menu" id="menuBtn" aria-expanded="false" aria-controls="navItems">Menu</button>`;
}

// ---------------------------------------------------------------- search
const S = { cat: "all", q: "", on: 0, items: [] };
const CATS = [["all", "All"], ["ca", "Canada"], ["us", "United States"], ["pages", "Pages"]];
function searchItems() {
  const D = store.D, q = S.q.trim().toLowerCase(), all = S.cat === "all";
  const pages = ROUTES.map((r) => ({ page: true, label: r[1], href: "#" + r[0], icon: r[3] }));
  const us = [...D.us_table].sort((a, b) => b.adv_val - a.adv_val);
  if (!q) {
    if (S.cat === "pages") return { head: "Pages", items: pages };
    return { head: "Most active", items: (all ? [...D.table.slice(0, 6), ...us.slice(0, 4)] : S.cat === "ca" ? D.table.slice(0, 10) : us.slice(0, 10)) };
  }
  const score = (x) => (x.sym.toLowerCase() === q ? 3 : x.sym.toLowerCase().startsWith(q) ? 2 : x.sym.toLowerCase().includes(q) || (x.name || "").toLowerCase().includes(q) ? 1 : 0);
  const pool = [...(all || S.cat === "ca" ? D.table : []), ...(all || S.cat === "us" ? us : [])];
  const stocks = pool.map((x) => [score(x), x]).filter((m) => m[0]).sort((a, b) => b[0] - a[0] || b[1].adv_val - a[1].adv_val).slice(0, 12).map((m) => m[1]);
  const pg = all || S.cat === "pages" ? pages.filter((p) => p.label.toLowerCase().includes(q)) : [];
  const items = [...stocks, ...pg];
  return { head: items.length ? "Results" : "Nothing matches. Try a ticker such as RY, SHOP or SPY.", items };
}
function drawSearch() {
  const { head, items } = searchItems();
  S.items = items; S.on = Math.min(S.on, Math.max(0, items.length - 1));
  $("#sCats").innerHTML = CATS.map(([v, l]) => `<button type="button" data-c="${v}" aria-pressed="${v === S.cat}">${l}</button>`).join("");
  $("#sList").innerHTML = `<div class="s-h">${head}</div>` + items.map((x, k) => x.page
    ? `<a class="s-item ${k === S.on ? "on" : ""}" role="option" aria-selected="${k === S.on}" href="${x.href}">${iconTile(x.icon)}<span class="n"><b>${esc(x.label)}</b></span>${tag("Page")}</a>`
    : `<a class="s-item ${k === S.on ? "on" : ""}" role="option" aria-selected="${k === S.on}" href="#/stock/${instKey(x)}">${tile(x)}<span class="n"><b>${esc(x.sym)}</b> ${esc(x.name || "")}</span>${tag(x.mkt === "CA" ? "TSX" : "US")}</a>`).join("");
  $("#sList .on")?.scrollIntoView({ block: "nearest" });
}
function openSearch() { if (!store.D) return; S.q = ""; S.on = 0; $("#sInput").value = ""; $("#scrim").classList.add("open"); drawSearch(); $("#sInput").focus(); }
function closeSearch(refocus = true) { if (!$("#scrim").classList.contains("open")) return; $("#scrim").classList.remove("open"); if (refocus) $("#searchBtn")?.focus(); }
function wireSearch() {
  $("#sInput").addEventListener("input", (e) => { S.q = e.target.value; S.on = 0; drawSearch(); });
  $("#sInput").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = S.items.length; if (n) { S.on = (S.on + (e.key === "ArrowDown" ? 1 : n - 1)) % n; drawSearch(); } }
    else if (e.key === "Enter") { const a = $$("#sList .s-item")[S.on]; if (a) { location.hash = a.getAttribute("href"); closeSearch(false); } }
  });
  $("#sCats").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.cat = b.dataset.c; S.on = 0; drawSearch(); $("#sInput").focus(); });
  $("#sList").addEventListener("click", (e) => { if (e.target.closest(".s-item")) closeSearch(false); });
  $("#scrim").addEventListener("mousedown", (e) => { if (e.target === $("#scrim")) closeSearch(); });
}

// ---------------------------------------------------------------- router
let current = null, visits = 0;
function render() {
  const path = decodeURIComponent((location.hash || "#/").slice(1).split("?")[0]) || "/";
  current?.unmount?.();
  let i = ROUTES.findIndex((r) => r[0] === path), page, name, listed = true;
  if (path.startsWith("/stock/")) { page = stock(path.slice(7)); name = page.title || "Stock"; i = 1; listed = false; }
  else { i = Math.max(0, i); page = ROUTES[i][2](); name = ROUTES[i][1]; }
  const bar = page.bar || {}, prev = listed && ROUTES[i - 1], next = listed && ROUTES[i + 1];
  $("#barTitle").innerHTML = (bar.back ? `<a class="back" id="backBtn" href="${bar.back}" aria-label="Back">${ic("back")}</a>` : "") + (bar.title || `<span>${name}</span>`);
  $("#barActs").innerHTML = (bar.acts || "") + (bar.back ? "" : SOURCE);
  $("#main").innerHTML = BANNER + `<div class="page">${page.html}${listed ? `<div class="pager">${prev ? `<a href="#${prev[0]}"><span>Previous</span>← ${prev[1]}</a>` : "<span></span>"}${next ? `<a href="#${next[0]}" style="text-align:right"><span>Next</span>${next[1]} →</a>` : "<span></span>"}</div>` : ""}</div>`;
  drawRail(listed ? i : -1);
  document.title = (path === "/" ? "" : name + " · ") + "Execution Lab · Tiago Costa";
  current = page; visits++;
  window.scrollTo(0, 0);
  page.mount?.();
  stickSide();
}
// A side column taller than the window sticks by its bottom edge instead of its top, so none of it is cut off.
let sideWatch = null;
function stickSide() {
  sideWatch?.disconnect();
  const side = $(".side"); if (!side) return;
  const fit = () => { side.style.top = Math.min(84, window.innerHeight - side.offsetHeight - 16) + "px"; };
  sideWatch = new ResizeObserver(fit); sideWatch.observe(side); sideWatch.observe(document.documentElement);
  fit();
}
async function start() {
  drawRail(0);
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
  wireSearch();
  window.addEventListener("hashchange", render);
  $("#rail").addEventListener("click", (e) => {
    if (e.target.closest("#searchBtn")) return openSearch();
    const m = e.target.closest("#menuBtn");
    if (m) { const o = $("#navItems").classList.toggle("open"); m.setAttribute("aria-expanded", String(o)); }
  });
  $("#barTitle").addEventListener("click", (e) => { if (e.target.closest("#backBtn") && visits > 1) { e.preventDefault(); history.back(); } });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return closeSearch();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); return openSearch(); }
    if (e.ctrlKey || e.metaKey || e.altKey || $("#scrim").classList.contains("open")) return;
    const el = e.target, typing = el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); return openSearch(); }
    const r = ROUTES.find((x) => x[4] === e.key.toLowerCase());
    if (r) location.hash = r[0];
  });
}
start();
