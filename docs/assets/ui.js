// Shared helpers: formatting, icons, chart theme, the scrubbing hero chart, small page building blocks.
export const C = { c1: "#1f7db5", c2: "#d17509", c3: "#7a5ea8", c4: "#4f8a3c", ink: "#000000", ink2: "#5e5e5e", ink3: "#8c8c8c", line: "#dcdcdc", grid: "#ebebeb", buy: "#357941", sell: "#b8352a", up: "#357941", down: "#b8352a", linen: "#ececec" };
export const ALGO_COLOR = { twap: C.ink3, vwap: C.c1, pov: C.c2, is: C.c3, moc: C.ink, adaptive: C.c4 };
const FONT = "Hanken Grotesk, Helvetica Neue, system-ui, sans-serif";

export const store = { D: null };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const f0 = (x) => (x == null || isNaN(x) ? "–" : Math.round(x).toLocaleString("en-CA"));
export const f1 = (x) => (x == null || isNaN(x) ? "–" : x.toLocaleString("en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const f2 = (x) => (x == null || isNaN(x) ? "–" : x.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const money = (x, cur = "$") => {
  if (x == null || isNaN(x)) return "–";
  const a = Math.abs(x), s = x < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${cur}${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${s}${cur}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}${cur}${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return `${s}${cur}${a.toFixed(0)}`;
};
export const shares = (x) => (x >= 1e6 ? (x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + "M" : x >= 1e3 ? (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + "K" : f0(x));
export const bps = (x) => `${f1(x)} bps`;
export const cur = (inst) => (inst.mkt === "US" ? "US$" : "C$");
export const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
export const longDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
export const signed = (x, d = 1) => (x == null || isNaN(x) ? "–" : (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d }));

/** Instruments offered in the simulators: the 40 most traded TSX names plus the US names with fresh data. */
export function instruments(mkt = "ALL") {
  const D = store.D, ca = D.table.slice(0, 40), us = D.us_table;
  return mkt === "CA" ? ca : mkt === "US" ? us : [...ca, ...us];
}
export const instKey = (i) => `${i.mkt}:${i.sym}`;
export const instLabel = (i) => `${i.sym}${i.name ? " · " + i.name : ""}${i.mkt === "US" ? " (US)" : ""}`;
export const instOptions = (list, sel) => list.map((i) => `<option value="${i.mkt}:${i.sym}" ${sel === i.mkt + ":" + i.sym ? "selected" : ""}>${esc(instLabel(i))}</option>`).join("");
export const findInst = (key) => { const [m, s] = String(key).split(":"); return (m === "US" ? store.D.us_table : store.D.table).find((x) => x.sym === s); };
/** Values after "?" in the address, e.g. #/execution?inst=CA:RY&side=-1 */
export const query = () => Object.fromEntries(new URLSearchParams((location.hash.split("?")[1] || "")));

// ---------------------------------------------------------------- icons (drawn for this project, 24-unit grid)
const P = {
  mark: "M5 16l5-6 4 3 6-7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.9-3.9",
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z",
  market: "M4 20h16M6 20v-7M10 20V8M14 20v-9M18 20V5",
  mood: "M4 15a8 8 0 0 1 16 0M12 15l4-5M3 19h18",
  timing: "M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4",
  flow: "M4 8h13M14 4l4 4-4 4M20 16H7M10 12l-4 4 4 4",
  exec: "M5 6h8M17 6h2M5 12h2M11 12h8M5 18h10M19 18h0M15 4v4M9 10v4M17 16v4",
  ops: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4",
  about: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5",
  back: "M14 6l-6 6 6 6", next: "M10 6l6 6-6 6", down: "M6 9l6 6 6-6", arrow: "M5 12h14M13 6l6 6-6 6",
  ext: "M14 5h5v5M19 5l-8 8M11 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5",
  bookmark: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z",
  expand: "M14 5h5v5M19 5l-6 6M10 19H5v-5M5 19l6-6",
  sort: "M5 7h14M7 12h10M10 17h4", updown: "M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3", pick: "M8 10l4-4 4 4M8 14l4 4 4-4",
  layers: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4", bolt: "M13 3L5 13h6l-1 8 8-10h-6z", flag: "M6 21V4h11l-2 4 2 4H6", clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  wave: "M3 12h3l2-6 4 12 3-9 2 3h4", coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 14.5c.4 1 1.3 1.5 2.5 1.5 1.5 0 2.5-.7 2.5-1.9 0-2.6-4.8-1.2-4.8-3.8 0-1.1 1-1.8 2.3-1.8 1.100 0 1.900.500 2.300 1.300M12 7v1.500M12 16v1.500",
  code: "M9 8l-4 4 4 4M15 8l4 4-4 4",
};
export const ic = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.info}"/></svg>`;
/** A small dark tile carrying the ticker, the way a broker app shows a name that has no logo. */
export const tile = (inst, cls = "") => `<span class="tile ${inst.mkt === "US" ? "us" : ""} ${cls}" aria-hidden="true">${esc(String(inst.sym).replace(/[-.].*$/, "").slice(0, 4))}</span>`;
export const iconTile = (name) => `<span class="tile ico" aria-hidden="true">${ic(name)}</span>`;

// ---------------------------------------------------------------- charts (Plotly, one shared theme)
const base = () => ({
  font: { family: FONT, size: 12.5, color: C.ink2 },
  margin: { l: 50, r: 14, t: 10, b: 38 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
  hovermode: "x unified", showlegend: false, bargap: 0.28,
  hoverlabel: { bgcolor: "#000000", bordercolor: "#000000", font: { color: "#ffffff", family: FONT, size: 12.5 } },
  xaxis: { gridcolor: C.grid, linecolor: C.line, zeroline: false, ticks: "", automargin: true },
  yaxis: { gridcolor: C.grid, zerolinecolor: C.line, linecolor: "rgba(0,0,0,0)", ticks: "", automargin: true },
});
const merge = (a, b) => { for (const k in b) a[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] ? { ...a[k] } : {}, b[k]) : b[k]; return a; };
export function plot(id, traces, layout = {}) {
  const el = typeof id === "string" ? document.getElementById(id) : id;
  if (!el || !window.Plotly) return;
  window.Plotly.react(el, traces, merge(base(), layout), { displayModeBar: false, responsive: true });
}
export const line = (x, y, name, color, extra = {}) => { const { line: ln, ...rest } = extra; return { x, y, name, type: "scatter", mode: "lines", line: { color, width: 2, ...(ln || {}) }, hovertemplate: `%{y}<extra>${name}</extra>`, ...rest }; };
export const bar = (x, y, name, color, extra = {}) => ({ x, y, name, type: "bar", marker: { color, line: { width: 0 } }, hovertemplate: `%{y}<extra>${name}</extra>`, ...extra });
export const legend = (items) => `<div class="legend">${items.map(([name, color, kind]) => `<span><i class="${kind === "bar" ? "" : "ln"}" style="background:${color}"></i>${esc(name)}</span>`).join("")}</div>`;

// ---------------------------------------------------------------- scrubbing chart
// One series, no axes. Moving the pointer (or the arrow keys) along it reads out any past value:
// the line stays coloured up to the pointer and turns grey after it, and onMove reports the point.
let scrubId = 0;
export function scrub(el, { labels, values, color = C.up, format = (v) => String(v), name = "Series", onMove = () => {} }) {
  const pts = values.map((v, i) => [i, v]).filter((p) => p[1] != null && !isNaN(p[1]));
  const id = "sc" + ++scrubId, n = pts.length;
  let at = null, W = 0, H = 0, X = () => 0, Y = () => 0;
  const padT = 30, padB = 6, padR = 8;
  el.tabIndex = 0; el.setAttribute("role", "img");
  if (n < 2) { el.innerHTML = `<p class="empty">Not enough history for a chart.</p>`; return { destroy() {} }; }
  el.setAttribute("aria-label", `${name}: line chart with ${n} points from ${labels[pts[0][0]]} to ${labels[pts[n - 1][0]]}. Starts at ${format(pts[0][1])} and ends at ${format(pts[n - 1][1])}. Use the left and right arrow keys to read values.`);

  function draw() {
    W = el.clientWidth; H = el.clientHeight;
    if (!W || !H) return;
    const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1])), span = hi - lo || 1;
    X = (k) => (k / (n - 1)) * (W - padR); Y = (v) => padT + (1 - (v - lo + span * 0.06) / (span * 1.12)) * (H - padT - padB);
    const d = pts.map((p, k) => `${k ? "L" : "M"}${X(k).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join("");
    const area = `${d}L${X(n - 1).toFixed(1)} ${H}L0 ${H}Z`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="${id}d" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".62" fill="${color}"/></pattern>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".86" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <mask id="${id}m"><rect width="${W}" height="${H}" fill="url(#${id}g)"/></mask>
        <clipPath id="${id}c"><rect class="clip" x="-4" y="0" width="${W + 8}" height="${H}"/></clipPath>
      </defs>
      <path d="${d}" fill="none" stroke="#c4c4c4" stroke-width="1.4" stroke-linejoin="round"/>
      <g clip-path="url(#${id}c)"><path d="${area}" fill="url(#${id}d)" mask="url(#${id}m)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g>
      <line class="vl" y1="${padT - 8}" y2="${H}" stroke="#6b6b6b" stroke-width="1" visibility="hidden"/>
      <text class="lb" y="14" text-anchor="middle" visibility="hidden"></text>
      <circle class="halo" r="7" fill="${color}" opacity=".18"/><circle class="dot" r="3.2" fill="${color}"/>
    </svg>`;
    place();
  }
  function place() {
    const k = at ?? n - 1, x = X(k), y = Y(pts[k][1]), q = (s) => el.querySelector(s);
    if (!q("svg")) return;
    q(".dot").setAttribute("cx", x); q(".dot").setAttribute("cy", y); q(".halo").setAttribute("cx", x); q(".halo").setAttribute("cy", y);
    q(".halo").setAttribute("visibility", at == null ? "visible" : "hidden");
    q(".clip").setAttribute("width", at == null ? W + 8 : x + 4);
    const vl = q(".vl"), lb = q(".lb");
    vl.setAttribute("visibility", at == null ? "hidden" : "visible"); lb.setAttribute("visibility", at == null ? "hidden" : "visible");
    if (at != null) { vl.setAttribute("x1", x); vl.setAttribute("x2", x); lb.textContent = labels[pts[k][0]]; lb.setAttribute("x", Math.max(48, Math.min(W - 48, x))); }
  }
  function set(k) { at = k == null ? null : Math.max(0, Math.min(n - 1, k)); place(); onMove(at == null ? null : pts[at][0]); }
  const fromEvent = (e) => { const r = el.getBoundingClientRect(); return Math.round(((e.clientX - r.left) / Math.max(1, r.width - padR)) * (n - 1)); };
  const move = (e) => set(fromEvent(e)), leave = () => set(null);
  const key = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" ? -1 : 1); set((at ?? n - 1) + step); }
    else if (e.key === "Home") { e.preventDefault(); set(0); } else if (e.key === "End" || e.key === "Escape") { set(null); }
  };
  el.addEventListener("pointermove", move); el.addEventListener("pointerdown", move); el.addEventListener("pointerleave", leave); el.addEventListener("keydown", key); el.addEventListener("blur", leave);
  const ro = new ResizeObserver(() => draw()); ro.observe(el);
  draw();
  return { destroy() { ro.disconnect(); el.removeEventListener("pointermove", move); el.removeEventListener("pointerdown", move); el.removeEventListener("pointerleave", leave); el.removeEventListener("keydown", key); el.removeEventListener("blur", leave); } };
}
/** Tiny inline sparkline for stat cards. */
export function spark(values, color = "#3a6fcc", w = 120, h = 26) {
  const v = values.filter((x) => x != null), lo = Math.min(...v), hi = Math.max(...v), s = hi - lo || 1;
  const d = v.map((y, i) => `${i ? "L" : "M"}${((i / (v.length - 1)) * (w - 4)).toFixed(1)} ${(h - 3 - ((y - lo) / s) * (h - 6)).toFixed(1)}`).join("");
  const ey = h - 3 - ((v[v.length - 1] - lo) / s) * (h - 6);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="flex:none"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="${w - 4}" cy="${ey.toFixed(1)}" r="2.4" fill="${color}"/></svg>`;
}

// ---------------------------------------------------------------- page blocks
export const pageHead = (eyebrow, title, lead) => `<div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="lead">${lead}</p>`;
export const shortBox = (items) => `<div class="short" aria-label="In short">${items.map(([big, lbl]) => `<div><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`).join("")}</div>`;
export const frame = (problem, does, why) => `<div class="frame"><div><h4>The desk problem</h4><p>${problem}</p></div><div><h4>What this page does</h4><p>${does}</p></div><div><h4>Why it matters</h4><p>${why}</p></div></div>`;
export const chartCard = (title, id, how, extra = "", cls = "") => `<div class="card"><h3>${title}</h3>${extra}<div id="${id}" class="chart ${cls}" role="img" aria-label="${esc(title)}"></div><p class="how"><b>How to read it:</b> ${how}</p></div>`;
export const tag = (text, kind = "") => `<span class="tag ${kind}">${esc(text)}</span>`;
export function seg(id, options, value, cls = "seg") {
  return `<div class="${cls}" id="${id}" role="group">${options.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}">${l}</button>`).join("")}</div>`;
}
export function onSeg(id, fn) {
  const el = document.getElementById(id);
  el?.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("button", el).forEach((x) => x.setAttribute("aria-pressed", x === b));
    fn(b.dataset.v);
  });
}
export const debounce = (fn, ms = 120) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------------------------------------------------------------- watchlist (kept in this browser only)
const WKEY = "execlab.watch";
export const watch = {
  get() { try { return JSON.parse(localStorage.getItem(WKEY) || "[]"); } catch { return []; } },
  has(k) { return this.get().includes(k); },
  toggle(k) { const w = this.get(), i = w.indexOf(k); if (i >= 0) w.splice(i, 1); else w.push(k); try { localStorage.setItem(WKEY, JSON.stringify(w)); } catch { /* storage unavailable */ } return i < 0; },
};
