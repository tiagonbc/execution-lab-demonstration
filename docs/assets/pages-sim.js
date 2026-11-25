// Pages built on SIMULATION calibrated to real daily statistics: order flow, execution lab, daily operations.
import { store, C, ALGO_COLOR, $, $$, esc, f0, f1, f2, money, shares, cur, clock, plot, line, bar, legend, pageHead, shortBox, frame, chartCard, tag, seg, onSeg, instruments, instOptions, findInst, debounce } from "./ui.js";
import * as E from "./engine.js";

const ALGO = Object.fromEntries(E.ALGOS.map((a) => [a.id, a]));
const hourTicks = { tickvals: [0, 60, 120, 180, 240, 300, 360, 390], ticktext: ["9:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:00"] };

// ================================================================= ORDER FLOW
export function flow() {
  const st = { inst: "CA:RY", seed: 7, ice: 3, par: 2, reveal: false, idx: 0, timer: null };
  let sim, ice, par, bursts, vp, score, tk;

  const html = `
  ${pageHead("Order flow · simulated book", "Who else is in the book, and what are they doing?", "Thirty minutes of a simulated order book with hidden participants planted in it: iceberg orders, large orders cut into slices, and one aggressive burst. Three detectors read only what a public feed shows and try to find them.")}
  <div id="fl-short"></div>
  ${frame("A large order is never alone. Hidden size, other algorithms and impatient traders decide what a fill costs, and none of them announce themselves.", "Simulates a realistic book for a real stock, hides participants in it, and scores how many the detectors find and how many false alarms they raise.", "Reading other participants is how I trade my own intraday strategies. The same reading tells an execution algorithm when to lean in and when to step back.")}
  <div class="controls">
    <label>Stock<select id="fl-inst">${instOptions(instruments(), st.inst)}</select></label>
    <div class="ctl">Icebergs planted ${seg("fl-ice", [["0", "0"], ["2", "2"], ["3", "3"], ["5", "5"]], String(st.ice))}</div>
    <div class="ctl">Sliced orders planted ${seg("fl-par", [["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]], String(st.par))}</div>
    <button class="btn sm" id="fl-new" type="button">New session</button>
    <label class="check"><input type="checkbox" id="fl-reveal"> Reveal what was planted</label>
  </div>
  <div class="score" id="fl-score"></div>

  <div class="card mt"><h3>Price, with what the detectors flagged</h3>
    <div id="fl-px" class="chart tall" role="img" aria-label="Mid price over the session with detector flags"></div>
    ${legend([["Mid price", C.ink], ["Iceberg flagged (price level holds)", C.c3], ["Aggressive burst", C.c2, "bar"], ["Sliced buy order", C.buy, "bar"], ["Sliced sell order", C.sell, "bar"]])}
    <p class="how"><b>How to read it:</b> a purple line is a price where hidden size kept reloading. An orange band is a burst of orders sweeping the book. Bars along the bottom are orders arriving on a steady clock. Tick "Reveal what was planted" to see the truth as dotted outlines.</p></div>

  <div class="two mt">
    <div class="card"><h3>The book at <span id="fl-time" class="num"></span></h3>
      <div class="player"><button class="btn sm ghost" id="fl-play" type="button">Play</button><input type="range" id="fl-slider" min="0" max="0" value="0" aria-label="Session time"></div>
      <div class="ladder-h"><span>Buyers (bid size)</span><span>Price</span><span>Sellers (offer size)</span></div>
      <div class="ladder" id="fl-ladder"></div>
      <p class="how"><b>How to read it:</b> five best prices on each side. A dark price is a level the iceberg detector has flagged by this moment. Drag the slider or press Play.</p>
      <h3 style="margin-top:20px">Latest trades</h3><div class="tbl-wrap mt"><table id="fl-tape"></table></div></div>
    <div class="card"><h3>Alerts, in the order they fired</h3><div class="feed mt" id="fl-feed"></div></div>
  </div>

  <div class="grid g2 mt">
    ${chartCard("Net buying and selling, every 15 seconds", "fl-net", "bars above zero are seconds when buyers were the aggressors, below zero sellers. A long run on one side is someone working an order.")}
    ${chartCard("One-sidedness of the flow", "fl-vp", "share of each block of volume that was one-sided, averaged over the last five blocks (a VPIN-style gauge). Market makers widen or step away when it climbs.")}
  </div>

  <h2>Does it work, or did I get lucky?</h2>
  <p class="sub">One session proves little. This runs 40 fresh sessions for the chosen stock and reports the hit rate and the false alarms.</p>
  <div class="controls"><button class="btn sm" id="fl-batch" type="button">Test on 40 sessions</button><span id="fl-batch-out" class="small muted">Not run yet.</span></div>

  <h2>How each detector thinks</h2>
  <div class="grid g3 mt">
    <div class="card"><h3>Iceberg</h3><p>A trade removes shares from a price, yet the size shown there is larger than "before minus traded". Size came back at the instant of the trade. Once can be a new order; the same reload size at the same price several times is a hidden order.</p><p class="small muted">Use: sell into a hidden buyer while it lasts; do not expect price to break through it until it is done.</p></div>
    <div class="card"><h3>Sliced order</h3><p>One participant's large order shows as the same size, on the same side, on a steady clock. The detector walks back in time looking for that rhythm and tolerates a missed beat.</p><p class="small muted">Use: this is also how others see us. My algorithms vary slice size and timing for exactly this reason.</p></div>
    <div class="card"><h3>Aggressive burst</h3><p>Patient traders rarely clear the best price and keep going. Someone who must trade now does it again and again, and the other side stops refilling. Five sweeps on one side inside thirty seconds raises the flag.</p><p class="small muted">Use: pull passive orders on the side being hit, and wait for the book to refill.</p></div>
  </div>
  <p class="small muted mt">${tag("Simulated", "simu")} Order-by-order TSX data is a paid exchange feed that I do not redistribute, so the book here is generated: size and volatility come from the stock's real daily statistics, and the detectors use only fields a public depth-and-trades feed provides (price, size, displayed size before and after, sequence). Pointed at a real feed, the detector code is unchanged.</p>`;

  const px = (ticks) => ticks * sim.tick;
  const dec = () => (sim.tick < 0.01 ? 3 : 2);
  function run() {
    const inst = findInst(st.inst);
    sim = E.simulateFlow(inst, { icebergs: st.ice, parents: st.par }, st.seed);
    ice = E.detectIcebergs(sim.prints); par = E.detectParents(sim.prints); bursts = E.detectBursts(sim.prints, sim.T);
    vp = E.vpin(sim.prints); score = E.scoreFlow(sim, ice, par, bursts); tk = E.tickRuleAccuracy(sim.prints);
    st.idx = sim.snaps.length - 1;
    const sl = $("#fl-slider"); sl.max = sim.snaps.length - 1; sl.value = st.idx;
    const vol = sim.prints.reduce((s, p) => s + p.qty, 0);
    $("#fl-short").innerHTML = shortBox([[f0(sim.prints.length), `trades in 30 minutes of ${esc(inst.sym)} (${shares(vol)} shares)`], [`${score.ice.caught + score.par.caught + score.tox.caught} of ${score.ice.detectable + score.par.detectable + 1}`, "hidden participants found from public data"], [String(score.ice.falseAlarms + score.par.falseAlarms + score.tox.falseAlarms), "false alarms in this session"]]);
    drawScore(); drawPrice(); drawNet(); drawBook(); drawFeed();
  }
  function drawScore() {
    const card = (n, l) => `<div class="card"><div class="n">${n}</div><div class="l">${l}</div></div>`;
    const tooSmall = score.ice.planted - score.ice.detectable;
    $("#fl-score").innerHTML =
      card(`${score.ice.caught} of ${score.ice.detectable}`, `icebergs found${tooSmall ? ` (${tooSmall} more barely traded, so there was nothing to see)` : ""}; ${score.ice.falseAlarms} false`) +
      card(`${score.par.caught} of ${score.par.detectable}`, `sliced orders found; ${score.par.falseAlarms} false`) +
      card(score.tox.caught ? `${score.tox.delay}s` : "missed", score.tox.caught ? `to flag the aggressive burst; ${score.tox.falseAlarms} false` : `burst not flagged; ${score.tox.falseAlarms} false`) +
      card(f0(tk) + "%", "of trades correctly labelled buy or sell from prices alone (tick rule)");
  }
  function drawPrice() {
    const x = sim.snaps.map((s) => s.t / 60), y = sim.snaps.map((s) => +(px((s.bid + s.ask) / 2)).toFixed(4));
    const traces = [line(x, y, "Mid price", C.ink, { line: { width: 1.6 }, hovertemplate: "$%{y}<extra></extra>" })];
    ice.forEach((d) => traces.push({ x: [d.tFlag / 60, Math.max(d.t1, d.tFlag + 20) / 60], y: [px(d.px), px(d.px)], type: "scatter", mode: "lines+markers", marker: { size: 7, color: C.c3 }, line: { color: C.c3, width: 4 },
      hovertemplate: `Hidden ${d.side === "bid" ? "buyer" : "seller"} at $${px(d.px).toFixed(dec())}<br>${f0(d.vol)} shares traded, reloads of ${f0(d.clip)}<extra></extra>`, name: "Iceberg" }));
    const shapes = [];
    bursts.events.forEach((e) => shapes.push({ type: "rect", yref: "paper", y0: 0, y1: 1, x0: e.t0 / 60, x1: Math.max(e.t1, e.t0 + 8) / 60, fillcolor: "rgba(209,117,9,.16)", line: { width: 0 } }));
    par.forEach((d, i) => shapes.push({ type: "rect", yref: "paper", y0: 0.012 + 0.035 * (i % 3), y1: 0.04 + 0.035 * (i % 3), x0: d.t0 / 60, x1: d.t1 / 60, fillcolor: d.side > 0 ? C.buy : C.sell, line: { width: 0 } }));
    if (st.reveal) {
      const tr = sim.truth;
      tr.icebergs.filter((i) => i.px != null).forEach((i) => traces.push({ x: [i.t0 / 60, (i.done ?? sim.T) / 60], y: [px(i.px), px(i.px)], type: "scatter", mode: "lines", line: { color: C.ink3, width: 1.5, dash: "dot" },
        hovertemplate: `Planted iceberg (${i.side === "bid" ? "buy" : "sell"}): ${f0(i.executed)} of ${f0(i.total)} traded, ${i.refills} reloads<extra></extra>`, name: "Planted" }));
      shapes.push({ type: "rect", yref: "paper", y0: 0, y1: 1, x0: tr.toxic.start / 60, x1: tr.toxic.end / 60, fillcolor: "rgba(0,0,0,0)", line: { color: C.ink3, width: 1.5, dash: "dot" } });
      tr.parents.forEach((p, i) => shapes.push({ type: "rect", yref: "paper", y0: 0.955 - 0.03 * i, y1: 0.975 - 0.03 * i, x0: p.start / 60, x1: p.end / 60, fillcolor: "rgba(0,0,0,0)", line: { color: p.side > 0 ? C.buy : C.sell, width: 1.5, dash: "dot" } }));
    }
    plot("fl-px", traces, { hovermode: "closest", shapes, xaxis: { title: { text: "Minutes into the session", font: { size: 12 } }, range: [0, sim.T / 60] }, yaxis: { tickprefix: "$", tickformat: `.${dec()}f` }, margin: { b: 48, l: 64 } });
  }
  function drawNet() {
    const w = 15, nb = Math.ceil(sim.T / w), net = new Array(nb).fill(0);
    for (const p of sim.prints) net[Math.min(nb - 1, Math.floor(p.t / w))] += p.side * p.qty;
    const x = net.map((_, i) => (i * w) / 60);
    plot("fl-net", [bar(x, net, "Net shares", net.map((v) => (v >= 0 ? C.buy : C.sell)), { hovertemplate: "%{y:,.0f} shares net<extra></extra>" })], { bargap: 0.1, xaxis: { title: { text: "Minutes", font: { size: 12 } } }, yaxis: { tickformat: ",.0f" }, margin: { b: 48, l: 60 } });
    plot("fl-vp", [line(vp.map((b) => b.t / 60), vp.map((b) => +(b.vpin * 100).toFixed(0)), "One-sidedness", C.c1, { line: { shape: "hv" } })], { xaxis: { title: { text: "Minutes", font: { size: 12 } }, range: [0, sim.T / 60] }, yaxis: { ticksuffix: "%", range: [0, 100] }, margin: { b: 48 } });
  }
  function drawBook() {
    const s = sim.snaps[st.idx], mx = Math.max(...s.bids, ...s.asks, 1);
    $("#fl-time").textContent = clock(s.t) + " min";
    const flagged = (side, p) => ice.some((d) => d.side === side && d.px === p && d.tFlag <= s.t && d.t1 + 30 >= s.t);
    let h = "";
    for (let l = 4; l >= 0; l--) h += `<div class="lv ${flagged("ask", s.ask + l) ? "ice" : ""}"><div class="b"></div><div class="px">${px(s.ask + l).toFixed(dec())}</div><div class="a" style="--w:${(s.asks[l] / mx) * 100}"><span>${f0(s.asks[l])}</span></div></div>`;
    for (let l = 0; l < 5; l++) h += `<div class="lv ${flagged("bid", s.bid - l) ? "ice" : ""}"><div class="b" style="--w:${(s.bids[l] / mx) * 100}"><span>${f0(s.bids[l])}</span></div><div class="px">${px(s.bid - l).toFixed(dec())}</div><div class="a"></div></div>`;
    $("#fl-ladder").innerHTML = h;
    const upto = sim.prints.filter((p) => p.t <= s.t).slice(-9).reverse();
    $("#fl-tape").innerHTML = `<thead><tr><th class="l">Time</th><th class="l">Aggressor</th><th>Shares</th><th>Price</th></tr></thead><tbody>${upto.map((p) => `<tr><td class="l">${clock(p.t)}</td><td class="l">${p.side > 0 ? tag("Buy", "buy") : tag("Sell", "sell")}</td><td>${f0(p.qty)}${p.qty < 100 ? ' <span class="nm" style="display:inline">odd lot</span>' : ""}</td><td>${px(p.px).toFixed(dec())}</td></tr>`).join("")}</tbody>`;
  }
  function drawFeed() {
    const items = [];
    ice.forEach((d) => items.push({ t: d.tFlag, kind: "Iceberg", cls: "", head: `Hidden ${d.side === "bid" ? "buyer" : "seller"} at $${px(d.px).toFixed(dec())}`, body: `Size reloaded ${d.refills} times in clips of ${f0(d.clip)}; ${f0(d.vol)} shares traded at this price.`, act: d.side === "bid" ? "Selling: this bid absorbs size without the price dropping. Buying: expect support here until it is gone." : "Buying: this offer absorbs size without the price rising. Selling: expect a ceiling here until it is gone." }));
    par.forEach((d) => items.push({ t: d.tFlag, kind: "Sliced order", cls: d.side > 0 ? "buy" : "sell", head: `${d.side > 0 ? "Buy" : "Sell"} order on a clock: ${f0(d.clip)} shares about every ${f0(d.interval)}s`, body: `${d.prints} slices seen, about ${f0(d.vol)} shares so far.`, act: d.side > 0 ? "A buyer is working size. Buying alongside costs more; a seller can rest offers into the steady demand." : "A seller is working size. Selling alongside costs more; a buyer can rest bids into the steady supply." }));
    bursts.events.forEach((e) => items.push({ t: e.t0, kind: "Burst", cls: "warn", head: `Aggressive ${e.side > 0 ? "buying" : "selling"}: ${f0(e.peak)} sweeps in ${bursts.w}s`, body: `Lasted about ${Math.max(1, e.t1 - e.t0)}s.`, act: `Pull passive ${e.side > 0 ? "offers" : "bids"}; wait for the book to refill before resuming.` }));
    items.sort((a, b) => a.t - b.t);
    $("#fl-feed").innerHTML = items.length ? `<table><tbody>${items.map((i) => `<tr><td class="l" style="vertical-align:top;width:54px"><b>${clock(i.t)}</b></td><td class="l wrapc"><p style="margin:0 0 4px">${tag(i.kind, i.cls)} <b>${i.head}</b></p><p class="small muted" style="margin:0 0 4px">${i.body}</p><p class="small" style="margin:0">${i.act}</p></td></tr>`).join("")}</tbody></table>` : `<p class="muted">No alerts in this session.</p>`;
  }
  function stop() { clearInterval(st.timer); st.timer = null; const b = $("#fl-play"); if (b) b.textContent = "Play"; }
  function mount() {
    run();
    $("#fl-inst").addEventListener("change", (e) => { st.inst = e.target.value; stop(); run(); });
    onSeg("fl-ice", (v) => { st.ice = +v; stop(); run(); });
    onSeg("fl-par", (v) => { st.par = +v; stop(); run(); });
    $("#fl-new").addEventListener("click", () => { st.seed++; stop(); run(); });
    $("#fl-reveal").addEventListener("change", (e) => { st.reveal = e.target.checked; drawPrice(); });
    $("#fl-slider").addEventListener("input", (e) => { st.idx = +e.target.value; drawBook(); });
    $("#fl-play").addEventListener("click", () => {
      if (st.timer) return stop();
      if (st.idx >= sim.snaps.length - 1) st.idx = 0;
      $("#fl-play").textContent = "Pause";
      st.timer = setInterval(() => {
        if (!document.getElementById("fl-ladder")) return stop();
        st.idx = Math.min(sim.snaps.length - 1, st.idx + 1); $("#fl-slider").value = st.idx; drawBook();
        if (st.idx >= sim.snaps.length - 1) stop();
      }, 110);
    });
    $("#fl-batch").addEventListener("click", () => {
      const inst = findInst(st.inst), t = { ic: 0, id: 0, ifa: 0, pc: 0, pd: 0, pfa: 0, bc: 0, bfa: 0 };
      for (let s = 101; s <= 140; s++) {
        const x = E.simulateFlow(inst, { icebergs: st.ice, parents: st.par }, s);
        const sc = E.scoreFlow(x, E.detectIcebergs(x.prints), E.detectParents(x.prints), E.detectBursts(x.prints, x.T));
        t.ic += sc.ice.caught; t.id += sc.ice.detectable; t.ifa += sc.ice.falseAlarms; t.pc += sc.par.caught; t.pd += sc.par.detectable; t.pfa += sc.par.falseAlarms; t.bc += sc.tox.caught; t.bfa += sc.tox.falseAlarms;
      }
      const pc = (a, b) => (b ? f0((a / b) * 100) + "%" : "n/a");
      $("#fl-batch-out").innerHTML = `<b style="color:var(--ink)">${esc(inst.sym)}, 40 sessions:</b> icebergs ${t.ic} of ${t.id} found (${pc(t.ic, t.id)}), ${t.ifa} false · sliced orders ${t.pc} of ${t.pd} (${pc(t.pc, t.pd)}), ${t.pfa} false · bursts ${t.bc} of 40 (${pc(t.bc, 40)}), ${t.bfa} false.`;
    });
  }
  return { html, mount, unmount: stop };
}

