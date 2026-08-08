"""Pattern detection and OCO stop-entry execution for three_*_breakout.

Intrabar policy — we only have OHLC, so the within-bar path is unknown. Every
ambiguity is resolved ADVERSELY, and each resolution is counted so the report
can state how much of the result rests on an assumption:

  * Both OCO legs triggerable in one bar -> bar-direction heuristic (a bullish
    bar is assumed to have traded down before up, so the SELL leg fills first).
  * Stop-loss and target both reachable in one bar -> STOP is taken first.
  * A bar that gaps past a trigger fills at the OPEN, not the trigger price.

R-multiples use a common denominator, the theoretical risk |trigger - stop|
measured at signal time, so gross and net R differ only by modelled cost.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Iterator

import pandas as pd

from .costs import CostModel

POLARITIES = ("green", "red")
STOPS = ("S1", "S2")


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
    side: int                 # +1 long, -1 short
    box_high: float
    box_low: float
    bh: float
    risk: float               # theoretical, price units
    entry_raw: float
    entry_net: float
    exit_raw: float
    exit_net: float
    exit_reason: str          # "target" | "stop" | "eod"
    gross_r: float
    net_r: float
    bars_held: int
    ambiguous_entry: bool     # both OCO legs triggerable in the fill bar
    ambiguous_exit: bool      # stop and target both reachable in one bar


def _pattern_end(bars: pd.DataFrame, i: int, polarity: str) -> bool:
    """True when bars i-2..i are three consecutive bars of the given polarity."""
    o = bars["open"].to_numpy()
    c = bars["close"].to_numpy()
    if polarity == "green":
        return bool(c[i - 2] > o[i - 2] and c[i - 1] > o[i - 1] and c[i] > o[i])
    return bool(c[i - 2] < o[i - 2] and c[i - 1] < o[i - 1] and c[i] < o[i])


def run(
    bars: pd.DataFrame,
    cfg: Config,
    costs: CostModel,
    tick_buffer_ticks: float = 1.0,
) -> tuple[list[Trade], dict]:
    """Walk the bars once and return (trades, diagnostics)."""
    if len(bars) < 4:
        return [], {"signals": 0, "fills": 0, "expired": 0, "bh_ticks": []}

    ts = bars.index
    o = bars["open"].to_numpy(float)
    h = bars["high"].to_numpy(float)
    l = bars["low"].to_numpy(float)
    c = bars["close"].to_numpy(float)
    hours = ts.hour.to_numpy()

    buf = tick_buffer_ticks * costs.tick_size
    trades: list[Trade] = []
    signals = fills = expired = 0
    bh_ticks: list[float] = []
    amb_entry = amb_exit = 0

    i = 2
    n = len(bars)
    while i < n:
        if not _pattern_end(bars, i, cfg.polarity):
            i += 1
            continue

        signals += 1
        box_high = max(h[i - 2], h[i - 1], h[i])
        box_low = min(l[i - 2], l[i - 1], l[i])
        bh = box_high - box_low
        bh_ticks.append(bh / costs.tick_size)

        if bh <= 0:
            i += 1
            continue

        buy_trig = box_high + buf
        sell_trig = box_low - buf

        # Orders live for bars i+1 .. i+n_expiry.
        fill_j = None
        side = 0
        entry_raw = 0.0
        ambiguous_entry = False

        for j in range(i + 1, min(i + 1 + cfg.n_expiry, n)):
            hit_buy = h[j] >= buy_trig
            hit_sell = l[j] <= sell_trig
            if not (hit_buy or hit_sell):
                continue

            if hit_buy and hit_sell:
                ambiguous_entry = True
                amb_entry += 1
                # Bullish bar assumed to trade down first -> SELL leg fills.
                take_buy = c[j] < o[j]
            else:
                take_buy = hit_buy

            side = 1 if take_buy else -1
            trig = buy_trig if take_buy else sell_trig
            # A gap past the trigger fills at the open.
            if take_buy:
                entry_raw = o[j] if o[j] >= trig else trig
            else:
                entry_raw = o[j] if o[j] <= trig else trig
            fill_j = j
            break

        if fill_j is None:
            expired += 1
            # Reset detection past the expiry window; no overlapping boxes.
            i = min(i + 1 + cfg.n_expiry, n)
            continue

        fills += 1
        trig = buy_trig if side == 1 else sell_trig

        if cfg.stop == "S1":
            stop_price = box_low if side == 1 else box_high
        else:  # S2: 0.5 * BH from entry
            stop_price = trig - 0.5 * bh if side == 1 else trig + 0.5 * bh

        risk = abs(trig - stop_price)
        if risk <= 0:
            i = fill_j + 1
            continue

        target = trig + side * cfg.target_k * risk

        spread_in = costs.spread(int(hours[fill_j]))
        entry_net = entry_raw + side * spread_in

        # Resolve the position, starting on the fill bar itself.
        exit_k = None
        exit_raw = 0.0
        reason = "eod"
        ambiguous_exit = False

        for k in range(fill_j, n):
            if side == 1:
                hit_stop = l[k] <= stop_price
                hit_tgt = h[k] >= target
            else:
                hit_stop = h[k] >= stop_price
                hit_tgt = l[k] <= target

            if hit_stop and hit_tgt:
                ambiguous_exit = True
                amb_exit += 1
                hit_tgt = False  # adverse: stop first

            if hit_stop:
                if side == 1:
                    exit_raw = o[k] if o[k] <= stop_price else stop_price
                else:
                    exit_raw = o[k] if o[k] >= stop_price else stop_price
                reason = "stop"
                exit_k = k
                break
            if hit_tgt:
                if side == 1:
                    exit_raw = o[k] if o[k] >= target else target
                else:
                    exit_raw = o[k] if o[k] <= target else target
                reason = "target"
                exit_k = k
                break

        if exit_k is None:  # data ran out with the position open
            exit_k = n - 1
            exit_raw = c[exit_k]
            reason = "eod"

        spread_out = costs.spread(int(hours[exit_k]))
        if reason == "stop":
            # Adverse fill on the stop exit, per the pre-registered cost model.
            exit_net = exit_raw - side * spread_out
        else:
            # Limit/target and forced close fill at price.
            exit_net = exit_raw

        gross_pnl = (exit_raw - entry_raw) * side
        net_pnl = (exit_net - entry_net) * side - costs.commission_price_units

        trades.append(
            Trade(
                entry_time=ts[fill_j],
                exit_time=ts[exit_k],
                side=side,
                box_high=box_high,
                box_low=box_low,
                bh=bh,
                risk=risk,
                entry_raw=entry_raw,
                entry_net=entry_net,
                exit_raw=exit_raw,
                exit_net=exit_net,
                exit_reason=reason,
                gross_r=gross_pnl / risk,
                net_r=net_pnl / risk,
                bars_held=exit_k - fill_j,
                ambiguous_entry=ambiguous_entry,
                ambiguous_exit=ambiguous_exit,
            )
        )

        # One position at a time, no pyramiding: resume detection after exit.
        i = exit_k + 1

    diag = {
        "signals": signals,
        "fills": fills,
        "expired": expired,
        "bh_ticks": bh_ticks,
        "ambiguous_entry": amb_entry,
        "ambiguous_exit": amb_exit,
    }
    return trades, diag


def trades_to_frame(trades: list[Trade]) -> pd.DataFrame:
    if not trades:
        return pd.DataFrame(columns=[f.name for f in Trade.__dataclass_fields__.values()])
    return pd.DataFrame([asdict(t) for t in trades])


def grid(polarity: str) -> Iterator[Config]:
    """The frozen 90-config grid for one polarity."""
    for tf in ("1m", "5m", "15m", "30m", "1H"):
        for n_exp in (3, 5, 10):
            for stop in ("S1", "S2"):
                for k in (1.0, 1.5, 2.0):
                    yield Config(polarity, tf, n_exp, stop, k)
