// Execution Lab engine. Pure functions, no DOM: the same file runs in the browser and under `node --test`.
// Everything here is a SIMULATION calibrated to real daily statistics (price, volume, volatility).
// It does not read any order-level market data feed.

// ------------------------------------------------------------------ random numbers
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = f();
    v = f();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  f.poisson = (lam) => {
    if (lam <= 0) return 0;
    const L = Math.exp(-lam); let k = 0, p = 1;
    do { k++; p *= f(); } while (p > L && k < 200);
    return k - 1;
  };
  return f;
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lot = (x) => Math.max(100, Math.round(x / 100) * 100);
export const quantile = (arr, q) => {
  const a = [...arr].sort((x, y) => x - y);
  if (!a.length) return NaN;
  const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
};
export const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
export const stdev = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

// ------------------------------------------------------------------ the trading day
export const MINUTES = 390;      // 9:30 to 16:00, one bin per minute; bin 390 is the closing auction
export const minuteLabel = (m) => {
  if (m >= MINUTES) return "Close";
  const t = 570 + m; return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Share of the day's volume in each minute (U shape) plus the closing auction. Sums to 1. */
export function volumeCurve(closeShare = 0.08) {
  const w = new Float64Array(MINUTES + 1);
  let s = 0;
  for (let m = 0; m < MINUTES; m++) {
    w[m] = 0.55 + 2.4 * Math.exp(-m / 22) + 1.5 * Math.exp(-(MINUTES - 1 - m) / 16);
    s += w[m];
  }
  for (let m = 0; m < MINUTES; m++) w[m] *= (1 - closeShare) / s;
  w[MINUTES] = closeShare;
  return w;
}

/** Relative volatility of each minute (highest at the open). Squares sum to 1. */
export function volProfile() {
  const w = new Float64Array(MINUTES);
  let s = 0;
  for (let m = 0; m < MINUTES; m++) {
    w[m] = 1 + 1.7 * Math.exp(-m / 28) + 0.45 * Math.exp(-(MINUTES - 1 - m) / 35);
    s += w[m] * w[m];
  }
  const k = 1 / Math.sqrt(s);
  for (let m = 0; m < MINUTES; m++) w[m] *= k;
  return w;
}

/** One simulated day for an instrument {px, adv_sh, vol_d (% per day), on_share (%), spread_bps}. */
export function simulateDay(inst, o = {}, R = rng(1)) {
  const q = clamp(o.signalQ ?? 0.1, 0, 0.6);
  const curve = volumeCurve(o.closeShare ?? 0.08);
  const prof = volProfile();
  const dayF = Math.exp(0.25 * R.gauss() - 0.031);
  const sigD = (inst.vol_d / 100) * Math.sqrt(1 - (inst.on_share ?? 30) / 100) * (o.volMult ?? 1);
  const u = new Float64Array(MINUTES + 2), v = new Float64Array(MINUTES + 1), sig = new Float64Array(MINUTES + 1);
  u[0] = inst.px;
  const flip = o.anti ? -1 : 1;                              // mirror day: same volumes, every price move reversed
  let s = 0;
  for (let m = 0; m < MINUTES; m++) {
    s = 0.9 * s + Math.sqrt(1 - 0.81) * flip * R.gauss();   // order-flow signal, known at the start of the minute
    sig[m] = s;
    const z = q * s + Math.sqrt(1 - q * q) * flip * R.gauss(); // q = how much the signal says about the next move
    u[m + 1] = u[m] * Math.exp(sigD * prof[m] * z);
    v[m] = inst.adv_sh * dayF * curve[m] * Math.exp(0.35 * R.gauss() - 0.061) * (o.liqMult ?? 1);
  }
  v[MINUTES] = inst.adv_sh * dayF * curve[MINUTES] * Math.exp(0.2 * R.gauss() - 0.02) * (o.liqMult ?? 1);
  u[MINUTES + 1] = u[MINUTES];
  return { u, v, sig, curve, sigD };
}

// ------------------------------------------------------------------ impact model
export const IMPACT = { eta: 0.142, beta: 0.6, gamma: 1.2 };   // temporary and permanent impact (Almgren et al. 2005 form)
export const CROSS = { twap: 0.6, vwap: 0.55, pov: 0.7, is: 0.85, moc: 0, adaptive: 0.5 };   // share of the half-spread paid
export const ALGOS = [
  { id: "twap", name: "TWAP", plain: "Equal slices through the window." },
  { id: "vwap", name: "VWAP", plain: "Follows the usual volume curve: more at the open and close." },
  { id: "pov", name: "POV", plain: "Takes a fixed share of whatever volume shows up." },
  { id: "is", name: "Arrival (IS)", plain: "Front-loaded: trades faster to cut the risk of the price drifting away." },
  { id: "moc", name: "Close", plain: "Everything in the closing auction." },
  { id: "adaptive", name: "Flow-aware", plain: "VWAP that speeds up or waits depending on the order-flow signal." },
];

/** Closed-form cost estimate before trading (basis points of the arrival price). */
export function preTrade(inst, qty, o = {}) {
  const sig = inst.vol_d / 100, x = qty / inst.adv_sh;
  const windowShare = clamp(o.windowShare ?? 1, 0.01, 1);     // share of the day's volume inside the order's window
  const part = clamp(x / windowShare, 0, 3);
  const spread = (inst.spread_bps / 2) * (o.cross ?? 0.55);
  const temp = IMPACT.eta * sig * Math.pow(part, IMPACT.beta) * 1e4;
  const perm = 0.5 * IMPACT.gamma * sig * x * 1e4;
  const days = clamp(o.dayShare ?? windowShare, 0.01, 1);
  const risk = sig * Math.sqrt(days / 3) * 1e4;                // one standard deviation of the price drifting while we work
  return { bps: spread + temp + perm, spread, temp, perm, risk, part: part * 100, pctAdv: x * 100 };
}

/** Run one algorithm over one simulated day. order = {side: +1 buy / -1 sell, qty, start, end}. */
export function runAlgo(day, inst, order, algo, p = {}, R = null) {
  const side = order.side >= 0 ? 1 : -1, Q = Math.max(0, order.qty);
  const s0 = clamp(Math.round(order.start ?? 0), 0, MINUTES - 1);
  const e0 = clamp(Math.round(order.end ?? MINUTES), s0 + 1, MINUTES);
  const useClose = algo === "moc" || (!!p.useClose && e0 === MINUTES && algo !== "twap" && algo !== "is");
  const bins = [];
  if (algo !== "moc") for (let m = s0; m < e0; m++) bins.push(m);
  if (useClose) bins.push(MINUTES);
  const n = bins.length, w = new Float64Array(n);
  const kappa = p.urgency ?? 2.5;
  for (let i = 0; i < n; i++) {
    const m = bins[i];
    if (algo === "twap") w[i] = 1;
    else if (algo === "is") w[i] = Math.sinh(kappa * (1 - i / n)) - Math.sinh(kappa * (1 - (i + 1) / n));
    else w[i] = day.curve[m];
  }
  const tail = new Float64Array(n + 1);
  for (let i = n - 1; i >= 0; i--) tail[i] = tail[i + 1] + w[i];
  const maxPart = clamp(p.maxPart ?? 0.3, 0.02, 0.9), rate = clamp(p.rate ?? 0.1, 0.01, 0.5);
  const sigD = inst.vol_d / 100, half = inst.spread_bps / 2 / 1e4, cross = p.cross ?? CROSS[algo] ?? 0.6;
  const fills = new Float64Array(MINUTES + 1);
  const arrival = day.u[s0];
  let rem = Q, done = 0, cSpread = 0, cTemp = 0, cPerm = 0, cTiming = 0, peak = 0, mktNot = 0, mktVol = 0, forced = 0, lastBin = s0;
  for (let i = 0; i < n && Q > 0; i++) {
    const m = bins[i], vm = day.v[m], isLast = i === n - 1;
    mktNot += day.u[m] * vm; mktVol += vm;
    let child;
    if (algo === "pov") child = (rate / (1 - rate)) * vm;
    else child = rem * (w[i] / tail[i]);
    if (algo === "adaptive") child *= clamp(1 + (p.tilt ?? 0.9) * side * day.sig[m], 0.3, 2.4);
    if (p.randomize && R) child *= Math.exp(0.3 * R.gauss() - 0.045);
    const cap = (maxPart / (1 - maxPart)) * vm;
    if (isLast) { if (rem > Math.min(child, cap) + 1e-9) forced = rem - Math.min(child, cap); child = rem; }
    else child = Math.min(child, cap, rem);
    if (child <= 0) continue;
    const part = child / vm;
    const temp = IMPACT.eta * sigD * Math.pow(Math.min(part, 4), IMPACT.beta);
    const perm = IMPACT.gamma * sigD * (done + child / 2) / inst.adv_sh;
    const px = day.u[m], f = child / Q;
    cTiming += f * side * (px - arrival) / arrival;
    cPerm += f * perm * px / arrival;
    cTemp += f * temp * px / arrival;
    cSpread += f * (m === MINUTES ? 0 : half * cross) * px / arrival;
    fills[m] = child; done += child; rem -= child; lastBin = m;
    peak = Math.max(peak, child / (child + vm));
  }
  const is = (cTiming + cPerm + cTemp + cSpread) * 1e4;
  const avgPx = arrival * (1 + side * is / 1e4);
  const vwap = mktVol > 0 ? mktNot / mktVol : arrival;
  const close = day.u[MINUTES];
  return {
    algo, fills, done, pctDone: Q ? (done / Q) * 100 : 100, avgPx, arrival, vwap, close, lastBin,
    isBps: is, vsVwapBps: side * (avgPx - vwap) / vwap * 1e4, vsCloseBps: side * (avgPx - close) / close * 1e4,
    parts: { spread: cSpread * 1e4, temp: cTemp * 1e4, perm: cPerm * 1e4, timing: cTiming * 1e4 },
    impactBps: (cSpread + cTemp + cPerm) * 1e4, peakPart: peak * 100, forcedPct: Q ? (forced / Q) * 100 : 0,
    costCash: Q * arrival * is / 1e4,
  };
}

/**
 * Same simulated days for every algorithm (common random numbers), so differences are the algorithms'.
 * Days come in mirrored pairs (every price move reversed in the second), so luck in the market's direction
 * cancels and the average cost is not an accident of whether prices happened to rise or fall.
 */
/** Standard error of the mean when samples come in mirrored pairs. */
export function pairSe(x) {
  const pm = [];
  for (let i = 0; i + 1 < x.length; i += 2) pm.push((x[i] + x[i + 1]) / 2);
  return pm.length > 1 ? stdev(pm) / Math.sqrt(pm.length) : 0;
}

export function monteCarlo(inst, order, algos, nDays = 200, seed = 11, o = {}, params = {}) {
  const out = {};
  for (const a of algos) out[a] = { is: [], impact: [], vwap: [], peak: [], forced: 0 };
  for (let i = 0; i < nDays; i++) {
    const pair = Math.floor(i / 2);
    const day = simulateDay(inst, { ...o, anti: i % 2 === 1 }, rng(seed * 1000003 + pair * 7919));
    const R2 = rng(seed * 31 + pair);
    for (const a of algos) {
      const r = runAlgo(day, inst, order, a, params[a] ?? params, R2);
      out[a].is.push(r.isBps); out[a].impact.push(r.impactBps); out[a].vwap.push(r.vsVwapBps); out[a].peak.push(r.peakPart);
      if (r.forcedPct > 1) out[a].forced++;
    }
  }
  const res = {};
  for (const a of algos) {
    const x = out[a].is;
    res[a] = {
      algo: a, n: nDays, mean: mean(x), sd: stdev(x), p5: quantile(x, 0.05), p25: quantile(x, 0.25), p50: quantile(x, 0.5),
      p75: quantile(x, 0.75), p95: quantile(x, 0.95), impact: mean(out[a].impact), vsVwap: mean(out[a].vwap),
      peak: mean(out[a].peak), forcedDays: out[a].forced, se: pairSe(x), samples: x,
    };
  }
  return res;
}

// ------------------------------------------------------------------ order-flow simulator
/**
 * A few minutes of a simulated order book with planted participants:
 * market makers, small random orders, sliced parent orders ("big orders"), icebergs and one aggressive burst.
 * Every print carries only what a public feed shows; `truth` is kept apart and used only to score the detectors.
 */
export function simulateFlow(inst, o = {}, seed = 7) {
  const R = rng(seed), T = o.seconds ?? 1800, LV = 8;
  const tick = inst.tick ?? 0.01;
  const spreadT = Math.max(1, Math.round((inst.spread_bps / 1e4) * inst.px / tick));
  const expVol = inst.adv_sh * (T / 23400) * 0.85;
  const touch = lot(clamp(inst.adv_sh * 0.0004, 500, 20000));
  const sigS = (inst.vol_d / 100) / Math.sqrt(23400) * inst.px / tick;      // ticks per square-root second
  const target = (l) => touch * (0.7 + 0.25 * l);
  const newDepth = (l) => lot(target(l) * (0.6 + 0.8 * R()));
  let bid = Math.round(inst.px / tick) - Math.ceil(spreadT / 2), ask = bid + spreadT;
  let B = Array.from({ length: LV }, (_, l) => newDepth(l)), A = Array.from({ length: LV }, (_, l) => newDepth(l));

  const nIce = o.icebergs ?? 3, nPar = o.parents ?? 2;
  const ices = [], parents = [];
  for (let i = 0; i < nIce; i++) {
    const clip = lot(touch * (0.3 + 0.3 * R()));
    ices.push({ id: i + 1, side: R() < 0.5 ? "bid" : "ask", clip, total: clip * Math.round(8 + 14 * R()), start: Math.round(T * (0.06 + 0.8 * R())),
      px: null, shown: 0, left: 0, refills: 0, executed: 0, done: null, active: false });
  }
  for (let i = 0; i < nPar; i++) {
    const start = Math.round(T * (0.05 + 0.45 * R())), dur = Math.round(T * (0.3 + 0.25 * R()));
    parents.push({ id: i + 1, side: R() < 0.5 ? 1 : -1, clip: lot(touch * (0.5 + 0.5 * R())), interval: Math.round(12 + 14 * R()), start,
      end: Math.min(T - 5, start + dur), next: start, executed: 0, children: 0 });
  }
  const toxic = { start: Math.round(T * (0.55 + 0.3 * R())), len: o.toxicLen ?? 90, side: R() < 0.5 ? 1 : -1 };
  toxic.end = Math.min(T, toxic.start + toxic.len);

  const noiseShare = 0.62, meanSize = touch * 0.3;
  const lam = (expVol * noiseShare) / (meanSize * T) / 2;        // orders per second, each side
  const prints = [], snaps = [];
  const iceAt = (side, px) => ices.find((x) => x.active && x.side === side && x.px === px && x.left > 0);

  const moveUp = () => { A.shift(); A.push(newDepth(LV - 1)); ask += 1; const nb = ask - spreadT; while (bid < nb) { B.unshift(lot(target(0) * (0.2 + 0.5 * R()))); B.pop(); bid += 1; } };
  const moveDown = () => { B.shift(); B.push(newDepth(LV - 1)); bid -= 1; const na = bid + spreadT; while (ask > na) { A.unshift(lot(target(0) * (0.2 + 0.5 * R()))); A.pop(); ask -= 1; } };

  let oid = 0;
  function hit(sgn, qty, src, t) {
    let rem = qty, guard = 0; oid++;
    while (rem > 0 && guard++ < 40) {
      const arr = sgn > 0 ? A : B, p = sgn > 0 ? ask : bid, ice = iceAt(sgn > 0 ? "ask" : "bid", p);
      const mid = (bid + ask) / 2, dispBefore = arr[0] + (ice ? ice.shown : 0);
      const take = Math.min(rem, arr[0]); arr[0] -= take; rem -= take;
      let iceTake = 0;
      if (rem > 0 && ice) {
        while (rem > 0 && ice.left > 0) {
          const x = Math.min(rem, ice.shown);
          ice.shown -= x; ice.left -= x; rem -= x; iceTake += x; ice.executed += x;
          if (ice.shown === 0 && ice.left > 0) { ice.shown = Math.min(ice.clip, ice.left); ice.refills++; }
        }
        if (ice.left <= 0) { ice.done = t; ice.active = false; }
      }
      const stillIce = iceAt(sgn > 0 ? "ask" : "bid", p);
      if (arr[0] === 0 && !stillIce && rem === 0 && R() < 0.18) arr[0] = lot(touch * (0.2 + 0.6 * R()));   // someone re-quotes the same price
      const dispAfter = arr[0] + (stillIce ? stillIce.shown : 0);
      if (take + iceTake > 0) prints.push({ t, px: p, qty: take + iceTake, mid, side: sgn, dispBefore, dispAfter, oid, src, ice: iceTake > 0 ? ice.id : null });
      if (arr[0] === 0 && !stillIce) { if (sgn > 0) moveUp(); else moveDown(); }
      if (rem > 0 && stillIce) break;
    }
  }

  for (let t = 0; t < T; t++) {
    const inTox = t >= toxic.start && t < toxic.end;
    // quotes drift (cancel and replace), but an iceberg does not move with them
    let s = Math.round(R.gauss() * sigS * 0.3);
    const bIce = ices.filter((x) => x.active && x.side === "bid" && x.left > 0).map((x) => x.px);
    const aIce = ices.filter((x) => x.active && x.side === "ask" && x.left > 0).map((x) => x.px);
    const lo = bIce.length ? Math.max(...bIce) - bid : -99, hi = aIce.length ? Math.min(...aIce) - ask : 99;
    s = lo > hi ? 0 : clamp(s, lo, hi);
    bid += s; ask += s;
    // icebergs join the touch at their start time
    for (const ic of ices) if (!ic.active && ic.done === null && t === ic.start) { ic.active = true; ic.px = ic.side === "bid" ? bid : ask; ic.left = ic.total; ic.shown = ic.clip; ic.t0 = t; }
    // market makers refill toward their usual size (slower on the side being attacked)
    for (let l = 0; l < LV; l++) {
      const kb = inTox && toxic.side < 0 ? 0.03 : 0.15, ka = inTox && toxic.side > 0 ? 0.03 : 0.15;
      if (B[l] < target(l)) B[l] += Math.round(((target(l) - B[l]) * kb) / 100) * 100;
      if (A[l] < target(l)) A[l] += Math.round(((target(l) - A[l]) * ka) / 100) * 100;
    }
    // small random orders, both sides (some odd lots, as retail flow has)
    for (const sgn of [1, -1]) {
      const k = R.poisson(lam);
      for (let j = 0; j < k; j++) {
        const odd = R() < 0.18;
        const q = odd ? 1 + Math.floor(R() * 99) : lot(meanSize * Math.exp(0.8 * R.gauss() - 0.32));
        hit(sgn, q, "noise", t);
      }
    }
    // sliced parent orders: same clip, steady clock
    for (const pa of parents) if (t >= pa.next && t < pa.end) {
      hit(pa.side, pa.clip, "parent" + pa.id, t); pa.executed += pa.clip; pa.children++;
      pa.next = t + Math.max(2, Math.round(pa.interval * (1 + 0.08 * R.gauss())));
    }
    // one aggressive, one-sided burst
    if (inTox && R() < 0.55) hit(toxic.side, lot(touch * (0.5 + 1.0 * R())), "toxic", t);
    if (t % 5 === 0) {
      const show = (arr, side, best, dir) => arr.slice(0, 5).map((x, l) => { const ic = iceAt(side, best + dir * l); return x + (ic ? ic.shown : 0); });
      snaps.push({ t, bid, ask, bids: show(B, "bid", bid, -1), asks: show(A, "ask", ask, 1) });
    }
  }
  return { inst, tick, T, touch, prints, snaps, truth: { icebergs: ices, parents, toxic } };
}

/**
 * Iceberg detector. Public data only: a print takes size from a price level, yet the level shows more than
 * (displayed before - traded) right after. Size came back at the instant of the trade. One such reload can be a
 * new order joining; the same reload size at the same price several times is a hidden order.
 */
export function detectIcebergs(prints, minRefills = 3) {
  const st = new Map(), found = [];
  for (const p of prints) {
    const key = (p.side > 0 ? "ask" : "bid") + "|" + p.px;
    let s = st.get(key);
    if (!s) { s = { side: p.side > 0 ? "ask" : "bid", px: p.px, vol: 0, counts: new Map(), t0: p.t, t1: p.t, rec: null }; st.set(key, s); }
    if (p.t - s.t1 > 240) { s.vol = 0; s.counts = new Map(); s.t0 = p.t; s.rec = null; }
    s.vol += p.qty; s.t1 = p.t;
    const reload = p.dispAfter - (p.dispBefore - p.qty);
    if (reload > 0) {
      let hitSize = null;
      for (const [size, c] of s.counts) if (reload % size === 0 && reload / size <= 6) { s.counts.set(size, c + reload / size); hitSize = size; }
      if (hitSize === null) { s.counts.set(reload, 1); hitSize = reload; }
      const [clip, n] = [...s.counts].sort((x, y) => y[1] - x[1])[0];
      if (n >= minRefills && !s.rec) { s.rec = { side: s.side, px: s.px, clip, t0: s.t0, tFlag: p.t, t1: p.t, vol: s.vol, refills: n }; found.push(s.rec); }
      if (s.rec) s.rec.refills = n;
    }
    if (s.rec) { s.rec.t1 = p.t; s.rec.vol = s.vol; }
  }
  return found;
}

/** Fold the prints of one incoming order (same exchange sequence) into one aggressive order. */
export function aggressiveOrders(prints) {
  const out = [];
  for (const p of prints) {
    const last = out[out.length - 1];
    if (last && last.oid === p.oid) { last.qty += p.qty; last.px = p.px; last.levels++; }
    else out.push({ oid: p.oid, t: p.t, side: p.side, qty: p.qty, px: p.px, levels: 1 });
  }
  return out;
}

/**
 * Sliced-order detector. Public data only: orders of one size on one side that arrive on a steady clock.
 * For each new order it walks back in time looking for the same size one interval earlier, then another, and so on.
 */
export function detectParents(prints, o = {}) {
  const need = o.minPrints ?? 8, orders = aggressiveOrders(prints);
  const groups = new Map(), found = [];
  for (const p of orders) {
    if (p.qty < 200) continue;
    const key = p.side + "|" + p.qty;
    let g = groups.get(key);
    if (!g) { g = { side: p.side, clip: p.qty, times: [], rec: null }; groups.set(key, g); }
    if (g.rec && p.t - g.rec.t1 <= g.rec.interval * 2.5) { g.rec.t1 = p.t; g.rec.prints++; g.rec.vol += p.qty; g.times.push(p.t); continue; }
    const ts = g.times;
    let best = null;
    for (let j = ts.length - 1; j >= 0 && p.t - ts[j] <= 90; j--) {
      const gap = p.t - ts[j];
      if (gap < 4) continue;
      const tol = Math.max(1.5, 0.15 * gap);
      let expect = ts[j] - gap, count = 2, first = ts[j], k = j - 1, miss = 0;
      while (k >= 0 && count < need + 2) {
        while (k >= 0 && ts[k] > expect + tol) k--;
        if (k >= 0 && Math.abs(ts[k] - expect) <= tol) { count++; first = ts[k]; expect = ts[k] - gap; k--; }
        else if (miss === 0) { miss = 1; expect -= gap; }
        else break;
      }
      if (count >= need && (!best || count > best.count)) best = { count, gap, first };
    }
    ts.push(p.t);
    if (best) { g.rec = { side: g.side, clip: g.clip, interval: best.gap, t0: best.first, tFlag: p.t, t1: p.t, prints: best.count, vol: best.count * p.qty }; found.push(g.rec); }
  }
  return found;
}

/** Toxicity gauge in the spirit of VPIN: order imbalance per equal-volume bucket, averaged over the last few buckets. */
export function vpin(prints, nBuckets = 40, window = 5) {
  const tot = prints.reduce((s, p) => s + p.qty, 0), size = tot / nBuckets;
  const out = []; let buy = 0, sell = 0, filled = 0;
  for (const p of prints) {
    let q = p.qty;
    while (q > 0) {
      const x = Math.min(q, size - filled);
      if (p.px > p.mid) buy += x; else sell += x;
      filled += x; q -= x;
      if (filled >= size - 1e-9) { out.push({ t: p.t, imb: Math.abs(buy - sell) / size, net: (buy - sell) / size }); buy = sell = filled = 0; }
    }
  }
  for (let i = 0; i < out.length; i++) { const w = out.slice(Math.max(0, i - window + 1), i + 1); out[i].vpin = mean(w.map((x) => x.imb)); }
  return out;
}

/** Tick rule: classify a print as buy or sell from price changes alone, then compare with the true aggressor. */
export function tickRuleAccuracy(prints) {
  let last = null, dir = 1, ok = 0, n = 0;
  for (const p of prints) {
    if (last !== null && p.px !== last) dir = p.px > last ? 1 : -1;
    if (last !== null) { n++; if (dir === p.side) ok++; }
    last = p.px;
  }
  return n ? (ok / n) * 100 : 0;
}

/** Does net order flow in one window say anything about the next one? Correlation of imbalance with the next mid move. */
export function flowSignal(prints, T, w = 15) {
  const nb = Math.floor(T / w), imb = new Array(nb).fill(0), vol = new Array(nb).fill(0), mid = new Array(nb).fill(null);
  for (const p of prints) { const i = Math.min(nb - 1, Math.floor(p.t / w)); imb[i] += p.side * p.qty; vol[i] += p.qty; mid[i] = p.mid; }
  for (let i = 1; i < nb; i++) if (mid[i] === null) mid[i] = mid[i - 1];
  const xs = [], ys = [];
  for (let i = 0; i < nb - 2; i++) if (vol[i] > 0 && mid[i] !== null && mid[i + 2] !== null && mid[i + 1] !== null) { xs.push(imb[i] / vol[i]); ys.push(mid[i + 2] - mid[i + 1]); }
  const mx = mean(xs), my = mean(ys), sx = stdev(xs), sy = stdev(ys);
  const corr = sx && sy ? mean(xs.map((x, i) => (x - mx) * (ys[i] - my))) / (sx * sy) : 0;
  return { corr, n: xs.length, imb: imb.map((x, i) => (vol[i] ? x / vol[i] : 0)), w };
}

/**
 * Aggressive-burst detector. Public data only: count the incoming orders that clear the best price and keep
 * going ("sweeps") on each side over the last `w` seconds. Patient participants rarely sweep; a participant
 * who needs to trade now sweeps again and again, and the other side stops refilling.
 */
export function detectBursts(prints, T, w = 30, k = 5) {
  const up = new Float64Array(T + 1), dn = new Float64Array(T + 1);
  for (const o of aggressiveOrders(prints)) if (o.levels >= 2) (o.side > 0 ? up : dn)[Math.min(T, o.t)] += 1;
  const ratio = new Float64Array(T + 1), events = [];
  let ru = 0, rd = 0, cur = null;
  for (let t = 0; t <= T; t++) {
    ru += up[t]; rd += dn[t];
    if (t >= w) { ru -= up[t - w]; rd -= dn[t - w]; }
    ratio[t] = ru - rd;
    const side = ru >= rd ? 1 : -1, n = Math.max(ru, rd);
    if (n >= k) {
      if (!cur || cur.side !== side) { cur = { t0: t, t1: t, side, peak: n }; events.push(cur); }
      cur.t1 = t; cur.peak = Math.max(cur.peak, n);
    } else if (cur && t - cur.t1 > w) cur = null;
  }
  return { events, ratio, w, k };
}

/** Score the detectors against what was planted. */
export function scoreFlow(sim, ice, par, bursts) {
  const tr = sim.truth;
  const detectable = tr.icebergs.filter((x) => x.refills >= 4);
  const iceHit = detectable.filter((x) => ice.some((d) => d.side === x.side && d.px === x.px));
  const iceFalse = ice.filter((d) => !tr.icebergs.some((x) => x.side === d.side && x.px === d.px && x.refills > 0));
  const realPar = tr.parents.filter((x) => x.children >= 8);
  const parHit = realPar.filter((x) => par.some((d) => d.side === x.side && d.clip === x.clip && d.t1 >= x.start && d.t0 <= x.end));
  const parFalse = par.filter((d) => !tr.parents.some((x) => x.side === d.side && x.clip === d.clip && d.t1 >= x.start && d.t0 <= x.end));
  const ev = bursts.events, hit = ev.find((e) => e.t1 >= tr.toxic.start && e.t0 <= tr.toxic.end + bursts.w && e.side === tr.toxic.side);
  const falseB = ev.filter((e) => !(e.t1 >= tr.toxic.start && e.t0 <= tr.toxic.end + bursts.w));
  return {
    ice: { planted: tr.icebergs.length, detectable: detectable.length, caught: iceHit.length, falseAlarms: iceFalse.length },
    par: { planted: tr.parents.length, detectable: realPar.length, caught: parHit.length, falseAlarms: parFalse.length },
    tox: { planted: 1, caught: hit ? 1 : 0, falseAlarms: falseB.length, delay: hit ? Math.max(0, hit.t0 - tr.toxic.start) : null, peak: hit ? hit.peak : 0 },
  };
}

// ------------------------------------------------------------------ multi-venue routing (Canada)
// Fee numbers are ILLUSTRATIVE round figures per share, chosen to show the mechanics. Real schedules are public and change.
export const VENUES = [
  { id: "TSX", name: "TSX", kind: "Lit", model: "Maker-taker", take: 0.0015, share: 0.42, prot: true, note: "Listing exchange, opening and closing auctions" },
  { id: "CXC", name: "Nasdaq CXC", kind: "Lit", model: "Maker-taker", take: 0.0026, share: 0.14, prot: true, note: "Pays makers more, charges takers more" },
  { id: "NEO", name: "Cboe Canada", kind: "Lit", model: "Maker-taker", take: 0.0018, share: 0.12, prot: true, note: "Several books, including one built for retail and long-term flow" },
  { id: "CX2", name: "Nasdaq CX2", kind: "Lit", model: "Inverted", take: -0.0004, share: 0.09, prot: true, note: "Pays the taker, charges the maker" },
  { id: "ALP", name: "Alpha", kind: "Lit", model: "Inverted + speed bump", take: -0.0010, share: 0.1, prot: false, note: "Short random delay on incoming orders, so its quotes are not protected" },
  { id: "OMG", name: "Omega / Lynx", kind: "Lit", model: "Maker-taker", take: 0.0012, share: 0.05, prot: true, note: "Smaller books" },
  { id: "DRK", name: "Dark midpoint", kind: "Dark", model: "Midpoint", take: 0.0010, share: 0.08, prot: false, note: "No displayed quotes; fills at the midpoint when there is a match" },
];

/** A consolidated snapshot of offers across venues for one stock (what a router sees for a BUY order). */
export function venueBook(inst, seed = 3) {
  const R = rng(seed), tick = inst.tick ?? 0.01;
  const spreadT = Math.max(1, Math.round((inst.spread_bps / 1e4) * inst.px / tick));
  const bid = Math.round(inst.px / tick) * tick - Math.ceil(spreadT / 2) * tick, ask = bid + spreadT * tick;
  const touch = lot(clamp(inst.adv_sh * 0.0004, 500, 20000));
  const levels = [];
  for (const v of VENUES) {
    if (v.kind === "Dark") { if (R() < 0.75) levels.push({ venue: v.id, px: (bid + ask) / 2, size: lot(touch * (0.3 + 1.2 * R())), lvl: -1 }); continue; }
    for (let l = 0; l < 3; l++) {
      if (l === 0 && R() < (v.share > 0.1 ? 0.05 : 0.3)) continue;        // smaller venues are not always at the best price
      levels.push({ venue: v.id, px: ask + l * tick, size: lot(touch * 2.4 * v.share * (0.6 + 0.9 * R()) * (1 + 0.5 * l)), lvl: l });
    }
  }
  return { bid, ask, mid: (bid + ask) / 2, tick, levels, touch };
}

/** Route a marketable BUY order. Policies: single (TSX only), size, fee, dark (midpoint first, then lowest fee). */
export function route(book, qty, policy = "fee") {
  const fee = (id) => VENUES.find((v) => v.id === id).take;
  const lit = book.levels.filter((x) => x.lvl >= 0);
  let queue = [];
  if (policy === "single") queue = lit.filter((x) => x.venue === "TSX").sort((a, b) => a.px - b.px);
  else {
    const byPx = [...new Set(lit.map((x) => x.px))].sort((a, b) => a - b);
    for (const px of byPx) {
      const at = lit.filter((x) => x.px === px);
      at.sort(policy === "size" ? (a, b) => b.size - a.size : (a, b) => fee(a.venue) - fee(b.venue));
      queue.push(...at);
    }
    if (policy === "dark") queue = [...book.levels.filter((x) => x.lvl < 0), ...queue];
  }
  let rem = qty; const fills = [];
  for (const lv of queue) {
    if (rem <= 0) break;
    const q = Math.min(rem, lv.size);
    fills.push({ venue: lv.venue, px: lv.px, qty: q, fee: q * fee(lv.venue) }); rem -= q;
  }
  const filled = qty - rem, notional = fills.reduce((s, f) => s + f.px * f.qty, 0), fees = fills.reduce((s, f) => s + f.fee, 0);
  const worst = fills.length ? Math.max(...fills.map((f) => f.px)) : null;
  // a better-priced protected quote left untouched while we paid more elsewhere = trade-through
  const through = worst === null ? false : lit.some((lv) => VENUES.find((v) => v.id === lv.venue).prot && lv.px < worst - 1e-9 &&
    (fills.filter((f) => f.venue === lv.venue && Math.abs(f.px - lv.px) < 1e-9).reduce((s, f) => s + f.qty, 0) < lv.size));
  const avg = filled ? notional / filled : 0, allIn = filled ? (notional + fees) / filled : 0;
  return { policy, fills, filled, unfilled: rem, avgPx: avg, fees, allIn, tradeThrough: through,
    vsAskBps: filled ? ((allIn - book.ask) / book.ask) * 1e4 : 0, venues: new Set(fills.map((f) => f.venue)).size };
}
