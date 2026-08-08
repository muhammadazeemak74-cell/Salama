"""Pattern detection and OCO stop-entry execution for three_*_breakout.

Intrabar policy — see three_breakout/ADDENDUM_01_FILL_RESOLUTION.md.

Pattern detection and the N_expiry window run on the configured timeframe.
Order triggering and position resolution run on a RESOLUTION SERIES: the 1m
base bars for timeframes >= 5m, so sequence within a higher-timeframe bar is
observed rather than assumed; the bars themselves at 1m, where no finer series
exists.

Where sequence cannot be observed — both events inside one resolution bar — the
PESSIMISTIC rule applies and the trade is counted as assumption-resolved:

  * both OCO legs touched -> the LOSING leg filled, determined by resolving
    both candidates and taking the worse net R (not by guessing from candle
    colour)
  * stop and target both touched -> the STOP filled

A bar that OPENS beyond a level fills at the OPEN, never at the level, so
weekend and session gaps cannot produce free fills.

R-multiples use a common denominator, the theoretical risk |trigger - stop|
measured at signal time, so gross and net R differ only by modelled cost.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Iterator

import numpy as np
import pandas as pd

from .costs import CostModel

POLARITIES = ("green", "red")
STOPS = ("S1", "S2")
RESOLUTIONS = ("pessimistic", "optimistic")

_TF_DELTA = {
    "1m": pd.Timedelta(minutes=1),
    "5m": pd.Timedelta(minutes=5),
    "15m": pd.Timedelta(minutes=15),
    "30m": pd.Timedelta(minutes=30),
    "1H": pd.Timedelta(hours=1),
}

# A config whose trades exceed this assumption fraction is flagged.
ASSUMPTION_DEPENDENT_THRESHOLD = 0.05


@dataclass(frozen=True)
class Config:
    polarity: str
    timeframe: str
    n_expiry: int
    stop: str
    target_k: float

    def __post_init__(self):
        if self.polarity not in POLARITIES:
            raise ValueError(f"bad polarity {self.polarity!r}")
        if self.stop not in STOPS:
            raise ValueError(f"bad stop {self.stop!r}")

    @property
    def key(self) -> str:
        return f"{self.polarity}|{self.timeframe}|N{self.n_expiry}|{self.stop}|k{self.target_k:g}"


@dataclass
class Trade:
    entry_time: pd.Timestamp
    exit_time: pd.Timestamp
    side: int
    box_high: float
    box_low: float
    bh: float
    risk: float
    entry_raw: float
    entry_net: float
    exit_raw: float
    exit_net: float
    exit_reason: str          # "target" | "stop" | "eod"
    gross_r: float
    net_r: float
    bars_held: int            # in resolution-series bars
    ambiguous_entry: bool     # OCO legs settled by assumption
    ambiguous_exit: bool      # stop/target settled by assumption
    gapped_entry: bool
    gapped_exit: bool

    @property
    def assumption_resolved(self) -> bool:
        return self.ambiguous_entry or self.ambiguous_exit


class _Series:
    """The series that fills resolve against, plus the timeframe->series map."""

    def __init__(self, tf_bars: pd.DataFrame, timeframe: str, base: pd.DataFrame | None):
        use_base = base is not None and timeframe != "1m"
        src = base if use_base else tf_bars
        self.observed = bool(use_base)
        self.o = src["open"].to_numpy(float)
        self.h = src["high"].to_numpy(float)
        self.l = src["low"].to_numpy(float)
        self.c = src["close"].to_numpy(float)
        self.hour = src.index.hour.to_numpy()
        self.ts = src.index
        self.n = len(src)

        if use_base:
            edges = tf_bars.index
            self.start = np.searchsorted(src.index.values, edges.values, side="left")
            self.end = np.searchsorted(
                src.index.values, (edges + _TF_DELTA[timeframe]).values, side="left"
            )
        else:
            m = len(tf_bars)
            self.start = np.arange(m)
            self.end = np.arange(1, m + 1)

    def tf_bar_of(self, rs_idx: int) -> int:
        """Which timeframe bar contains this resolution-series index."""
        return int(np.searchsorted(self.start, rs_idx, side="right") - 1)


def _first_trigger(s: _Series, lo: int, hi: int, buy: float, sell: float):
    """First index in [lo,hi) touching each OCO leg; hi when untouched."""
    if lo >= hi:
        return hi, hi
    hh, ll = s.h[lo:hi], s.l[lo:hi]
    mb, ms = hh >= buy, ll <= sell
    ib = lo + int(mb.argmax()) if mb.any() else hi
    is_ = lo + int(ms.argmax()) if ms.any() else hi
    return ib, is_


def _first_touch(s: _Series, start: int, stop_price: float, target: float,
                 side: int, chunk: int = 8192):
    """First index >= start touching stop / target; s.n when untouched.

    Chunked so a long-running position does not scan to the end of history.
    """
    pos = start
    while pos < s.n:
        end = min(pos + chunk, s.n)
        hh, ll = s.h[pos:end], s.l[pos:end]
        if side == 1:
            m_stop, m_tgt = ll <= stop_price, hh >= target
        else:
            m_stop, m_tgt = hh >= stop_price, ll <= target
        a_s, a_t = m_stop.any(), m_tgt.any()
        if a_s or a_t:
            i_s = pos + int(m_stop.argmax()) if a_s else s.n
            i_t = pos + int(m_tgt.argmax()) if a_t else s.n
            return i_s, i_t
        pos = end
    return s.n, s.n


def _search_levels_reference(s: _Series, start: int, end: int, kind: str,
                             level_a: float, level_b: float, side: int = 1):
    """Naive scalar scan — the pre-vectorization implementation.

    REFERENCE ONLY. Never used on a production path. Retained permanently as
    the golden master for `test_vectorized_search_matches_reference`, so any
    future optimisation of `_first_trigger` / `_first_touch` must still
    reproduce it trade-for-trade. Do not "fix" this to match the fast path —
    if they disagree, the fast path is wrong until proven otherwise.

    Returns (idx_a, idx_b), using `end` for "not touched first". Only the
    earlier index is meaningful; a tie (idx_a == idx_b) is the ambiguity the
    callers resolve by tie-break.
    """
    for k in range(start, end):
        if kind == "trigger":
            a = s.h[k] >= level_a          # buy stop
            b = s.l[k] <= level_b          # sell stop
        elif side == 1:
            a = s.l[k] <= level_a          # long stop-loss
            b = s.h[k] >= level_b          # long target
        else:
            a = s.h[k] >= level_a          # short stop-loss
            b = s.l[k] <= level_b          # short target
        if a or b:
            return (k if a else end), (k if b else end)
    return end, end


def _first_trigger_ref(s: _Series, lo: int, hi: int, buy: float, sell: float):
    if lo >= hi:
        return hi, hi
    return _search_levels_reference(s, lo, hi, "trigger", buy, sell)


def _first_touch_ref(s: _Series, start: int, stop_price: float, target: float,
                     side: int):
    return _search_levels_reference(s, start, s.n, "exit", stop_price, target, side)


# Search backends. "vectorized" is production; "reference" is the golden master.
SEARCH_BACKENDS = {
    "vectorized": (_first_trigger, _first_touch),
    "reference": (_first_trigger_ref, _first_touch_ref),
}


def _pattern_end(o: np.ndarray, c: np.ndarray, i: int, polarity: str) -> bool:
    if polarity == "green":
        return bool(c[i - 2] > o[i - 2] and c[i - 1] > o[i - 1] and c[i] > o[i])
    return bool(c[i - 2] < o[i - 2] and c[i - 1] < o[i - 1] and c[i] < o[i])


def _build(side: int, fill_rs: int, trig: float, box_high: float, box_low: float,
           bh: float, cfg: Config, costs: CostModel, s: _Series,
           pessimistic: bool, ambiguous_entry: bool, touch=None) -> Trade | None:
    """Resolve one candidate leg all the way to its exit."""
    if cfg.stop == "S1":
        stop_price = box_low if side == 1 else box_high
    else:
        stop_price = trig - side * 0.5 * bh

    risk = abs(trig - stop_price)
    if risk <= 0:
        return None
    target = trig + side * cfg.target_k * risk

    # Entry: a gap past the trigger fills at the open.
    o0 = s.o[fill_rs]
    gapped_entry = (o0 >= trig) if side == 1 else (o0 <= trig)
    entry_raw = o0 if gapped_entry else trig

    touch = touch or _first_touch
    i_stop, i_tgt = touch(s, fill_rs, stop_price, target, side)
    ambiguous_exit = False

    if i_stop == s.n and i_tgt == s.n:
        exit_rs, reason = s.n - 1, "eod"
    elif i_stop == i_tgt:
        ambiguous_exit = True
        reason = "stop" if pessimistic else "target"
        exit_rs = i_stop
    elif i_stop < i_tgt:
        exit_rs, reason = i_stop, "stop"
    else:
        exit_rs, reason = i_tgt, "target"

    gapped_exit = False
    # The open-gap rule only applies on a LATER bar. When entry and exit share
    # one resolution bar the position was opened intrabar, so that bar's open
    # predates the position and cannot gap it — charging the open there would
    # book a loss the trade was never exposed to. Fill at the level instead.
    later_bar = exit_rs > fill_rs
    if reason == "eod":
        exit_raw = s.c[exit_rs]
    elif reason == "stop":
        oe = s.o[exit_rs]
        gapped_exit = later_bar and ((oe <= stop_price) if side == 1 else (oe >= stop_price))
        exit_raw = oe if gapped_exit else stop_price
    else:
        oe = s.o[exit_rs]
        gapped_exit = later_bar and ((oe >= target) if side == 1 else (oe <= target))
        exit_raw = oe if gapped_exit else target

    entry_net = entry_raw + side * costs.spread(int(s.hour[fill_rs]))
    if reason == "stop":
        exit_net = exit_raw - side * costs.spread(int(s.hour[exit_rs]))
    else:
        exit_net = exit_raw

    gross_pnl = (exit_raw - entry_raw) * side
    net_pnl = (exit_net - entry_net) * side - costs.commission_price_units

    return Trade(
        entry_time=s.ts[fill_rs], exit_time=s.ts[exit_rs], side=side,
        box_high=box_high, box_low=box_low, bh=bh, risk=risk,
        entry_raw=entry_raw, entry_net=entry_net,
        exit_raw=exit_raw, exit_net=exit_net, exit_reason=reason,
        gross_r=gross_pnl / risk, net_r=net_pnl / risk,
        bars_held=exit_rs - fill_rs,
        ambiguous_entry=ambiguous_entry, ambiguous_exit=ambiguous_exit,
        gapped_entry=bool(gapped_entry), gapped_exit=bool(gapped_exit),
    )


def run(
    bars: pd.DataFrame,
    cfg: Config,
    costs: CostModel,
    base_bars: pd.DataFrame | None = None,
    resolution: str = "pessimistic",
    tick_buffer_ticks: float = 1.0,
    search: str = "vectorized",
) -> tuple[list[Trade], dict]:
    """Walk the bars once and return (trades, diagnostics).

    `search` selects the level-search backend. "vectorized" is production;
    "reference" is the naive golden master and exists only so tests can prove
    the two agree trade-for-trade.
    """
    if resolution not in RESOLUTIONS:
        raise ValueError(f"bad resolution {resolution!r}")
    if search not in SEARCH_BACKENDS:
        raise ValueError(f"bad search backend {search!r}")
    trigger_fn, touch_fn = SEARCH_BACKENDS[search]
    pessimistic = resolution == "pessimistic"

    empty = {"signals": 0, "fills": 0, "expired": 0, "bh_ticks": [],
             "ambiguous_entry": 0, "ambiguous_exit": 0,
             "assumption_resolved": 0, "assumption_frac": 0.0,
             "assumption_dependent": False, "observed_resolution": False}
    if len(bars) < 4:
        return [], empty

    s = _Series(bars, cfg.timeframe, base_bars)
    o = bars["open"].to_numpy(float)
    c = bars["close"].to_numpy(float)
    hi_ = bars["high"].to_numpy(float)
    lo_ = bars["low"].to_numpy(float)
    n_tf = len(bars)

    buf = tick_buffer_ticks * costs.tick_size
    trades: list[Trade] = []
    signals = fills = expired = 0
    amb_entry = amb_exit = 0
    bh_ticks: list[float] = []

    i = 2
    while i < n_tf:
        if not _pattern_end(o, c, i, cfg.polarity):
            i += 1
            continue

        signals += 1
        box_high = max(hi_[i - 2], hi_[i - 1], hi_[i])
        box_low = min(lo_[i - 2], lo_[i - 1], lo_[i])
        bh = box_high - box_low
        bh_ticks.append(bh / costs.tick_size)
        if bh <= 0:
            i += 1
            continue

        buy_trig, sell_trig = box_high + buf, box_low - buf

        # Order window: timeframe bars i+1 .. i+N, mapped into the series.
        last_tf = min(i + cfg.n_expiry, n_tf - 1)
        w_lo, w_hi = int(s.start[i + 1]) if i + 1 < n_tf else s.n, int(s.end[last_tf])
        ib, is_ = trigger_fn(s, w_lo, min(w_hi, s.n), buy_trig, sell_trig)

        if ib == is_ and ib >= min(w_hi, s.n):
            expired += 1
            i = min(i + 1 + cfg.n_expiry, n_tf)
            continue

        ambiguous_entry = ib == is_
        if ambiguous_entry:
            amb_entry += 1
            # Resolve BOTH legs; pessimistic takes the worse outcome.
            cands = [
                t for t in (
                    _build(1, ib, buy_trig, box_high, box_low, bh, cfg, costs, s,
                           pessimistic, True, touch_fn),
                    _build(-1, is_, sell_trig, box_high, box_low, bh, cfg, costs, s,
                           pessimistic, True, touch_fn),
                ) if t is not None
            ]
            if not cands:
                i += 1
                continue
            trade = (min if pessimistic else max)(cands, key=lambda t: t.net_r)
        else:
            side = 1 if ib < is_ else -1
            fill_rs = ib if side == 1 else is_
            trig = buy_trig if side == 1 else sell_trig
            trade = _build(side, fill_rs, trig, box_high, box_low, bh, cfg, costs, s,
                           pessimistic, False, touch_fn)
            if trade is None:
                i += 1
                continue

        fills += 1
        if trade.ambiguous_exit:
            amb_exit += 1
        trades.append(trade)

        # One position at a time: resume detection after the exit bar.
        exit_rs = int(np.searchsorted(s.ts.values, trade.exit_time.to_datetime64(), "left"))
        i = max(s.tf_bar_of(exit_rs) + 1, i + 1)

    n_res = sum(1 for t in trades if t.assumption_resolved)
    frac = (n_res / len(trades)) if trades else 0.0
    diag = {
        "signals": signals, "fills": fills, "expired": expired,
        "bh_ticks": bh_ticks,
        "ambiguous_entry": amb_entry, "ambiguous_exit": amb_exit,
        "assumption_resolved": n_res,
        "assumption_frac": frac,
        "assumption_dependent": frac > ASSUMPTION_DEPENDENT_THRESHOLD,
        "observed_resolution": s.observed,
        "gapped_entries": sum(1 for t in trades if t.gapped_entry),
        "gapped_exits": sum(1 for t in trades if t.gapped_exit),
    }
    return trades, diag


def trades_to_frame(trades: list[Trade]) -> pd.DataFrame:
    if not trades:
        return pd.DataFrame(columns=list(Trade.__dataclass_fields__))
    return pd.DataFrame([asdict(t) for t in trades])


def grid(polarity: str) -> Iterator[Config]:
    """The frozen 90-config grid for one polarity."""
    for tf in ("1m", "5m", "15m", "30m", "1H"):
        for n_exp in (3, 5, 10):
            for stop in ("S1", "S2"):
                for k in (1.0, 1.5, 2.0):
                    yield Config(polarity, tf, n_exp, stop, k)