// ================================================================= EXECUTION LAB
const WINDOWS = { day: [0, 390, "All day, 9:30 to 16:00"], am: [0, 120, "First two hours"], mid: [30, 330, "10:00 to 15:00"], pm: [270, 390, "Last two hours"] };
export function execution() {
  const st = { inst: "CA:RY", side: 1, pct: 5, win: "day", useClose: true, closeShare: 8, signalQ: 10, volMult: 1, rate: 10, day: 1, show: new Set(["vwap", "is", "adaptive"]) };
  const algos = E.ALGOS.map((a) => a.id);
  let mc;

  const html = `
  ${pageHead("Execution lab · simulation on real statistics", "What will this order cost, and which algorithm should carry it?", "Pick a real stock and an order size. The lab estimates the cost before trading, replays the order through six algorithms on one simulated day, then repeats it on 300 days to see which is cheapest and which is safest.")}
  <div id="ex-short"></div>
  ${frame("A large order moves the price against itself. Trade fast and you pay impact; trade slowly and the price drifts while you wait.", "Simulates the day from the stock's real price, volume and volatility, and runs every algorithm on the very same days, in mirrored up-and-down pairs, so the comparison is fair and not a matter of luck.", "The posting asks for algorithms that decide how orders are generated, and for a simulation framework to validate them. This is both, small enough to read.")}
  <div class="controls">
    <label>Stock<select id="ex-inst">${instOptions(instruments(), st.inst)}</select></label>
    <div class="ctl">Side ${seg("ex-side", [["1", "Buy"], ["-1", "Sell"]], String(st.side))}</div>
    <label>Order size: <span id="ex-pct-l"></span><input type="range" id="ex-pct" min="0.5" max="30" step="0.5" value="${st.pct}"></label>
    <label>Trading window<select id="ex-win">${Object.entries(WINDOWS).map(([k, v]) => `<option value="${k}">${v[2]}</option>`).join("")}</select></label>
    <label class="check"><input type="checkbox" id="ex-close" checked> Use the closing auction</label>
  </div>
  <div class="controls" style="margin-top:10px">
    <span class="small" style="font-weight:600;color:var(--ink)">Assumptions you can change</span>
    <label>Closing auction share of volume: <span id="ex-cs-l"></span><input type="range" id="ex-cs" min="0" max="20" step="1" value="${st.closeShare}"></label>
    <label>How much the flow signal knows: <span id="ex-sq-l"></span><input type="range" id="ex-sq" min="0" max="30" step="1" value="${st.signalQ}"></label>
    <div class="ctl">Market mood ${seg("ex-vm", [["0.7", "Calm"], ["1", "Normal"], ["1.6", "Stressed"]], String(st.volMult))}</div>
    <label>POV rate: <span id="ex-rt-l"></span><input type="range" id="ex-rt" min="3" max="30" step="1" value="${st.rate}"></label>
  </div>

  <h2>Before trading: the estimate</h2>
  <div class="two mt">
    <div class="card" id="ex-pre"></div>
    ${chartCard("How cost grows with size", "ex-curve", "estimated cost of working an order of each size over the chosen window. The dot is your order. Every extra share costs more than the one before it, which is why large orders are split across days.", "", "short-c")}
  </div>

  <h2>One day, replayed</h2>
  <p class="sub">The same simulated day, three views. Choose which algorithms to draw.</p>
  <div class="controls" style="margin-top:14px"><div class="chips" id="ex-chips"></div><button class="btn sm ghost" id="ex-newday" type="button">Another day</button></div>
  <div class="grid g2 mt">
    ${chartCard("Price during the day", "ex-path", "the stock's price in basis points from where it was when the order arrived. Up is bad for a buyer, good for a seller.")}
    ${chartCard("How fast each algorithm fills", "ex-fill", "share of the order completed through the day. A steep early line is an urgent algorithm; a line that hugs the volume curve is VWAP.")}
  </div>
  <div class="tbl-wrap mt"><table id="ex-day"></table></div>

  <h2>300 days: which algorithm wins?</h2>
  <div class="card linen mt"><p class="verdict" id="ex-verdict"></p></div>
  <div class="grid g2 mt">
    ${chartCard("Average cost by algorithm", "ex-bar", "average cost against the arrival price, in basis points; lower is better. The thin line on each bar is the margin of error from 300 days.")}
    ${chartCard("Cost against risk", "ex-front", "left is safer (cost varies less from day to day), down is cheaper. No algorithm is best at both, which is the trade-off a trader chooses.")}
  </div>
  <div class="tbl-wrap mt"><table id="ex-mc"></table></div>
  <p class="small muted mt">Cost is implementation shortfall: the average fill price against the price when the order arrived. Impact follows the form in Almgren, Thum, Hauptmann and Li (2005): a temporary part that grows with the share of volume taken (power 0.6) and a permanent part that grows with size. The coefficients are literature values, not a fit to anyone's fills; with real fills I would re-fit them per stock group. "Flow-aware" only beats VWAP if the signal knows something: set that slider to 0 and its edge disappears, which is the honest test.</p>`;

  const order = () => { const inst = findInst(st.inst), w = WINDOWS[st.win]; return { inst, o: { side: st.side, qty: Math.round((inst.adv_sh * st.pct) / 100), start: w[0], end: w[1] } }; };
  const opts = () => ({ closeShare: st.closeShare / 100, signalQ: st.signalQ / 100, volMult: st.volMult });
  const params = () => ({ useClose: st.useClose && WINDOWS[st.win][1] === 390, rate: st.rate / 100 });
  function windowShare() { const w = WINDOWS[st.win], c = E.volumeCurve(st.closeShare / 100); let s = 0; for (let m = w[0]; m < w[1]; m++) s += c[m]; if (params().useClose) s += c[390]; return s; }

  function labels() {
    const { inst, o } = order(), c = cur(inst);
    $("#ex-pct-l").textContent = `${st.pct}% of a day = ${shares(o.qty)} sh, ${money(o.qty * inst.px, c)}`;
    $("#ex-cs-l").textContent = st.closeShare + "%"; $("#ex-sq-l").textContent = st.signalQ === 0 ? "nothing" : st.signalQ + "%"; $("#ex-rt-l").textContent = st.rate + "% of volume";
  }
  function drawPre() {
    const { inst, o } = order(), c = cur(inst), ws = windowShare(), w = WINDOWS[st.win];
    const scaled = { ...inst, vol_d: inst.vol_d * st.volMult };
    const pre = E.preTrade(scaled, o.qty, { windowShare: ws, dayShare: (w[1] - w[0]) / 390, cross: E.CROSS.vwap });
    const notional = o.qty * inst.px;
    $("#ex-pre").innerHTML = `<h3>${st.side > 0 ? "Buy" : "Sell"} ${f0(o.qty)} ${esc(inst.sym)} <span class="muted" style="font:500 15px var(--sans)">${money(notional, c)}</span></h3>
      <div class="grid g3 mt"><div><div class="num" style="font:500 32px/1 var(--serif)">${f1(pre.bps)} bps</div><div class="small muted">expected cost, about ${money((notional * pre.bps) / 1e4, c)}</div></div>
      <div><div class="num" style="font:500 32px/1 var(--serif)">±${f0(pre.risk)} bps</div><div class="small muted">how far the price typically drifts while the order works</div></div>
      <div><div class="num" style="font:500 32px/1 var(--serif)">${f1(pre.part)}%</div><div class="small muted">of the volume in the window</div></div></div>
      <div class="bars" style="margin-top:18px">${[["Crossing the spread", pre.spread], ["Temporary impact (pressure while trading)", pre.temp], ["Permanent impact (information leaked)", pre.perm]].map(([l, v]) => `<div class="bar" style="grid-template-columns:260px 1fr 64px"><span>${l}</span><span class="track"><span class="fill" style="width:${Math.min(100, (v / pre.bps) * 100)}%"></span></span><span class="v">${f1(v)} bps</span></div>`).join("")}</div>
      <p class="how" style="margin-top:14px">${pre.part > 25 ? `<b>Too large for this window.</b> At ${f0(pre.part)}% of volume the order would dominate the tape. I would spread it over more days or find a block.` : pre.part > 10 ? `<b>Heavy.</b> Above 10% of volume the order is visible; a longer window or the closing auction would help.` : `<b>Comfortable.</b> Under 10% of volume, a patient schedule should stay close to this estimate.`} Real inputs: price ${f2(inst.px)}, ${shares(inst.adv_sh)} shares a day, daily volatility ${f2(inst.vol_d)}%, modelled spread ${f1(inst.spread_bps)} bps.</p>`;
    const xs = [0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30];
    const ys = xs.map((p) => +E.preTrade(scaled, (inst.adv_sh * p) / 100, { windowShare: ws, cross: E.CROSS.vwap }).bps.toFixed(1));
    plot("ex-curve", [line(xs, ys, "Estimated cost", C.c1, { hovertemplate: "%{x}% of a day: %{y} bps<extra></extra>" }), { x: [st.pct], y: [+pre.bps.toFixed(1)], type: "scatter", mode: "markers", marker: { size: 12, color: C.ink, line: { color: "#fff", width: 2 } }, hovertemplate: "Your order: %{y} bps<extra></extra>" }],
      { hovermode: "closest", xaxis: { ticksuffix: "%", title: { text: "Order size, % of a day's volume", font: { size: 12 } } }, yaxis: { ticksuffix: " bps", rangemode: "tozero" }, margin: { b: 48, l: 62 } });
    return pre;
  }
  function drawDay() {
    const { inst, o } = order(), day = E.simulateDay(inst, opts(), E.rng(9000 + st.day * 37)), w = WINDOWS[st.win];
    const res = Object.fromEntries(algos.map((a) => [a, E.runAlgo(day, inst, o, a, params())]));
    const xs = [...Array(391).keys()], base = day.u[w[0]];
    plot("ex-path", [line(xs, xs.map((m) => +(((day.u[m] - base) / base) * 1e4).toFixed(1)), "Price vs arrival", C.ink, { line: { width: 1.6 }, hovertemplate: "%{y} bps<extra></extra>" })],
      { xaxis: hourTicks, yaxis: { ticksuffix: " bps" }, shapes: [{ type: "rect", yref: "paper", y0: 0, y1: 1, x0: w[0], x1: w[1], fillcolor: "rgba(245,243,239,.9)", line: { width: 0 }, layer: "below" }] });
    const fillTr = [...st.show].map((a) => { let c = 0; const y = xs.map((m) => { c += res[a].fills[m]; return +((c / (o.qty || 1)) * 100).toFixed(1); }); return line(xs, y, ALGO[a].name, ALGO_COLOR[a], { hovertemplate: `%{y}%<extra>${ALGO[a].name}</extra>` }); });
    plot("ex-fill", fillTr, { xaxis: hourTicks, yaxis: { ticksuffix: "%", range: [0, 102] } });
    const c = cur(inst), best = Math.min(...algos.map((a) => res[a].isBps));
    $("#ex-day").innerHTML = `<thead><tr><th class="l">Algorithm</th><th class="l wrapc">What it does</th><th>Cost vs arrival</th><th>In dollars</th><th>From impact</th><th>From price drift</th><th>vs market VWAP</th><th>Peak share of volume</th></tr></thead><tbody>${
      algos.map((a) => { const r = res[a]; return `<tr class="${r.isBps === best ? "best" : ""}"><td class="l"><b style="border-left:4px solid ${ALGO_COLOR[a]};padding-left:8px">${ALGO[a].name}</b></td><td class="l wrapc small">${ALGO[a].plain}</td><td><b>${f1(r.isBps)} bps</b></td><td>${money(r.costCash, c)}</td><td>${f1(r.impactBps)}</td><td>${f1(r.parts.timing)}</td><td>${f1(r.vsVwapBps)}</td><td>${f0(r.peakPart)}%</td></tr>`; }).join("")}</tbody>`;
  }
  function drawMC() {
    const { inst, o } = order(), c = cur(inst), notional = o.qty * inst.px;
    mc = E.monteCarlo(inst, o, algos, 300, 17, opts(), params());
    const rows = algos.map((a) => mc[a]).sort((x, y) => x.mean - y.mean), best = rows[0], safe = [...rows].sort((x, y) => x.sd - y.sd)[0], vw = mc.vwap;
    const diff = vw.samples.map((v, i) => v - best.samples[i]), dMean = E.mean(diff), dSe = E.pairSe(diff);
    const clear = best.algo !== "vwap" && dMean > 2 * dSe;
    $("#ex-verdict").innerHTML = `<b>${ALGO[best.algo].name}</b> is the cheapest on average for this order: ${f1(best.mean)} bps, about ${money((notional * best.mean) / 1e4, c)}. ` +
      (best.algo === "vwap" ? "" : clear ? `That is ${f1(dMean)} bps better than VWAP, a gap larger than the noise in 300 days. ` : `Its lead over VWAP (${f1(dMean)} bps) is within the noise of 300 days, so I would not call it a real edge. `) +
      `<b>${ALGO[safe.algo].name}</b> carries the least day-to-day risk (±${f0(safe.sd)} bps).`;
    plot("ex-bar", [bar(rows.map((r) => ALGO[r.algo].name), rows.map((r) => +r.mean.toFixed(1)), "Average cost", rows.map((r) => ALGO_COLOR[r.algo]), { error_y: { type: "data", array: rows.map((r) => +(2 * r.se).toFixed(1)), color: C.ink, thickness: 1.2, width: 5 }, hovertemplate: "%{y} bps<extra></extra>" })], { hovermode: "closest", yaxis: { ticksuffix: " bps" } });
    plot("ex-front", [{ x: rows.map((r) => +r.sd.toFixed(1)), y: rows.map((r) => +r.mean.toFixed(1)), text: rows.map((r) => ALGO[r.algo].name), type: "scatter", mode: "markers+text", textposition: rows.map((r) => ({ twap: "top right", vwap: "bottom left", is: "top left", adaptive: "bottom center", pov: "top center", moc: "bottom left" }[r.algo])), textfont: { color: C.ink, size: 12.5 }, marker: { size: 13, color: rows.map((r) => ALGO_COLOR[r.algo]), line: { color: "#fff", width: 2 } }, hovertemplate: "%{text}<br>cost %{y} bps, risk ±%{x} bps<extra></extra>" }],
      { hovermode: "closest", xaxis: { ticksuffix: " bps", title: { text: "Risk: day-to-day variation in cost", font: { size: 12 } } }, yaxis: { ticksuffix: " bps", title: { text: "Average cost", font: { size: 12 } } }, margin: { b: 50, l: 66, t: 24 } });
    $("#ex-mc").innerHTML = `<thead><tr><th class="l">Algorithm</th><th>Average cost</th><th>In dollars</th><th>Margin of error</th><th>Risk (1 s.d.)</th><th>A bad day (1 in 20)</th><th>A good day (1 in 20)</th><th>vs market VWAP</th><th>Peak share of volume</th></tr></thead><tbody>${
      rows.map((r, i) => `<tr class="${i === 0 ? "best" : ""}"><td class="l"><b style="border-left:4px solid ${ALGO_COLOR[r.algo]};padding-left:8px">${ALGO[r.algo].name}</b></td><td><b>${f1(r.mean)} bps</b></td><td>${money((notional * r.mean) / 1e4, c)}</td><td>±${f1(2 * r.se)}</td><td>±${f0(r.sd)}</td><td>${f0(r.p95)}</td><td>${f0(r.p5)}</td><td>${f1(r.vsVwap)}</td><td>${f0(r.peak)}%</td></tr>`).join("")}</tbody>`;
    return { best, safe };
  }
  function drawChips() {
    $("#ex-chips").innerHTML = algos.map((a) => `<button type="button" class="chip" data-a="${a}" aria-pressed="${st.show.has(a)}"><i style="background:${ALGO_COLOR[a]}"></i>${ALGO[a].name}</button>`).join("");
  }
  function all() {
    labels(); const pre = drawPre(); drawDay(); const { best } = drawMC();
    $("#ex-short").innerHTML = shortBox([[f1(pre.bps) + " bps", "estimated cost before trading"], [ALGO[best.algo].name, `cheapest of six on 300 simulated days (${f1(best.mean)} bps)`], [f1(pre.part) + "%", "of the window's volume this order takes"]]);
  }
  const later = debounce(all, 140);
  function mount() {
    drawChips(); all();
    $("#ex-inst").addEventListener("change", (e) => { st.inst = e.target.value; all(); });
    onSeg("ex-side", (v) => { st.side = +v; all(); });
    onSeg("ex-vm", (v) => { st.volMult = +v; all(); });
    $("#ex-win").addEventListener("change", (e) => { st.win = e.target.value; all(); });
    $("#ex-close").addEventListener("change", (e) => { st.useClose = e.target.checked; all(); });
    for (const [id, key] of [["ex-pct", "pct"], ["ex-cs", "closeShare"], ["ex-sq", "signalQ"], ["ex-rt", "rate"]]) $("#" + id).addEventListener("input", (e) => { st[key] = +e.target.value; labels(); later(); });
    $("#ex-newday").addEventListener("click", () => { st.day++; drawDay(); });
    $("#ex-chips").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; const a = b.dataset.a; if (st.show.has(a)) st.show.delete(a); else st.show.add(a); drawChips(); drawDay(); });
  }
  return { html, mount };
}

