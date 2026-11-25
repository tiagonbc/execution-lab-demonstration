// Pages built on REAL daily data: market structure, sentiment and regime, timing and statistics.
import { store, C, $, $$, esc, f0, f1, f2, money, shares, cur, plot, line, bar, legend, pageHead, shortBox, frame, chartCard, tag, seg, onSeg, instruments, instOptions, findInst, debounce } from "./ui.js";
import * as E from "./engine.js";

// ================================================================= MARKET STRUCTURE
export function market() {
  const D = store.D, ca = D.table, us = D.us_table;
  const totCa = ca.reduce((s, x) => s + x.adv_val, 0), top20 = ca.slice(0, 20).reduce((s, x) => s + x.adv_val, 0);
  const medSpread = [...ca].map((x) => x.spread_bps).sort((a, b) => a - b)[Math.floor(ca.length / 2)];
  const st = { mkt: "CA", size: 5e6, sort: "adv_val", dir: -1, q: "", rInst: "CA:RY", rMult: 3, rSeed: 4 };

  const compare = [
    ["Where shares trade", "TSX and TSX Venture (listing), Alpha, Nasdaq Canada (CXC, CX2, CXD), Cboe Canada, CSE, Omega and Lynx, plus dark pools", "16 exchanges (NYSE, Nasdaq and Cboe groups, IEX, MEMX, MIAX), dozens of dark pools, and wholesalers that fill most retail orders off-exchange"],
    ["Best-price rule", "Order Protection Rule: a better-priced displayed order on a protected marketplace must be taken first", "Reg NMS Rule 611: no trading through the best protected quote (NBBO)"],
    ["Quotes that are not protected", "Venues with a speed bump (Alpha) and venues under the market-share threshold", "Manual quotes; odd-lot quotes historically sat outside the NBBO"],
    ["Open and close", "TSX opening auction at 9:30; Market-on-Close facility with an imbalance published about ten minutes before the 4:00 close; extended session at the closing price", "Opening and closing crosses on the listing exchange (NYSE, Nasdaq); the close is the largest single liquidity event of the day"],
    ["Price steps", "C$0.01 at C$0.50 and above, half a cent below", "US$0.01 at US$1.00 and above"],
    ["Lot size", "Board lot is 100 shares at C$1.00 and above; odd lots are common in retail flow", "Round lot is 100 shares for most stocks; odd lots are a large share of trades in high-priced names"],
    ["Dark trading", "Small dark orders must improve the price (a full tick, or half a tick when the spread is one tick)", "Midpoint and sub-penny price improvement are common off-exchange"],
    ["Halts", "Single-stock circuit breakers and market-wide halts coordinated with the US", "Limit Up-Limit Down bands per stock; market-wide breakers at 7%, 13% and 20%"],
    ["Settlement", "T+1 since May 27, 2024", "T+1 since May 28, 2024"],
    ["Regulators", "CIRO (trading rules, UMIR) and the provincial securities commissions (CSA)", "SEC and FINRA"],
    ["Why both matter here", "Over a hundred large Canadian companies also trade in the US. Their prices are tied together through the exchange rate, so US volume and US holidays show up in TSX liquidity (see Timing).", ""],
  ];

  const html = `
  ${pageHead("Market structure · real data", "Know the venue before you send the order", "How Canadian and US equity markets are organised, how liquid each stock really is, and what that means for where an order should go.")}
  ${shortBox([[f0(D.counts.ca_universe), `most-traded TSX names measured, from ${f0(D.counts.ca_files)} in the database`], [f0((top20 / totCa) * 100) + "%", "of the traded value sits in the top 20 names"], [f1(medSpread) + " bps", "modelled spread of the median name (the banks sit near 1 bp)"]])}
  ${frame("A C$5M order is nothing in Royal Bank and most of a day in a small cap. The same algorithm cannot treat them alike.", "Measures every stock's liquidity from real daily data, and shows how an order is split across Canadian venues.", "Cost, speed and the right algorithm all start from how much of the day's volume the order is.")}

  <h2>Two markets, side by side</h2>
  <p class="sub">The rules that shape execution, in plain words. This is my working summary of public rules; before coding against any of them I would confirm the detail in the current rulebooks.</p>
  <div class="tbl-wrap mt"><table><thead><tr><th class="l" style="width:17%"></th><th class="l wrapc">Canada</th><th class="l wrapc">United States</th></tr></thead><tbody>
    ${compare.map((r) => `<tr><td class="l wrapc"><b>${r[0]}</b></td><td class="l wrapc" ${r[2] ? "" : 'colspan="2"'}>${r[1]}</td>${r[2] ? `<td class="l wrapc">${r[2]}</td>` : ""}</tr>`).join("")}
  </tbody></table></div>

  <h2>The trading day in Toronto</h2>
  <div class="timeline">
    <div><span class="t">7:00 – 9:30</span><b>Pre-open</b>Orders queue. An indicative opening price forms.</div>
    <div class="hot"><span class="t">9:30</span><b>Opening auction</b>One price clears the overnight interest. The first minutes are the most volatile.</div>
    <div><span class="t">9:30 – 15:50</span><b>Continuous trading</b>Volume is U-shaped: busy early, quiet at midday, busy late.</div>
    <div class="hot"><span class="t">about 15:50</span><b>Close imbalance</b>The exchange publishes the buy or sell imbalance for the close.</div>
    <div class="hot"><span class="t">16:00</span><b>Closing auction</b>Index funds and ETFs trade here. It sets the official price.</div>
    <div><span class="t">16:15 – 17:00</span><b>Extended session</b>Trading at the closing price only.</div>
  </div>
  <div class="grid g2 mt">
    ${chartCard("Where the day's volume is (model)", "mk-curve", "each bar is the share of a normal day's volume in that half hour; the last bar is the closing auction. The lab uses this curve for VWAP and you can change the auction share in the Execution lab.", `<p class="small muted">${tag("Model", "simu")} Daily bars do not show the intraday shape, so this is an assumption, stated openly.</p>`)}
    <div class="card linen"><h3>What I take from this</h3>
      <p>The open is where information arrives and spreads are widest, so I avoid forcing size there unless the order is urgent.</p>
      <p>The close is where natural liquidity gathers. For orders benchmarked to the close, the auction is the cheapest place to trade, up to a sensible share of it.</p>
      <p>Midday is quiet: a patient order hides best when the book is active, so the middle of the day is for small passive slices, not for size.</p>
      <p class="small muted">For Canadian names that also trade in the US, 9:30 to 16:00 Eastern is the same clock in both countries, which keeps the two books in line all day.</p></div>
  </div>

  <h2>How liquid is each stock?</h2>
  <p class="sub">${tag("Real data", "real")} Every dot is a stock. Further right means more dollars traded per day; higher means more volatile. Orders are cheapest bottom-right and most expensive top-left.</p>
  <div class="card mt"><div id="mk-map" class="chart tall" role="img" aria-label="Liquidity map: value traded per day against daily volatility"></div>
    ${legend([["Canada (TSX)", C.c1, "bar"], ["United States", C.c2, "bar"]])}
    <p class="how"><b>How to read it:</b> hover a dot for the name, the value traded per day and the estimated cost of a C$5M order worked over the day.</p></div>

  <div class="controls">
    <div class="ctl">Market ${seg("mk-mkt", [["CA", "Canada"], ["US", "United States"]], st.mkt)}</div>
    <div class="ctl">Order size ${seg("mk-size", [["1000000", "$1M"], ["5000000", "$5M"], ["25000000", "$25M"]], String(st.size))}</div>
    <label>Find a stock<input type="search" id="mk-q" placeholder="Symbol or name" autocomplete="off"></label>
  </div>
  <div class="tbl-wrap mt" style="max-height:520px;overflow-y:auto"><table id="mk-tbl"></table></div>
  <p class="small muted mt">Value per day is the 60-day median. Daily volatility is the 60-day standard deviation of returns. The spread is modelled (one tick at least, wider with volatility, narrower with traded value) because daily bars carry no quotes. Estimated cost uses the impact model on the Execution lab page, for an order worked across the whole day.</p>

  <h2>Where should the order go?</h2>
  <p class="sub">${tag("Simulated book, illustrative fees", "simu")} A Canadian stock shows offers on several venues at once. The router decides which to take first. The best-price rule is not optional; the choice among venues at the same price is where money is saved.</p>
  <div class="controls">
    <label>Stock<select id="rt-inst">${instOptions(instruments("CA"), st.rInst)}</select></label>
    <div class="ctl">Buy order size ${seg("rt-mult", [["1", "Small"], ["3", "Medium"], ["6", "Large"]], String(st.rMult))}</div>
    <button class="btn sm ghost" id="rt-new" type="button">New book</button>
  </div>
  <div class="grid g2 mt" style="grid-template-columns:minmax(0,1fr)">
    <div class="card"><h3>Offers on each venue right now</h3><div class="tbl-wrap mt"><table id="rt-book"></table></div>
      <p class="how"><b>How to read it:</b> shares offered at the best price and one and two ticks above it. Taker fee is what the venue charges (or pays, when negative) per share.</p></div>
    <div class="card"><h3>Four ways to route the same order</h3><div class="tbl-wrap mt"><table id="rt-res"></table></div>
      <div class="callout" id="rt-say"></div></div>
  </div>
  <p class="small muted mt">Fee figures are round illustrative numbers, not the venues' current schedules. Real schedules are public, change often, and would be loaded as configuration.</p>`;

  function drawMap() {
    const tr = (rows, name, color) => ({
      x: rows.map((x) => x.adv_val), y: rows.map((x) => x.vol_d), type: "scatter", mode: "markers", name,
      marker: { color, size: 9, opacity: 0.8, line: { color: "#fff", width: 1.5 } },
      customdata: rows.map((x) => [x.sym, x.name || "", money(x.adv_val, cur(x)), f1(E.preTrade(x, 5e6 / x.px, { windowShare: 0.92 }).bps), f1((5e6 / x.adv_val) * 100)]),
      hovertemplate: "<b>%{customdata[0]}</b> %{customdata[1]}<br>%{customdata[2]} traded per day<br>Daily volatility %{y:.2f}%<br>$5M order = %{customdata[4]}% of a day, about %{customdata[3]} bps<extra></extra>",
    });
    plot("mk-map", [tr(ca, "Canada", C.c1), tr(us, "United States", C.c2)], {
      hovermode: "closest", xaxis: { type: "log", title: { text: "Value traded per day (log scale)", font: { size: 12 } }, tickprefix: "$" },
      yaxis: { title: { text: "Daily volatility, %", font: { size: 12 } }, rangemode: "tozero" }, margin: { b: 50 },
    });
  }
  function drawCurve() {
    const w = E.volumeCurve(0.08), labels = [], vals = [];
    for (let b = 0; b < 13; b++) { let s = 0; for (let m = b * 30; m < (b + 1) * 30; m++) s += w[m]; labels.push(E.minuteLabel(b * 30)); vals.push(+(s * 100).toFixed(1)); }
    labels.push("Close"); vals.push(8);
    plot("mk-curve", [bar(labels, vals, "Share of the day", labels.map((l) => (l === "Close" ? C.ink : C.c1)), { hovertemplate: "%{y}% of the day<extra></extra>" })], { yaxis: { ticksuffix: "%" }, xaxis: { type: "category" } });
  }
  const cols = [["sym", "Stock", "l"], ["px", "Price"], ["adv_val", "Value per day"], ["adv_sh", "Shares per day"], ["vol_d", "Daily volatility"], ["range_bps", "Typical day range"], ["spread_bps", "Spread (model)"], ["on_share", "Overnight share of risk"], ["pct", "Order as % of a day"], ["cost", "Est. cost"]];
  function drawTable() {
    const src = (st.mkt === "CA" ? ca : us).map((x) => ({ ...x, pct: (st.size / x.adv_val) * 100, cost: E.preTrade(x, st.size / x.px, { windowShare: 0.92 }).bps }));
    const q = st.q.trim().toLowerCase();
    let rows = q ? src.filter((x) => x.sym.toLowerCase().includes(q) || (x.name || "").toLowerCase().includes(q)) : src;
    rows = [...rows].sort((a, b) => (st.sort === "sym" ? a.sym.localeCompare(b.sym) * -st.dir : (a[st.sort] - b[st.sort]) * st.dir));
    const c = st.mkt === "US" ? "US$" : "C$";
    $("#mk-tbl").innerHTML = `<thead><tr>${cols.map(([k, l, cl]) => `<th data-sort="${k}" class="${cl || ""}" aria-sort="${st.sort === k ? (st.dir < 0 ? "descending" : "ascending") : "none"}">${l}${st.sort === k ? (st.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr></thead><tbody>${
      rows.slice(0, 120).map((x) => `<tr><td class="l"><span class="sym">${esc(x.sym)}</span><span class="nm">${esc(x.name || "")}</span></td><td>${f2(x.px)}</td><td>${money(x.adv_val, c)}</td><td>${shares(x.adv_sh)}</td><td>${f2(x.vol_d)}%</td><td>${f0(x.range_bps)} bps</td><td>${f1(x.spread_bps)} bps</td><td>${f0(x.on_share)}%</td><td>${x.pct >= 100 ? f0(x.pct) : f1(x.pct)}%</td><td><b>${x.pct > 40 ? "too large for one day" : f1(x.cost) + " bps"}</b></td></tr>`).join("") || `<tr><td class="l" colspan="10">No match.</td></tr>`}</tbody>`;
  }
  function drawRouter() {
    const inst = findInst(st.rInst), bk = E.venueBook(inst, st.rSeed), qty = bk.touch * st.rMult;
    const sizeAt = (v, l) => { const x = bk.levels.find((y) => y.venue === v && y.lvl === l); return x ? f0(x.size) : "–"; };
    $("#rt-book").innerHTML = `<thead><tr><th class="l">Venue</th><th class="l">Model</th><th>Taker fee</th><th>${f2(bk.ask)}</th><th>${f2(bk.ask + bk.tick)}</th><th>${f2(bk.ask + 2 * bk.tick)}</th></tr></thead><tbody>${
      E.VENUES.map((v) => `<tr><td class="l"><b>${v.name}</b>${v.prot ? "" : ` <span class="nm">not protected</span>`}</td><td class="l">${v.model}</td><td>${v.take < 0 ? "pays " : ""}${(Math.abs(v.take) * 100).toFixed(2)}¢</td>${v.kind === "Dark" ? `<td colspan="3" class="l">${sizeAt(v.id, -1) === "–" ? "no match right now" : sizeAt(v.id, -1) + " at the midpoint " + bk.mid.toFixed(3)}</td>` : `<td>${sizeAt(v.id, 0)}</td><td>${sizeAt(v.id, 1)}</td><td>${sizeAt(v.id, 2)}</td>`}</tr>`).join("")}</tbody>`;
    const pol = [["single", "Listing exchange only"], ["size", "Biggest size first"], ["fee", "Lowest fee first"], ["dark", "Midpoint first, then lowest fee"]];
    const res = pol.map(([p, l]) => ({ l, ...E.route(bk, qty, p) }));
    const best = Math.min(...res.filter((r) => !r.tradeThrough && !r.unfilled).map((r) => r.allIn));
    $("#rt-res").innerHTML = `<thead><tr><th class="l">Policy</th><th>Average price</th><th>Fees</th><th>All-in vs best offer</th><th class="l">Best-price rule</th></tr></thead><tbody>${
      res.map((r) => `<tr class="${r.allIn === best && !r.tradeThrough ? "best" : ""}"><td class="l wrapc"><b>${r.l}</b><span class="nm">${r.venues} venue${r.venues > 1 ? "s" : ""}${r.unfilled ? ", " + f0(r.unfilled) + " unfilled" : ""}</span></td><td>${r.avgPx.toFixed(4)}</td><td>${r.fees < 0 ? "-" : ""}$${Math.abs(r.fees).toFixed(2)}</td><td><b>${r.vsAskBps >= 0 ? "+" : ""}${f2(r.vsAskBps)} bps</b></td><td class="l">${r.tradeThrough ? tag("Trade-through", "bad") : tag("Respected", "good")}</td></tr>`).join("")}</tbody>`;
    const fee = res[2], size = res[1], dark = res[3], single = res[0];
    $("#rt-say").innerHTML = `<b>Buying ${f0(qty)} ${esc(inst.sym)}.</b> Sending everything to one exchange ${single.tradeThrough ? "walks up its book while cheaper shares sit elsewhere, which the best-price rule does not allow" : "costs " + f2(single.vsAskBps - fee.vsAskBps) + " bps more than routing across venues"}. Among compliant routes, choosing the lowest fee at each price saves $${(size.fees - fee.fees).toFixed(2)} against taking the biggest size first${dark.allIn < fee.allIn ? `, and checking the dark midpoint first saves another ${f2(fee.vsAskBps - dark.vsAskBps)} bps` : ""}.`;
  }
  function mount() {
    drawCurve(); drawMap(); drawTable(); drawRouter();
    onSeg("mk-mkt", (v) => { st.mkt = v; drawTable(); });
    onSeg("mk-size", (v) => { st.size = +v; drawTable(); });
    $("#mk-q").addEventListener("input", debounce((e) => { st.q = e.target.value; drawTable(); }));
    $("#mk-tbl").addEventListener("click", (e) => { const th = e.target.closest("th[data-sort]"); if (!th) return; const k = th.dataset.sort; if (st.sort === k) st.dir *= -1; else { st.sort = k; st.dir = -1; } drawTable(); });
    $("#rt-inst").addEventListener("change", (e) => { st.rInst = e.target.value; drawRouter(); });
    onSeg("rt-mult", (v) => { st.rMult = +v; drawRouter(); });
    $("#rt-new").addEventListener("click", () => { st.rSeed++; drawRouter(); });
  }
  return { html, mount };
}

// ================================================================= SENTIMENT AND REGIME
const PART_LABEL = { calm: "Calm (low volatility)", breadth: "Stocks in an uptrend", flow: "Money into rising stocks", trend: "Index above its trend" };
function gaugeCard(title, g, note) {
  return `<div class="card"><h3>${title}</h3><p class="small muted">${note}</p>
    <div class="gauge mt"><div class="dial" style="--v:${g.score}"><div><div><b>${f0(g.score)}</b><span>out of 100</span></div></div></div>
    <div><p style="margin-bottom:10px">${tag(g.label, g.score >= 65 ? "good" : g.score >= 45 ? "" : g.score >= 30 ? "warn" : "bad")}</p>
    <div class="bars">${Object.entries(g.parts).filter(([, v]) => v != null).map(([k, v]) => `<div class="bar"><span>${PART_LABEL[k]}</span><span class="track"><span class="fill" style="width:${v}%"></span></span><span class="v">${f0(v)}</span></div>`).join("")}</div></div></div></div>`;
}
export function regimeAdvice(r, T) {
  const out = [], fifth = T.volreg[4], calm = T.volreg[0];
  if (r.vol_pct >= 80) out.push(`<b>Volatility is high</b> (${f1(r.vol)}% a year, higher than ${f0(r.vol_pct)}% of the last five years). In the most volatile fifth of days the typical TSX stock's daily range is ${f0((fifth.range_bps / calm.range_bps - 1) * 100)}% wider than in the calmest fifth and overnight gaps are ${f0((fifth.gap_bps / calm.gap_bps - 1) * 100)}% bigger. I would trade smaller slices over a longer window, rest more of the order passively, and tighten price limits.`);
  else if (r.vol_pct <= 25) out.push(`<b>Volatility is low</b> (${f1(r.vol)}% a year). Prices drift little while an order is working, so patience is cheap: longer windows and more passive orders cost little in risk.`);
  else out.push(`<b>Volatility is ordinary</b> (${f1(r.vol)}% a year, percentile ${f0(r.vol_pct)}). Standard schedules apply.`);
  if (r.flow != null) out.push(r.flow < 45 ? `<b>Sellers are in control</b>: ${f0(r.flow)}% of traded value is in rising stocks and ${f0(r.b200)}% of names are above their 200-day average. Sell orders compete with the crowd and cost more; buy orders find sellers easily.` : r.flow > 55 ? `<b>Buyers are in control</b>: ${f0(r.flow)}% of traded value is in rising stocks. Buy orders compete with the crowd; sell orders find buyers easily.` : `<b>Flow is balanced</b>: ${f0(r.flow)}% of traded value is in rising stocks.`);
  return out;
}
export function regime() {
  const D = store.D, R = D.regime, ts = D.regime_ts;
  const st = { span: "3y", bm: "ca" };
  const advice = regimeAdvice(R.ca, D.timing);
  const html = `
  ${pageHead("Sentiment and regime · real data", "What mood is the market in today?", "Six measures of fear, participation and money flow for Canada and the US, turned into one plain reading and a list of what I would change in the algorithms.")}
  ${shortBox([[`${f0(R.ca.score)} · ${R.ca.label}`, `Canada, as of ${D.asof}`], [`${f0(R.us.score)} · ${R.us.label}`, `United States (VIX ${f1(R.us.vix)})`], [f2(D.link.corr_60d), "correlation of the two markets, last 60 days"]])}
  ${frame("An algorithm tuned on calm days bleeds on stressed ones. Someone has to notice the change before the fills do.", "Scores the market each day from real prices and volumes, and translates the score into execution settings.", "The posting asks to respond to changing conditions. This is the dashboard I would check before the open.")}
  <div class="grid g2 mt2">
    ${gaugeCard("Canada", R.ca, `${D.counts.ca_universe} most-traded TSX names and the TSX 60 ETF`)}
    ${gaugeCard("United States", R.us, `S&P 500 ETF, VIX and ${D.counts.us_etfs} broad, style and sector ETFs`)}
  </div>
  <div class="callout"><b>What I would do with this today.</b><ul style="margin:8px 0 0;padding-left:20px">${advice.map((a) => `<li>${a}</li>`).join("")}</ul></div>
  <p class="small muted mt">The score is the plain average of the parts shown, each on a 0 to 100 scale: calm = 100 minus the volatility percentile over five years; uptrend = share above the 200-day average; money flow = share of traded value in rising stocks over ten days; trend = distance of the index from its 200-day average. It describes conditions. It is not a forecast and not advice.</p>

  <h2>Fear: how much are prices moving?</h2>
  <div class="grid g2 mt">
    ${chartCard("Realised volatility, Canada and the US", "rg-vol", "yearly volatility implied by the last 20 days of moves. Spikes are stress; the two countries rise together.", `<div style="margin:6px 0 8px">${seg("rg-span", [["3y", "Last 3 years"], ["long", "Since 2007"]], st.span)}</div>`)}
    ${chartCard("VIX, monthly average", "rg-vix", "the options market's price of fear for the S&P 500. Above 25 is a stressed month.")}
  </div>
  ${legend([["Canada (TSX 60 ETF)", C.c1], ["United States (S&P 500 ETF)", C.c2]])}

  <h2>Participation: how many stocks are taking part?</h2>
  <div class="grid g2 mt">
    ${chartCard("Stocks above their average price", "rg-breadth", "the share of names trading above their 50-day and 200-day averages. A rising index with falling breadth is a narrow, fragile market.", `<div style="margin:6px 0 8px">${seg("rg-bm", [["ca", "Canada"], ["us", "US ETFs"]], st.bm)}</div>`)}
    ${chartCard("New highs minus new lows, Canada", "rg-nhnl", "share of names at a one-year high minus the share at a one-year low. Below zero, more stocks are breaking down than breaking out.")}
  </div>
  <div id="rg-breadth-lg">${legend([["Above 50-day average", C.c1], ["Above 200-day average", C.c2]])}</div>

  <h2>Money flow: where is the volume going?</h2>
  <div class="grid g2 mt">
    ${chartCard("Traded value in rising stocks, Canada", "rg-flow", "of every dollar traded over ten days, the share that went through stocks that closed up. Above 50%, buyers are paying up; below, sellers are.")}
    ${chartCard("Value traded per day, Canada", "rg-turn", "20-day average for the 240 names, in billions of Canadian dollars. More turnover means more room to hide an order.")}
  </div>

  <h2>Togetherness: are stocks moving as one?</h2>
  <div class="grid g3 mt">
    ${chartCard("Average correlation between TSX stocks", "rg-corr", "when this is high, stocks move as a block and stock-specific liquidity dries up at the same time everywhere.", "", "short-c")}
    ${chartCard("Spread of daily returns across stocks", "rg-disp", "how different the winners and losers are on a typical day. High dispersion means stock picking, not macro, is driving flow.", "", "short-c")}
    ${chartCard("Canada and US moving together", "rg-link", "correlation of the two index ETFs over 60 days. For names listed in both countries, US flow sets the pace.", "", "short-c")}
  </div>`;

  const pct = { ticksuffix: "%" };
  function drawVol() {
    const a = st.span === "3y" ? ts.xiu_vol : ts.xiu_vol_long, b = st.span === "3y" ? ts.spy_vol : ts.spy_vol_long;
    plot("rg-vol", [line(a.d, a.v, "Canada", C.c1), line(b.d, b.v, "United States", C.c2)], { yaxis: { ...pct, rangemode: "tozero" } });
  }
  function drawBreadth() {
    const a = st.bm === "ca" ? ts.b50 : ts.us_b50, b = st.bm === "ca" ? ts.b200 : ts.us_b200;
    plot("rg-breadth", [line(a.d, a.v, "Above 50-day", C.c1), line(b.d, b.v, "Above 200-day", C.c2)], { yaxis: { ...pct, range: [0, 100] }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 50, y1: 50, line: { color: C.ink3, width: 1, dash: "dot" } }] });
  }
  function mount() {
    drawVol(); drawBreadth();
    plot("rg-vix", [bar(ts.vix_monthly.d, ts.vix_monthly.v, "VIX", ts.vix_monthly.v.map((v) => (v >= 25 ? C.c2 : C.c1)))], { xaxis: { type: "date", tickformat: "%b %Y" }, bargap: 0.2 });
    plot("rg-nhnl", [line(ts.nhnl.d, ts.nhnl.v, "Highs minus lows", C.c1, { fill: "tozeroy", fillcolor: "rgba(31,125,181,.12)" })], { yaxis: pct });
    plot("rg-flow", [line(ts.flow.d, ts.flow.v, "Share in rising stocks", C.c1)], { yaxis: pct, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 50, y1: 50, line: { color: C.ink3, width: 1, dash: "dot" } }] });
    plot("rg-turn", [line(ts.turnover.d, ts.turnover.v, "C$ billions per day", C.c1, { fill: "tozeroy", fillcolor: "rgba(31,125,181,.12)" })], { yaxis: { tickprefix: "$", ticksuffix: "B", rangemode: "tozero" } });
    plot("rg-corr", [line(ts.corr.d, ts.corr.v, "Average correlation", C.c1)], { yaxis: { ...pct, rangemode: "tozero" } });
    plot("rg-disp", [line(ts.disp.d, ts.disp.v, "Canada, stocks", C.c1), line(ts.us_disp.d, ts.us_disp.v, "US, sectors", C.c2)], { yaxis: { ...pct, rangemode: "tozero" } });
    plot("rg-link", [line(ts.xiu_spy_corr.d, ts.xiu_spy_corr.v, "Correlation", C.c1)], { yaxis: { ...pct, range: [0, 100] } });
    onSeg("rg-span", (v) => { st.span = v; drawVol(); });
    onSeg("rg-bm", (v) => { st.bm = v; drawBreadth(); });
  }
  return { html, mount };
}

