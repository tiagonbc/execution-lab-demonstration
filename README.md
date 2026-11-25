# Execution Lab

A working demonstration for a quantitative trading role, designed and built by Tiago Costa.
It covers Canadian and US equities: how the markets are organised, what mood they are in, which days are cheap
to trade, who else is in the order book, what an order will cost, and whether the algorithms are behaving.

**Daily market statistics are real. The order book, fills and venue fees are simulated or illustrative, and every
page says which is which.** Not affiliated with or endorsed by Wealthsimple.

## Pages

| Page | What it answers | Data |
|---|---|---|
| Overview | Six questions with one live result each; the posting mapped to the lab | mixed |
| Market structure | Canada and the US side by side; liquidity of 240 TSX names and US names; multi-venue router | real + simulated book |
| Sentiment | A daily market-mood score for Canada and the US, and what to change in the algorithms | real |
| Timing | Weekday, calendar-event and volatility effects; return distributions; forecasts scored out of sample | real |
| Order flow | A simulated book with planted icebergs, sliced orders and bursts; three detectors scored against the truth | simulated |
| Execution lab | Pre-trade cost estimate; six algorithms on one day and on 300 mirrored days | simulated on real statistics |
| Operations | Daily routine, control charts that catch planted problem days, limits and kill switch | simulated |
| About | Who built it, what is real, design check, glossary | |

## Layout

```
build_data.py          Python (pandas, NumPy): raw daily price files -> docs/data/market.json (statistics only)
docs/index.html        static site, no server-side code
docs/assets/engine.js  day simulator, impact model, six algorithms, Monte Carlo, order-book simulator,
                       iceberg / sliced-order / burst detectors, venue router (no dependencies)
docs/assets/*.js       pages and charts (Plotly)
tests/engine.test.mjs  15 automated tests for the engine
```

## Run

```
python build_data.py              # needs the local price databases; writes docs/data/market.json
node --test tests/engine.test.mjs # 15 tests
python -m http.server 8796 --directory docs
```

## Data

- Canada: daily bars (open, high, low, close, volume) for TSX-listed symbols from my own research database.
- US: daily closes for ETFs, the S&P 500 and VIX from Norgate Data, plus daily bars for a few US symbols.
- Only derived statistics are published. No price series is in this repository.
- The universe is today's 240 most-traded names followed back in time, so delisted names are missing (survivorship).

## Models, stated plainly

- Spread: one tick at least, wider with volatility, narrower with traded value. Daily bars carry no quotes.
- Intraday shape: a U-shaped volume curve plus a closing-auction share that the reader can change.
- Impact: temporary impact grows with the share of volume taken (power 0.6), permanent impact with size, in the
  form of Almgren, Thum, Hauptmann and Li (2005) with literature coefficients. Not fitted to anyone's fills.
- Monte Carlo days come in mirrored pairs so the market's direction cancels out of the average cost.
- Venue fees are round illustrative numbers.
