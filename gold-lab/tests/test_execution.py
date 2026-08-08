"""Execution-engine verification on hand-built bars.

These assert that the ENGINE implements the spec. They say nothing about
whether the strategy has edge — that needs real XAUUSD history.
"""

import numpy as np
import pandas as pd
import pytest

from goldlab.costs import CostModel, constant_model
from goldlab.strategy import Config, run
from goldlab import metrics, stats

ZERO = constant_model(0.0)          # frictionless, for gross-path assertions
SPREAD20 = constant_model(20.0)     # 20 ticks = 0.20 USD


def bars(rows):
    """rows: list of (o, h, l, c) starting 2024-01-02 09:00 UTC, 1-minute."""
    idx = pd.date_range("2024-01-02 09:00", periods=len(rows), freq="1min", tz="UTC")
    return pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx)


# Three green bars: box = [102.0, 99.5], BH = 2.5
GREEN3 = [
    (100.0, 101.0, 99.5, 100.8),
    (100.8, 101.5, 100.5, 101.2),
    (101.2, 102.0, 101.0, 101.8),
]
# Three red bars: box = [102.0, 99.5], BH = 2.5
RED3 = [
    (101.8, 102.0, 101.0, 101.2),
    (101.2, 101.5, 100.5, 100.8),
    (100.8, 101.0, 99.5, 100.0),
]

CFG = Config("green", "1m", n_expiry=3, stop="S1", target_k=1.0)


def test_box_and_long_target():
    # Fill at 102.01, S1 stop 99.5 -> risk 2.51, target 104.52.
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),   # fills the BUY leg
        (102.3, 105.0, 102.2, 104.8),   # hits target
    ])
    trades, diag = run(b, CFG, ZERO)
    assert diag["signals"] == 1 and diag["fills"] == 1
    t = trades[0]
    assert t.side == 1
    assert t.box_high == pytest.approx(102.0)
    assert t.box_low == pytest.approx(99.5)
    assert t.bh == pytest.approx(2.5)
    assert t.entry_raw == pytest.approx(102.01)
    assert t.risk == pytest.approx(2.51)
    assert t.exit_reason == "target"
    assert t.gross_r == pytest.approx(1.0, abs=1e-9)


def test_short_leg_fills_and_stops_out():
    # SELL trigger 99.49; S1 stop for a short is box_high 102.0.
    b = bars(GREEN3 + [
        (101.0, 101.2, 99.0, 99.2),     # fills the SELL leg at 99.49
        (99.2, 102.5, 99.1, 102.4),     # stop at 102.0
    ])
    trades, _ = run(b, CFG, ZERO)
    t = trades[0]
    assert t.side == -1
    assert t.entry_raw == pytest.approx(99.49)
    assert t.risk == pytest.approx(102.0 - 99.49)
    assert t.exit_reason == "stop"
    assert t.gross_r == pytest.approx(-1.0, abs=1e-9)


def test_no_fill_expires_after_n_bars():
    quiet = [(101.8, 101.9, 101.5, 101.6)] * 5
    trades, diag = run(b_ := bars(GREEN3 + quiet), CFG, ZERO)
    assert diag["signals"] >= 1
    assert diag["fills"] == 0
    assert diag["expired"] == 1
    assert trades == []


def test_stop_and_target_same_bar_resolves_adversely():
    # Bar 4 spans both 99.5 (stop) and 104.52 (target) -> stop must win.
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 99.0, 100.0),
    ])
    trades, _ = run(b, CFG, ZERO)
    t = trades[0]
    assert t.ambiguous_exit is True
    assert t.exit_reason == "stop"
    assert t.gross_r < 0


def test_both_legs_triggerable_uses_bar_direction():
    # Bar 4 reaches both triggers. Bar is bullish -> assumed down-then-up,
    # so the SELL leg is the one that fills.
    b = bars(GREEN3 + [
        (101.5, 103.0, 99.0, 102.9),
        (102.9, 103.0, 102.8, 102.9),
    ])
    trades, diag = run(b, CFG, ZERO)
    assert diag["ambiguous_entry"] == 1
    assert trades[0].side == -1


