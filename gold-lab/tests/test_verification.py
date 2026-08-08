"""Verification pass — golden master, lookahead sentinel, plumbing assertions.

These are guards, not features. They exist so that a future refactor cannot
silently change execution behaviour, and so the engine's freedom from
lookahead is a checked property rather than a remembered one.
"""

from __future__ import annotations

import numpy as np
import pytest

from goldlab import data as gdata
from goldlab import metrics
from goldlab.costs import CostModel, constant_model
from goldlab.strategy import Config, grid, run

from .synthetic import binomial_two_sided_p, random_walk

# Sized so the full 180-config grid runs twice in a few seconds.
GM_BARS = 40_000
GM_SEED = 20260808

# Fields that must match exactly, per trade. Aggregates are not enough:
# offsetting errors cancel in a mean and would pass an aggregate check.
EXACT_FIELDS = ("entry_time", "entry_raw", "exit_time", "exit_raw",
                "exit_reason", "net_r")


def _grid_trades(base, tf_bars, costs, search):
    out = {}
    for polarity in ("green", "red"):
        for cfg in grid(polarity):
            trades, diag = run(tf_bars[cfg.timeframe], cfg, costs,
                               base_bars=base, search=search)
            out[cfg.key] = (trades, diag)
    return out


@pytest.fixture(scope="module")
def gm_case():
    base = random_walk(GM_BARS, GM_SEED)
    costs = CostModel()
    tf_bars = {tf: gdata.resample(base, tf) for tf in gdata.TIMEFRAMES}
    return base, costs, tf_bars


# --- 1. golden-master equivalence -----------------------------------------

def test_vectorized_search_matches_reference(gm_case):
    """The fast level search must reproduce the naive loop trade-for-trade.

    Guards future perf work: if these diverge, the VECTORIZED path is wrong
    until proven otherwise. Never adjust the reference to match it.
    """
    base, costs, tf_bars = gm_case
    fast = _grid_trades(base, tf_bars, costs, "vectorized")
    ref = _grid_trades(base, tf_bars, costs, "reference")

    assert set(fast) == set(ref) and len(fast) == 180

    total = 0
    for key in sorted(fast):
        f_trades, f_diag = fast[key]
        r_trades, r_diag = ref[key]
        assert len(f_trades) == len(r_trades), f"{key}: trade count differs"
        for i, (a, b) in enumerate(zip(f_trades, r_trades)):
            for field in EXACT_FIELDS:
                va, vb = getattr(a, field), getattr(b, field)
                assert va == vb, f"{key} trade {i}: {field} {va!r} != {vb!r}"
        for field in ("signals", "fills", "expired", "assumption_resolved"):
            assert f_diag[field] == r_diag[field], f"{key}: diag {field} differs"
        total += len(f_trades)

    assert total > 10_000, f"only {total} trades compared — sample too thin"


# --- 2. lookahead sentinel -------------------------------------------------
# NOTE on the null. The obvious sentinel — "gross expectancy should be positive
# in ~50% of configs on a driftless walk" — is NOT a valid test here, for two
# reasons established in the verification pass:
#
#   1. Configs sharing one walk are not independent trials, so a binomial over
#      configs is meaningless. The independent unit is the SEED.
#   2. Even per-seed, gross is genuinely inflated by an intrabar-resolution
#      artifact (see README): the fill bar's extremes both trigger the entry
#      and resolve the exit, and OHLC cannot order those events. The artifact
#      scales with (resolution bar range) / (box height), so it is worst at 1m.
#
# So gross-positive fraction is NOT asserted near 50%. What IS asserted:
#   (a) the exit machinery is exactly fair from unconditional entries — this is
#       the real cross-bar lookahead test, and it has no artifact;
#   (b) NET expectancy, the protocol's actual decision variable, is positive
#       nowhere on a driftless walk;
#   (c) gross is not ~100%, which would indicate true lookahead rather than
#       the bounded artifact.

