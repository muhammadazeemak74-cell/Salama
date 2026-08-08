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

That the engine implements the spec + Addendum 01 — box construction, both OCO
legs, S1/S2 stops, `target_k` scaling, expiry, one-position-at-a-time,
red/green mirroring, sub-resolution above 1m, the losing-leg and stop-first
tie-breaks, assumption accounting, and gap fills at the open including a
weekend-gap case. They establish nothing about whether the strategy has edge.

Two whole-pipeline checks on a driftless synthetic random walk, since a walk
with no drift is a known-answer input:

1. **No lookahead.** Gross expectancy came out positive in roughly half of
   configs — a fair coin, as it must be — and net expectancy positive in none.
   A lookahead bug would have shown gross overwhelmingly positive.
2. **Tie-break direction.** Addendum 01 §5 predicted in advance that the 1m
   change must move results *down*, and called an improvement a bug. Headline
   1m moved *up* (+0.0127R), so it was decomposed by running all three modes on
   the fixed engine: pessimistic −2.0838, old bar-direction heuristic −2.0640,
   optimistic −2.0622. Pessimistic is more adverse than the old heuristic in
   36 of 36 configs. The apparent improvement was the same-bar gap fix below,
   which landed in the same change and moves results up legitimately.

Those synthetic outputs were deleted and are not results.

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
