// Shared helpers: formatting, chart theme, small page building blocks.
export const C = { c1: "#1f7db5", c2: "#d17509", c3: "#7a5ea8", c4: "#4f8a3c", ink: "#32302f", ink2: "#686664", ink3: "#94908d", line: "#e4e2e1", grid: "#f1f0f0", buy: "#3d7a34", sell: "#c2451e", linen: "#f5f3ef" };
export const ALGO_COLOR = { twap: C.ink3, vwap: C.c1, pov: C.c2, is: C.c3, moc: C.ink, adaptive: C.c4 };

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

/** Instruments offered in the simulators: the 40 most traded TSX names plus the US names with fresh data. */
export function instruments(mkt = "ALL") {
  const D = store.D, ca = D.table.slice(0, 40), us = D.us_table;
  return mkt === "CA" ? ca : mkt === "US" ? us : [...ca, ...us];
}
export const instLabel = (i) => `${i.sym}${i.name ? " · " + i.name : ""}${i.mkt === "US" ? " (US)" : ""}`;
export const instOptions = (list, sel) => list.map((i) => `<option value="${i.mkt}:${i.sym}" ${sel === i.mkt + ":" + i.sym ? "selected" : ""}>${esc(instLabel(i))}</option>`).join("");
export const findInst = (key) => { const [m, s] = key.split(":"); return (m === "US" ? store.D.us_table : store.D.table).find((x) => x.sym === s); };

// ---------------------------------------------------------------- charts (Plotly, one shared theme)
const base = () => ({
  font: { family: "DM Sans, system-ui, sans-serif", size: 12.5, color: C.ink2 },
  margin: { l: 50, r: 14, t: 10, b: 38 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
  hovermode: "x unified", showlegend: false, bargap: 0.28,
  hoverlabel: { bgcolor: "#1c1b1b", bordercolor: "#1c1b1b", font: { color: "#ffffff", family: "DM Sans, system-ui, sans-serif", size: 12.5 } },
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

// ---------------------------------------------------------------- page blocks
export const pageHead = (eyebrow, title, lead) => `<div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="lead">${lead}</p>`;
export const shortBox = (items) => `<div class="short" aria-label="In short">${items.map(([big, lbl]) => `<div><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`).join("")}</div>`;
export const frame = (problem, does, why) => `<div class="frame"><div><h4>The desk problem</h4><p>${problem}</p></div><div><h4>What this page does</h4><p>${does}</p></div><div><h4>Why it matters</h4><p>${why}</p></div></div>`;
export const chartCard = (title, id, how, extra = "", cls = "") => `<div class="card"><h3>${title}</h3>${extra}<div id="${id}" class="chart ${cls}" role="img" aria-label="${esc(title)}"></div><p class="how"><b>How to read it:</b> ${how}</p></div>`;
export const tag = (text, kind = "") => `<span class="tag ${kind}">${esc(text)}</span>`;
export function seg(id, options, value) {
  return `<div class="seg" id="${id}" role="group">${options.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}">${l}</button>`).join("")}</div>`;
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
