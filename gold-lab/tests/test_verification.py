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

def test_search_backends_agree(gm_case):
    """The chunked search must reproduce the default scalar path trade-for-trade.

    Guards future perf work. `reference` (naive scalar) is the DEFAULT and the
    faster of the two; `chunked` is retained only as this comparison target. If
    they diverge, the CHUNKED path is wrong until proven otherwise — never
    adjust the reference to match it.
    """
    base, costs, tf_bars = gm_case
    fast = _grid_trades(base, tf_bars, costs, "chunked")
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


def test_default_search_backend_is_the_scalar_reference():
    """The default must be the measured-faster path, not the chunked one."""
    from goldlab.strategy import DEFAULT_SEARCH, SEARCH_BACKENDS, _first_touch_ref
    assert DEFAULT_SEARCH == "reference"
    assert SEARCH_BACKENDS[DEFAULT_SEARCH][1] is _first_touch_ref


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


# --- 6. tick sub-resolution for 1m (Addendum 01-B) -------------------------
# A tick is a zero-range bar, so it cannot straddle two levels. Under tick
# resolution every sequence is observed, no tie-break can fire, and the
# pessimistic/optimistic bracket collapses to zero width.

def _ticks(prices, start="2024-01-02 09:03", freq="1s"):
    import pandas as pd
    idx = pd.date_range(start, periods=len(prices), freq=freq, tz="UTC")
    p = np.asarray(prices, dtype=float)
    return pd.DataFrame({"open": p, "high": p, "low": p, "close": p}, index=idx)


def _one_minute_case():
    """A 1m bar that spans BOTH the 99.50 stop and the 104.52 target.

    Box from GREEN3 is [102.00, 99.50]; buy trigger 102.01, risk 2.51,
    target 104.52. Bar 3 fills the long; bar 4 touches both levels, so on bar
    data alone the sequence is unknowable and the tie-break decides.
    """
    return _bars(GREEN3 + [
        (101.8, 102.5, 101.7, 102.3),
        (102.3, 105.0, 99.0, 100.0),
    ])


def test_ticks_resolve_a_true_stop_then_target_sequence():
    """True path: down to the stop FIRST, then up through the target.

    The bar alone cannot show this. Ticks can.
    """
    b = _one_minute_case()
    # bar 4 spans 09:04. Path: 102.30 -> 99.00 (stop) -> 105.00 (target).
    tk = _ticks([102.3, 101.0, 99.5, 99.0, 101.0, 104.52, 105.0],
                start="2024-01-02 09:04")
    t = run(b, CFG, ZERO, ticks=tk)[0][0]
    assert t.exit_reason == "stop"
    assert t.ambiguous_exit is False        # observed, not assumed
    assert t.gross_r < 0


def test_ticks_resolve_a_true_target_then_stop_sequence_against_the_bound():
    """True path: UP through the target first, then down to the stop.

    This is the discriminating case. The pessimistic bound says "stop" and the
    optimistic bound says "target"; only tick resolution can say which actually
    happened. Here the truth is `target`, so tick resolution must disagree with
    the pessimistic bound that binds when ticks are absent.
    """
    b = _one_minute_case()
    tk = _ticks([102.3, 103.5, 104.52, 105.0, 102.0, 99.5, 99.0],
                start="2024-01-02 09:04")

    observed = run(b, CFG, ZERO, ticks=tk)[0][0]
    assert observed.exit_reason == "target"
    assert observed.ambiguous_exit is False   # observed, not assumed
    assert observed.gross_r > 0

    # Without ticks the same bar is ambiguous and the pessimistic bound binds,
    # giving the OPPOSITE outcome to what actually happened.
    bound = run(b, CFG, ZERO)[0][0]
    assert bound.ambiguous_exit is True
    assert bound.exit_reason == "stop"
    assert bound.gross_r < 0
    assert observed.net_r > bound.net_r      # truth is not either bound


def test_tick_resolution_collapses_the_bracket_to_zero_width():
    """Pessimistic and optimistic must coincide exactly under ticks."""
    b = _one_minute_case()
    tk = _ticks([102.3, 103.5, 104.52, 105.0, 102.0, 99.5, 99.0],
                start="2024-01-02 09:04")
    p = run(b, CFG, ZERO, ticks=tk, resolution="pessimistic")[0][0]
    o = run(b, CFG, ZERO, ticks=tk, resolution="optimistic")[0][0]
    assert p.exit_reason == o.exit_reason
    assert o.net_r - p.net_r == 0.0, "bracket must have zero width under ticks"


def test_ticks_drive_assumption_frac_to_zero_at_1m_at_scale():
    """assumption_frac must be exactly 0.0 for 1m when ticks are supplied."""
    base = random_walk(4_000, 777)
    # Synthesize 4 ticks per bar tracing open -> high -> low -> close.
    import pandas as pd
    rows, stamps = [], []
    for ts, r in base.iterrows():
        for j, px in enumerate((r["open"], r["high"], r["low"], r["close"])):
            rows.append(px)
            stamps.append(ts + pd.Timedelta(seconds=15 * j))
    p = np.asarray(rows, float)
    tk = pd.DataFrame({"open": p, "high": p, "low": p, "close": p},
                      index=pd.DatetimeIndex(stamps))

    checked = 0
    for polarity in ("green", "red"):
        for cfg in grid(polarity):
            if cfg.timeframe != "1m":
                continue
            trades, diag = run(base, cfg, CostModel(), ticks=tk)
            assert diag["resolution_source"] == "ticks"
            assert diag["observed_resolution"] is True
            assert diag["assumption_frac"] == 0.0, (
                f"{cfg.key}: assumption_frac={diag['assumption_frac']} under ticks"
            )
            # Bracket width must be exactly zero.
            opt, _ = run(base, cfg, CostModel(), ticks=tk, resolution="optimistic")
            if trades and opt:
                lo = float(np.mean([t.net_r for t in trades]))
                hi = float(np.mean([t.net_r for t in opt]))
                assert hi - lo == 0.0, f"{cfg.key}: bracket width {hi - lo}"
            checked += 1
    assert checked == 36


def test_absent_ticks_leaves_behaviour_unchanged():
    """Ticks are opt-in. Without them, 1m is bounded exactly as before."""
    b = _one_minute_case()
    a = run(b, CFG, ZERO)
    c = run(b, CFG, ZERO, ticks=None)
    assert a[1]["resolution_source"] == "self"
    assert a[1]["assumption_frac"] == c[1]["assumption_frac"] == 1.0
    assert a[0][0].exit_reason == c[0][0].exit_reason == "stop"
