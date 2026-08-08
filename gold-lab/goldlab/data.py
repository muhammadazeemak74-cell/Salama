"""Bar loading, resampling and the in-sample / out-of-sample split.

Input contract — a CSV with, at minimum:

    timestamp,open,high,low,close[,volume][,bid,ask]

`timestamp` must be parseable and is treated as UTC. Bars must be strictly
increasing in time. If `bid`/`ask` are present the cost model can be built from
measured spread instead of the placeholder profile.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

REQUIRED = ["open", "high", "low", "close"]

# pandas offset aliases for the five pre-registered timeframes.
TIMEFRAMES = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1H": "1h",
}


def load_bars(path: str) -> pd.DataFrame:
    """Load and validate a bar CSV. Returns a UTC-indexed OHLC frame."""
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]

    ts_col = next(
        (c for c in ("timestamp", "time", "date", "datetime") if c in df.columns),
        None,
    )
    if ts_col is None:
        raise ValueError(f"{path}: no timestamp column (looked for timestamp/time/date/datetime)")

    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"{path}: missing required columns {missing}")

    ts = pd.to_datetime(df[ts_col], utc=True, errors="coerce")
    if ts.isna().any():
        raise ValueError(f"{path}: {int(ts.isna().sum())} unparseable timestamps")

    df = df.assign(timestamp=ts).set_index("timestamp").sort_index()

    if df.index.has_duplicates:
        raise ValueError(f"{path}: duplicate timestamps present")

    bad = df[(df["high"] < df["low"]) | (df["high"] < df["open"]) | (df["high"] < df["close"])
             | (df["low"] > df["open"]) | (df["low"] > df["close"])]
    if len(bad):
        raise ValueError(f"{path}: {len(bad)} bars violate OHLC ordering (first at {bad.index[0]})")

    keep = REQUIRED + [c for c in ("volume", "bid", "ask") if c in df.columns]
    return df[keep]


def resample(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    """Resample base bars up to one of the pre-registered timeframes."""
    if timeframe not in TIMEFRAMES:
        raise ValueError(f"unknown timeframe {timeframe!r}; expected one of {list(TIMEFRAMES)}")

    agg = {"open": "first", "high": "max", "low": "min", "close": "last"}
    if "volume" in df.columns:
        agg["volume"] = "sum"

    out = df.resample(TIMEFRAMES[timeframe], label="left", closed="left").agg(agg)
    # Weekend / holiday gaps resample into empty bars; drop them rather than
    # forward-filling, which would invent price action that never traded.
    return out.dropna(subset=["open", "high", "low", "close"])


@dataclass
class Split:
    is_bars: pd.DataFrame
    oos_bars: pd.DataFrame
    boundary: pd.Timestamp

    def describe(self) -> str:
        return (
            f"IS {self.is_bars.index[0]} -> {self.is_bars.index[-1]} ({len(self.is_bars):,} bars); "
            f"OOS {self.oos_bars.index[0]} -> {self.oos_bars.index[-1]} ({len(self.oos_bars):,} bars); "
            f"boundary {self.boundary}"
        )


def split_70_30(df: pd.DataFrame) -> Split:
    """Chronological 70/30 split. The final 30% is the locked OOS block."""
    if len(df) < 10:
        raise ValueError("not enough bars to split")
    cut = int(len(df) * 0.70)
    return Split(is_bars=df.iloc[:cut], oos_bars=df.iloc[cut:], boundary=df.index[cut])


def measure_spread(df: pd.DataFrame) -> pd.Series | None:
    """Per-bar spread in price units from bid/ask, when the feed carries them."""
    if "bid" not in df.columns or "ask" not in df.columns:
        return None
    return (df["ask"] - df["bid"]).clip(lower=0.0)