// ================================================================= DAILY OPERATIONS
export function opsData() {
  const insts = instruments("CA"), days = [];
  const incidents = { 23: { liqMult: 0.38, label: "Volume ran at about 40% of forecast (a US holiday missing from the calendar)" }, 41: { volMult: 2.6, label: "Volatility shock: ranges about 2.6 times normal" }, 42: { volMult: 2.0, label: "Second day of the volatility shock" } };
  for (let d = 1; d <= 60; d++) {
    const R = E.rng(5000 + d), inc = incidents[d] || {}, gap = [], is = [], part = [];
    for (let k = 0; k < 16; k++) {
      const inst = insts[Math.floor(R() * insts.length)], pct = 0.005 + 0.055 * R(), side = R() < 0.5 ? 1 : -1, qty = inst.adv_sh * pct;
      const day = E.simulateDay(inst, { signalQ: 0.1, liqMult: inc.liqMult ?? 1, volMult: inc.volMult ?? 1 }, E.rng(d * 1000 + k));
      const r = E.runAlgo(day, inst, { side, qty, start: 0, end: 390 }, "vwap", { useClose: true });
      const pre = E.preTrade(inst, qty, { windowShare: 1, cross: E.CROSS.vwap });
      gap.push(r.impactBps - pre.bps); is.push(Math.abs(r.parts.timing) / (inst.vol_d * 100)); part.push(r.peakPart);
    }
    days.push({ d, gap: E.mean(gap), drift: E.mean(is), peak: Math.max(...part), incident: inc.label || null });
  }
  const basis = days.slice(0, 20), lim = (k) => { const m = E.mean(basis.map((x) => x[k])), s = E.stdev(basis.map((x) => x[k])); return { m, hi: m + 3 * s, lo: m - 3 * s }; };
  const L = { gap: lim("gap"), drift: lim("drift") };
  const alerts = [];
  for (const x of days.slice(20)) {
    if (x.gap > L.gap.hi) alerts.push({ d: x.d, rule: "Impact above estimate", detail: `Fills cost ${f1(x.gap)} bps more than the pre-trade estimate (limit ${f1(L.gap.hi)})`, cause: x.incident });
    if (x.drift > L.drift.hi) alerts.push({ d: x.d, rule: "Price drift out of range", detail: `Prices moved ${f2(x.drift)} daily ranges while orders worked (limit ${f2(L.drift.hi)})`, cause: x.incident });
    if (x.peak > 25) alerts.push({ d: x.d, rule: "Participation cap", detail: `One order reached ${f0(x.peak)}% of a minute's volume (cap 25%)`, cause: x.incident });
  }
  return { days, L, alerts, incidents };
}
export function operations() {
  const O = opsData(), planted = Object.keys(O.incidents).map(Number), caught = planted.filter((d) => O.alerts.some((a) => a.d === d));
  const falseDays = [...new Set(O.alerts.filter((a) => !planted.includes(a.d)).map((a) => a.d))];
  const html = `
  ${pageHead("Daily operations · simulation", "Is the algorithm behaving today?", "Running algorithms is a daily job: check them before the open, watch them during the day, and measure them after the close. This page shows the routine I would follow and the control charts that tell me when something is off.")}
  ${shortBox([["60 days", "of simulated trading, 16 orders a day, on real TSX statistics"], [`${caught.length} of ${planted.length}`, "planted problem days caught by the control limits"], [String(falseDays.length), "false alarm days in the 40 monitored days"]])}
  ${frame("An algorithm does not announce that its volume forecast is stale or that the market changed. It just gets worse fills.", "Compares every day's fills with the pre-trade estimate and flags days that fall outside the normal range.", "The posting asks for someone to manage daily trading operations and own the outcomes. This is how I would know, by the afternoon, that something needs my attention.")}

  <h2>The daily routine</h2>
  <div class="steps">
    <div><div class="when">Before the open</div><ul><li>Calendar: index rebalance, options expiry, US or Canadian holiday, month-end? Each changes the volume forecast (see Timing).</li><li>Market mood: the regime score and overnight moves in the US set slice sizes and price limits.</li><li>Data checks: yesterday's volumes and prices loaded, no stale or missing symbols, corporate actions applied.</li><li>Limits loaded and tested: maximum order size, participation cap, price collars, kill switch.</li></ul></div>
    <div><div class="when">During the day</div><ul><li>Each working order against its schedule: ahead, behind, or stuck.</li><li>Fills against the pre-trade estimate, live. A gap that keeps growing is a model problem, not bad luck.</li><li>Order-flow alerts on the names being traded (icebergs, sliced orders, bursts).</li><li>Venue health: rejects, slow acknowledgements, a venue that stopped filling.</li></ul></div>
    <div><div class="when">Into the close</div><ul><li>Close imbalance published: resize what goes to the auction.</li><li>Anything unfinished: complete in the auction, carry to tomorrow, or stop, by rule and not by mood.</li></ul></div>
    <div><div class="when">After the close</div><ul><li>Cost report per order: against arrival, against VWAP, against the estimate.</li><li>Control charts below. Any flagged day gets a written cause the same evening.</li><li>What changes tomorrow: a parameter, a forecast, or nothing.</li></ul></div>
  </div>

  <h2>Control charts</h2>
  <p class="sub">${tag("Simulated", "simu")} The first 20 days set the normal range (average plus or minus three standard deviations). The next 40 days are monitored. Three problem days were planted without telling the monitor.</p>
  <div class="grid g2 mt">
    ${chartCard("Impact paid against the estimate", "op-gap", "each dot is one day: how many basis points the fills cost above or below the pre-trade estimate. A dot above the upper line means the model is under-estimating cost that day.")}
    ${chartCard("Price drift while orders worked", "op-drift", "how far prices moved during execution, in units of a normal day's range. A spike means the market changed character and the schedules should adapt.")}
  </div>
  ${legend([["Normal day", C.c1, "bar"], ["Flagged day", C.c2, "bar"], ["Control limit", C.ink]])}
  <div class="card mt"><h3>Alerts raised</h3><div class="tbl-wrap mt"><table><thead><tr><th class="l">Day</th><th class="l">Rule</th><th class="l wrapc">What the monitor saw</th><th class="l wrapc">What had been planted</th></tr></thead><tbody>
    ${O.alerts.map((a) => `<tr><td class="l"><b>${a.d}</b></td><td class="l">${tag(a.rule, "warn")}</td><td class="l wrapc">${a.detail}</td><td class="l wrapc">${a.cause ? a.cause : '<span class="muted">Nothing: a false alarm</span>'}</td></tr>`).join("") || `<tr><td class="l" colspan="4">No alerts.</td></tr>`}
  </tbody></table></div></div>

  <h2>Limits and what happens when one is hit</h2>
  <div class="tbl-wrap mt"><table><thead><tr><th class="l">Guard</th><th class="l">Trips when</th><th class="l wrapc">Automatic response</th><th class="l wrapc">Then a person</th></tr></thead><tbody>
    <tr><td class="l"><b>Order size</b></td><td class="l wrapc">A single order is above a set share of the stock's daily volume</td><td class="l wrapc">Order is held, not sent</td><td class="l wrapc">Approves a multi-day plan or sends it back</td></tr>
    <tr><td class="l"><b>Participation cap</b></td><td class="l wrapc">Our share of a minute's volume passes 25%</td><td class="l wrapc">Slice is cut to the cap; the remainder rolls forward</td><td class="l wrapc">Extends the window if the order is falling behind</td></tr>
    <tr><td class="l"><b>Price collar</b></td><td class="l wrapc">Price is more than three normal daily ranges from arrival</td><td class="l wrapc">Order pauses</td><td class="l wrapc">Checks for news or a halt before resuming</td></tr>
    <tr><td class="l"><b>Cost against estimate</b></td><td class="l wrapc">Ten orders in a row cost more than three times the estimate</td><td class="l wrapc">Algorithm falls back to plain VWAP</td><td class="l wrapc">Finds the cause before the smart logic is switched back on</td></tr>
    <tr><td class="l"><b>Venue health</b></td><td class="l wrapc">Rejects above 2% or acknowledgements slow for a minute</td><td class="l wrapc">Venue is removed from routing</td><td class="l wrapc">Confirms with the venue and restores it</td></tr>
    <tr><td class="l"><b>Kill switch</b></td><td class="l wrapc">Any person on the desk, at any time</td><td class="l wrapc">All working orders cancelled, no new orders</td><td class="l wrapc">Restarts only after a written cause</td></tr>
  </tbody></table></div>
  <p class="small muted mt">The thresholds are the ones I would start from and then tune with the desk. I run the same pattern on my own trading system for the Brazilian exchange: a dry-run mode, an account allow-list, order throttling, a duplicate-order guard and an exposure cap, all under automated tests.</p>`;

  function control(id, key, suffix) {
    const L = O.L[key], xs = O.days.map((x) => x.d), ys = O.days.map((x) => +x[key].toFixed(2));
    const flagged = O.days.map((x) => x.d > 20 && x[key] > L.hi);
    const hl = (y, dash) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: C.ink, width: 1, dash } });
    plot(id, [{ x: xs, y: ys, type: "scatter", mode: "lines+markers", line: { color: C.line, width: 1.5 }, marker: { size: flagged.map((f) => (f ? 12 : 8)), color: flagged.map((f) => (f ? C.c2 : C.c1)), line: { color: "#fff", width: 1.5 } }, hovertemplate: `Day %{x}: %{y}${suffix}<extra></extra>` }],
      { hovermode: "closest", xaxis: { title: { text: "Trading day", font: { size: 12 } } }, yaxis: { ticksuffix: suffix }, margin: { b: 48, l: 56 },
        shapes: [hl(L.hi, "dash"), hl(L.m, "dot"), { type: "rect", yref: "paper", y0: 0, y1: 1, x0: 0.5, x1: 20.5, fillcolor: "rgba(245,243,239,.9)", line: { width: 0 }, layer: "below" }],
        annotations: [{ x: 10.5, y: 1, yref: "paper", text: "sets the normal range", showarrow: false, font: { size: 11.5, color: C.ink2 }, yanchor: "top" }] });
  }
  function mount() { control("op-gap", "gap", " bps"); control("op-drift", "drift", "×"); }
  return { html, mount };
}
