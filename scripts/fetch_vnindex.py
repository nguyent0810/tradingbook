#!/usr/bin/env python3
"""
Fetch VNINDEX daily OHLCV via vnstock and write normalized JSON for import-bars.ts.

Usage:
  python scripts/fetch_vnindex.py
  python scripts/fetch_vnindex.py --output data/vnindex.json

Requires: pip install -r requirements.txt
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from vnstock import Quote
except ImportError:
    print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
    raise


def date_to_utc_midnight_ms(dt: datetime) -> int:
    """Trading calendar day as UTC midnight epoch ms (stable dedupe key)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    day = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
    return int(day.timestamp() * 1000)


def fetch_vnindex_bars(
    min_rows: int = 100,
    start: str | None = None,
    end: str | None = None,
) -> list[dict]:
    """
    >= min_rows trading days.

    Default window stays 420 calendar days so the daily job is unchanged. Pass
    explicit `start`/`end` for a multi-year backfill — an explicit range is
    required there rather than a relative one, so the same command re-run on a
    different day requests exactly the same history.
    """
    if end:
        end_date = datetime.strptime(end, "%Y-%m-%d").date()
    else:
        # Inclusive end: add one calendar day so same-day / boundary fetches from VCI
        # are less likely to drop the latest session vs a strict "today" end.
        end_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()
    start_date = (
        datetime.strptime(start, "%Y-%m-%d").date()
        if start
        else end_date - timedelta(days=420)
    )
    if start_date >= end_date:
        raise SystemExit(f"--start {start_date} must be before --end {end_date}")
    start_s = start_date.isoformat()
    end_s = end_date.isoformat()

    quote = Quote(symbol="VNINDEX", source="VCI")
    df = quote.history(start=start_s, end=end_s, interval="1D")
    if df is None or df.empty:
        raise RuntimeError("vnstock returned no rows for VNINDEX")

    df = df.sort_values("time").reset_index(drop=True)

    # Normalize column names (defensive)
    col_map = {c.lower(): c for c in df.columns}
    for need in ("time", "open", "high", "low", "close", "volume"):
        if need not in col_map:
            raise RuntimeError(f"Missing column {need}, got {list(df.columns)}")

    out: list[dict] = []
    for _, row in df.iterrows():
        t = row[col_map["time"]]
        if hasattr(t, "to_pydatetime"):
            t = t.to_pydatetime()
        if isinstance(t, datetime):
            pass
        else:
            t = datetime.fromisoformat(str(t))

        ms = date_to_utc_midnight_ms(t)
        out.append(
            {
                "time": ms,
                "open": float(row[col_map["open"]]),
                "high": float(row[col_map["high"]]),
                "low": float(row[col_map["low"]]),
                "close": float(row[col_map["close"]]),
                "volume": float(row[col_map["volume"]]),
            }
        )

    if len(out) < min_rows:
        print(
            f"Warning: only {len(out)} rows (wanted >= {min_rows}). "
            "Upstream may be rate-limited or range too short.",
            file=sys.stderr,
        )

    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch VNINDEX daily bars (vnstock)")
    parser.add_argument(
        "--output",
        "-o",
        default="data/vnindex.json",
        help="Output JSON path (array of OHLCV bars)",
    )
    parser.add_argument(
        "--min-rows",
        type=int,
        default=100,
        help="Warn if fewer trading rows than this",
    )
    parser.add_argument(
        "--start",
        default="",
        help="Explicit history start YYYY-MM-DD (backfill). Default: end - 420 days.",
    )
    parser.add_argument(
        "--end",
        default="",
        help="Explicit history end YYYY-MM-DD. Default: UTC today + 1 day.",
    )
    parser.add_argument(
        "--print-json",
        action="store_true",
        help="Also print full JSON to stdout (default: write file only + stderr summary)",
    )
    args = parser.parse_args()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    bars = fetch_vnindex_bars(
        min_rows=args.min_rows,
        start=args.start.strip() or None,
        end=args.end.strip() or None,
    )
    text = json.dumps(bars, indent=2)
    out_path.write_text(text, encoding="utf-8")

    print(f"Wrote {len(bars)} bars to {out_path.resolve()}", file=sys.stderr)
    if args.print_json:
        print(text)


if __name__ == "__main__":
    main()
