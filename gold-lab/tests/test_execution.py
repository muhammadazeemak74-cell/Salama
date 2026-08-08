"""Execution-engine verification on hand-built bars.

These assert that the ENGINE implements the spec + Addendum 01. They say
nothing about whether the strategy has edge — that needs real XAUUSD history.
"""

import numpy as np
import pandas as pd
import pytest

from goldlab.costs import constant_model
from goldlab.strategy import Config, run
from goldlab import metrics, stats

ZERO = constant_model(0.0)          # frictionless, for gross-path assertions
SPREAD20 = constant_model(20.0)     # 20 ticks = 0.20 USD

START = "2024-01-02 09:00"


def bars(rows, freq="1min", start=START):
    idx = pd.date_range(start, periods=len(rows), freq=freq, tz="UTC")
    return pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx)


def explode(rows, per=5, start=START):
    """Expand each (o,h,l,c) into `per` 1m bars tracing an up-then-down path.

    Aggregating the result back up reproduces the original OHLC exactly, so a
    test can control the intrabar sequence a higher timeframe cannot see.
    """
    out = []
    for o, h, l, c in rows:
        path = [(o, o, o, o), (o, h, o, h), (h, h, l, l), (l, c, l, c)]
        path += [(c, c, c, c)] * (per - len(path))
        out.extend(path[:per])
    return bars(out, freq="1min", start=start)


# Three green bars: box = [102.0, 99.5], BH = 2.5, triggers 102.01 / 99.49
GREEN3 = [
    (100.0, 101.0, 99.5, 100.8),
    (100.8, 101.5, 100.5, 101.2),
    (101.2, 102.0, 101.0, 101.8),
]
RED3 = [
    (101.8, 102.0, 101.0, 101.2),
    (101.2, 101.5, 100.5, 100.8),
    (100.8, 101.0, 99.5, 100.0),
]

CFG = Config("green", "1m", n_expiry=3, stop="S1", target_k=1.0)


# --- core execution -------------------------------------------------------

def test_box_and_long_target():
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 102.2, 104.8),
    ])
    trades, diag = run(b, CFG, ZERO)
    assert diag["signals"] == 1 and diag["fills"] == 1
    t = trades[0]
    assert t.side == 1
    assert (t.box_high, t.box_low) == (102.0, 99.5)
    assert t.bh == pytest.approx(2.5)
    assert t.entry_raw == pytest.approx(102.01)
    assert t.risk == pytest.approx(2.51)
    assert t.exit_reason == "target"
    assert t.gross_r == pytest.approx(1.0, abs=1e-9)


def test_short_leg_fills_and_stops_out():
    b = bars(GREEN3 + [
        (101.0, 101.2, 99.0, 99.2),
        (99.2, 102.5, 99.1, 102.4),
    ])
    t = run(b, CFG, ZERO)[0][0]
    assert t.side == -1
    assert t.entry_raw == pytest.approx(99.49)
    assert t.exit_reason == "stop"
    assert t.gross_r == pytest.approx(-1.0, abs=1e-9)


def test_no_fill_expires_after_n_bars():
    trades, diag = run(bars(GREEN3 + [(101.8, 101.9, 101.5, 101.6)] * 5), CFG, ZERO)
    assert diag["fills"] == 0 and diag["expired"] == 1 and trades == []


def test_s2_stop_is_half_box_height():
    cfg = Config("green", "1m", n_expiry=3, stop="S2", target_k=1.0)
    b = bars(GREEN3 + [(101.8, 102.5, 101.7, 102.3), (102.3, 105.0, 102.2, 104.8)])
    assert run(b, cfg, ZERO)[0][0].risk == pytest.approx(1.25)


def test_target_k_scales_risk():
    b = bars(GREEN3 + [(101.8, 102.5, 101.7, 102.3), (102.3, 110.0, 102.2, 109.0)])
    for k in (1.0, 1.5, 2.0):
        t = run(b, Config("green", "1m", 3, "S1", k), ZERO)[0][0]
        assert t.exit_reason == "target"
        assert t.gross_r == pytest.approx(k, abs=1e-9)


def test_red_polarity_mirrors():
    b = bars(RED3 + [(100.0, 102.5, 99.9, 102.4), (102.4, 105.0, 102.3, 104.9)])
    trades, diag = run(b, Config("red", "1m", 3, "S1", 1.0), ZERO)
    assert diag["signals"] == 1 and trades[0].side == 1
    assert run(b, CFG, ZERO)[1]["signals"] == 0


