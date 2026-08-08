"""Performance metrics, computed identically for gross and net R series."""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd


@dataclass
class Metrics:
    n: int
    expectancy: float        # mean R per trade
    total_r: float
    win_rate: float
    profit_factor: float
    max_dd_r: float
    recovery_ratio: float    # total_r / max_dd_r
    longest_flat_frac: float # longest underwater stretch / n
    std_r: float

    def as_dict(self, prefix: str = "") -> dict:
        return {f"{prefix}{k}": v for k, v in asdict(self).items()}


def equity(r: np.ndarray) -> np.ndarray:
    """Cumulative R equity curve, starting at 0."""
    return np.concatenate([[0.0], np.cumsum(r)])


def max_drawdown(eq: np.ndarray) -> float:
    """Max peak-to-trough drawdown of an equity curve, in R (positive)."""
    peak = np.maximum.accumulate(eq)
    return float(np.max(peak - eq))


def longest_underwater(eq: np.ndarray) -> int:
    """Longest run of trades spent below a prior equity peak."""
    peak = np.maximum.accumulate(eq)
    under = eq < peak
    best = cur = 0
    for u in under:
        cur = cur + 1 if u else 0
        best = max(best, cur)
    return best


def compute(r: np.ndarray) -> Metrics:
    r = np.asarray(r, dtype=float)
    n = len(r)
    if n == 0:
        return Metrics(0, np.nan, 0.0, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan)

    wins = r[r > 0]
    losses = r[r < 0]
    gross_win = float(wins.sum())
    gross_loss = float(-losses.sum())

    eq = equity(r)
    dd = max_drawdown(eq)
    total = float(r.sum())

    return Metrics(
        n=n,
        expectancy=float(r.mean()),
        total_r=total,
        win_rate=float(len(wins) / n),
        profit_factor=(gross_win / gross_loss) if gross_loss > 0 else np.inf,
        max_dd_r=dd,
        recovery_ratio=(total / dd) if dd > 0 else np.inf,
        longest_flat_frac=longest_underwater(eq) / n,
        std_r=float(r.std(ddof=1)) if n > 1 else np.nan,
    )


def bh_distribution(bh_ticks: list[float], spread_ticks: float) -> dict:
    """The §8 diagnostic: box height against the cost of trading it."""
    if not bh_ticks:
        return {}
    a = np.asarray(bh_ticks, dtype=float)
    med = float(np.median(a))
    return {
        "n_boxes": len(a),
        "bh_p05": float(np.percentile(a, 5)),
        "bh_p25": float(np.percentile(a, 25)),
        "bh_median": med,
        "bh_p75": float(np.percentile(a, 75)),
        "bh_p95": float(np.percentile(a, 95)),
        "spread_ticks": spread_ticks,
        # Round-turn cost is ~2x spread (adverse entry + adverse stop exit).
        "bh_over_2x_spread": med / (2.0 * spread_ticks) if spread_ticks > 0 else np.inf,
    }


def to_frame(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(rows)
