"""Matched-geometry null baseline (ACCEPTANCE_CRITERIA.md Amendment 1).

">0 net expectancy" is the wrong hurdle when a residual execution artifact
scales with bar geometry: the artifact rides on bar range and box height, so a
config can clear zero on artifact alone. The fix is to measure the hurdle
rather than assume it — build a series with the SAME geometry as the real one
but no serial structure, run the identical engine and cost model over it, and
require the real result to beat its own null.

Construction. Each bar is reduced to four geometry deltas:

    gap = open_t  - close_{t-1}      up = high_t - open_t
    ch  = close_t - open_t           dn = open_t  - low_t

Blocks of bars are drawn with the stationary bootstrap (Politis-Romano, block
length by Politis-White) and re-chained into a new price path. Because the
whole (gap, up, ch, dn) tuple travels together, every bar in a resample is a
real bar's exact shape — bar range, body, gap and therefore the box-height
distribution are preserved, as is volatility clustering within a block. What is
destroyed is serial structure across blocks, which is the only thing a genuine
edge could live in.

Original timestamps are reused, so the session-varying spread lands on the same
hours and the cost model is identical to the live run.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .stats import politis_white_block_length, stationary_bootstrap_indices

MIN_RESAMPLES = 200
NULL_PERCENTILE = 97.5


@dataclass
class Geometry:
    gap: np.ndarray
    up: np.ndarray
    ch: np.ndarray
    dn: np.ndarray
    first_open: float
    index: pd.DatetimeIndex

    def __len__(self) -> int:
        return len(self.ch)


def bar_geometry(bars: pd.DataFrame) -> Geometry:
    """Reduce bars to the four shape deltas the resampler re-chains."""
    o = bars["open"].to_numpy(float)
    h = bars["high"].to_numpy(float)
    l = bars["low"].to_numpy(float)
    c = bars["close"].to_numpy(float)

    gap = np.empty_like(o)
    gap[0] = 0.0
    gap[1:] = o[1:] - c[:-1]

    # Anchor on the FIRST OPEN: the chain is close_t = open_0 + cumsum(gap+ch)
    # with gap_0 == 0, so close_0 == open_0 + ch_0 == close_0.
    return Geometry(gap=gap, up=h - o, ch=c - o, dn=o - l,
                    first_open=float(o[0]), index=bars.index)


def block_length_for(bars: pd.DataFrame) -> float:
    """Politis-White block length on close-to-close returns.

    Same selector already pre-registered for the test statistic in stats.py —
    reused here rather than introducing a second, tunable knob.
    """
    c = bars["close"].to_numpy(float)
    return politis_white_block_length(np.diff(c))


def resample_bars(geom: Geometry, block_length: float, rng) -> pd.DataFrame:
    """One matched-geometry resample. Same length, same timestamps."""
    n = len(geom)
    idx = stationary_bootstrap_indices(n, block_length, rng)

    gap, up, ch, dn = geom.gap[idx].copy(), geom.up[idx], geom.ch[idx], geom.dn[idx]
    gap[0] = 0.0          # the resampled path starts at the real first open

    # close_t = close_{t-1} + gap_t + ch_t, so the path is a cumulative sum.
    close = geom.first_open + np.cumsum(gap + ch)
    open_ = close - ch
    return pd.DataFrame(
        {"open": open_, "high": open_ + up, "low": open_ - dn, "close": close},
        index=geom.index,
    )


@dataclass
class NullResult:
    n_resamples: int
    block_length: float
    mean: float
    p975: float
    observed: float
    excess: float          # observed - p975; must be > 0 to pass
    n_valid: int

    def as_dict(self, prefix: str = "null_") -> dict:
        return {
            f"{prefix}resamples": self.n_resamples,
            f"{prefix}block_length": self.block_length,
            f"{prefix}mean": self.mean,
            f"{prefix}p975": self.p975,
            f"{prefix}excess": self.excess,
            f"{prefix}n_valid": self.n_valid,
            f"{prefix}passes": bool(self.excess > 0),
        }


def summarise(observed: float, null_values: list[float], block_length: float) -> NullResult:
    """Turn a null sample into the reported hurdle."""
    a = np.asarray([v for v in null_values if np.isfinite(v)], dtype=float)
    if a.size == 0:
        return NullResult(0, block_length, np.nan, np.nan, observed, np.nan, 0)
    p975 = float(np.percentile(a, NULL_PERCENTILE))
    return NullResult(
        n_resamples=len(null_values),
        block_length=block_length,
        mean=float(a.mean()),
        p975=p975,
        observed=observed,
        excess=observed - p975,
        n_valid=int(a.size),
    )