def test_one_position_at_a_time():
    seq = [(101.8, 102.5, 101.7, 102.3), (102.3, 105.0, 102.2, 104.8)]
    trades, _ = run(bars(GREEN3 + seq + GREEN3 + seq), CFG, ZERO)
    for a, c in zip(trades, trades[1:]):
        assert a.exit_time < c.entry_time


def test_grid_is_exactly_90_configs():
    from goldlab.strategy import grid
    g = list(grid("green"))
    assert len(g) == 90 and len({c.key for c in g}) == 90


# --- Addendum 01 §1: pessimistic 1m resolution ----------------------------

def test_stop_and_target_same_bar_resolves_to_stop():
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 99.0, 100.0),   # spans both 99.5 stop and 104.52 target
    ])
    t = run(b, CFG, ZERO)[0][0]
    assert t.ambiguous_exit is True
    assert t.exit_reason == "stop"
    assert t.gross_r < 0


def test_both_legs_touched_takes_the_losing_leg():
    # Bar 3 gaps above the buy trigger AND trades below the sell trigger.
    # Long fills gapped at 103.50 and stops at 99.50  -> -1.59R
    # Short fills at 99.49 and stops at 102.00        -> -1.00R
    # Pessimistic must take the long; optimistic the short.
    b = bars(GREEN3 + [
        (103.5, 104.0, 99.0, 103.8),
        (103.8, 104.0, 103.7, 103.9),
    ])
    pess = run(b, CFG, ZERO, resolution="pessimistic")[0][0]
    opt = run(b, CFG, ZERO, resolution="optimistic")[0][0]

    assert pess.ambiguous_entry and opt.ambiguous_entry
    assert pess.side == 1 and pess.gross_r == pytest.approx((99.5 - 103.5) / 2.51)
    assert opt.side == -1 and opt.gross_r == pytest.approx(-1.0)
    assert pess.net_r < opt.net_r          # pessimistic is strictly worse


def test_optimistic_flips_the_stop_target_tie():
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 99.0, 100.0),
    ])
    assert run(b, CFG, ZERO, resolution="pessimistic")[0][0].exit_reason == "stop"
    assert run(b, CFG, ZERO, resolution="optimistic")[0][0].exit_reason == "target"


def test_assumption_accounting_and_flag():
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 99.0, 100.0),
    ])
    _, diag = run(b, CFG, ZERO)
    assert diag["ambiguous_exit"] == 1
    assert diag["assumption_resolved"] == 1
    assert diag["assumption_frac"] == pytest.approx(1.0)
    assert diag["assumption_dependent"] is True
    assert diag["observed_resolution"] is False   # 1m has no finer series


def test_clean_config_is_not_flagged():
    b = bars(GREEN3 + [(101.8, 102.5, 101.7, 102.3), (102.3, 105.0, 102.2, 104.8)])
    _, diag = run(b, CFG, ZERO)
    assert diag["assumption_resolved"] == 0
    assert diag["assumption_dependent"] is False


# --- Addendum 01 §1: sub-resolution above 1m ------------------------------

def test_higher_tf_resolves_sequence_against_1m_base():
    # The 5m action bar touches BOTH triggers, so at 5m it is ambiguous.
    # Its 1m path goes up first, so the BUY leg is observed to fill first.
    base = explode(GREEN3 + [(101.0, 104.0, 99.0, 100.0), (100.0, 100.5, 99.8, 100.2)])
    from goldlab.data import resample
    tf = resample(base, "5m")
    cfg = Config("green", "5m", n_expiry=3, stop="S1", target_k=1.0)

    assumed, d_assumed = run(tf, cfg, ZERO)                    # no base series
    observed, d_obs = run(tf, cfg, ZERO, base_bars=base)       # with base series

    assert d_assumed["observed_resolution"] is False
    assert assumed[0].ambiguous_entry is True

    assert d_obs["observed_resolution"] is True
    assert observed[0].ambiguous_entry is False
    assert observed[0].side == 1
    assert d_obs["assumption_resolved"] == 0


def test_one_minute_ignores_base_series():
    # There is no sub-resolution at 1m even if a base is handed in.
    b = bars(GREEN3 + [(103.5, 104.0, 99.0, 103.8), (103.8, 104.0, 103.7, 103.9)])
    _, diag = run(b, CFG, ZERO, base_bars=b)
    assert diag["observed_resolution"] is False


# --- Addendum 01 §4: gaps -------------------------------------------------

