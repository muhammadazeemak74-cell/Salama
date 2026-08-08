"""Cost model for retail spot XAUUSD.

Every number in DEFAULT_SPREAD_TICKS is a PLACEHOLDER. Replace it with the
spread profile from the broker/feed the study is meant to represent, or pass a
measured profile derived from bid/ask data. Whatever is used gets echoed into
VERDICT.md so a headline number can never quietly rest on an invented constant.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# XAUUSD retail spot is conventionally quoted to 2dp; some feeds use 3dp.
DEFAULT_TICK_SIZE = 0.01

# Session buckets by UTC hour. Spot gold spreads widen in thin Asia hours and
# around the 21:00-22:00 UTC rollover, and tighten through London/NY overlap.
SESSIONS = {
    "asia": range(0, 7),
    "london": range(7, 13),
    "ny_overlap": range(13, 17),
    "ny_late": range(17, 21),
    "rollover": range(21, 24),
}

# PLACEHOLDER spread profile, in ticks (0.01 USD). NOT measured. NOT broker data.
DEFAULT_SPREAD_TICKS = {
    "asia": 30.0,
    "london": 18.0,
    "ny_overlap": 15.0,
    "ny_late": 22.0,
    "rollover": 55.0,
}


@dataclass
class CostModel:
    """Spread + commission model.

    spread_ticks may be a float (single constant) or a dict keyed by session
    name. When it is a dict the model is session-varying; `is_session_varying`
    reports which, so VERDICT.md can state it plainly.
    """

    tick_size: float = DEFAULT_TICK_SIZE
    spread_ticks: float | dict[str, float] = field(
        default_factory=lambda: dict(DEFAULT_SPREAD_TICKS)
    )
    # Round-turn commission expressed in price units per unit of exposure.
    commission_price_units: float = 0.0
    # True when spread_ticks came from measured bid/ask rather than the default.
    measured: bool = False

    @property
    def is_session_varying(self) -> bool:
        return isinstance(self.spread_ticks, dict)

    def session_for(self, utc_hour: int) -> str:
        for name, hours in SESSIONS.items():
            if utc_hour in hours:
                return name
        raise ValueError(f"hour out of range: {utc_hour}")

    def spread_in_ticks(self, utc_hour: int) -> float:
        if isinstance(self.spread_ticks, dict):
            return self.spread_ticks[self.session_for(utc_hour)]
        return float(self.spread_ticks)

    def spread(self, utc_hour: int) -> float:
        """Spread in price units at the given UTC hour."""
        return self.spread_in_ticks(utc_hour) * self.tick_size

    def describe(self) -> str:
        if self.is_session_varying:
            body = ", ".join(
                f"{k}={v:g}t" for k, v in self.spread_ticks.items()
            )
            kind = "session-varying"
        else:
            body = f"{float(self.spread_ticks):g}t"
            kind = "constant"
        origin = "measured from data" if self.measured else "PLACEHOLDER (not measured)"
        return (
            f"tick={self.tick_size:g}; spread {kind} [{body}] ({origin}); "
            f"commission={self.commission_price_units:g} price units round turn"
        )


def constant_model(spread_ticks: float, **kw) -> CostModel:
    return CostModel(spread_ticks=float(spread_ticks), **kw)
