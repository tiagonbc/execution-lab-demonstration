"""Build docs/data/market.json for the Execution Lab demonstration.

Reads two local price stores and writes DERIVED STATISTICS ONLY (no price series):
  * Canada: my AmiBroker research database of TSX / TSXV / Cboe Canada daily bars
    (open, high, low, close, volume).
  * US: daily closes for ETFs and indices cached from Norgate Data by my DAA Lab
    project, plus the few US symbols kept in the Canadian database.

Run:  python -I build_data.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
CA_DB = Path(r"C:\Program Files\AmiBroker\Databases\Canada")
US_CACHE = ROOT.parent / "DAA Lab" / "data" / "cache"
OUT = ROOT / "docs" / "data" / "market.json"

HEADER = 0x4A0
REC = np.dtype([("lo", "<u4"), ("hi", "<u4"), ("c", "<f4"), ("o", "<f4"), ("h", "<f4"),
                ("l", "<f4"), ("v", "<f4"), ("oi", "<f4"), ("a1", "<f4"), ("a2", "<f4")])

N_UNIVERSE = 240      # liquid TSX names used for breadth, flow and timing statistics
N_TIMING = 100        # most liquid names used for the calendar statistics
N_INSTR = 40          # names offered in the execution lab
ANN = math.sqrt(252)

NAMES = {
    "RY": "Royal Bank of Canada", "TD": "Toronto-Dominion Bank", "ENB": "Enbridge", "CNQ": "Canadian Natural Resources",
    "SHOP": "Shopify", "BMO": "Bank of Montreal", "BNS": "Bank of Nova Scotia", "CM": "CIBC", "CP": "Canadian Pacific Kansas City",
    "CNR": "Canadian National Railway", "SU": "Suncor Energy", "TRP": "TC Energy", "MFC": "Manulife Financial",
    "BN": "Brookfield Corporation", "ABX": "Barrick", "AEM": "Agnico Eagle Mines", "CVE": "Cenovus Energy", "BCE": "BCE",
    "T": "TELUS", "NTR": "Nutrien", "SLF": "Sun Life Financial", "WCN": "Waste Connections", "CSU": "Constellation Software",
    "ATD": "Alimentation Couche-Tard", "NA": "National Bank of Canada", "FNV": "Franco-Nevada", "WPM": "Wheaton Precious Metals",
    "TECK.B": "Teck Resources", "CCO": "Cameco", "IMO": "Imperial Oil", "L": "Loblaw", "DOL": "Dollarama", "FTS": "Fortis",
    "PPL": "Pembina Pipeline", "K": "Kinross Gold", "TOU": "Tourmaline Oil", "IFC": "Intact Financial", "GWO": "Great-West Lifeco",
    "POW": "Power Corporation of Canada", "MG": "Magna International", "RCI.B": "Rogers Communications", "QSR": "Restaurant Brands",
    "FM": "First Quantum Minerals", "CLS": "Celestica", "BAM": "Brookfield Asset Management", "TRI": "Thomson Reuters",
    "XIU": "iShares S&P/TSX 60 ETF", "XIC": "iShares Core S&P/TSX Capped Composite ETF", "ZEB": "BMO Equal Weight Banks ETF",
    "XEG": "iShares S&P/TSX Capped Energy ETF", "ZSP": "BMO S&P 500 ETF", "VFV": "Vanguard S&P 500 ETF (CAD)",
    "XGD": "iShares S&P/TSX Global Gold ETF", "AC": "Air Canada", "BB": "BlackBerry", "LUN": "Lundin Mining",
    "ARX": "ARC Resources", "WN": "George Weston", "EMA": "Emera", "H": "Hydro One", "GIB.A": "CGI", "OTEX": "Open Text",
    "SPY": "SPDR S&P 500 ETF", "QQQ": "Invesco QQQ", "IWM": "iShares Russell 2000 ETF",
}

US_NAMES = {"SPY": "SPDR S&P 500 ETF", "EWC": "iShares MSCI Canada ETF", "V": "Visa", "C": "Citigroup", "F": "Ford Motor",
            "T": "AT&T", "B": "Barrick Mining", "D": "Dominion Energy", "O": "Realty Income", "M": "Macy's", "H": "Hyatt Hotels",
            "J": "Jacobs Solutions", "L": "Loews", "R": "Ryder System", "U": "Unity Software", "W": "Wayfair", "Z": "Zillow Group",
            "S": "SentinelOne", "G": "Genpact"}


# ---------------------------------------------------------------- loaders
def read_ami(path: Path) -> pd.DataFrame:
    """One AmiBroker symbol file -> daily OHLCV DataFrame indexed by date."""
    n = (path.stat().st_size - HEADER) // REC.itemsize
    if n <= 0:
        return pd.DataFrame()
    a = np.fromfile(path, dtype=REC, count=n, offset=HEADER)
    hi = a["hi"]
    dates = pd.to_datetime(dict(year=(hi >> 20).astype(int), month=((hi >> 16) & 15).astype(int),
                                day=((hi >> 11) & 31).astype(int)), errors="coerce")
    df = pd.DataFrame({"o": a["o"], "h": a["h"], "l": a["l"], "c": a["c"], "v": a["v"]}, index=dates).astype("float64")
    df = df[~df.index.isna()]
    df = df[~df.index.duplicated(keep="last")].sort_index()
    return df[(df["c"] > 0) & (df["h"] >= df["l"])]


def ca_path(sym: str) -> Path:
    return CA_DB / sym[0].lower() / sym


def norgate_close(sym: str) -> pd.Series:
    safe = sym.replace("$", "_").replace("%", "_")
    files = sorted(US_CACHE.glob(f"ng_{safe}_[01]*.pkl"), key=lambda p: -p.stat().st_size)
    s = pd.read_pickle(files[0])
    if isinstance(s, pd.DataFrame):
        s = s.iloc[:, 0]
    return s.dropna().astype("float64")


# ---------------------------------------------------------------- estimators
def logret(c: pd.Series | pd.DataFrame):
    return np.log(c / c.shift(1))


def garman_klass(df: pd.DataFrame, n: int) -> float:
    d = df.tail(n)
    v = 0.5 * np.log(d["h"] / d["l"]) ** 2 - (2 * math.log(2) - 1) * np.log(d["c"] / d["o"]) ** 2
    return float(math.sqrt(max(v.mean(), 0.0)))


def model_spread(px: float, vol_d: float, adv_val: float) -> float:
    """Modelled quoted spread as a fraction of price. Daily bars carry no quotes, so this is a
    stated assumption, not a measurement: one tick at least, wider with volatility, narrower
    with traded value (0.1 x daily volatility x (value traded in $M) ^ -0.4)."""
    return max(tick_size(px) / px, 0.1 * vol_d * (max(adv_val, 1e5) / 1e6) ** -0.4)


def tick_size(px: float) -> float:
    return 0.01 if px >= 0.5 else 0.005


def r(x, nd=4):
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    return round(float(x), nd)


def series(idx, vals, nd=2):
    return {"d": [d.strftime("%Y-%m-%d") for d in idx], "v": [r(v, nd) for v in vals]}


def pct_rank(s: pd.Series, n: int) -> float:
    w = s.dropna().tail(n)
    return float((w <= w.iloc[-1]).mean() * 100)


def dist_stats(rets: pd.Series) -> dict:
    x = rets.dropna()
    z = (x - x.mean()) / x.std()
    edges = np.arange(-0.05, 0.0501, 0.0025)
    counts, _ = np.histogram(x.clip(-0.0499, 0.0499), bins=edges)
    return {"n": int(len(x)), "mean_bps": r(x.mean() * 1e4, 2), "sd_pct": r(x.std() * 100, 3),
            "ann_vol_pct": r(x.std() * ANN * 100, 2), "skew": r((z ** 3).mean(), 2), "ex_kurt": r((z ** 4).mean() - 3, 2),
            "beyond3": r((z.abs() > 3).mean() * 100, 2), "worst_pct": r(x.min() * 100, 2), "best_pct": r(x.max() * 100, 2),
            "bins": [r(e * 100, 2) for e in edges[:-1]], "counts": [int(c) for c in counts]}


def acf_abs(rets: pd.Series, lags=20) -> list:
    a = rets.dropna().abs()
    return [r(a.autocorr(k), 3) for k in range(1, lags + 1)]


# ---------------------------------------------------------------- main
def main() -> None:
    xiu = read_ami(ca_path("XIU.TO"))
    asof = xiu.index[-2]                     # the newest bar was saved mid-session: drop it
    xiu = xiu.loc[:asof]
    print("as of", asof.date())

    # pass 1: rank every .TO symbol by recent traded value
    rows = []
    n_files = sum(1 for _ in CA_DB.glob("?/*.TO"))
    for p in CA_DB.glob("?/*.TO"):
        df = read_ami(p).loc[:asof]
        if len(df) < 320 or df.index[-1] != asof:
            continue
        t = df.tail(60)
        px = float(t["c"].median())
        zero = float((t["v"] <= 0).mean())
        if px < 2 or zero > 0.05:
            continue
        rows.append((p.name, float((t["c"] * t["v"]).median()), df))
    rows.sort(key=lambda x: -x[1])
    n_scanned = len(rows)
    rows = rows[:N_UNIVERSE]
    syms = [x[0] for x in rows]
    data = {x[0]: x[2] for x in rows}
    print("scanned", n_scanned, "kept", len(syms), "top", syms[:8])

    cal = xiu.index[xiu.index >= asof - pd.Timedelta(days=365 * 7)]
    C = pd.DataFrame({s: data[s]["c"] for s in syms}).reindex(cal)
    O = pd.DataFrame({s: data[s]["o"] for s in syms}).reindex(cal)
    H = pd.DataFrame({s: data[s]["h"] for s in syms}).reindex(cal)
    L = pd.DataFrame({s: data[s]["l"] for s in syms}).reindex(cal)
    V = pd.DataFrame({s: data[s]["v"] for s in syms}).reindex(cal)
    R = logret(C).clip(-0.25, 0.25)
    DV = C * V

    # ------------------------------------------------ US inputs
    spy_c = norgate_close("SPY").loc[:asof]
    us_set = ["SPY", "QQQ", "IWM", "MDY", "IJR", "VTI", "XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY",
              "IWD", "IWF", "IWN", "IWO", "MTUM", "SCHD"]
    USC = pd.DataFrame({s: norgate_close(s) for s in us_set}).loc[:asof]
    vix = norgate_close("$VIX").loc[:asof]
    spy_db = read_ami(ca_path("SPY")).loc[:asof]
    us_fresh = {}
    for p in CA_DB.glob("?/*"):
        if "." in p.name or p.name.startswith("~"):
            continue
        df = read_ami(p).loc[:asof]
        if len(df) > 320 and df.index[-1] == asof and float((df["c"] * df["v"]).tail(60).median()) > 5e7:
            us_fresh[p.name] = df
    print("US symbols with fresh OHLCV:", sorted(us_fresh))

    # ------------------------------------------------ per-symbol table
    xr = logret(xiu["c"])

    def sym_row(sym: str, df: pd.DataFrame, mkt: str) -> dict:
        t20, t60 = df.tail(20), df.tail(60)
        px = float(df["c"].iloc[-1])
        lr = logret(df["c"]).clip(-0.25, 0.25)
        on = np.log(df["o"] / df["c"].shift(1)).tail(250)
        intr = np.log(df["c"] / df["o"]).tail(250)
        dv = (df["c"] * df["v"])
        spread = model_spread(px, float(lr.tail(60).std()), float(dv.tail(60).median()))
        amihud = float((lr.abs() / dv).replace([np.inf, -np.inf], np.nan).tail(60).mean() * 1e6 * 1e4)
        base = sym[:-3] if sym.endswith(".TO") else sym
        j = pd.concat([lr, xr], axis=1).dropna().tail(250)
        beta = float(np.cov(j.iloc[:, 0], j.iloc[:, 1])[0, 1] / j.iloc[:, 1].var()) if mkt == "CA" and len(j) > 60 else None
        return {
            "sym": base, "mkt": mkt, "name": (US_NAMES if mkt == "US" else NAMES).get(base, ""), "px": r(px, 2),
            "adv_sh": int(t20["v"].mean()), "adv_val": r(float(dv.tail(60).median()), 0),
            "vol_d": r(lr.tail(60).std() * 100, 3), "vol_ann": r(lr.tail(60).std() * ANN * 100, 1),
            "gk_d": r(garman_klass(df, 20) * 100, 3), "range_bps": r(((t20["h"] - t20["l"]) / t20["c"]).median() * 1e4, 1),
            "spread_bps": r(spread * 1e4, 2), "tick_bps": r(tick_size(px) / px * 1e4, 2), "tick": tick_size(px),
            "amihud": r(amihud, 3), "on_share": r(on.var() / (on.var() + intr.var()) * 100, 1), "beta": r(beta, 2),
        }

    table = [sym_row(s, data[s], "CA") for s in syms]
    us_rows = [sym_row(s, df, "US") for s, df in sorted(us_fresh.items(), key=lambda kv: -float((kv[1]["c"] * kv[1]["v"]).tail(60).median()))]

    # weekly volatility / relative-volume history for the execution-lab names
    hist = {}
    for s in syms[:N_INSTR] + list(us_fresh):
        df = data.get(s, us_fresh.get(s))
        lr = logret(df["c"]).clip(-0.25, 0.25)
        v20 = (lr.rolling(20).std() * ANN * 100).tail(756)[::5]
        rv = (df["v"].rolling(5).mean() / df["v"].rolling(60).mean()).tail(756)[::5]
        hist[s[:-3] if s.endswith(".TO") else s] = {"d": [d.strftime("%Y-%m-%d") for d in v20.index],
                                                   "vol": [r(x, 1) for x in v20], "rv": [r(x, 2) for x in rv]}

    # ------------------------------------------------ regime series (Canada)
    win = cal[-756:]
    ma50, ma200 = C.rolling(50).mean(), C.rolling(200).mean()
    b50 = (C > ma50).sum(axis=1) / C.notna().sum(axis=1) * 100
    b200 = (C > ma200).sum(axis=1) / ma200.notna().sum(axis=1) * 100
    adv_dec = ((R > 0).sum(axis=1) - (R < 0).sum(axis=1)) / R.notna().sum(axis=1) * 100
    hi252, lo252 = C.rolling(252).max(), C.rolling(252).min()
    nhnl = ((C >= hi252).sum(axis=1) - (C <= lo252).sum(axis=1)) / hi252.notna().sum(axis=1) * 100
    up_dv = DV.where(R > 0).sum(axis=1)
    flow = (up_dv.rolling(10).sum() / DV.where(R.notna()).sum(axis=1).rolling(10).sum()) * 100
    disp = (R.std(axis=1) * 100).rolling(20).mean()
    ew = R.mean(axis=1)
    n = R.notna().sum(axis=1)
    sd_i = R.rolling(60).std()
    s1, s2 = sd_i.sum(axis=1), (sd_i ** 2).sum(axis=1)
    corr = ((ew.rolling(60).var() - s2 / n ** 2) / ((s1 ** 2 - s2) / n ** 2)).clip(-0.2, 1) * 100
    turnover = DV.sum(axis=1).rolling(20).mean() / 1e9
    xiu_vol = xr.rolling(20).std() * ANN * 100
    spy_r = logret(spy_c)
    spy_vol = spy_r.rolling(20).std() * ANN * 100
    xiu_ma200 = xiu["c"].rolling(200).mean()
    spy_ma200 = spy_c.rolling(200).mean()

    # US breadth across the 21 broad, style and sector ETFs
    us_b200 = (USC > USC.rolling(200).mean()).sum(axis=1) / len(us_set) * 100
    us_b50 = (USC > USC.rolling(50).mean()).sum(axis=1) / len(us_set) * 100
    UR = logret(USC)
    us_disp = (UR[["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]].std(axis=1) * 100).rolling(20).mean()
    vix_m = vix.resample("ME").mean().tail(60)

    def clamp(x):
        return float(max(0.0, min(100.0, x)))

    def gauge(volp, breadth, flowv, dist):
        parts = {"calm": clamp(100 - volp), "breadth": clamp(breadth),
                 "flow": clamp((flowv - 35) / 30 * 100) if flowv is not None else None, "trend": clamp(50 + dist * 500)}
        vals = [v for v in parts.values() if v is not None]
        score = round(sum(vals) / len(vals))
        label = "Risk-on, calm" if score >= 65 else "Normal" if score >= 45 else "Cautious" if score >= 30 else "Stressed"
        return {"score": r(score, 0), "label": label, "parts": {k: r(v, 0) for k, v in parts.items()}}

    ca_volp, us_volp = pct_rank(xiu_vol, 1260), pct_rank(spy_vol, 1260)
    regime = {
        "ca": {**gauge(ca_volp, b200.iloc[-1], flow.iloc[-1], xiu["c"].iloc[-1] / xiu_ma200.iloc[-1] - 1),
               "vol": r(xiu_vol.iloc[-1], 1), "vol_pct": r(ca_volp, 0), "b50": r(b50.iloc[-1], 0), "b200": r(b200.iloc[-1], 0),
               "flow": r(flow.iloc[-1], 0), "disp": r(disp.iloc[-1], 2), "corr": r(corr.iloc[-1], 0),
               "trend": r((xiu["c"].iloc[-1] / xiu_ma200.iloc[-1] - 1) * 100, 1), "turnover": r(turnover.iloc[-1], 2),
               "nhnl": r(nhnl.iloc[-1], 1)},
        "us": {**gauge(us_volp, us_b200.iloc[-1], None, spy_c.iloc[-1] / spy_ma200.iloc[-1] - 1),
               "vol": r(spy_vol.iloc[-1], 1), "vol_pct": r(us_volp, 0), "b50": r(us_b50.iloc[-1], 0), "b200": r(us_b200.iloc[-1], 0),
               "vix": r(vix.iloc[-1], 1), "vix_pct": r(pct_rank(vix, 1260), 0), "disp": r(us_disp.iloc[-1], 2),
               "trend": r((spy_c.iloc[-1] / spy_ma200.iloc[-1] - 1) * 100, 1)},
    }

    wk = slice(None, None, 5)
    long_idx = xiu_vol.loc["2007-01-01":].index[wk]
    regime_ts = {
        "xiu_vol": series(win, xiu_vol.reindex(win), 1), "spy_vol": series(win, spy_vol.reindex(win), 1),
        "b50": series(win, b50.reindex(win), 0), "b200": series(win, b200.reindex(win), 0),
        "us_b50": series(win, us_b50.reindex(win), 0), "us_b200": series(win, us_b200.reindex(win), 0),
        "adv_dec": series(win, adv_dec.rolling(10).mean().reindex(win), 1), "nhnl": series(win, nhnl.reindex(win), 1),
        "flow": series(win, flow.reindex(win), 1), "disp": series(win, disp.reindex(win), 2),
        "us_disp": series(win, us_disp.reindex(win), 2), "corr": series(win, corr.reindex(win), 0),
        "turnover": series(win, turnover.reindex(win), 2),
        "xiu_vol_long": series(long_idx, xiu_vol.reindex(long_idx), 1),
        "spy_vol_long": series(long_idx, spy_vol.reindex(long_idx).ffill(), 1),
        "vix_monthly": series(vix_m.index, vix_m.values, 1),
        "xiu_spy_corr": series(win, xr.rolling(60).corr(spy_r.reindex(xr.index)).reindex(win) * 100, 0),
    }

    # ------------------------------------------------ timing statistics (5 years, most liquid names)
    top = syms[:N_TIMING]
    t5 = cal[-1260:]
    relV = (V[top] / V[top].rolling(20).median().shift(1)).reindex(t5)
    rng = ((H[top] - L[top]) / C[top])
    relG = (rng / rng.rolling(20).median().shift(1)).reindex(t5)
    rng5 = rng.reindex(t5) * 1e4
    R5 = R[top].reindex(t5)
    gap5 = (np.log(O[top] / C[top].shift(1)).abs() * 1e4).reindex(t5)
    cost = relG * relV.clip(lower=0.05) ** -0.5        # same order, same stock: cost ~ volatility x sqrt(1 / volume)
    xr5 = xr.reindex(t5)

    def agg(mask) -> dict:
        m = np.asarray(mask)
        return {"n": int(m.sum()), "rel_vol": r(np.nanmedian(relV[m].values) * 100, 1), "rel_range": r(np.nanmedian(relG[m].values) * 100, 1),
                "cost": r(np.nanmedian(cost[m].values) * 100, 1), "range_bps": r(np.nanmedian(rng5[m].values), 1),
                "gap_bps": r(np.nanmedian(gap5[m].values), 1), "ret_bps": r(np.nanmean(xr5[m].values) * 1e4, 1),
                "up_pct": r(np.nanmean((xr5[m] > 0).values) * 100, 1)}

    dow = t5.dayofweek
    weekday = [{"k": k, **agg(dow == i)} for i, k in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri"])]

    ym = pd.Series(t5.to_period("M"), index=t5)
    first = ~ym.duplicated(keep="first").values
    last = ~ym.duplicated(keep="last").values
    third_fri = (dow == 4) & (t5.day >= 15) & (t5.day <= 21)
    quarter = third_fri & np.isin(t5.month, [3, 6, 9, 12])
    us_closed = ~t5.isin(spy_c.index)
    pos = pd.Series(np.arange(len(t5)), index=t5)
    after_us = np.isin(np.arange(len(t5)), pos[us_closed].values + 1)
    events = [
        {"k": "All days", **agg(np.ones(len(t5), bool))},
        {"k": "First trading day of the month", **agg(first)},
        {"k": "Last trading day of the month", **agg(last)},
        {"k": "Monthly options expiry (3rd Friday)", **agg(third_fri & ~quarter)},
        {"k": "Quarterly expiry and index rebalance", **agg(quarter)},
        {"k": "US market closed, TSX open", **agg(us_closed)},
        {"k": "Day after a US holiday", **agg(after_us)},
    ]

    volq = pd.qcut(xiu_vol.shift(1).reindex(t5), 5, labels=False)
    edges = xiu_vol.shift(1).reindex(t5).quantile([0, .2, .4, .6, .8, 1]).values
    names = ["Calmest fifth", "Calm", "Middle", "Volatile", "Most volatile fifth"]
    volreg = [{"k": names[i], "lo": r(edges[i], 1), "hi": r(edges[i + 1], 1), **agg((volq == i).values)} for i in range(5)]

    def on_share(df):
        on = np.log(df["o"] / df["c"].shift(1)).tail(1260)
        intr = np.log(df["c"] / df["o"]).tail(1260)
        return r(on.var() / (on.var() + intr.var()) * 100, 1)

    overnight = {"xiu": on_share(xiu), "spy": on_share(spy_db) if len(spy_db) > 300 and spy_db.index[-1] == asof else None,
                 "median_top": r(float(np.median([x["on_share"] for x in table[:N_TIMING] if x["on_share"] is not None])), 1)}

    # US weekday behaviour (SPY, last 10 years of closes; volume and range from the OHLCV copy when fresh)
    s10 = spy_r.tail(2520)
    us_weekday = []
    spy_ok = len(spy_db) > 300 and spy_db.index[-1] == asof
    if spy_ok:
        sv = (spy_db["v"] / spy_db["v"].rolling(20).median().shift(1)).tail(1260)
        sg0 = (spy_db["h"] - spy_db["l"]) / spy_db["c"]
        sg = (sg0 / sg0.rolling(20).median().shift(1)).tail(1260)
    for i, k in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri"]):
        m = s10.index.dayofweek == i
        row = {"k": k, "ret_bps": r(s10[m].mean() * 1e4, 1), "abs_bps": r(s10[m].abs().mean() * 1e4, 1), "up_pct": r((s10[m] > 0).mean() * 100, 1)}
        if spy_ok:
            row["rel_vol"] = r(sv[sv.index.dayofweek == i].median() * 100, 1)
            row["rel_range"] = r(sg[sg.index.dayofweek == i].median() * 100, 1)
        us_weekday.append(row)

    vix_prev = vix.shift(1)
    vb = [(0, 15, "VIX under 15"), (15, 20, "15 to 20"), (20, 25, "20 to 25"), (25, 35, "25 to 35"), (35, 200, "Over 35")]
    j = pd.concat([vix_prev.rename("v"), spy_r.rename("spy"), xr.rename("xiu")], axis=1).dropna().tail(2520)
    vix_buckets = [{"k": k, "n": int(((j.v >= a) & (j.v < b)).sum()),
                    "spy_abs": r(j.spy[(j.v >= a) & (j.v < b)].abs().mean() * 1e4, 0),
                    "xiu_abs": r(j.xiu[(j.v >= a) & (j.v < b)].abs().mean() * 1e4, 0)} for a, b, k in vb]

    # ------------------------------------------------ forecast checks (out of sample)
    half = len(t5) // 2
    ewma = rng[top].ewm(halflife=10).mean().shift(1).reindex(t5)
    naive = rng[top].shift(1).reindex(t5)
    avg20 = rng[top].rolling(20).mean().shift(1).reindex(t5)
    real = rng[top].reindex(t5)

    def mae(f):
        return float(np.nanmean(np.abs(f.values[half:] - real.values[half:])) * 1e4)

    def rank_corr(f):
        a, b = f.iloc[half:].stack(), real.iloc[half:].stack()
        k = a.index.intersection(b.index)
        return float(a[k].rank().corr(b[k].rank()))

    wd_factor = np.array([np.nanmedian(relV.values[:half][dow[:half] == i]) for i in range(5)])
    v_base = V[top].rolling(20).median().shift(1).reindex(t5)
    v_real = V[top].reindex(t5)
    f_plain, f_wd = v_base, v_base.mul(wd_factor[dow], axis=0)

    def mape(f):
        e = (f.values[half:] - v_real.values[half:]) / v_real.values[half:]
        return float(np.nanmedian(np.abs(e[np.isfinite(e)])) * 100)

    forecasts = {
        "test_days": int(len(t5) - half), "names": len(top),
        "range": {"yesterday": r(mae(naive), 1), "avg20": r(mae(avg20), 1), "ewma": r(mae(ewma), 1), "rank_corr": r(rank_corr(ewma), 2)},
        "volume": {"median20": r(mape(f_plain), 1), "with_weekday": r(mape(f_wd), 1),
                   "weekday_factor": [r(x * 100, 1) for x in wd_factor]},
    }

    # impact check: does traded value explain price moves the way the square-root rule says?
    x = table[:N_UNIVERSE]
    lx = np.log([t["adv_val"] for t in x])
    ly = np.log([max(t["amihud"], 1e-6) for t in x])
    slope = float(np.polyfit(lx, ly, 1)[0])

    out = {
        "asof": asof.strftime("%Y-%m-%d"), "built": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "counts": {"ca_files": n_files, "ca_scanned": n_scanned, "ca_universe": len(syms), "timing_names": len(top), "us_etfs": len(us_set),
                   "years_timing": 5, "bars_ca": int(sum(len(data[s]) for s in syms))},
        "table": table, "us_table": us_rows, "hist": hist, "regime": regime, "regime_ts": regime_ts,
        "timing": {"weekday": weekday, "events": events, "volreg": volreg, "overnight": overnight, "us_weekday": us_weekday,
                   "vix_buckets": vix_buckets},
        "dist": {"xiu": dist_stats(xr.tail(2520)), "spy": dist_stats(spy_r.tail(2520))},
        "acf": {"xiu": acf_abs(xr.tail(2520)), "spy": acf_abs(spy_r.tail(2520)),
                "xiu_lag1": r(xr.tail(2520).autocorr(1), 3), "spy_lag1": r(spy_r.tail(2520).autocorr(1), 3)},
        "forecasts": forecasts, "amihud_slope": r(slope, 2),
        "link": {"corr_60d": r(xr.tail(60).corr(spy_r.reindex(xr.index).tail(60)), 2),
                 "corr_5y": r(xr.tail(1260).corr(spy_r.reindex(xr.index).tail(1260)), 2)},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, f"{OUT.stat().st_size / 1024:.0f} KB")
    print(json.dumps(regime, indent=1))
    print("weekday", json.dumps(weekday))
    print("events", json.dumps(events))
    print("volreg", json.dumps(volreg))
    print("forecasts", json.dumps(forecasts), "amihud slope", slope, "overnight", overnight)
    print("us_weekday", json.dumps(us_weekday))
    print("vix", json.dumps(vix_buckets), "link", out["link"])
    print("dist xiu", {k: v for k, v in out["dist"]["xiu"].items() if k not in ("bins", "counts")})
    print("dist spy", {k: v for k, v in out["dist"]["spy"].items() if k not in ("bins", "counts")})
    print("top rows", json.dumps(table[:5]))
    print("us rows", json.dumps(us_rows[:5]))


if __name__ == "__main__":
    main()
