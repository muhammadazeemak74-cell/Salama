# Pre-registration — `three_green_breakout` / `three_red_breakout`

**Frozen: 2026-08-08, BEFORE any backtest was run.**
**Status at time of writing: NO RESULTS HAVE BEEN OBSERVED. No data has been loaded.**

This document is a commitment device. Nothing below may be changed after any
result — in-sample or out-of-sample — has been looked at. If a rule here turns
out to be inconvenient once numbers exist, the answer is REJECT, not an edit to
this file. Any revision must be a new file with a new date, and the strategy
restarts from a fresh split.

---

## 1. Strategy definition (frozen)

Signal: 3 consecutive bullish bars (`close > open`) on XAUUSD — mirrored as 3
consecutive bearish bars (`close < open`) for `three_red_breakout`.

Box, measured at close of the 3rd bar:

```
box_high = max(high[-3:])
box_low  = min(low[-3:])
BH       = box_high - box_low
```

Orders — OCO pair placed at close of the 3rd bar:

```
BUY  STOP @ box_high + tick_buffer
SELL STOP @ box_low  - tick_buffer
```

- Unfilled legs cancel after `N_expiry` bars.
- On fill, the opposite leg cancels immediately.
- One position at a time. No pyramiding.
- Pattern detection resets on fill **or** expiry — no overlapping boxes.
- `direction_filter: none` — whichever leg fills is taken.

Stop-loss variants (**both** are run; neither may be selected after seeing results):

- `S1`: opposite side of the box
- `S2`: `0.5 * BH` from entry

Target variants: `k * risk`, for `k` in `{1.0, 1.5, 2.0}`.

## 2. Parameter grid (frozen, exhaustive)

| Axis | Values | Count |
|---|---|---|
| timeframe | 1m, 5m, 15m, 30m, 1H | 5 |
| N_expiry | 3, 5, 10 | 3 |
| stop | S1, S2 | 2 |
| target_k | 1.0, 1.5, 2.0 | 3 |

**90 configs per polarity. 180 total across green + red.**

No config outside this grid may be reported. No axis may be added — including
session, trend, ATR, volatility, or news filters — for any reason, and
explicitly not to rescue a failing result.

## 3. Cost model (headline = net)

Every metric is produced **gross and net**. The headline number is always net.

- Retail spot XAUUSD spread, session-varying if the data supports it. If the
  data does not support session-varying spread, a single constant is used and
  that fact is stated in `VERDICT.md`.
- Stop-entry fills are modelled as **adverse**, never mid: worst-case 1×
  spread on entry **and** 1× spread on stop-loss exit.
- Commission applied if the harness has a commission model.
- Spread and commission values are taken from the harness. They are **not**
  invented here — see §8.

## 4. Split

- **In-sample:** first 70% of available history, chronological.
- **Out-of-sample:** final 30%, **LOCKED**.

OOS is not loaded, plotted, described, or computed against until IS is complete
and **exactly one** config has been nominated in writing. OOS is looked at once.
There is no second nomination — if the nominated config fails OOS, the verdict
is REJECT for the whole family. Re-nominating a different config after an OOS
failure is the specific failure mode this split exists to prevent.

## 5. Statistical test (frozen before results)

Null hypothesis per config: mean net R-multiple per trade ≤ 0. One-sided.

Trade returns from a stop/target structure are bimodal and fat-tailed, and
adjacent trades share regime, so a plain t-test is not trusted. Test statistic:
mean net R, evaluated by **studentized stationary bootstrap** (Politis–Romano),
10,000 resamples, block length selected by the automatic rule of Politis–White
on the per-trade net R series. The bootstrap p-value is the raw p-value.

**Multiple-testing correction — Bonferroni, binding:**

