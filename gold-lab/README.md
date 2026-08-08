# gold-lab

Backtest harness for the pre-registered `three_green_breakout` /
`three_red_breakout` study.

**Status: the harness is built and verified. The study has NOT been run — there
is no XAUUSD price history in this repo. No result in this directory should be
quoted, because none exists.**

## Layout

```
three_breakout/ACCEPTANCE_CRITERIA.md   frozen pre-registration — read first
three_breakout/ADDENDUM_01_FILL_RESOLUTION.md   intrabar fill resolution
goldlab/costs.py                        spread + commission model
goldlab/data.py                         loader, resampling, 70/30 split
goldlab/strategy.py                     pattern detection + OCO execution
goldlab/metrics.py                      expectancy, PF, drawdown, BH table
goldlab/stats.py                        studentized stationary bootstrap
run_three_breakout.py                   phase-ordered protocol runner
tests/test_execution.py                 engine verification (25 tests)
tests/test_verification.py              golden master + sentinels (12 tests)
tests/synthetic.py                      seeded random walk, binomial helper
```

## Running

```bash
pip install -r requirements.txt
python3 -m pytest tests/ -q
python3 run_three_breakout.py --data path/to/XAUUSD_1m.csv
```

Input CSV needs `timestamp,open,high,low,close`, timestamps UTC, strictly
increasing. Optional `bid`/`ask` columns switch the cost model from the
placeholder spread profile to a measured one — supply them if you have them.

`--stop-after {1..5}` halts at an earlier phase. It cannot skip ahead.

Cost overrides: `--spread-ticks`, `--commission`, `--tick-size`.

## Phase order is enforced in code

1. BH-vs-spread diagnostic table, written **before** any grid runs.
2. In-sample grid — 90 configs × 2 polarities, every metric gross **and** net.
3. Nomination of exactly one config, from in-sample results only.
4. OOS unlocked and evaluated **once**, for the nominated config only.
5. `VERDICT.md`.

The out-of-sample block is not read before step 4. If no config clears the
in-sample criteria, the run stops at step 3 with a REJECT and OOS is never
touched — that is the intended outcome, not a failure of the run.

## Fill resolution

Per Addendum 01. Pattern detection and the `N_expiry` window run on the
configured timeframe; **order triggering and exits resolve on a finer series**:

- **>= 5m** — resolved against the 1m base bars, so sequence inside a
  higher-timeframe bar is *observed*.
- **1m** — no finer series exists, so the pessimistic tie-break applies: both
  OCO legs touched takes the **losing** leg (determined by resolving both and
  taking the worse net R, not by guessing from candle colour); stop and target
  both touched takes the **stop**.

Each config reports `assumption_resolved`, `assumption_frac`, and the
`ASSUMPTION_DEPENDENT` flag when more than 5% of its trades were settled by
tie-break rather than observed sequence. 1m additionally carries
`net_expectancy_optimistic_delta` — pre-declared non-binding, and unable to
rescue a failing config.

## What the tests establish

37 tests. That the engine implements the spec + Addendum 01 — box construction,
both OCO legs, S1/S2 stops, `target_k` scaling, expiry, one-position-at-a-time,
red/green mirroring, sub-resolution above 1m, the losing-leg and stop-first
tie-breaks, assumption accounting, and gap fills at the open including a
weekend-gap case. They establish nothing about whether the strategy has edge.

Beyond those, the **Verification pass** below covers golden-master equivalence
of the fast and reference search paths, the lookahead sentinels, entry-gap
regressions, and the sub-resolution plumbing assertions.

One earlier claim here has been **withdrawn**. A previous version of this file
reported that gross expectancy was positive in "roughly half of configs — a fair
coin, as it must be". That was measured on the pre-gap-fix engine, on a single
walk, counting configs as if they were independent. All three are wrong: the
engine had a bug, configs on one walk are not independent, and the correct
figure on the fixed engine is ~81%, driven by a real intrabar-resolution
artifact. See Verification pass §2. The tie-break direction check (Addendum 01
§5) stands: pessimistic −2.0838 vs old bar-direction −2.0640, more adverse in
36 of 36 configs.

Those synthetic outputs were deleted and are not results.

## Verification pass

All figures below are reproducible from the seeds named. Synthetic outputs were
deleted; none of this is a result about gold.

### 1. Golden-master equivalence — PASS

The chunked vectorized level search landed as an untested refactor alongside
two logic changes. `_search_levels_reference()` restores the pre-vectorization
naive loop and is kept permanently, reference-only, wired in behind
`run(..., search="reference")`.

Both were run on the identical fixed engine (gap fix and Addendum 01 present in
both), seed 20260808, 40k bars, all 180 configs. Asserted **per trade**, not
aggregated — offsetting errors cancel in a mean: entry timestamp, entry price,
exit timestamp, exit price, exit reason, net R, plus per-config signal/fill/
expiry/assumption counts.

**Exact equality on all 180 configs and every trade in them** (>10k trades
compared). Guarded permanently by `test_vectorized_search_matches_reference`.

One correction this surfaced: **the vectorization is a pessimization.** Timed
A/B on identical data — 100k bars, 180 configs — vectorized 37.7s, naive
reference 12.7s. The chunked path evaluates 8192-element boolean arrays even
when the barrier is two bars away. The earlier 4m42s -> 58s figure conflated
three simultaneous changes and misattributed the gain; it was not the
vectorization. The fast path is retained only because it is now proven
equivalent, not because it is fast.

### 2. Lookahead sentinel — re-run, and the original null was wrong

