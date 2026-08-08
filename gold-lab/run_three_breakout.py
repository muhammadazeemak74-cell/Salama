#!/usr/bin/env python3
"""Run the pre-registered three_*_breakout protocol.

Phase order is enforced in code, not by discipline:

  1. BH-vs-spread diagnostic table (§8) - written before any grid runs.
  2. In-sample grid, both polarities, 90 configs each. Gross AND net.
  3. Nomination of exactly ONE config from IS results only.
  4. OOS evaluated for the nominated config ONLY, once.
  5. VERDICT.md.

The OOS block is not touched before step 4. `--stop-after` lets a run halt at
an earlier phase; it cannot skip ahead.

Usage:
    python3 run_three_breakout.py --data XAUUSD_1m.csv [--spread-ticks 18]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from goldlab import data as gdata
from goldlab import metrics, nullmodel, stats
from goldlab.costs import CostModel, DEFAULT_SPREAD_TICKS, constant_model
from goldlab.strategy import Config, grid, run, trades_to_frame

RESULTS = Path(__file__).parent / "results"
MIN_TRADES = 200
MIN_PROFIT_FACTOR = 1.15
MIN_RECOVERY_IS = 2.0
MIN_RECOVERY_OOS = 1.0
MAX_FLAT_FRAC = 0.25


def build_costs(args, base: pd.DataFrame) -> CostModel:
    measured = gdata.measure_spread(base)
    if measured is not None and args.spread_ticks is None:
        by_session: dict[str, float] = {}
        model = CostModel(tick_size=args.tick_size, measured=True)
        hours = base.index.hour
        for name in DEFAULT_SPREAD_TICKS:
            mask = np.array([model.session_for(int(h)) == name for h in hours])
            if mask.any():
                by_session[name] = float(measured[mask].mean() / args.tick_size)
        model.spread_ticks = by_session
        model.commission_price_units = args.commission
        return model

    if args.spread_ticks is not None:
        return constant_model(
            args.spread_ticks, tick_size=args.tick_size,
            commission_price_units=args.commission, measured=False,
        )

    return CostModel(
        tick_size=args.tick_size,
        commission_price_units=args.commission,
        measured=False,
    )


def phase2_bh_table(base: pd.DataFrame, costs: CostModel, ticks=None) -> pd.DataFrame:
    """§8 - box height vs. the measured cost of trading it. The decisive table.

    Reported per timeframe in BOTH units, next to the measured round-trip cost:

        roundtrip = 2 x spread (adverse entry + adverse stop exit) + commission
        c         = roundtrip / risk_unit,  risk_unit = median BH + tick buffer

    `k_min_cover_cost` is the literal "how big must the target be before it even
    pays the round trip": k such that k * risk == roundtrip, i.e. k = c. Above
    c = 1 a full 1R target does not cover costs.

    A single "minimum target_k to break even" does NOT exist, and the algebra
    says why. On a fair market the gambler's-ruin win rate is p = 1/(1+k), so
    net expectancy in R units is

        E = p(k - c) + (1 - p)(-1 - c) = -c

    — independent of k. No target multiple breaks even on a fair market; k
    cancels. What a real edge must do instead is beat the fair win rate by a
    multiplicative factor, and that factor is also independent of k:

        p_required = (1 + c) / (1 + k)   vs   p_fair = 1 / (1 + k)
        uplift     = p_required / p_fair = 1 + c

    So `req_winrate_uplift` is the honest headline: the strategy must win
    (1 + c) times more often than chance just to reach zero.
    """
    rows = []
    for tf in gdata.TIMEFRAMES:
        bars = gdata.resample(base, tf)
        _, diag = run(bars, Config("green", tf, 3, "S1", 1.0), costs, base_bars=base,
                      ticks=ticks)
        bh_ticks = np.asarray(diag["bh_ticks"], dtype=float)
        if bh_ticks.size == 0:
            continue

        spread_t = float(
            np.mean([costs.spread_in_ticks(h) for h in range(24)])
            if costs.is_session_varying else costs.spread_in_ticks(12)
        )
        tick = costs.tick_size
        roundtrip_usd = 2.0 * spread_t * tick + costs.commission_price_units
        med_t = float(np.median(bh_ticks))
        risk_usd = med_t * tick + tick          # median BH + 1 tick buffer
        c = roundtrip_usd / risk_usd if risk_usd > 0 else np.inf

        row = {
            "timeframe": tf, "bars": len(bars), "n_boxes": int(bh_ticks.size),
            "bh_p25_usd": float(np.percentile(bh_ticks, 25)) * tick,
            "bh_median_usd": med_t * tick,
            "bh_p75_usd": float(np.percentile(bh_ticks, 75)) * tick,
            "bh_p25_ticks": float(np.percentile(bh_ticks, 25)),
            "bh_median_ticks": med_t,
            "bh_p75_ticks": float(np.percentile(bh_ticks, 75)),
            "spread_usd": spread_t * tick, "spread_ticks": spread_t,
            "roundtrip_usd": roundtrip_usd, "roundtrip_ticks": roundtrip_usd / tick,
            "risk_unit_usd": risk_usd,
            "cost_over_risk": c,
            "k_min_cover_cost": c,
            "req_winrate_uplift": 1.0 + c,
        }
        for k in (1.0, 1.5, 2.0):
            row[f"fair_wr_k{k:g}"] = 1.0 / (1.0 + k)
            row[f"req_wr_k{k:g}"] = (1.0 + c) / (1.0 + k)
        rows.append(row)

    df = pd.DataFrame(rows)
    RESULTS.mkdir(parents=True, exist_ok=True)
    df.to_csv(RESULTS / "bh_vs_spread.csv", index=False)
    return df


def phase2_grid(bars_by_tf: dict, base: pd.DataFrame, costs: CostModel,
                polarity: str, ticks=None) -> pd.DataFrame:
    rows = []
    for cfg in grid(polarity):
        # Addendum 01 §1: >=5m resolves against the 1m base series; 1m has no
        # finer series and falls back to the pessimistic tie-break.
        trades, diag = run(bars_by_tf[cfg.timeframe], cfg, costs, base_bars=base,
                           ticks=ticks, resolution="pessimistic")
        gross = np.array([t.gross_r for t in trades])
        net = np.array([t.net_r for t in trades])
        mg, mn = metrics.compute(gross), metrics.compute(net)

        row = {
            "config": cfg.key, "polarity": polarity, "timeframe": cfg.timeframe,
            "n_expiry": cfg.n_expiry, "stop": cfg.stop, "target_k": cfg.target_k,
            "signals": diag["signals"], "fills": diag["fills"],
            "expired": diag["expired"],
            "ambiguous_entry": diag["ambiguous_entry"],
            "ambiguous_exit": diag["ambiguous_exit"],
            "assumption_resolved": diag["assumption_resolved"],
            "assumption_frac": diag["assumption_frac"],
            "ASSUMPTION_DEPENDENT": diag["assumption_dependent"],
            "observed_resolution": diag["observed_resolution"],
            "resolution_source": diag["resolution_source"],
            "gapped_entries": diag["gapped_entries"],
            "gapped_exits": diag["gapped_exits"],
            "untradeable_evidence": mn.n < MIN_TRADES,
        }
        row.update(mg.as_dict("gross_"))
        row.update(mn.as_dict("net_"))

        # Addendum 01 §2: 1m sensitivity to the tie-break rule. Reported only —
        # pre-declared as unable to rescue a failing config.
        if cfg.timeframe == "1m":
            opt_trades, _ = run(bars_by_tf[cfg.timeframe], cfg, costs,
                                base_bars=base, ticks=ticks,
                                resolution="optimistic")
            opt = metrics.compute(np.array([t.net_r for t in opt_trades]))
            row["net_expectancy_optimistic"] = opt.expectancy
            row["net_expectancy_optimistic_delta"] = (
                opt.expectancy - mn.expectancy
                if np.isfinite(opt.expectancy) and np.isfinite(mn.expectancy) else np.nan
            )
        else:
            row["net_expectancy_optimistic"] = np.nan
            row["net_expectancy_optimistic_delta"] = np.nan

        # Only spend bootstrap effort where the criteria could still be met.
        if mn.n >= MIN_TRADES and mn.expectancy > 0:
            res = stats.test_mean_positive(net)
            row.update({
                "net_p_value": res.p_value, "net_t": res.t_stat,
                "block_length": res.block_length,
                "passes_bonferroni_90": res.passes_primary,
                "passes_bonferroni_180": res.passes_both,
            })
        else:
            row.update({
                "net_p_value": np.nan, "net_t": np.nan, "block_length": np.nan,
                "passes_bonferroni_90": False, "passes_bonferroni_180": False,
            })
        rows.append(row)
    return pd.DataFrame(rows)


def run_null(is_df: pd.DataFrame, bars: pd.DataFrame, costs: CostModel,
                 ticks, n_resamples: int) -> pd.DataFrame:
    """Amendment 1 — matched-geometry null, per config, on the REAL series.

    Resamples are generated ONCE and every config is run over each of them, so
    all configs face the same null draws and the geometry cost is amortised.
    """
    geom = nullmodel.bar_geometry(bars)
    block = nullmodel.block_length_for(bars)
    rng = np.random.default_rng(20260808)
    print(f"  block length (Politis-White): {block:.2f} bars; "
          f"{n_resamples} resamples x {len(is_df)} surviving configs")

    wanted = set(is_df["config"])
    samples: dict[str, list[float]] = {k: [] for k in wanted}
    for r in range(n_resamples):
        rb = nullmodel.resample_bars(geom, block, rng)
        by_tf = {tf: gdata.resample(rb, tf) for tf in gdata.TIMEFRAMES}
        for polarity in ("green", "red"):
            for cfg in grid(polarity):
                if cfg.key not in wanted:
                    continue          # already rejected without the null
                trades, _ = run(by_tf[cfg.timeframe], cfg, costs, base_bars=rb,
                                ticks=None, resolution="pessimistic")
                m = metrics.compute(np.array([t.net_r for t in trades]))
                samples[cfg.key].append(m.expectancy)
        if (r + 1) % 25 == 0:
            print(f"  null resample {r + 1}/{n_resamples}")

    rows = []
    for _, row in is_df.iterrows():
        res = nullmodel.summarise(row["net_expectancy"], samples[row["config"]], block)
        rows.append({"config": row["config"], **res.as_dict()})
    return pd.DataFrame(rows)


def write_grids(is_df: pd.DataFrame) -> None:
    for polarity in ("green", "red"):
        d = is_df[is_df["polarity"] == polarity]
        out = RESULTS / f"three_{polarity}_breakout"
        out.mkdir(parents=True, exist_ok=True)
        d[[c for c in d.columns if not c.startswith("net_")]].to_csv(
            out / "grid_gross.csv", index=False)
        d[[c for c in d.columns if not c.startswith("gross_")]].to_csv(
            out / "grid_net.csv", index=False)


def phase3_survivors(is_df: pd.DataFrame) -> pd.Series:
    """Everything checkable WITHOUT the null.

    Amendment 2 restores `net_expectancy > 0` as a conjunct of criterion 1, so
    a config failing here fails outright and its null cannot change that. That
    is what makes it sound to compute the null for survivors only.
    """
    return (
        (is_df["polarity"] == "green")
        & (is_df["net_n"] >= MIN_TRADES)
        & (is_df["net_expectancy"] > 0)                    # criterion 1(a)
        & (is_df["passes_bonferroni_90"])                  # criterion 2
        & (is_df["net_profit_factor"] > MIN_PROFIT_FACTOR) # criterion 5
        & (is_df["net_recovery_ratio"] >= MIN_RECOVERY_IS)
        & (is_df["net_longest_flat_frac"] <= MAX_FLAT_FRAC)
    )


def nominate(is_df: pd.DataFrame) -> dict | None:
    """Pick exactly one config from IS results. Criteria 1, 2 and 5.

    Criterion 1 is the Amendment 2 conjunction: net expectancy must be BOTH
    positive AND above the 97.5th percentile of its own matched-geometry null.
    Passing (a) without (b) is artifact; passing (b) without (a) is a config
    that merely loses less than its own scrambled null, which is not tradeable.
    """
    """Pick exactly one config from IS results. Criteria 1, 2 and 5 only."""
    ok = is_df[phase3_survivors(is_df) & (is_df["null_excess"] > 0)]  # 1(a) AND 1(b)
    if ok.empty:
        return None
    # Lowest p-value wins; ties broken by net expectancy.
    best = ok.sort_values(["net_p_value", "net_expectancy"], ascending=[True, False]).iloc[0]
    return best.to_dict()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="XAUUSD bar CSV (base timeframe <= 1m)")
    ap.add_argument("--tick-size", type=float, default=0.01)
    ap.add_argument("--spread-ticks", type=float, default=None,
                    help="constant spread override; omit to use measured bid/ask "
                         "or the placeholder session profile")
    ap.add_argument("--commission", type=float, default=0.0)
    ap.add_argument("--ticks", default=None,
                    help="optional tick CSV (timestamp,price | timestamp,bid,ask). "
                         "When supplied it becomes the resolution series at every "
                         "timeframe including 1m: sequence is observed, "
                         "assumption_frac goes to 0 and the 1m bracket collapses.")
    ap.add_argument("--null-resamples", type=int, default=nullmodel.MIN_RESAMPLES,
                    help="matched-geometry null resamples per config "
                         f"(Amendment 1 requires >= {nullmodel.MIN_RESAMPLES})")
    ap.add_argument("--stop-after", type=int, default=2, choices=[1, 2, 3, 4, 5],
                    help="DEFAULT 2: load+costs, then the BH-vs-spread table, "
                         "then STOP. The diagnostic is cheap and usually "
                         "decisive; the null is hours. Pass 3/4/5 explicitly to "
                         "go further. It can never skip ahead.")
    args = ap.parse_args()

    base = gdata.load_bars(args.data)
    ticks = gdata.load_ticks(args.ticks) if args.ticks else None
    costs = build_costs(args, base)
    print(f"bars: {len(base):,}  {base.index[0]} -> {base.index[-1]}")
    print(f"costs: {costs.describe()}")
    print(f"resolution: {'TICKS (' + format(len(ticks), ',') + ')' if ticks is not None else '1m base bars; 1m timeframe is BOUNDED (Addendum 01-A)'}")
    if args.null_resamples < nullmodel.MIN_RESAMPLES:
        print(f"ERROR: --null-resamples {args.null_resamples} below the "
              f"pre-registered minimum {nullmodel.MIN_RESAMPLES}")
        return 2
    if not costs.measured:
        print("WARNING: spread is a placeholder, not measured. "
              "Headline numbers are provisional until real spread data is supplied.")

    RESULTS.mkdir(parents=True, exist_ok=True)

    # Phase 1: data + measured cost model (done above) --------------------
    print("\n=== Phase 1: data loaded, cost model resolved ===")
    if args.stop_after == 1:
        return 0

    # Phase 2: the decisive diagnostic ------------------------------------
    bh = phase2_bh_table(base, costs, ticks)
    print("\n=== Phase 2: box height vs measured round-trip cost ===")
    geo = ["timeframe", "n_boxes", "bh_p25_usd", "bh_median_usd", "bh_p75_usd",
           "bh_median_ticks", "roundtrip_usd", "roundtrip_ticks"]
    imp = ["timeframe", "cost_over_risk", "k_min_cover_cost",
           "req_winrate_uplift", "req_wr_k1", "req_wr_k1.5", "req_wr_k2"]
    print(bh[geo].to_string(index=False, float_format=lambda v: f"{v:,.3f}"))
    print()
    print(bh[imp].to_string(index=False, float_format=lambda v: f"{v:,.4f}"))
    print("\n  cost_over_risk c = round-trip / (median BH + buffer)")
    print("  a fair market yields net expectancy of exactly -c for EVERY k,")
    print("  so no target multiple breaks even; an edge must beat the fair win")
    print("  rate by a factor of (1 + c). k_min_cover_cost > 1 means even a")
    print("  full 1R target does not cover the round trip.")

    if args.stop_after <= 2:
        print("\nSTOP after Phase 2 (default). Read the table above before "
              "spending hours on the grid and null.")
        print("Re-run with --stop-after 5 to continue.")
        return 0

    # Phase 3: in-sample grid ---------------------------------------------
    split = gdata.split_70_30(base)
    print(f"\nsplit: {split.describe()}")
    print("OOS is LOCKED until a config is nominated.")

    is_by_tf = {tf: gdata.resample(split.is_bars, tf) for tf in gdata.TIMEFRAMES}
    frames = [phase2_grid(is_by_tf, split.is_bars, costs, p, ticks)
              for p in ("green", "red")]
    is_df = pd.concat(frames, ignore_index=True)

    write_grids(is_df)

    n_untradeable = int(is_df["untradeable_evidence"].sum())
    n_assumed = int(is_df["ASSUMPTION_DEPENDENT"].sum())
    print(f"\n=== Phase 3: IS grid ===")
    print(f"configs: {len(is_df)}  flagged n<{MIN_TRADES}: {n_untradeable}")
    print(f"flagged ASSUMPTION-DEPENDENT (>5% of trades resolved by "
          f"assumption): {n_assumed}")
    surv_mask = phase3_survivors(is_df)
    n_surv = int(surv_mask.sum())
    print(f"survived every non-null gate: {n_surv}")
    if args.stop_after == 3:
        return 0

    # Phase 4: null, SURVIVORS ONLY ---------------------------------------
    if n_surv == 0:
        print("\n=== Phase 4: SKIPPED — zero survivors, no null to compute ===")
        for col in ("null_mean", "null_p975", "null_excess", "null_resamples",
                    "null_block_length"):
            is_df[col] = np.nan
        write_grids(is_df)
        write_verdict(bh, is_df, None, None, costs, split)
        print("VERDICT: REJECT (no config cleared the in-sample gates).")
        return 0

    print(f"\n=== Phase 4: matched-geometry null, {n_surv} surviving configs ===")
    null_df = run_null(is_df[surv_mask], split.is_bars, costs, ticks,
                           args.null_resamples)
    is_df = is_df.merge(null_df, on="config", how="left")
    write_grids(is_df)
    print(f"of those, clearing their null (excess > 0): "
          f"{int((is_df['null_excess'] > 0).sum())}")
    if args.stop_after == 4:
        return 0

    # Phase 5: nominate, unlock OOS, verdict -------------------------------
    nom = nominate(is_df)
    if nom is None:
        write_verdict(bh, is_df, None, None, costs, split)
        print("\nNo config satisfies the IS criteria. VERDICT: REJECT.")
        return 0
    print(f"\n=== Phase 5: nominated {nom['config']} (p={nom['net_p_value']:.3g}) ===")

    # OOS unlocked, evaluated once ----------------------------------------
    cfg = Config(nom["polarity"], nom["timeframe"], int(nom["n_expiry"]),
                 nom["stop"], float(nom["target_k"]))
    oos_bars = gdata.resample(split.oos_bars, cfg.timeframe)
    oos_trades, oos_diag = run(oos_bars, cfg, costs, base_bars=split.oos_bars,
                               resolution="pessimistic")
    oos_net = metrics.compute(np.array([t.net_r for t in oos_trades]))
    oos_gross = metrics.compute(np.array([t.gross_r for t in oos_trades]))
    print(f"=== Phase 4: OOS net expectancy {oos_net.expectancy:+.4f}R "
          f"over n={oos_net.n} ===")

    # Amendment 1: OOS null, computed AFTER nomination, nominated config only.
    oos_geom = nullmodel.bar_geometry(split.oos_bars)
    oos_block = nullmodel.block_length_for(split.oos_bars)
    rng = np.random.default_rng(20260809)
    oos_null_vals = []
    for _ in range(args.null_resamples):
        rb = nullmodel.resample_bars(oos_geom, oos_block, rng)
        t2, _ = run(gdata.resample(rb, cfg.timeframe), cfg, costs, base_bars=rb)
        oos_null_vals.append(metrics.compute(np.array([t.net_r for t in t2])).expectancy)
    oos_null = nullmodel.summarise(oos_net.expectancy, oos_null_vals, oos_block)
    print(f"=== OOS null: p97.5 {oos_null.p975:+.4f}R  excess "
          f"{oos_null.excess:+.4f}R -> {'PASS' if oos_null.excess > 0 else 'FAIL'} ===")

    eq = metrics.equity(np.array([t.net_r for t in oos_trades]))
    pd.DataFrame({"trade": range(len(eq)), "equity_r": eq}).to_csv(
        RESULTS / f"three_{cfg.polarity}_breakout" / "equity_nominated.csv", index=False)
    trades_to_frame(oos_trades).to_csv(
        RESULTS / f"three_{cfg.polarity}_breakout" / "trades_nominated_oos.csv", index=False)

    write_verdict(bh, is_df, nom,
                  {"net": oos_net, "gross": oos_gross, "diag": oos_diag,
                   "null": oos_null},
                  costs, split)
    return 0


def _md_table(df: pd.DataFrame) -> str:
    """Markdown table, degrading to plain text rather than killing the run.

    `to_markdown` needs the optional `tabulate` package. A long null run must
    not lose its verdict to a missing formatter.
    """
    try:
        return df.to_markdown(index=False)
    except ImportError:
        return "```\n" + df.to_string(index=False) + "\n```"


def write_verdict(bh, is_df, nom, oos, costs, split) -> None:
    lines = ["# VERDICT — three_green_breakout / three_red_breakout", "",
             "Protocol: `ACCEPTANCE_CRITERIA.md` (Amendment 1: matched-geometry "
             "null) as amended by `ADDENDUM_01_FILL_RESOLUTION.md` "
             "(01-A bounds, 01-B tick resolution).", ""]
    src = is_df["resolution_source"].iloc[0] if len(is_df) else "self"
    label = {"ticks": "TICK resolution — sequence observed at every timeframe; "
                      "1m figures are ESTIMATES and the bracket has zero width",
             "1m_bars": "1m BASE-BAR resolution — >=5m observed; 1m is BOUNDED, "
                        "not estimated (Addendum 01-A)",
             "self": "NO sub-resolution — every timeframe bounded by tie-break"}[src]
    lines += [f"**Resolution mode: {label}**", ""]
    lines.append(f"Cost model: `{costs.describe()}`")
    if not costs.measured:
        lines.append("")
        lines.append("> Spread is a PLACEHOLDER, not measured from the feed. "
                     "This verdict is provisional until real spread data is supplied.")
    lines += ["", f"Split: {split.describe()}", "", "## BH vs spread (ticks)", "",
              _md_table(bh), "", "## Result", ""]

    if nom is None:
        lines += [
            "**REJECT.**", "",
            "No in-sample config satisfied criteria 1, 2 and 5 simultaneously: "
            "n >= 200, net expectancy BOTH > 0 and above its own "
            "matched-geometry null 97.5th percentile (Amendment 2), Bonferroni "
            "p < 5.56e-4, net PF > 1.15, recovery >= 2.0, flat <= 25%. No "
            "config was nominated, so the OOS block was never unlocked and "
            "remains clean.",
        ]
    else:
        green = is_df[(is_df["polarity"] == "green") & (is_df["net_n"] >= MIN_TRADES)]
        red = is_df[(is_df["polarity"] == "red") & (is_df["net_n"] >= MIN_TRADES)]
        g_pos = float((green["net_expectancy"] > 0).mean()) if len(green) else float("nan")
        r_pos = float((red["net_expectancy"] > 0).mean()) if len(red) else float("nan")
        lines += [
            f"Nominated: `{nom['config']}`", "",
            f"- IS net expectancy: {nom['net_expectancy']:+.4f}R over n={int(nom['net_n'])}",
            f"- IS matched null: mean {nom['null_mean']:+.4f}R, "
            f"p97.5 {nom['null_p975']:+.4f}R over {int(nom['null_resamples'])} "
            f"resamples (block {nom['null_block_length']:.1f})",
            f"- **IS excess over null: {nom['null_excess']:+.4f}R** "
            f"-> {'PASS' if nom['null_excess'] > 0 else 'FAIL'} (criterion 1, amended)",
            f"- IS raw p-value: {nom['net_p_value']:.3g} vs Bonferroni(90) "
            f"{stats.BONFERRONI_PRIMARY:.3g}",
            f"- IS net profit factor: {nom['net_profit_factor']:.3f}",
            f"- Mirror check: green net-positive {g_pos:.0%} of tradeable configs, "
            f"red {r_pos:.0%}",
            f"- OOS net expectancy: {oos['net'].expectancy:+.4f}R over n={oos['net'].n}",
            f"- OOS matched null p97.5: {oos['null'].p975:+.4f}R; "
            f"**excess {oos['null'].excess:+.4f}R** -> "
            f"{'PASS' if oos['null'].excess > 0 else 'FAIL'}",
            f"- OOS net profit factor: {oos['net'].profit_factor:.3f}",
            f"- OOS recovery ratio: {oos['net'].recovery_ratio:.2f}",
            f"- Fill resolution: "
            + ("observed against the 1m base series"
               if oos["diag"]["observed_resolution"]
               else "1m — pessimistic tie-break, no finer series exists"),
            f"- Trades resolved by assumption: {nom['assumption_frac']:.1%} in-sample, "
            f"{oos['diag']['assumption_frac']:.1%} OOS",
        ]
        if nom.get("ASSUMPTION_DEPENDENT"):
            lines.append(
                f"- **ASSUMPTION-DEPENDENT**: more than 5% of this config's trades "
                f"were settled by tie-break rather than observed sequence. The "
                f"result is partly a statement about the resolution convention."
            )
        if nom["timeframe"] == "1m" and nom.get("resolution_source") != "ticks":
            lo = nom["net_expectancy"]
            hi = nom.get("net_expectancy_optimistic", np.nan)
            lines += [
                "",
                "> **1m figures are BOUNDS, not estimates** (Addendum 01-A). The "
                "pessimistic tie-break selects the leg whose outcome is worse, "
                "which the market cannot see, so it bounds rather than simulates "
                "fill order.",
                f"> - LOWER bound (pessimistic, binding): {lo:+.4f}R",
                f"> - UPPER bound (optimistic, non-binding): {hi:+.4f}R"
                if np.isfinite(hi) else "> - UPPER bound: not computed",
                f"> - true value is bracketed by these, estimated by neither; "
                f"bracket width {hi - lo:+.4f}R" if np.isfinite(hi) else "",
                "> Gross figures at 1m additionally carry an upward "
                "intrabar-resolution artifact and are not evidence.",
            ]
        lines.append("")
        fails = []
        if not (nom["net_expectancy"] > 0):
            fails.append("1(a) IS (net expectancy not > 0)")
        if not (nom["null_excess"] > 0):
            fails.append("1(b) IS (net expectancy does not exceed its "
                         "matched-null 97.5th percentile)")
        if not (oos["net"].expectancy > 0):
            fails.append("1(a) OOS / criterion 4 (OOS net expectancy not > 0)")
        if not (oos["null"].excess > 0):
            fails.append("1(b) OOS (OOS net expectancy does not exceed its "
                         "matched-null 97.5th percentile)")
        if not (oos["net"].profit_factor > MIN_PROFIT_FACTOR):
            fails.append("5 (OOS net profit factor <= 1.15)")
        if not (oos["net"].recovery_ratio >= MIN_RECOVERY_OOS):
            fails.append("5 (OOS recovery ratio < 1.0)")
        # Criterion 3 is pre-registered as binding with no admissible asymmetry.
        if np.isfinite(g_pos) and np.isfinite(r_pos) and (g_pos > 0.5) != (r_pos > 0.5):
            fails.append("3 (green/red asymmetry, no admissible structural reason)")

        lines.append("**REJECT.** Failing criterion: " + "; ".join(fails) if fails
                     else "**ACCEPT.** All five criteria hold.")

    (RESULTS / "VERDICT.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    sys.exit(main())
