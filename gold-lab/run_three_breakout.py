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
from goldlab import metrics, stats
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


def phase1_bh_table(base: pd.DataFrame, costs: CostModel) -> pd.DataFrame:
    """§8 - box height vs. the cost of trading it, per timeframe."""
    rows = []
    for tf in gdata.TIMEFRAMES:
        bars = gdata.resample(base, tf)
        # Box heights are polarity-independent in distribution; use green.
        _, diag = run(bars, Config("green", tf, 3, "S1", 1.0), costs, base_bars=base)
        avg_spread = float(
            np.mean([costs.spread_in_ticks(h) for h in range(24)])
            if costs.is_session_varying else costs.spread_in_ticks(12)
        )
        row = {"timeframe": tf, "bars": len(bars)}
        row.update(metrics.bh_distribution(diag["bh_ticks"], avg_spread))
        rows.append(row)
    df = pd.DataFrame(rows)
    RESULTS.mkdir(parents=True, exist_ok=True)
    df.to_csv(RESULTS / "bh_vs_spread.csv", index=False)
    return df


def phase2_grid(bars_by_tf: dict, base: pd.DataFrame, costs: CostModel,
                polarity: str) -> pd.DataFrame:
    rows = []
    for cfg in grid(polarity):
        # Addendum 01 §1: >=5m resolves against the 1m base series; 1m has no
        # finer series and falls back to the pessimistic tie-break.
        trades, diag = run(bars_by_tf[cfg.timeframe], cfg, costs, base_bars=base,
                           resolution="pessimistic")
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
                                base_bars=base, resolution="optimistic")
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


def nominate(is_df: pd.DataFrame) -> dict | None:
    """Pick exactly one config from IS results. Criteria 1, 2 and 5 only."""
    ok = is_df[
        (is_df["polarity"] == "green")
        & (is_df["net_n"] >= MIN_TRADES)
        & (is_df["net_expectancy"] > 0)
        & (is_df["passes_bonferroni_90"])
        & (is_df["net_profit_factor"] > MIN_PROFIT_FACTOR)
        & (is_df["net_recovery_ratio"] >= MIN_RECOVERY_IS)
        & (is_df["net_longest_flat_frac"] <= MAX_FLAT_FRAC)
    ]
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
    ap.add_argument("--stop-after", type=int, default=5, choices=[1, 2, 3, 4, 5])
    args = ap.parse_args()

    base = gdata.load_bars(args.data)
    costs = build_costs(args, base)
    print(f"bars: {len(base):,}  {base.index[0]} -> {base.index[-1]}")
    print(f"costs: {costs.describe()}")
    if not costs.measured:
        print("WARNING: spread is a placeholder, not measured. "
              "Headline numbers are provisional until real spread data is supplied.")

    RESULTS.mkdir(parents=True, exist_ok=True)

    # Phase 1 -----------------------------------------------------------
    bh = phase1_bh_table(base, costs)
    print("\n=== Phase 1: BH vs spread (ticks) ===")
    print(bh.to_string(index=False))
    if args.stop_after == 1:
        return 0

    # Phase 2 -----------------------------------------------------------
    split = gdata.split_70_30(base)
    print(f"\nsplit: {split.describe()}")
    print("OOS is LOCKED until a config is nominated.")

    is_by_tf = {tf: gdata.resample(split.is_bars, tf) for tf in gdata.TIMEFRAMES}
    frames = [phase2_grid(is_by_tf, split.is_bars, costs, p) for p in ("green", "red")]
    is_df = pd.concat(frames, ignore_index=True)

    for polarity in ("green", "red"):
        d = is_df[is_df["polarity"] == polarity]
        out = RESULTS / f"three_{polarity}_breakout"
        out.mkdir(parents=True, exist_ok=True)
        gross_cols = [c for c in d.columns if not c.startswith("net_")]
        net_cols = [c for c in d.columns if not c.startswith("gross_")]
        d[gross_cols].to_csv(out / "grid_gross.csv", index=False)
        d[net_cols].to_csv(out / "grid_net.csv", index=False)

    n_untradeable = int(is_df["untradeable_evidence"].sum())
    n_assumed = int(is_df["ASSUMPTION_DEPENDENT"].sum())
    print(f"\n=== Phase 2: IS grid ===")
    print(f"configs: {len(is_df)}  flagged n<{MIN_TRADES}: {n_untradeable}")
    print(f"flagged ASSUMPTION-DEPENDENT (>5% of trades resolved by "
          f"assumption): {n_assumed}")
    if args.stop_after == 2:
        return 0

    # Phase 3 -----------------------------------------------------------
    nom = nominate(is_df)
    if nom is None:
        write_verdict(bh, is_df, None, None, costs, split)
        print("\nNo config satisfies the IS criteria. VERDICT: REJECT.")
        return 0
    print(f"\n=== Phase 3: nominated {nom['config']} (p={nom['net_p_value']:.3g}) ===")
    if args.stop_after == 3:
        return 0

    # Phase 4 - OOS unlocked, evaluated once -----------------------------
    cfg = Config(nom["polarity"], nom["timeframe"], int(nom["n_expiry"]),
                 nom["stop"], float(nom["target_k"]))
    oos_bars = gdata.resample(split.oos_bars, cfg.timeframe)
    oos_trades, oos_diag = run(oos_bars, cfg, costs, base_bars=split.oos_bars,
                               resolution="pessimistic")
    oos_net = metrics.compute(np.array([t.net_r for t in oos_trades]))
    oos_gross = metrics.compute(np.array([t.gross_r for t in oos_trades]))
    print(f"=== Phase 4: OOS net expectancy {oos_net.expectancy:+.4f}R "
          f"over n={oos_net.n} ===")

    eq = metrics.equity(np.array([t.net_r for t in oos_trades]))
    pd.DataFrame({"trade": range(len(eq)), "equity_r": eq}).to_csv(
        RESULTS / f"three_{cfg.polarity}_breakout" / "equity_nominated.csv", index=False)
    trades_to_frame(oos_trades).to_csv(
        RESULTS / f"three_{cfg.polarity}_breakout" / "trades_nominated_oos.csv", index=False)

    write_verdict(bh, is_df, nom, {"net": oos_net, "gross": oos_gross, "diag": oos_diag},
                  costs, split)
    return 0


