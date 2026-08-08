"""Matched-geometry null (ACCEPTANCE_CRITERIA.md Amendment 1).

These test the machinery only. The null itself is pre-registered to run on the
REAL series; running it on synthetic data is not a substitute and nothing here
is reported as a result.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from goldlab import nullmodel
from goldlab.data import resample as tf_resample
from goldlab.strategy import Config, run
from goldlab.costs import constant_model

from .synthetic import random_walk


@pytest.fixture(scope="module")
def bars():
    return random_walk(6_000, 31337)


def test_geometry_round_trips_exactly(bars):
    """Reducing to deltas and rebuilding in original order returns the bars."""
    g = nullmodel.bar_geometry(bars)
    close = g.first_open + np.cumsum(g.gap + g.ch)
    open_ = close - g.ch
    assert np.allclose(open_, bars["open"].to_numpy())
    assert np.allclose(close, bars["close"].to_numpy())
    assert np.allclose(open_ + g.up, bars["high"].to_numpy())
    assert np.allclose(open_ - g.dn, bars["low"].to_numpy())


def test_resample_preserves_every_bar_shape(bars):
    """Each resampled bar must be some real bar's exact shape.

    This is what "matched geometry" means: bar range, body and gap all travel
    together, so the box-height distribution the strategy sees is the real one.
    """
    g = nullmodel.bar_geometry(bars)
    rb = nullmodel.resample_bars(g, 20.0, np.random.default_rng(1))

    assert len(rb) == len(bars)
    assert rb.index.equals(bars.index)          # timestamps reused -> same sessions

    orig = {(round(u, 9), round(c, 9), round(d, 9))
            for u, c, d in zip(g.up, g.ch, g.dn)}
    got = zip(rb["high"] - rb["open"], rb["close"] - rb["open"],
              rb["open"] - rb["low"])
    for u, c, d in got:
        assert (round(u, 9), round(c, 9), round(d, 9)) in orig


def test_resample_yields_valid_ohlc(bars):
    g = nullmodel.bar_geometry(bars)
    rb = nullmodel.resample_bars(g, 20.0, np.random.default_rng(2))
    assert (rb["high"] >= rb[["open", "close"]].max(axis=1) - 1e-12).all()
    assert (rb["low"] <= rb[["open", "close"]].min(axis=1) + 1e-12).all()
    assert (rb["high"] >= rb["low"]).all()


def test_resample_preserves_the_box_height_distribution(bars):
    """The quantity the artifact scales with must survive resampling."""
    g = nullmodel.bar_geometry(bars)
    rb = nullmodel.resample_bars(g, 20.0, np.random.default_rng(3))
    costs = constant_model(0.0)
    cfg = Config("green", "5m", 5, "S1", 1.0)

    a = np.array(run(tf_resample(bars, "5m"), cfg, costs, base_bars=bars)[1]["bh_ticks"])
    b = np.array(run(tf_resample(rb, "5m"), cfg, costs, base_bars=rb)[1]["bh_ticks"])
    assert len(a) > 50 and len(b) > 50
    for q in (25, 50, 75):
        pa, pb = np.percentile(a, q), np.percentile(b, q)
        assert abs(pb - pa) / pa < 0.25, f"p{q} box height moved {pa:.1f} -> {pb:.1f}"


def test_resample_is_deterministic_for_a_seed(bars):
    g = nullmodel.bar_geometry(bars)
    x = nullmodel.resample_bars(g, 15.0, np.random.default_rng(7))
    y = nullmodel.resample_bars(g, 15.0, np.random.default_rng(7))
    assert x.equals(y)


def test_block_length_reuses_the_preregistered_selector(bars):
    """No second, tunable knob — same Politis-White rule as the test statistic."""
    from goldlab.stats import politis_white_block_length
    expected = politis_white_block_length(np.diff(bars["close"].to_numpy()))
    assert nullmodel.block_length_for(bars) == expected
    assert nullmodel.block_length_for(bars) >= 1.0


def test_summarise_math_and_pass_rule():
    null = [0.0] * 97 + [1.0] * 3          # p97.5 sits at the top of the mass
    r = nullmodel.summarise(observed=0.5, null_values=null, block_length=12.0)
    assert r.n_valid == 100
    assert r.excess == pytest.approx(r.observed - r.p975)
    assert r.as_dict()["null_passes"] is (r.excess > 0)

    # A positive raw expectancy that fails its null must NOT pass.
    weak = nullmodel.summarise(0.05, [0.10] * 100, 12.0)
    assert weak.observed > 0 and weak.excess < 0
    assert weak.as_dict()["null_passes"] is False

    # A negative raw expectancy CAN clear a more negative null — intended.
    strong = nullmodel.summarise(-0.05, [-0.30] * 100, 12.0)
    assert strong.observed < 0 and strong.excess > 0
    assert strong.as_dict()["null_passes"] is True


def test_nan_null_values_are_dropped_not_counted():
    r = nullmodel.summarise(0.1, [np.nan, 0.0, 0.0, np.nan], 5.0)
    assert r.n_valid == 2 and r.n_resamples == 4


def test_preregistered_minimum_resamples():
    assert nullmodel.MIN_RESAMPLES == 200
    assert nullmodel.NULL_PERCENTILE == 97.5


def test_nomination_requires_clearing_the_null_not_merely_zero():
    """Criterion 1 amended: raw sign is not sufficient and not necessary."""
    import run_three_breakout as R

    base = {
        "polarity": "green", "net_n": 500, "passes_bonferroni_90": True,
        "net_profit_factor": 1.5, "net_recovery_ratio": 3.0,
        "net_longest_flat_frac": 0.1, "net_p_value": 1e-6,
    }
    df = pd.DataFrame([
        {**base, "config": "positive-but-fails-null",
         "net_expectancy": 0.05, "null_excess": -0.01},
        {**base, "config": "negative-but-clears-null",
         "net_expectancy": -0.02, "null_excess": 0.03, "net_p_value": 1e-5},
    ])
    nom = R.nominate(df)
    assert nom is not None
    assert nom["config"] == "negative-but-clears-null"

    only_failing = df.iloc[[0]]
    assert R.nominate(only_failing) is None
