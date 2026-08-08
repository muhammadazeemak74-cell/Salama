# Addendum 01 — Intrabar fill resolution

**Frozen: 2026-08-08, BEFORE any real data landed.**
**Status at time of writing: NO RESULTS HAVE BEEN OBSERVED. No XAUUSD history
has been loaded. The synthetic random-walk run used to verify the engine is not
a result and is not consulted here.**

Amends `ACCEPTANCE_CRITERIA.md` (frozen 2026-08-08). That document is **not**
rewritten. Where the two differ, this addendum governs §"Intrabar policy" only;
every other frozen rule — the 90-config grid, the cost model, the 70/30 split,
the Bonferroni thresholds, the acceptance criteria, the no-admissible-asymmetry
declaration — stands unchanged.

The original spec resolved intrabar ambiguity by assumption at every timeframe.
That is stricter than necessary above 1m, where a finer series exists and the
sequence can simply be *observed*. It was also weaker than it should be at 1m,
where the bar-direction heuristic is a guess dressed as a rule.

---

## 1. Fill resolution

**Timeframes >= 5m.** Every fill — both OCO legs, and the stop/target race
after entry — resolves against the **1m base series**, not the aggregated bar.
Sequence within a higher-timeframe bar is therefore *observed*, not assumed.

Mechanically: pattern detection and the `N_expiry` window continue to run on
the aggregated timeframe. Order triggering and position resolution run on the
1m bars spanning that window. Nothing about the strategy definition changes —
only the granularity at which its events are timed.

**1m timeframe.** No sub-resolution exists. Resolution is **PESSIMISTIC**:

- both OCO legs touched in one bar → assume the **losing** leg filled first
- stop and target both touched → assume the **stop** filled

"Losing leg" is defined operationally, not by guesswork about bar shape: both
candidate legs are resolved to their exits, and the one with the **worse net R**
is the one taken. This is strictly more adverse than the bar-direction heuristic
it replaces, which could pick the winning leg by luck of the candle's colour.

**Residual ambiguity above 1m.** Sub-resolution shrinks ambiguity but does not
always eliminate it: both levels can still fall inside a single 1m bar. When
that happens the same PESSIMISTIC rule applies, and the event is counted as an
assumption exactly as it would be at 1m. Only genuinely observed sequences count
as observed.

## 2. Assumption accounting

Every config records the number and fraction of its trades whose entry or exit
was settled **by assumption rather than by observation**.

> If **> 5%** of a config's trades were resolved by assumption, that config is
> flagged **`ASSUMPTION-DEPENDENT`** in the grid output.

The flag is descriptive, not disqualifying on its own. It is reported in
`grid_net.csv`, `grid_gross.csv` and `VERDICT.md`. A nominated config carrying
this flag must have the fact stated in the verdict — a result that rests on a
tie-break rule for more than one trade in twenty is a different claim from one
that rests on observed sequence, and the reader is entitled to know which they
are being handed.

## 3. Sensitivity — reported, non-binding

The 1m timeframe is additionally re-run under **OPTIMISTIC** resolution (both
tie-breaks inverted: winning leg fills, target beats stop). The grid carries a
single extra column:

    net_expectancy_optimistic_delta = net_expectancy(OPTIMISTIC) - net_expectancy(PESSIMISTIC)

This quantifies how much of any 1m result is an artifact of the tie-break rule
rather than of the strategy. A large delta means the 1m result is a statement
about the resolution convention, not about gold.

**Binding status: none.** The optimistic run is diagnostic only. It is
pre-declared here, before any data, that:

- the PESSIMISTIC number is the headline at 1m, always;
- no config may be nominated on its optimistic figures;
- the optimistic run **cannot convert a REJECT into an ACCEPT**, and cannot
  raise a config above the `n >= 200`, Bonferroni, profit-factor, recovery or
  OOS thresholds.

It sits alongside Benjamini–Hochberg in §5 of the frozen spec: informative,
explicitly not an escape hatch.

## 4. Gap handling

If a bar **opens beyond** a level, the fill is at the **open**, not at the
level. This applies to all four cases — buy-stop entry, sell-stop entry,
stop-loss exit, and target exit — and at whichever granularity is doing the
resolving.

Weekend and session gaps must never produce free fills. A stop-loss that gaps
through fills at the gapped open and takes the full adverse excursion; it does
not fill at the stop price. The pre-registered adverse spread from the frozen
cost model is applied **on top of** the gapped fill, not instead of it.

This was the engine's behaviour before this addendum. It is written down here
so it is pre-registered rather than incidental, and it is covered by explicit
tests including a weekend-gap case.

## 5. What this does not change

No filter is added. No parameter is added, removed or re-valued. The grid is
still exactly 90 configs per polarity, 180 across both. The OOS block remains
locked until a single config is nominated from in-sample results. All five
acceptance criteria are unchanged in wording and in threshold.

Expected direction of effect, stated in advance so it cannot be claimed as a
discovery afterwards: sub-resolution above 1m should move results **either
way** — it removes an adverse assumption, so some configs improve — while the
1m change should move results **down**, since pessimistic-by-outcome is
strictly more adverse than the bar-direction heuristic. If 1m improves after
this change, that is a bug, not an edge, and must be investigated as one.
