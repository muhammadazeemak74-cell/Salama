# Pre-registration — `ema9_retest`

**Frozen: 2026-09-09, BEFORE any backtest was run.**
**Status at time of writing: NO RESULTS HAVE BEEN OBSERVED on the train window.
No price data has been loaded. The geometry pre-check has NOT been run — it is
blocked (see §9).**

Trial number: **UNRESOLVED — see §7.1.** The previously recorded "trial 55,
inherited 54" is known to be wrong: a `three_breakout` study consumed further
configurations against this same holdout without reaching the ledger. The
corrected count must be established before this family is registered.

---

## 1. Provenance of the parameters — read this before any number

All six parameters were supplied pre-chosen:

| Parameter | Value |
|---|---|
| Fast EMA | 9 |
| Trend EMA | 200 |
| Minimum EMA separation | 0.01 % |
| ADX threshold | 18 |
| Target multiple | 7.5 R |
| Cooldown | 2 bars |

They came from an **undocumented optimisation on 2023–2026 TradingView data**,
described by their author as *"your exact best working settings."*

They are **frozen as given and not re-swept here.** No value in the table above
may be changed, tuned, or "checked nearby" at any point in this study. If a
parameter looks wrong once results exist, the answer is REJECT and a new
pre-registration, not an edit.

Two further facts about the source result, recorded so they cannot be forgotten
when the number is quoted:

- It used **100 % of equity per trade.** Position sizing of that kind compounds
  a single lucky sequence into an arbitrary headline figure and says nothing
  about per-trade edge.
- It modelled **zero costs.** No spread, no slippage, no commission.

Neither is a criticism of the idea. Both mean the source figure is not evidence
and is not carried into this study in any form.

## 2. Strategy definition (frozen)

Long side stated; **short is the exact mirror** with the inequalities reversed.

- **Trend filter:** `close > EMA(200)` on 4H
- **Retest:** `low <= EMA(9)` and `close > EMA(9)` and `close > open`
- **Separation:** `|EMA9 - EMA200| / EMA200 * 100 >= 0.01`
- **ADX(14) > 18**
- **Cooldown:** at least 2 bars since the last exit
- **Entry:** the **open of the next 4H bar**
- **Stop:** the signal bar's low
- **Target:** `entry + 7.5 * (entry - stop)`
- One position at a time

### 2.1 Why entry is the next open, not the signal close

The source Pine script enters at the signal bar's close. That is a same-bar
fill: the bar's close is the value that *triggers* the condition, so filling at
it uses the bar's own outcome to decide entry. The engine forbids this. Entry
is therefore the next 4H bar's open, which is the first price actually
tradeable after the signal is known.

This makes the strategy strictly harder than the source and the difference is
expected to be material on a 7.5R target — it is not a technicality.

### 2.2 Unresolved: the gap-through-stop case (must be fixed before running)

Entry is the next bar's open; the stop is the **previous** bar's low. Nothing
prevents the next open from gapping to or below that low, which makes
`entry - stop <= 0` and the R-multiple undefined or negative.

This is a genuine hole in the frozen rules and it is a free parameter until
closed. It is pre-registered here, before any data, as:

> **If the entry bar's open is at or below the signal bar's low (long side;
> mirrored for short), the trade is SKIPPED and recorded as
> `degenerate_gap`.** The count and rate of skips is reported alongside the
> geometry pre-check. It is not silently dropped.

Rationale for skip over immediate-stop: an immediate stop would book a loss on
a trade that could never have been entered at a sane risk, manufacturing
downside the rule never took. Skipping is the neutral treatment. Either choice
is defensible; what is not defensible is choosing after seeing which produces
the better number.

## 3. Bar construction (frozen)

4H bars resampled from the 15m series on the **22:00 UTC boundary**.

**Assertion:** 6 bars per session day (24h / 4H = 6).

### 3.1 Unresolved: the assertion as written will fail

XAUUSD does not trade a clean 24h day. The week opens Sunday ~22:00 UTC and
closes Friday ~21:00–22:00 UTC, with a daily maintenance break, plus market
holidays. A strict global "every session day has exactly 6 bars" assert will
fire on the Friday close, the Sunday open, and every holiday.

Pre-registered form, before any data:

> The assertion is **6 bars per COMPLETE session day**. Fridays, Sundays and
> exchange holidays are enumerated as expected exceptions, counted, and
> reported. Any *unexpected* short day — a gap in the 15m source — fails the
> run rather than being tolerated, because a silently missing 4H bar shifts
> every EMA that follows it.

## 4. Geometry pre-check — the gate (RUN FIRST, REPORT ONLY THIS)

Computed before any expectancy figure exists:

- `spread_share_of_R` — **median and IQR**
- **both-sides-touched rate** — the fraction of trades where the bar range
  covers both stop and target, so bar data cannot order the two events

> **STOP CONDITIONS.** Either of the following halts the family with **no
> expectancy computed**:
> - median `spread_share_of_R` **> 15 %**
> - both-sides-touched rate **> 30 %**

The gate is binding. A near miss is a pass; a marginal fail is a fail. It is
not re-run with a different cost assumption to see if it clears.

Why this gate is the right one for this family: a 7.5R target needs a
break-even win rate of `1 / 8.5 ≈ 11.8 %` before costs. Every point of spread
share raises that hurdle, and it raises it against a rule that will win rarely
by construction. If the geometry fails, no amount of edge in the signal can
recover it, and computing expectancy would only invite arguing with the gate.

## 5. Windows

- **Train: 2015–2021.** This is the evaluation window.
- **2023–2026: CONTAMINATED. Not a preliminary read, not a confirmation.**