def write_verdict(bh, is_df, nom, oos, costs, split) -> None:
    lines = ["# VERDICT — three_green_breakout / three_red_breakout", "",
             "Protocol: `ACCEPTANCE_CRITERIA.md` as amended by "
             "`ADDENDUM_01_FILL_RESOLUTION.md`.", ""]
    lines.append(f"Cost model: `{costs.describe()}`")
    if not costs.measured:
        lines.append("")
        lines.append("> Spread is a PLACEHOLDER, not measured from the feed. "
                     "This verdict is provisional until real spread data is supplied.")
    lines += ["", f"Split: {split.describe()}", "", "## BH vs spread (ticks)", "",
              bh.to_markdown(index=False), "", "## Result", ""]

    if nom is None:
        lines += [
            "**REJECT.**", "",
            "No in-sample config satisfied criteria 1, 2 and 5 simultaneously "
            "(n >= 200, net expectancy > 0, Bonferroni p < 5.56e-4, net PF > 1.15, "
            "recovery >= 2.0, flat <= 25%). No config was nominated, so the OOS "
            "block was never unlocked and remains clean.",
        ]
    else:
        green = is_df[(is_df["polarity"] == "green") & (is_df["net_n"] >= MIN_TRADES)]
        red = is_df[(is_df["polarity"] == "red") & (is_df["net_n"] >= MIN_TRADES)]
        g_pos = float((green["net_expectancy"] > 0).mean()) if len(green) else float("nan")
        r_pos = float((red["net_expectancy"] > 0).mean()) if len(red) else float("nan")
        lines += [
            f"Nominated: `{nom['config']}`", "",
            f"- IS net expectancy: {nom['net_expectancy']:+.4f}R over n={int(nom['net_n'])}",
            f"- IS raw p-value: {nom['net_p_value']:.3g} vs Bonferroni(90) "
            f"{stats.BONFERRONI_PRIMARY:.3g}",
            f"- IS net profit factor: {nom['net_profit_factor']:.3f}",
            f"- Mirror check: green net-positive {g_pos:.0%} of tradeable configs, "
            f"red {r_pos:.0%}",
            f"- OOS net expectancy: {oos['net'].expectancy:+.4f}R over n={oos['net'].n}",
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
        if nom["timeframe"] == "1m":
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
        if not (oos["net"].expectancy > 0):
            fails.append("4 (OOS net expectancy not > 0)")
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
