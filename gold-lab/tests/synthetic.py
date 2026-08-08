"""Seeded synthetic series for verification tests.

A driftless random walk is a known-answer input: it has no edge by
construction, so any config showing one indicts the engine, not the market.
Seeded so every verification result in the README is reproducible.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

SUB_STEPS = 6  # intra-minute steps used to build each 1m bar's high/low


def random_walk(n_bars: int, seed: int, sigma: float = 0.05,
                start_price: float = 2000.0) -> pd.DataFrame:
    """Driftless 1m OHLC random walk. No drift, no autocorrelation, no edge."""
    rng = np.random.default_rng(seed)
    px = start_price + np.cumsum(rng.normal(0.0, sigma, n_bars * SUB_STEPS))
    px = px.reshape(n_bars, SUB_STEPS)
    idx = pd.date_range("2022-01-03", periods=n_bars, freq="1min", tz="UTC")
    return pd.DataFrame(
        {"open": px[:, 0], "high": px.max(1), "low": px.min(1), "close": px[:, -1]},
        index=idx,
    )


def binomial_two_sided_p(k: int, n: int, p: float = 0.5) -> float:
    """Exact two-sided binomial p-value. Avoids a scipy dependency."""
    from math import comb

    if n == 0:
        return 1.0
    pmf = [comb(n, i) * p**i * (1 - p) ** (n - i) for i in range(n + 1)]
    return float(min(1.0, sum(v for v in pmf if v <= pmf[k] * (1 + 1e-12))))
