// Run with:  node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as E from "../docs/assets/engine.js";

const data = JSON.parse(fs.readFileSync(new URL("../docs/data/market.json", import.meta.url), "utf8"));
const big = data.table.find((x) => x.sym === "RY"), mid = data.table[30], small = data.table[150], spy = data.us_table[0];
const ALL = E.ALGOS.map((a) => a.id);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);

test("random numbers are reproducible and roughly standard normal", () => {
  const a = E.rng(42), b = E.rng(42);
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
  const g = E.rng(1), xs = Array.from({ length: 20000 }, () => g.gauss());
  near(E.mean(xs), 0, 0.03); near(E.stdev(xs), 1, 0.03);
});

test("the volume curve sums to one and carries the closing-auction share", () => {
  for (const c of [0, 0.08, 0.2]) {
    const w = E.volumeCurve(c);
    near(w.reduce((s, x) => s + x, 0), 1, 1e-9); near(w[E.MINUTES], c, 1e-12);
    assert.ok(w[0] > w[195] && w[389] > w[195], "U shape");
  }
  near(E.volProfile().reduce((s, x) => s + x * x, 0), 1, 1e-9);
});

test("simulated days reproduce the stock's real intraday volatility and volume", () => {
  const rets = [], vols = [];
  for (let i = 0; i < 400; i++) { const d = E.simulateDay(big, { signalQ: 0.1 }, E.rng(i + 1)); rets.push(Math.log(d.u[390] / d.u[0])); vols.push(d.v.reduce((s, x) => s + x, 0)); }
  const target = (big.vol_d / 100) * Math.sqrt(1 - big.on_share / 100);
  near(E.stdev(rets) / target, 1, 0.12);
  near(E.mean(vols) / big.adv_sh, 1, 0.06);
});

test("every algorithm fills the whole order, never more, on every instrument", () => {
  for (const inst of [big, mid, small, spy]) for (const pct of [0.005, 0.05, 0.25]) for (const side of [1, -1]) {
    const day = E.simulateDay(inst, {}, E.rng(9)), qty = Math.round(inst.adv_sh * pct);
    for (const a of ALL) {
      const r = E.runAlgo(day, inst, { side, qty, start: 0, end: 390 }, a, { useClose: true }, E.rng(3));
      near(r.done, qty, 1e-6 * qty + 1e-6);
      near(r.fills.reduce((s, x) => s + x, 0), qty, 1e-6 * qty + 1e-6);
      assert.ok(r.fills.every((x) => x >= 0));
      near(r.parts.spread + r.parts.temp + r.parts.perm + r.parts.timing, r.isBps, 1e-9);
    }
  }
});

test("schedules have the intended shape", () => {
  const day = E.simulateDay(big, {}, E.rng(5)), qty = big.adv_sh * 0.02, o = { side: 1, qty, start: 60, end: 300 };
  const twap = E.runAlgo(day, big, o, "twap"), is = E.runAlgo(day, big, o, "is"), moc = E.runAlgo(day, big, o, "moc");
  const first = (r) => r.fills.slice(60, 180).reduce((s, x) => s + x, 0) / qty;
  near(first(twap), 0.5, 0.01);
  assert.ok(first(is) > 0.7, "arrival algo is front-loaded");
  assert.equal(twap.fills.slice(0, 60).reduce((s, x) => s + x, 0), 0);
  assert.equal(twap.fills.slice(300).reduce((s, x) => s + x, 0), 0);
  near(moc.fills[390], qty, 1e-9);
  const pov = E.runAlgo(day, big, { side: 1, qty, start: 0, end: 390 }, "pov", { rate: 0.1 });
  assert.ok(pov.peakPart <= 10.5 || pov.forcedPct > 0, "POV respects its rate");
});

test("zero quantity costs nothing; a sell mirrors a buy on impact", () => {
  const day = E.simulateDay(mid, {}, E.rng(2));
  const z = E.runAlgo(day, mid, { side: 1, qty: 0 }, "vwap");
  assert.equal(z.isBps, 0); assert.equal(z.pctDone, 100);
  const b = E.runAlgo(day, mid, { side: 1, qty: mid.adv_sh * 0.03 }, "vwap"), s = E.runAlgo(day, mid, { side: -1, qty: mid.adv_sh * 0.03 }, "vwap");
  near(b.impactBps, s.impactBps, 1e-9); near(b.parts.timing, -s.parts.timing, 1e-9);
});

test("impact rises with order size and falls with a longer window", () => {
  const imp = (pct, end) => E.monteCarlo(mid, { side: 1, qty: mid.adv_sh * pct, start: 0, end }, ["vwap"], 60, 3).vwap.impact;
  assert.ok(imp(0.01, 390) < imp(0.05, 390) && imp(0.05, 390) < imp(0.2, 390));
  assert.ok(imp(0.05, 390) < imp(0.05, 60));
});

test("the simulation agrees with the closed-form pre-trade estimate", () => {
  for (const inst of [big, mid, small]) {
    const qty = inst.adv_sh * 0.05, pre = E.preTrade(inst, qty, { windowShare: 0.92, cross: E.CROSS.vwap });
    const mc = E.monteCarlo(inst, { side: 1, qty, start: 0, end: 390 }, ["vwap"], 200, 8).vwap;
    near(mc.impact / pre.bps, 1, 0.25);
  }
});