// ================================================================= TIMING AND STATISTICS
export function timing() {
  const D = store.D, T = D.timing, F = D.forecasts;
  const ev = Object.fromEntries(T.events.map((e) => [e.k, e]));
  const q = ev["Quarterly expiry and index rebalance"], ush = ev["US market closed, TSX open"], me = ev["Last trading day of the month"], fd = ev["First trading day of the month"];
  const wdMin = T.weekday.reduce((a, b) => (a.rel_vol < b.rel_vol ? a : b)), wdMax = T.weekday.reduce((a, b) => (a.rel_vol > b.rel_vol ? a : b));
  const usMin = T.us_weekday.reduce((a, b) => (a.rel_vol < b.rel_vol ? a : b)), usMax = T.us_weekday.reduce((a, b) => (a.rel_vol > b.rel_vol ? a : b));
  const v0 = T.volreg[0], v4 = T.volreg[4];
  const st = { dm: "xiu" };
  const statRow = (k, f) => `<tr><td class="l wrapc">${k}</td><td>${f(D.dist.xiu)}</td><td>${f(D.dist.spy)}</td></tr>`;
  const html = `
  ${pageHead("Timing and statistics · real data", "Which days are cheap to trade, and which are not?", `Five years of daily data for the ${T.weekday.length ? D.counts.timing_names : ""} most-traded TSX names and ten years of S&P 500 history, asked simple questions: does the weekday matter, do calendar events matter, and what does volatility do to the day.`)}
  ${shortBox([[f0(q.rel_vol) + "%", "of normal volume on quarterly rebalance days"], [f0(ush.rel_vol) + "%", "of normal volume when the US is closed"], ["+" + f0((v4.range_bps / v0.range_bps - 1) * 100) + "%", "wider daily ranges in the most volatile fifth of days"]])}
  ${frame("Everyone on a desk has a view on good and bad days to trade. Views are cheap; an algorithm needs numbers.", "Tests each belief on real data and keeps only what survives. Two forecasts are then checked on data they were not built on.", "An order that can choose its day should choose it. One that cannot should at least know what kind of day it is in.")}

  <h2>Does the day of the week matter?</h2>
  <div class="grid g2 mt">
    ${chartCard("Volume by weekday, normal day = 100", "tm-wd", "each bar compares that weekday's volume with the stock's own recent median. Bars near 100 mean the weekday tells you nothing.")}
    <div class="card linen"><h3>What the numbers say</h3>
      <p><b>Canada: barely.</b> The quietest weekday (${wdMin.k}) trades ${f0(wdMin.rel_vol)}% of normal and the busiest (${wdMax.k}) ${f0(wdMax.rel_vol)}%. That is noise, so the lab does not use a weekday factor for TSX volume.</p>
      <p><b>United States: yes.</b> ${usMin.k} is the quietest (${f0(usMin.rel_vol)}%) and ${usMax.k} the busiest (${f0(usMax.rel_vol)}%), with wider ranges late in the week.</p>
      <p>For an order with a choice of day, the weekday alone is a weak reason in Canada. The calendar events below are a strong one.</p>
      <div class="tbl-wrap"><table><thead><tr><th class="l">Canada</th>${T.weekday.map((w) => `<th>${w.k}</th>`).join("")}</tr></thead><tbody>
        <tr><td class="l">Volume</td>${T.weekday.map((w) => `<td>${f0(w.rel_vol)}</td>`).join("")}</tr>
        <tr><td class="l">Day range</td>${T.weekday.map((w) => `<td>${f0(w.rel_range)}</td>`).join("")}</tr>
        <tr><td class="l">Cost index</td>${T.weekday.map((w) => `<td><b>${f0(w.cost)}</b></td>`).join("")}</tr>
        <tr><td class="l">Index up, % of days</td>${T.weekday.map((w) => `<td>${f0(w.up_pct)}</td>`).join("")}</tr></tbody></table></div>
      <p class="small muted" style="margin-top:8px">Cost index: for the same order in the same stock, impact grows with the day's range and shrinks with the square root of its volume. 100 is an average day.</p></div>
  </div>
  ${legend([["Canada, " + D.counts.timing_names + " TSX names", C.c1, "bar"], ["United States, S&P 500 ETF", C.c2, "bar"]])}

  <h2>Do calendar events matter?</h2>
  <p class="sub">Yes, and much more than the weekday. These are the days I would plan large orders around.</p>
  <div class="two mt">
    ${chartCard("Volume on special days, Canada", "tm-ev", "volume against the stock's own normal. Long bars are days with far more liquidity than usual; short bars are days to stay small.")}
    <div class="card"><h3>The same days as a table</h3><div class="tbl-wrap mt"><table><thead><tr><th class="l">Day</th><th>Days</th><th>Volume</th><th>Range</th><th>Cost index</th></tr></thead><tbody>
      ${T.events.map((e) => `<tr><td class="l wrapc">${e.k}</td><td>${e.n}</td><td>${f0(e.rel_vol)}</td><td>${f0(e.rel_range)}</td><td><b>${f0(e.cost)}</b></td></tr>`).join("")}</tbody></table></div>
      <div class="callout"><b>Best day to work a large order:</b> the quarterly rebalance (cost index ${f0(q.cost)}), then month-end (${f0(me.cost)}). <b>Worst:</b> a US holiday (${f0(ush.cost)}), when a third of the usual volume shows up, and the first day of the month (${f0(fd.cost)}), when ranges are widest.</div></div>
  </div>

  <h2>What does volatility do to the trading day?</h2>
  <div class="grid g2 mt">
    ${chartCard("Day range and overnight gap by volatility level, Canada", "tm-vr", "days are sorted into five groups by how volatile the index was going in. Both the range during the day and the jump at the open grow with volatility.")}
    ${chartCard("Average daily move by VIX level", "tm-vix", "the average size of the daily move, up or down, in basis points. When VIX is above 25, a normal day is two to three times a calm day in both countries.")}
  </div>
  ${legend([["Typical day range / Canada", C.c1, "bar"], ["Typical overnight gap / United States", C.c2, "bar"]])}
  <div class="grid g3 mt">
    <div class="card"><div class="q-n">OVERNIGHT RISK</div><div class="q">${f0(T.overnight.xiu)}% of the TSX 60's risk arrives while the market is closed</div><p class="q-a">For the S&P 500 it is ${f0(T.overnight.spy)}%; for the median large TSX stock, ${f0(T.overnight.median_top)}%. An order carried overnight takes that risk with no way to trade out of it.</p></div>
    <div class="card"><div class="q-n">FAT TAILS</div><div class="q">${f1(D.dist.xiu.beyond3)}% of days are beyond three standard deviations</div><p class="q-a">A bell curve says 0.3%. Extreme days are ${f0(D.dist.xiu.beyond3 / 0.27)} times more common than the textbook, so limits and kill switches matter more than averages.</p></div>
    <div class="card"><div class="q-n">VOLATILITY CLUSTERS</div><div class="q">A big move today makes a big move tomorrow more likely</div><p class="q-a">The size of yesterday's move has a ${f2(D.acf.xiu[0])} correlation with today's in Canada and ${f2(D.acf.spy[0])} in the US, and it fades slowly. That is what makes volatility forecastable.</p></div>
  </div>

  <h2>The statistical picture</h2>
  <div class="grid g2 mt">
    ${chartCard("Daily returns compared with a bell curve", "tm-dist", "bars are the real share of days in each quarter-percent band over ten years; the line is what a bell curve with the same average and spread would give. Real markets have a taller middle and fatter ends.", `<div style="margin:6px 0 8px">${seg("tm-dm", [["xiu", "Canada"], ["spy", "United States"]], st.dm)}</div>`)}
    ${chartCard("How long volatility remembers", "tm-acf", "correlation between the size of a daily move and the size of the move 1 to 20 days later. It stays positive for weeks.")}
  </div>
  <div class="two mt">
    <div class="card"><h3>Ten years in numbers</h3><div class="tbl-wrap mt"><table><thead><tr><th class="l wrapc">TSX 60 ETF and S&P 500 ETF</th><th>Canada</th><th>US</th></tr></thead><tbody>
      ${statRow("Trading days", (d) => f0(d.n))}${statRow("Volatility per year", (d) => f1(d.ann_vol_pct) + "%")}${statRow("Typical daily move (1 s.d.)", (d) => f2(d.sd_pct) + "%")}
      ${statRow("Skew (negative = bigger drops than rallies)", (d) => f2(d.skew))}${statRow("Excess kurtosis (0 = bell curve)", (d) => f1(d.ex_kurt))}
      ${statRow("Days beyond 3 s.d.", (d) => f2(d.beyond3) + "%")}${statRow("Worst day", (d) => f1(d.worst_pct) + "%")}${statRow("Best day", (d) => "+" + f1(d.best_pct) + "%")}
      <tr><td class="l wrapc">One day's return against the next (correlation)</td><td>${f2(D.acf.xiu_lag1)}</td><td>${f2(D.acf.spy_lag1)}</td></tr></tbody></table></div></div>
    <div class="card"><h3>Do the forecasts hold up?</h3>
      <p class="small muted">Built on the first half of five years, scored on the second half (${f0(F.test_days)} days, ${F.names} stocks) that the forecast never saw.</p>
      <div class="tbl-wrap"><table><thead><tr><th class="l">Tomorrow's day range</th><th>Average miss</th></tr></thead><tbody>
        <tr><td class="l">Guess: same as yesterday</td><td>${f0(F.range.yesterday)} bps</td></tr><tr><td class="l">Guess: 20-day average</td><td>${f0(F.range.avg20)} bps</td></tr>
        <tr class="best"><td class="l"><b>Weighted average, recent days count more</b></td><td><b>${f0(F.range.ewma)} bps</b></td></tr></tbody></table></div>
      <p class="small" style="margin:8px 0 12px">The weighted forecast ranks tomorrow's quiet and wild stocks correctly most of the time (rank correlation ${f2(F.range.rank_corr)}) and beats "same as yesterday" by ${f0((1 - F.range.ewma / F.range.yesterday) * 100)}%.</p>
      <div class="tbl-wrap"><table><thead><tr><th class="l">Tomorrow's volume</th><th>Typical miss</th></tr></thead><tbody>
        <tr><td class="l">20-day median</td><td>${f1(F.volume.median20)}%</td></tr><tr><td class="l">20-day median with a weekday factor</td><td>${f1(F.volume.with_weekday)}%</td></tr></tbody></table></div>
      <div class="callout"><b>Follow the numbers.</b> The weekday factor improves the Canadian volume forecast by ${f1(F.volume.median20 - F.volume.with_weekday)} points, which is nothing, so I left it out. A belief that does not survive the test does not go into the algorithm.</div></div>
  </div>`;

  function drawDist() {
    const d = D.dist[st.dm], n = d.counts.reduce((s, x) => s + x, 0), color = st.dm === "xiu" ? C.c1 : C.c2;
    const x = d.bins.map((b) => b + 0.125), y = d.counts.map((c) => +((c / n) * 100).toFixed(2));
    const mu = d.mean_bps / 100, sd = d.sd_pct;
    const norm = x.map((v) => +((Math.exp(-0.5 * ((v - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))) * 0.25 * 100).toFixed(2));
    plot("tm-dist", [bar(x, y, "Real days", color, { hovertemplate: "%{y}% of days<extra>Real</extra>" }), line(x, norm, "Bell curve", C.ink, { line: { dash: "dot", width: 1.8 }, hovertemplate: "%{y}%<extra>Bell curve</extra>" })],
      { bargap: 0.08, xaxis: { ticksuffix: "%", range: [-4, 4], title: { text: "Daily return", font: { size: 12 } } }, yaxis: { ticksuffix: "%" }, margin: { b: 48 } });
  }
  function mount() {
    const wk = T.weekday.map((w) => w.k);
    plot("tm-wd", [bar(wk, T.weekday.map((w) => w.rel_vol), "Canada", C.c1), bar(wk, T.us_weekday.map((w) => w.rel_vol), "United States", C.c2)],
      { barmode: "group", bargroupgap: 0.08, yaxis: { range: [80, 118] }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 100, y1: 100, line: { color: C.ink, width: 1 } }] });
    const evs = T.events.slice(1).slice().reverse();
    plot("tm-ev", [bar(evs.map((e) => e.rel_vol), evs.map((e) => e.k), "Volume", evs.map((e) => (e.rel_vol >= 110 ? C.c1 : e.rel_vol <= 90 ? C.c2 : C.ink3)), { orientation: "h", text: evs.map((e) => f0(e.rel_vol)), textposition: "outside", cliponaxis: false, hovertemplate: "%{x}% of normal volume<extra></extra>" })],
      { hovermode: "closest", margin: { l: 10, r: 40 }, xaxis: { range: [0, Math.max(...evs.map((e) => e.rel_vol)) * 1.12] }, yaxis: { automargin: true }, shapes: [{ type: "line", yref: "paper", y0: 0, y1: 1, x0: 100, x1: 100, line: { color: C.ink, width: 1 } }] });
    const vk = T.volreg.map((v) => v.k);
    plot("tm-vr", [bar(vk, T.volreg.map((v) => v.range_bps), "Day range, bps", C.c1), bar(vk, T.volreg.map((v) => v.gap_bps), "Overnight gap, bps", C.c2)], { barmode: "group", bargroupgap: 0.08, yaxis: { ticksuffix: " bps" } });
    const bk = T.vix_buckets.map((v) => v.k);
    plot("tm-vix", [bar(bk, T.vix_buckets.map((v) => v.xiu_abs), "Canada", C.c1), bar(bk, T.vix_buckets.map((v) => v.spy_abs), "United States", C.c2)], { barmode: "group", bargroupgap: 0.08, yaxis: { ticksuffix: " bps" } });
    const lags = D.acf.xiu.map((_, i) => i + 1);
    plot("tm-acf", [bar(lags, D.acf.xiu, "Canada", C.c1), bar(lags, D.acf.spy, "United States", C.c2)], { barmode: "group", bargroupgap: 0.05, xaxis: { title: { text: "Days later", font: { size: 12 } }, dtick: 1 }, yaxis: { rangemode: "tozero" }, margin: { b: 48 } });
    drawDist();
    onSeg("tm-dm", (v) => { st.dm = v; drawDist(); });
  }
  return { html, mount };
}
