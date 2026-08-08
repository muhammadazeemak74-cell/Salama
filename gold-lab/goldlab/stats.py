"""Studentized stationary bootstrap, per §5 of the pre-registration.

H0: mean net R per trade <= 0, tested one-sided. A plain t-test is not used:
stop/target returns are bimodal and adjacent trades share regime, so both the
normality and the independence assumptions fail. The stationary bootstrap
(Politis & Romano 1994) resamples geometric-length blocks, preserving short-run
dependence; block length comes from the Politis & White (2004) automatic rule.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# Bonferroni thresholds frozen in the pre-registration (family-wise alpha 0.05).
ALPHA = 0.05
GRID_SIZE_PER_POLARITY = 90
GRID_SIZE_BOTH = 180
BONFERRONI_PRIMARY = ALPHA / GRID_SIZE_PER_POLARITY   # 5.56e-4
BONFERRONI_BOTH = ALPHA / GRID_SIZE_BOTH              # 2.78e-4


def _flat_top(t: np.ndarray) -> np.ndarray:
    """Politis-White flat-top lag window."""
    a = np.abs(t)
    return np.where(a <= 0.5, 1.0, np.where(a <= 1.0, 2.0 * (1.0 - a), 0.0))


def politis_white_block_length(x: np.ndarray) -> float:
    """Automatic block length for the stationary bootstrap."""
    x = np.asarray(x, dtype=float)
    n = len(x)
    if n < 16:
        return 1.0

    xc = x - x.mean()
    denom = float(np.dot(xc, xc))
    if denom <= 0:
        return 1.0

    k_max = max(5, int(np.ceil(np.sqrt(np.log10(n)))))
    m_max = int(np.ceil(np.sqrt(n))) + k_max
    m_max = min(m_max, n - 1)

    acf = np.array([np.dot(xc[: n - k], xc[k:]) / denom for k in range(m_max + 1)])

    # Smallest m past which the next k_max autocorrelations are all negligible.
    crit = 2.0 * np.sqrt(np.log10(n) / n)
    m = 0
    for cand in range(1, m_max - k_max + 1):
        window = acf[cand : cand + k_max]
        if np.all(np.abs(window) < crit):
            m = cand
            break
    else:
        m = m_max - k_max if m_max > k_max else 1

    M = min(max(2 * m, 2), m_max)
    lags = np.arange(-M, M + 1)
    w = _flat_top(lags / M)
    var = denom / n
    R = np.array([acf[abs(k)] * var for k in lags])

    G = float(np.sum(w * np.abs(lags) * R))
    D = 2.0 * float(np.sum(w * R)) ** 2
    if D <= 0 or G == 0:
        return 1.0

    b = ((2.0 * G**2) / D) ** (1.0 / 3.0) * n ** (1.0 / 3.0)
    return float(np.clip(b, 1.0, max(1.0, n / 4.0)))


@dataclass
class BootstrapResult:
    mean: float
    t_stat: float
    p_value: float
    block_length: float
    n_resamples: int
    passes_primary: bool
    passes_both: bool

    def describe(self) -> str:
        return (
            f"mean={self.mean:+.4f}R  t={self.t_stat:.3f}  p={self.p_value:.3g}  "
            f"(Bonferroni 90: {BONFERRONI_PRIMARY:.3g} -> "
            f"{'PASS' if self.passes_primary else 'FAIL'}; "
            f"180: {BONFERRONI_BOTH:.3g} -> "
            f"{'PASS' if self.passes_both else 'FAIL'})  "
            f"block={self.block_length:.2f}"
        )


def stationary_bootstrap_indices(n: int, block_length: float, rng) -> np.ndarray:
    """One resample of length n via geometric-length wrapped blocks."""
    p = 1.0 / max(block_length, 1.0)
    idx = np.empty(n, dtype=np.int64)
    cur = rng.integers(0, n)
    for t in range(n):
        if t > 0 and rng.random() < p:
            cur = rng.integers(0, n)
        else:
            cur = cur if t == 0 else (cur + 1) % n
        idx[t] = cur
    return idx


def test_mean_positive(
    r: np.ndarray, n_resamples: int = 10_000, seed: int = 20260808
) -> BootstrapResult:
    """One-sided studentized stationary bootstrap of H0: mean <= 0."""
    r = np.asarray(r, dtype=float)
    n = len(r)
    if n < 2:
        return BootstrapResult(np.nan, np.nan, 1.0, 1.0, 0, False, False)

    mean = float(r.mean())
    se = float(r.std(ddof=1) / np.sqrt(n))
    if se <= 0:
        return BootstrapResult(mean, np.inf if mean > 0 else 0.0, 0.0 if mean > 0 else 1.0,
                               1.0, 0, mean > 0, mean > 0)

    t_obs = mean / se
    b = politis_white_block_length(r)
    rng = np.random.default_rng(seed)

    count = 0
    for _ in range(n_resamples):
        s = r[stationary_bootstrap_indices(n, b, rng)]
        s_se = s.std(ddof=1) / np.sqrt(n)
        if s_se <= 0:
            continue
        # Centre on the observed mean to build the null distribution.
        if (s.mean() - mean) / s_se >= t_obs:
            count += 1

    p = (count + 1) / (n_resamples + 1)
    return BootstrapResult(
        mean=mean,
        t_stat=t_obs,
        p_value=p,
        block_length=b,
        n_resamples=n_resamples,
        passes_primary=p < BONFERRONI_PRIMARY,
        passes_both=p < BONFERRONI_BOTH,
    )


def benjamini_hochberg(pvals: np.ndarray, alpha: float = ALPHA) -> np.ndarray:
    """FDR control. Pre-declared NON-BINDING: reported for information only,
    and explicitly cannot convert a REJECT into an ACCEPT."""
    p = np.asarray(pvals, dtype=float)
    m = len(p)
    order = np.argsort(p)
    thresh = alpha * (np.arange(1, m + 1) / m)
    passed = p[order] <= thresh
    out = np.zeros(m, dtype=bool)
    if passed.any():
        cutoff = np.max(np.where(passed)[0])
        out[order[: cutoff + 1]] = True
    return out