test("Monte Carlo is reproducible and uses the same days for every algorithm", () => {
  const o = { side: 1, qty: big.adv_sh * 0.05, start: 0, end: 390 };
  const a = E.monteCarlo(big, o, ALL, 50, 7), b = E.monteCarlo(big, o, ALL, 50, 7);
  for (const k of ALL) assert.equal(a[k].mean, b[k].mean);
  assert.ok(a.pov.sd < a.twap.sd, "finishing early carries less timing risk");
});

test("the flow-aware algorithm only helps when the signal carries information", () => {
  const o = { side: 1, qty: mid.adv_sh * 0.05, start: 0, end: 390 };
  const none = E.monteCarlo(mid, o, ["vwap", "adaptive"], 400, 4, { signalQ: 0 });
  const some = E.monteCarlo(mid, o, ["vwap", "adaptive"], 400, 4, { signalQ: 0.2 });
  near(none.adaptive.mean - none.vwap.mean, 0, 2.5);
  assert.ok(some.vwap.mean - some.adaptive.mean > 3, "edge with signal");
  const sell = E.monteCarlo(mid, { ...o, side: -1 }, ["vwap", "adaptive"], 400, 4, { signalQ: 0.2 });
  assert.ok(sell.vwap.mean - sell.adaptive.mean > 3, "edge on the sell side too");
});

test("order-flow sessions are reproducible and internally consistent", () => {
  const a = E.simulateFlow(mid, {}, 12), b = E.simulateFlow(mid, {}, 12);
  assert.equal(a.prints.length, b.prints.length);
  assert.deepEqual(a.prints[100], b.prints[100]);
  for (const p of a.prints) { assert.ok(p.qty > 0); assert.ok(p.side === 1 ? p.px > p.mid : p.px < p.mid, "buys lift the offer, sells hit the bid"); }
  for (const s of a.snaps) assert.ok(s.ask > s.bid);
  for (const ic of a.truth.icebergs) assert.ok(ic.executed <= ic.total);
});

test("detectors: planted icebergs, sliced orders and bursts are found across many sessions", () => {
  for (const inst of [big, mid, small, spy]) {
    const t = { ic: 0, id: 0, ifa: 0, pc: 0, pd: 0, pfa: 0, bc: 0, bfa: 0, n: 0 };
    for (let s = 1; s <= 40; s++) {
      const sim = E.simulateFlow(inst, {}, s);
      const sc = E.scoreFlow(sim, E.detectIcebergs(sim.prints), E.detectParents(sim.prints), E.detectBursts(sim.prints, sim.T));
      t.ic += sc.ice.caught; t.id += sc.ice.detectable; t.ifa += sc.ice.falseAlarms; t.pc += sc.par.caught; t.pd += sc.par.detectable;
      t.pfa += sc.par.falseAlarms; t.bc += sc.tox.caught; t.bfa += sc.tox.falseAlarms; t.n++;
    }
    console.log(inst.sym, JSON.stringify(t));
    assert.ok(t.ic / t.id >= 0.75, `${inst.sym} iceberg recall ${t.ic}/${t.id}`);
    assert.ok(t.ifa / t.n <= 0.3, `${inst.sym} iceberg false alarms ${t.ifa}`);
    assert.ok(t.pc / t.pd >= 0.95, `${inst.sym} sliced-order recall ${t.pc}/${t.pd}`);
    assert.ok(t.pfa / t.n <= 0.2, `${inst.sym} sliced-order false alarms ${t.pfa}`);
    assert.ok(t.bc / t.n >= 0.95, `${inst.sym} burst recall ${t.bc}/${t.n}`);
    assert.ok(t.bfa / t.n <= 0.2, `${inst.sym} burst false alarms ${t.bfa}`);
  }
});

test("detectors never read the hidden labels", () => {
  const sim = E.simulateFlow(mid, {}, 21);
  const strip = sim.prints.map(({ t, px, qty, mid: m, side, dispBefore, dispAfter, oid }) => ({ t, px, qty, mid: m, side, dispBefore, dispAfter, oid }));
  assert.deepEqual(E.detectIcebergs(strip), E.detectIcebergs(sim.prints));
  assert.deepEqual(E.detectParents(strip), E.detectParents(sim.prints));
});

test("a session with nothing planted raises almost no iceberg or sliced-order flags", () => {
  let n = 0;
  for (let s = 1; s <= 20; s++) { const sim = E.simulateFlow(mid, { icebergs: 0, parents: 0 }, s); n += E.detectIcebergs(sim.prints).length + E.detectParents(sim.prints).length; }
  assert.ok(n <= 3, `false flags in 20 clean sessions: ${n}`);
});

test("router: fills the order, never trades through a protected quote, and fee-aware beats size-first", () => {
  for (const inst of [big, mid, small]) for (let seed = 1; seed <= 25; seed++) {
    const bk = E.venueBook(inst, seed), qty = bk.touch * 2;
    const single = E.route(bk, qty, "single"), size = E.route(bk, qty, "size"), fee = E.route(bk, qty, "fee"), dark = E.route(bk, qty, "dark");
    for (const r of [size, fee, dark]) { assert.equal(r.filled + r.unfilled, qty); assert.equal(r.tradeThrough, false); }
    near(size.avgPx, fee.avgPx, 1e-9);
    assert.ok(fee.allIn <= size.allIn + 1e-12);
    assert.ok(dark.allIn <= fee.allIn + 1e-9);
    assert.ok(single.allIn >= fee.allIn - 1e-9 || single.unfilled > 0);
  }
});