def test_exit_machinery_is_fair_from_unconditional_entries():
    """Gambler's ruin control: the real cross-bar lookahead test.

    Entries are unconditional (random indices, entry at that bar's close) and
    resolution starts on the NEXT bar, so none of the intrabar selection that
    inflates the strategy's gross figure applies. With symmetric barriers a
    driftless walk must give a 50% win rate and zero mean. Any drift here is
    lookahead in the exit search itself.
    """
    from goldlab.strategy import _Series, _first_touch

    base = random_walk(200_000, 4242)
    s = _Series(base, "1m", None)
    rng = np.random.default_rng(0)
    a = 1.0

    pnl = []
    for side in (1, -1):
        for i in rng.integers(10, s.n - 20_000, 8_000):
            entry = s.c[i]
            stop, tgt = entry - side * a, entry + side * a
            i_s, i_t = _first_touch(s, i + 1, stop, tgt, side)
            if i_s == s.n and i_t == s.n:
                continue
            pnl.append(((stop if i_s <= i_t else tgt) - entry) * side)

    pnl = np.array(pnl)
    assert len(pnl) > 10_000
    assert abs(pnl.mean()) < 0.02 * a, f"exit machinery drifts: {pnl.mean():+.5f}"
    assert abs((pnl > 0).mean() - 0.5) < 0.02, f"win rate {(pnl > 0).mean():.4f}"


@pytest.mark.parametrize("seed", [101, 202, 303])
def test_net_expectancy_is_never_positive_on_a_random_walk(seed):
    """The protocol-relevant sentinel. Net is the headline number.

    Also bounds gross: a fraction near 1.0 would mean true lookahead rather
    than the bounded intrabar artifact.
    """
    base = random_walk(60_000, seed)
    costs = CostModel()
    tf_bars = {tf: gdata.resample(base, tf) for tf in gdata.TIMEFRAMES}

    gross_pos = net_pos = tradeable = 0
    for polarity in ("green", "red"):
        for cfg in grid(polarity):
            trades, _ = run(tf_bars[cfg.timeframe], cfg, costs, base_bars=base)
            if len(trades) < 200:
                continue
            tradeable += 1
            gross_pos += metrics.compute(np.array([t.gross_r for t in trades])).expectancy > 0
            net_pos += metrics.compute(np.array([t.net_r for t in trades])).expectancy > 0

    assert tradeable >= 70, f"seed {seed}: only {tradeable} tradeable configs"
    assert net_pos == 0, f"seed {seed}: {net_pos} configs net-positive on a random walk"
    frac = gross_pos / tradeable
    assert frac < 0.98, f"seed {seed}: gross positive in {frac:.1%} — true lookahead suspect"


# --- 3. entry-gap regression ----------------------------------------------
# The gap fix restricted the OPEN-gap rule to "exit bar strictly later". Entry
# is the opposite case — the fill bar IS the trigger bar by definition — so
# these confirm entry gaps are still handled, and handled ADVERSELY. A test
# that passed because entry gaps were simply ignored would be a free-fill bug
# in the other direction, which is why each asserts the fill is worse than the
# trigger, not merely different from it.

GREEN3 = [
    (100.0, 101.0, 99.5, 100.8),
    (100.8, 101.5, 100.5, 101.2),
    (101.2, 102.0, 101.0, 101.8),
]
CFG = Config("green", "1m", n_expiry=3, stop="S1", target_k=1.0)
ZERO = constant_model(0.0)


def _bars(rows, index=None):
    import pandas as pd
    idx = pd.date_range("2024-01-02 09:00", periods=len(rows), freq="1min",
                        tz="UTC") if index is None else index
    return pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx)


def test_entry_gap_buy_leg_fills_at_open_and_is_adverse():
    # Buy trigger 102.01; the bar opens at 103.00, above it.
    b = _bars(GREEN3 + [(103.0, 103.5, 102.9, 103.4), (103.4, 106.0, 103.3, 105.9)])
    t = run(b, CFG, ZERO)[0][0]
    assert t.side == 1
    assert t.gapped_entry is True
    assert t.entry_raw == pytest.approx(103.0)
    assert t.entry_raw > 102.01, "gapped buy entry must be WORSE than the trigger"