def test_gap_through_trigger_fills_at_open():
    # Bar 4 opens at 103.0, above the 102.01 BUY trigger.
    b = bars(GREEN3 + [
        (103.0, 103.5, 102.9, 103.4),
        (103.4, 106.0, 103.3, 105.9),
    ])
    trades, _ = run(b, CFG, ZERO)
    assert trades[0].entry_raw == pytest.approx(103.0)


def test_s2_stop_is_half_box_height():
    cfg = Config("green", "1m", n_expiry=3, stop="S2", target_k=1.0)
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 102.2, 104.8),
    ])
    trades, _ = run(b, cfg, ZERO)
    # 0.5 * BH = 1.25 from the 102.01 trigger.
    assert trades[0].risk == pytest.approx(1.25)


def test_target_k_scales_risk():
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 110.0, 102.2, 109.0),
    ])
    for k in (1.0, 1.5, 2.0):
        cfg = Config("green", "1m", n_expiry=3, stop="S1", target_k=k)
        t = run(b, cfg, ZERO)[0][0]
        assert t.exit_reason == "target"
        assert t.gross_r == pytest.approx(k, abs=1e-9)


def test_red_polarity_mirrors():
    cfg = Config("red", "1m", n_expiry=3, stop="S1", target_k=1.0)
    b = bars(RED3 + [
        (100.0, 102.5, 99.9, 102.4),
        (102.4, 105.0, 102.3, 104.9),
    ])
    trades, diag = run(b, cfg, ZERO)
    assert diag["signals"] == 1
    assert trades[0].side == 1
    # A green pattern must not fire on red bars.
    assert run(b, CFG, ZERO)[1]["signals"] == 0


def test_costs_strictly_reduce_net_r():
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 102.2, 104.8),
    ])
    t_free = run(b, CFG, ZERO)[0][0]
    t_cost = run(b, CFG, SPREAD20)[0][0]
    assert t_cost.gross_r == pytest.approx(t_free.gross_r)
    assert t_cost.net_r < t_cost.gross_r
    # 20 ticks adverse on entry, over a 2.51 risk unit.
    assert t_cost.net_r == pytest.approx(1.0 - 0.20 / 2.51, abs=1e-9)


def test_stop_exit_pays_spread_on_both_ends():
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 102.4, 99.0, 99.1),
    ])
    t = run(b, CFG, SPREAD20)[0][0]
    assert t.exit_reason == "stop"
    # Adverse on entry AND on the stop exit: 2 x 0.20 over 2.51 risk.
    assert t.net_r == pytest.approx(-1.0 - 0.40 / 2.51, abs=1e-9)


def test_one_position_at_a_time():
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 102.2, 104.8),
    ] + GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 102.2, 104.8),
    ])
    trades, _ = run(b, CFG, ZERO)
    for a, c in zip(trades, trades[1:]):
        assert a.exit_time < c.entry_time


def test_grid_is_exactly_90_configs():
    from goldlab.strategy import grid
    g = list(grid("green"))
    assert len(g) == 90
    assert len({c.key for c in g}) == 90


# --- metrics / stats ---

def test_metrics_on_known_series():
    r = np.array([1.0, -1.0, 1.0, -1.0, 1.0])
    m = metrics.compute(r)
    assert m.n == 5
    assert m.expectancy == pytest.approx(0.2)
    assert m.total_r == pytest.approx(1.0)
    assert m.profit_factor == pytest.approx(3.0 / 2.0)
    assert m.win_rate == pytest.approx(0.6)
    assert m.max_dd_r == pytest.approx(1.0)


def test_bootstrap_does_not_flag_pure_noise():
    rng = np.random.default_rng(7)
    res = stats.test_mean_positive(rng.normal(0, 1, 500), n_resamples=2000)
    assert res.p_value > 0.01
    assert not res.passes_primary


def test_bootstrap_detects_a_real_strong_edge():
    rng = np.random.default_rng(7)
    res = stats.test_mean_positive(rng.normal(0.5, 1, 500), n_resamples=2000)
    assert res.p_value < stats.BONFERRONI_PRIMARY
    assert res.passes_primary


def test_bonferroni_thresholds_match_preregistration():
    assert stats.BONFERRONI_PRIMARY == pytest.approx(0.05 / 90)
    assert stats.BONFERRONI_BOTH == pytest.approx(0.05 / 180)
