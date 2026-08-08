# gold-lab

Backtest harness for the pre-registered `three_green_breakout` /
`three_red_breakout` study.

**Status: the harness is built and verified. The study has NOT been run — there
is no XAUUSD price history in this repo. No result in this directory should be
quoted, because none exists.**

## Layout

```
three_breakout/ACCEPTANCE_CRITERIA.md   frozen pre-registration — read first
goldlab/costs.py                        spread + commission model
goldlab/data.py                         loader, resampling, 70/30 split
goldlab/strategy.py                     pattern detection + OCO execution
goldlab/metrics.py                      expectancy, PF, drawdown, BH table
goldlab/stats.py                        studentized stationary bootstrap
run_three_breakout.py                   phase-ordered protocol runner
tests/test_execution.py                 engine verification (17 tests)
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

## What the tests establish

That the engine implements the spec — box construction, both OCO legs, S1/S2
stops, `target_k` scaling, expiry, one-position-at-a-time, red/green mirroring,
gap fills at the open, and adverse resolution of every intrabar ambiguity.
They establish nothing about whether the strategy has edge.

As an additional check the full pipeline was run on a driftless synthetic
random walk. Gross expectancy came out positive in roughly half of configs (a
fair coin, as it must be for a walk with no drift), and net expectancy positive
in none. A lookahead bug would have shown up as gross being overwhelmingly
positive. Those synthetic outputs were deleted and are not results.

## Cost model caveat

`goldlab/costs.py` ships a **placeholder** session spread profile. It is not
broker data and it is not measured. Any run using it prints a warning and
stamps the caveat into `VERDICT.md`. Replace it with real spread data before
treating any number as an answer.

## Runtime

~5 minutes for all 180 configs over 400k 1-minute bars, single-threaded. A
multi-year 1m history (~2M bars) should land near 25 minutes.