def test_entry_gap_sell_leg_fills_at_open_and_is_adverse():
    # Sell trigger 99.49; the bar opens at 98.00, below it.
    b = _bars(GREEN3 + [(98.0, 98.4, 97.5, 97.8), (97.8, 98.0, 95.0, 95.2)])
    t = run(b, CFG, ZERO)[0][0]
    assert t.side == -1
    assert t.gapped_entry is True
    assert t.entry_raw == pytest.approx(98.0)
    assert t.entry_raw < 99.49, "gapped sell entry must be WORSE than the trigger"


def test_entry_gap_across_a_weekend_is_not_a_free_fill():
    import pandas as pd
    idx = pd.DatetimeIndex(
        list(pd.date_range("2024-01-05 20:55", periods=4, freq="1min", tz="UTC"))
        + [pd.Timestamp("2024-01-07 22:00", tz="UTC")]
    )
    # Friday close ~101.8, Monday reopens at 104.00 — far above the trigger.
    b = _bars(GREEN3 + [(104.0, 104.5, 103.9, 104.4), (104.4, 108.0, 104.3, 107.9)],
              index=idx)
    t = run(b, CFG, constant_model(20.0))[0][0]
    assert t.gapped_entry is True
    assert t.entry_raw == pytest.approx(104.0)
    # Spread is charged on top of the gapped fill, not instead of it.
    assert t.entry_net == pytest.approx(104.20)


def test_entry_gap_handling_is_actually_reachable():
    """Sanity: gapped entries occur in bulk on synthetic data.

    Without this, the three tests above could all be passing on a code path
    that never fires in practice.
    """
    base = random_walk(20_000, 909)
    tf = gdata.resample(base, "5m")
    _, diag = run(tf, Config("green", "5m", 10, "S1", 1.0), CostModel(),
                  base_bars=base)
    assert diag["gapped_entries"] > 0


# --- 4. sub-resolution plumbing -------------------------------------------

def test_sub_resolution_leaves_no_assumptions_above_1m(gm_case):
    """Every timeframe >= 5m must resolve purely by observation.

    A nonzero assumption fraction above 1m means the 1m base series is not
    being consulted — the sub-resolution plumbing is disconnected.
    """
    base, costs, tf_bars = gm_case
    checked = 0
    for polarity in ("green", "red"):
        for cfg in grid(polarity):
            if cfg.timeframe == "1m":
                continue
            _, diag = run(tf_bars[cfg.timeframe], cfg, costs, base_bars=base)
            assert diag["observed_resolution"] is True, f"{cfg.key}: base not used"
            assert diag["assumption_frac"] == 0.0, (
                f"{cfg.key}: assumption_frac={diag['assumption_frac']:.4f} "
                f"above 1m — sub-resolution not consulted"
            )
            checked += 1
    assert checked == 144  # 4 timeframes x 18 configs x 2 polarities


def test_one_minute_still_reports_assumptions(gm_case):
    """Counterpart to the above: 1m has no finer series, so it MUST show some.

    If 1m also reported zero, the assumption counter would be dead code and
    the check above would be vacuous.
    """
    base, costs, tf_bars = gm_case
    total = sum(
        run(tf_bars["1m"], cfg, costs, base_bars=base)[1]["assumption_resolved"]
        for polarity in ("green", "red")
        for cfg in grid(polarity) if cfg.timeframe == "1m"
    )
    assert total > 0, "1m reported zero assumptions — counter is dead"


# --- helper sanity --------------------------------------------------------

def test_binomial_helper_matches_known_values():
    assert binomial_two_sided_p(50, 100) == pytest.approx(1.0, abs=1e-9)
    assert binomial_two_sided_p(75, 100) < 1e-5
    assert binomial_two_sided_p(0, 10) == pytest.approx(2 * 0.5**10)