The 74/162 gross-positive figure came from the buggy engine and is void. On the
fixed engine, 5 independent seeds x 150k bars:

| seed | tradeable | gross > 0 | net > 0 |
|---|---|---|---|
| 101 | 129 | 80.6% | 0 |
| 202 | 128 | 79.7% | 0 |
| 303 | 129 | 75.2% | 0 |
| 404 | 127 | 93.7% | 0 |
| 505 | 126 | 77.8% | 0 |

Pooled gross-positive **81.4%** — above the 65% lookahead-suspect threshold.
That was investigated rather than explained away, and two things came out of it.

**The binomial test as specified is invalid.** Configs sharing one walk are not
independent trials; they trade the same price path. A binomial over configs
reports p = 0.000 for what is essentially one observation. The independent unit
is the **seed**. Re-run per-config across 30 independent seeds:

| config | mean gross R | t | seeds > 0 |
|---|---|---|---|
| `green,1m,N5,S1,k1` | +0.0536 | +15.11 | 30/30 |
| `red,5m,N5,S2,k1.5` | +0.0595 | +5.97 | 26/30 |
| `green,5m,N5,S1,k2` | +0.0379 | +2.77 | 19/30 |
| `green,15m,N10,S1,k2` | +0.0421 | +1.42 | 15/30 |

**The excess is real but it is not lookahead.** Controls:

- Exit machinery from unconditional entries (random index, entry at close,
  resolution from the next bar), symmetric barriers: mean **0.00000**, win rate
  **0.5000** against a fair 0.5000. No cross-bar lookahead.
- Golden master: exact per-trade agreement, so not a search bug.
- Entry fills are never favorable (`min(entry - trigger, side-adjusted) =
  +0.00000`); exit gaps very nearly cancel (stop -0.00511 vs target +0.00498);
  idealizing both *raises* the bias to +0.089, so it is not fill handling.

Root cause: **an intrabar-resolution artifact.** The fill bar's extremes both
trigger the entry and resolve the exit, and OHLC cannot order those two events.
It scales with (resolution bar range) / (box height), which is why it is worst
at 1m — where the box spans only three one-minute bars — and why `t` falls from
15.1 at 1m to ~2 at 5m-15m. Sub-resolution shrinks it (5m: +0.0190 -> +0.0162)
but cannot remove it, because the fill bar is irreducible.

Consequences: gross figures are upper-biased, worst at 1m, and are not
evidence. **Net expectancy was positive in 0 of 639 config-seed combinations** —
the protocol's decision variable is unaffected, and the frozen spec already
makes net the headline. The sentinel test was rewritten accordingly: it asserts
the exit-machinery control is exactly fair, asserts net is positive nowhere, and
bounds gross only against ~100% (which would be true lookahead). It no longer
asserts gross ~50%, because that null is wrong for this strategy class on bar
data. Recorded in Addendum 01-A.

### 3. Entry-gap regression — PASS

The gap fix restricted the open-gap rule to "exit bar strictly later". Entry is
the opposite case — the fill bar IS the trigger bar by definition — so entry
gaps had to be confirmed still live, and still adverse. Each test asserts the
fill is **worse** than the trigger, not merely different, so it cannot pass by
entry gaps being silently unhandled (a free fill in the other direction):

- buy leg gapping above the trigger fills at the open, `entry > trigger`
- sell leg gapping below fills at the open, `entry < trigger`
- weekend gap fills at the gapped open with spread charged **on top**
- plus a reachability test asserting gapped entries occur in bulk, so the three
  above cannot pass on a code path that never fires

Confirmed at scale: side-adjusted `min(entry - trigger) = +0.00000` over 37,289
trades. No favorable entry fill exists.

### 4. Sub-resolution plumbing — PASS (assertion, not report)

Every timeframe >= 5m asserts `observed_resolution is True` and
`assumption_frac == 0.0` across all 144 such configs. A nonzero fraction would
mean the 1m base is not being consulted. Paired with a counterpart asserting 1m
*does* report assumptions — otherwise the counter could be dead code and the
first assertion vacuous.

### 5. 1m figures relabelled as bounds

Pessimistic-by-outcome selects the leg whose result is worse, which no market
participant can see; real fill order is independent of which outcome is worse.
So 1m pessimistic is a **lower bound**, 1m optimistic an **upper bound**, and
the true value is bracketed by them and estimated by neither. The
`optimistic_delta` column is the bracket **width**. Stated in Addendum 01-A and
stamped into `VERDICT.md` for any 1m nomination. No acceptance criterion,
threshold or binding rule changed — pessimistic still binds, the delta still
cannot rescue.

### Same-bar gap fix

Writing the Addendum 01 tests surfaced a real bug. The open-gap rule was being
applied even when entry and exit fell in the same bar, so a position that
filled *partway through* a bar could be charged an exit at that bar's open — a
price that predated the position. On the test case it booked a phantom −1.60R
on a trade whose true result was −1.00R. The rule now applies only when the
exit bar is strictly after the entry bar; within one bar the fill is taken at
the level. Covered by `test_same_bar_entry_and_stop_ignores_the_bar_open`.

## Cost model caveat

`goldlab/costs.py` ships a **placeholder** session spread profile. It is not
broker data and it is not measured. Any run using it prints a warning and
stamps the caveat into `VERDICT.md`. Replace it with real spread data before
treating any number as an answer.

## Runtime

~1 minute for all 180 configs over 400k 1-minute bars, single-threaded,
including the 1m optimistic sensitivity re-run. A multi-year 1m history
(~2M bars) should land in the 5-10 minute range.