The 2023–2026 period sits inside the holdout **and** is the period the six
parameters were optimised on. A result there measures the optimisation, not the
rule. It carries zero evidentiary weight in this study and will not be quoted,
plotted, or referred to as "encouraging" or "consistent."

The one genuine benefit of the odd provenance: because the search ran on
2023–2026, the 2015–2021 window is **untouched by it** and is a clean
out-of-sample test of these exact parameters. That is the only real evidence
this family will produce.

## 6. Reading rule (frozen BEFORE running)

Applied to net expectancy per trade, with a confidence interval:

| Result | Verdict |
|---|---|
| CI lower bound **> 0** | **ADVANCES** — ceiling **INCONCLUSIVE** if fewer than 100 trades |
| Point estimate positive, **CI crosses zero** | **NOT SIGNIFICANT** |
| Point estimate **<= 0** | **REJECTED** |

"Advances" never means "works." With fewer than 100 trades the verdict is
capped at INCONCLUSIVE no matter how good the interval looks — a 7.5R rule with
a low win rate can easily produce a flattering interval off a handful of
winners.

### 6.1 By-year concentration check (reported regardless of every other gate)

> Report any **single year contributing more than 50 % of net profit.**

Reported whether the family passes or fails, and stated in the verdict either
way. A 7.5R trend-continuation rule evaluated across gold's parabolic run is at
risk of testing the run rather than the rule. If one year carries the result,
the honest description is "this captured one trend," and that is a different
claim from "this has edge."

## 7. Multiple-testing position, stated honestly

This is trial 55 against 54 inherited runs on this dataset.

The author's original search over these six parameters has an **unknown trial
count**. Therefore:

> **The DSR trial count is UNINFORMATIVE in this family. Not merely a lower
> bound — uninformative. It must be reported with that word attached.**

Stated plainly, and before any result. A six-parameter search over any
plausible grid is on the order of **10³–10⁵ trials**. Our count — whatever the
reconciliation in §7.1 settles it at — will be in the tens or low hundreds.
A number three orders of magnitude too small is not a conservative estimate of
the multiple-testing burden; it is a different quantity entirely, and dressing
it up as "a lower bound" invites exactly the reading it does not support.

So: the multiple-testing burden of this family **has not been accounted for and
cannot be**, without the original author's search log. No DSR figure computed
here may be presented as though it had been.

> **The evidentiary weight of this family rests ENTIRELY on two things: the
> clean 2015–2021 window (§5) and the by-year concentration check (§6.1).**

Both are independent of the trial count. The DSR is reported for completeness,
is explicitly not load-bearing, and cannot on its own move a verdict in either
direction.

### 7.1 Ledger reconciliation — REQUIRED BEFORE REGISTRATION

The recorded "54 prior runs" is known to undercount. A `three_breakout` study
(commit `a067f72`, "three_breakout: imported, reconciled, REJECTED on criterion
1(a)") ran configurations against this same XAUUSD holdout on a branch that
never merged, so the ledger cannot see them. A run that happened but is not
counted is precisely the leak this protocol exists to prevent.

**This family is not registered until that reconciliation is done.** The
corrected total replaces 54, and `ema9_retest` takes the next number after it.

Two things the reconciliation must settle, neither of which may be decided
after seeing any `ema9_retest` result:

1. **The configuration count in that commit.** If it ran the grid frozen in
   `three_breakout/ACCEPTANCE_CRITERIA.md` §2 unchanged, that is 5 timeframes ×
   3 expiries × 2 stops × 3 targets = **90 per polarity, 180 across green and
   red**. This is a strong prior, not a reading — the commit has not been read
   (see §9) and the number must come from the commit, not from this inference.
2. **Whether the ledger counts polarities separately.** 180 configurations is
   180 trials under a per-configuration convention and 90 under a per-family
   one. The existing convention governs; it is not chosen here.

Under the per-configuration reading the corrected total would be 54 + 180 =
**234**, making this family trial **235**. That figure is recorded as an
expectation to be confirmed or corrected against the commit, and is **not** to
be used until it has been.

## 8. Inherited conventions (to be bound, not re-decided)

Same primary pinning (`XAUUSD_RETAIL`, slip 4.0), same gates, same verdict path
as the prior 54 runs. These are inherited unchanged; this document does not
redefine them.

**They are not resolvable in this repository — see §9.**

## 9. BLOCKED — this protocol cannot currently be executed

As of the freeze date, verified by inspection of this repository:

| Required | Status here |
|---|---|
| 15m XAUUSD parquet | **absent** — no parquet on the filesystem, no `data/` directory |
| `XAUUSD_RETAIL` pinning | **absent** — no instrument-pinning concept exists |
| slip 4.0 | **absent** — cost model is spread-based, no slippage parameter |
| §3 geometry pre-check | **absent** — §3 of the existing criteria is the cost model; the nearest analogue is §8, a different metric with different thresholds |
| `spread_share_of_R` | **absent** — metric does not exist |
| both-sides-touched rate | **absent** — metric does not exist |
| DSR / deflated Sharpe | **absent** — correction here is Bonferroni plus non-binding BH |
| Trial ledger at 54 | **absent** — no ledger exists; nothing to increment |
| EMA / ADX indicators | **absent** — no indicator layer of any kind |
| 4H timeframe | **absent** — supported set is 1m, 5m, 15m, 30m, 1H |
| Pluggable strategy interface | **absent** — the engine is hardcoded to the 3-bar box breakout |

No substitute or synthetic data will be used, and no absent convention will be
invented and presented as inherited. Both would produce a confident answer
containing no information, which on an anti-overfit protocol is worse than no
answer.

This file stands as the pre-registration for the moment the real harness and
data are supplied. Everything in §§1–7 is frozen as of the date above and is
binding from that moment; §8 is the only section awaiting resolution.