| Family | Tests | Threshold at family-wise α = 0.05 |
|---|---|---|
| Primary (per spec: one polarity's grid) | 90 | **p < 5.56e-4** |
| Secondary (both polarities, the honest family) | 180 | **p < 2.78e-4** |

The primary threshold (`5.56e-4`) is the binding one, per the task spec. The
180-test threshold is reported alongside it because both polarities are in fact
being tested, and a config that clears 90 but not 180 will be stated as such.

Benjamini–Hochberg FDR may be reported **for information only**. It is
pre-declared here as non-binding and **cannot convert a REJECT into an ACCEPT**.
It is not an escape hatch.

Because grid configs share underlying bars, the 180 tests are strongly
dependent and Bonferroni is conservative. This is noted, and it is still the
binding rule — a conservative correction is the correct bias on a 180-config
fishing surface.

## 6. Acceptance criteria — ALL must hold, else REJECT

1. **Net expectancy > 0 in-sample**, at **n ≥ 200 trades** for that config.
   Configs with n < 200 are flagged `untradeable-evidence` and are ineligible
   for nomination regardless of how good they look.
2. **Best config survives Bonferroni**: raw bootstrap p-value < `5.56e-4`. Both
   the raw p-value and the threshold are reported.
3. **Green and red mirrors are directionally consistent** — both net-positive,
   or the asymmetry has a *structural* reason stated in advance. See §7.
4. **Nominated config holds net expectancy > 0 in OOS**, with zero re-tuning.
5. **Net profit factor > 1.15**, and drawdown acceptable vs. equity-curve noise,
   made concrete as:
   - IS recovery ratio (net total R ÷ max drawdown in R) **≥ 2.0**
   - OOS recovery ratio **≥ 1.0**
   - Longest flat/underwater period **≤ 25%** of the sample span

## 7. Admissible structural reasons for green/red asymmetry

Declared in advance, as criterion 3 requires:

**None are identified.** With `direction_filter: none`, an OCO pair straddling
the box, and a symmetric stop/target structure, there is no prior reason for a
3-green box to behave differently from a 3-red box. Gold's long-run upward
drift is far too small at 1m–1H horizons to survive the modelled spread and is
therefore **not** admissible as an explanation.

Consequently: **if green is positive and red is not (or vice versa), that is
noise, and the verdict is REJECT.** This is pre-committed precisely so it
cannot be argued away later.

## 8. The diagnostic table (produced first)

Distribution of `BH` by timeframe, in ticks, against average spread in ticks.

This is generated **before** the grid runs, because it likely settles the
question on its own: the strategy pays ~2× spread (adverse entry + adverse stop
exit) against a box whose height sets the risk unit. Where median `BH` is a
small multiple of spread — expected on 1m and plausibly 5m — net expectancy is
structurally negative regardless of `N_expiry`, stop variant, or `target_k`,
and no amount of grid search fixes it.

Reported per timeframe: median, p25, p75, p05, p95 of `BH` in ticks; mean and
median spread in ticks; and the ratio `median(BH) / (2 × spread)`.

Tick size and spread values must come from the harness/data feed. They are
deliberately left unfilled here rather than assumed, so that no invented
constant can leak into a headline number.

## 9. Outputs

- `results/three_green_breakout/grid_net.csv`, `grid_gross.csv`
- `results/three_red_breakout/grid_net.csv`, `grid_gross.csv`
- Trade count per config, with `n < 200` flagged `untradeable-evidence`
- BH-vs-spread table (§8)
- Equity curve — **nominated config only**, not a wall of 90
- `VERDICT.md`: ACCEPT or REJECT, naming the failing criterion

## 10. Blocked

As of the freeze date this protocol **cannot be executed**. The gold-lab
harness, its cost model, and XAUUSD price history are not present in this
repository or in any repository reachable from this session. No substitute or
synthetic data will be used — fabricated inputs on an anti-overfit protocol
would produce a confident answer with no information in it.

This file stands as the pre-registration for the moment the real harness and
data are supplied.

---

# Amendment 1 — matched-geometry null replaces criterion 1's ">0"

**Added 2026-08-08. Pre-registered BEFORE any real data was loaded and before
any real-data result was observed.** The sections above are otherwise unchanged;
this amendment replaces the hurdle in criterion 1 and adds nothing else. The
grid is still 90 configs per polarity, the cost model, the 70/30 split, the
Bonferroni thresholds and criteria 2-5 all stand as written.

## Why the old hurdle is wrong

Criterion 1 required net expectancy **> 0**. That presumes zero is the
no-edge value. The verification pass showed it is not: the engine carries a
residual intrabar-resolution artifact — the fill bar's extremes both trigger
the entry and resolve the exit, and bar data cannot order those events — and
the artifact **scales with bar geometry**, specifically with the ratio of
resolution-bar range to box height. A hurdle of zero therefore silently varies
in difficulty across the grid, and is easiest exactly where the artifact is
largest.

Zero is also not the no-edge value once costs are charged, so the true hurdle
is not even a fixed negative number: it depends on the config's own trade
frequency, holding period and session mix.

The remedy is to stop assuming the hurdle and measure it, per config, on the
real series.

## The null

For each config, a null distribution of net expectancy is built by running the
**identical engine and identical cost model** over resamples of the **real** bar
series:

- **Stationary block bootstrap** (Politis-Romano) of the real bars, block
  length by **Politis-White** — the same selector already pre-registered in §5
  for the test statistic, reused rather than introduced as a new knob.
- Resampling operates on per-bar geometry deltas `(gap, up, ch, dn)` carried
  together, so every bar in a resample is a real bar's exact shape. **Bar range,
  body, gap, the box-height distribution and within-block volatility clustering
  are preserved.** Original timestamps are reused so the session-varying spread
  lands on the same hours.
- What is destroyed is **serial structure across blocks** — the only thing a
  genuine edge could live in. Anything that survives is artifact plus noise.
- **>= 200 resamples**, per config.

## The amended criterion

> **Criterion 1 (amended).** Net expectancy must exceed the **97.5th percentile
> of its own matched null distribution**, in-sample **and** out-of-sample. The
> `n >= 200` trades requirement is unchanged.

Define `excess = net_expectancy - null_p97.5`.

> **If `excess <= 0`, REJECT — regardless of the raw sign of net expectancy.**

A positive raw expectancy that fails to clear its own null is artifact, not
edge, and is to be reported as such. Symmetrically, this amendment can make the
hurdle *easier* than zero where the null is negative — that is intended and is
not a loosening, because the null is measured on the same costs and the same
geometry the config actually faces.

## Reporting

Per config, in `grid_net.csv` and in `VERDICT.md` for the nominated config:

| column | meaning |
|---|---|
| `net_expectancy` | observed, net, pessimistic resolution |
| `null_mean` | mean of the matched null |
| `null_p975` | 97.5th percentile — the hurdle |
| `null_excess` | observed minus hurdle; must be > 0 |
| `null_resamples`, `null_block_length` | provenance |

## Scope limits, stated in advance

- The null is measured on the **real series only**. Running it on synthetic
  data is not a substitute and its output would not be reported as a result.
- The null is computed for **every tradeable config**, not only those with
  positive raw expectancy. A config with negative net expectancy can still
  clear a more negative null, and excluding it in advance would bias the grid.
- Nomination order is unchanged: the OOS block stays locked until one config is
  nominated from in-sample results. The OOS null is computed **after**
  nomination, on the OOS block, for the nominated config only.
- This amendment cannot rescue anything. It only ever raises or lowers a
  measured hurdle; it adds no filter, no parameter and no grid entry.