def test_gap_through_entry_trigger_fills_at_open():
    b = bars(GREEN3 + [(103.0, 103.5, 102.9, 103.4), (103.4, 106.0, 103.3, 105.9)])
    t = run(b, CFG, ZERO)[0][0]
    assert t.entry_raw == pytest.approx(103.0)
    assert t.gapped_entry is True


def test_gap_through_stop_fills_at_open_not_the_stop():
    # Long entered at 102.01, stop 99.50. Next bar opens at 95.00.
    b = bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (95.0, 95.2, 94.0, 94.5),
    ])
    t = run(b, CFG, ZERO)[0][0]
    assert t.exit_reason == "stop"
    assert t.gapped_exit is True
    assert t.exit_raw == pytest.approx(95.0)          # not 99.50
    assert t.gross_r == pytest.approx((95.0 - 102.01) / 2.51)
    assert t.gross_r < -2.0                            # full adverse excursion


def test_weekend_gap_does_not_produce_a_free_fill():
    # A Friday close -> Monday open gap must be taken at the gapped open, and
    # the modelled spread applied on top of it, not instead of it.
    idx = list(pd.date_range("2024-01-05 20:55", periods=4, freq="1min", tz="UTC"))
    idx.append(pd.Timestamp("2024-01-07 22:00", tz="UTC"))
    rows = GREEN3 + [(101.8, 102.5, 101.7, 102.3), (95.0, 95.2, 94.0, 94.5)]
    b = pd.DataFrame(rows, columns=["open", "high", "low", "close"],
                     index=pd.DatetimeIndex(idx))
    t = run(b, CFG, SPREAD20)[0][0]
    assert t.exit_raw == pytest.approx(95.0)
    assert t.exit_net == pytest.approx(95.0 - 0.20)   # spread on top of the gap
    assert t.net_r < t.gross_r


# --- costs ----------------------------------------------------------------

def test_costs_strictly_reduce_net_r():
    b = bars(GREEN3 + [(101.8, 102.5, 101.7, 102.3), (102.3, 105.0, 102.2, 104.8)])
    free = run(b, CFG, ZERO)[0][0]
    cost = run(b, CFG, SPREAD20)[0][0]
    assert cost.gross_r == pytest.approx(free.gross_r)
    assert cost.net_r == pytest.approx(1.0 - 0.20 / 2.51, abs=1e-9)


def test_stop_exit_pays_spread_on_both_ends():
    b = bars(GREEN3 + [(101.8, 102.5, 101.7, 102.3), (102.3, 102.4, 99.0, 99.1)])
    t = run(b, CFG, SPREAD20)[0][0]
    assert t.exit_reason == "stop"
    assert t.net_r == pytest.approx(-1.0 - 0.40 / 2.51, abs=1e-9)


# --- metrics / stats ------------------------------------------------------

def test_metrics_on_known_series():
    m = metrics.compute(np.array([1.0, -1.0, 1.0, -1.0, 1.0]))
    assert m.n == 5
    assert m.expectancy == pytest.approx(0.2)
    assert m.profit_factor == pytest.approx(1.5)
    assert m.max_dd_r == pytest.approx(1.0)


def test_bootstrap_does_not_flag_pure_noise():
    rng = np.random.default_rng(7)
    res = stats.test_mean_positive(rng.normal(0, 1, 500), n_resamples=2000)
    assert res.p_value > 0.01 and not res.passes_primary


def test_bootstrap_detects_a_real_strong_edge():
    rng = np.random.default_rng(7)
    res = stats.test_mean_positive(rng.normal(0.5, 1, 500), n_resamples=2000)
    assert res.p_value < stats.BONFERRONI_PRIMARY and res.passes_primary


def test_bonferroni_thresholds_match_preregistration():
    assert stats.BONFERRONI_PRIMARY == pytest.approx(0.05 / 90)
    assert stats.BONFERRONI_BOTH == pytest.approx(0.05 / 180)


def test_same_bar_entry_and_stop_ignores_the_bar_open():
    # The sell leg fills at 99.49 partway through a bar that OPENED at 103.50,
    # above the short's 102.00 stop. The open predates the position, so it
    # cannot gap it: the stop must fill at 102.00, not at 103.50.
    b = bars(GREEN3 + [
        (103.5, 104.0, 99.0, 103.8),
        (103.8, 104.0, 103.7, 103.9),
    ])
    short = run(b, CFG, ZERO, resolution="optimistic")[0][0]
    assert short.side == -1
    assert short.entry_raw == pytest.approx(99.49)
    assert short.exit_raw == pytest.approx(102.0)
    assert short.gapped_exit is False
    assert short.gross_r == pytest.approx(-1.0)
