#!/usr/bin/env python3
"""
Fetch daily OHLCV for active Vietnam stocks via vnstock (VCI), write grouped JSON.

Reads symbol list from (in order):
  --symbols-file PATH
  else data/active-symbol-keys.json (from seed-stock-symbols.ts)
  else data/vn-symbols.json

Output default: data/stock-bars.json (override with --output).

Usage:
  python scripts/fetch_stock_bars.py
  python scripts/fetch_stock_bars.py --output data/stock-bars.json --calendar-days 200

Requires: pip install -r requirements.txt
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Windows: vnstock / tqdm may emit Unicode; avoid cp1252 encode errors during fetch.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

try:
    from vnstock import Quote
except ImportError:
    print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
    raise


def _safe_exc_text(err: BaseException) -> str:
    return str(err).encode("ascii", errors="backslashreplace").decode("ascii")


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "data" / "stock-bars.json"
ACTIVE_KEYS = ROOT / "data" / "active-symbol-keys.json"
STATIC_SYMBOLS = ROOT / "data" / "vn-symbols-seed.json"


def date_to_utc_midnight_ms(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    day = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
    return int(day.timestamp() * 1000)


def load_symbols(symbols_file: Path | None) -> list[str]:
    path = symbols_file
    if path is None:
        if ACTIVE_KEYS.is_file():
            path = ACTIVE_KEYS
        elif STATIC_SYMBOLS.is_file():
            path = STATIC_SYMBOLS
        else:
            raise FileNotFoundError(
                "No symbol list. Run: npx tsx scripts/seed-stock-symbols.ts "
                "or pass --symbols-file"
            )

    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "symbols" in data:
        raw = data["symbols"]
        if not isinstance(raw, list):
            raise ValueError("symbols key must be an array")
        return [str(s).strip().upper() for s in raw if str(s).strip()]

    if isinstance(data, list):
        if len(data) == 0:
            return []
        if isinstance(data[0], str):
            return [str(s).strip().upper() for s in data if str(s).strip()]
        out = []
        for item in data:
            if isinstance(item, dict) and "symbol" in item:
                out.append(str(item["symbol"]).strip().upper())
        return [s for s in out if s]

    raise ValueError(f"Unrecognized JSON shape in {path}")


def fetch_symbol_bars(symbol: str, start_s: str, end_s: str) -> list[dict]:
    quote = Quote(symbol=symbol, source="VCI")
    df = quote.history(start=start_s, end=end_s, interval="1D")
    if df is None or df.empty:
        return []

    df = df.sort_values("time").reset_index(drop=True)
    col_map = {c.lower(): c for c in df.columns}
    for need in ("time", "open", "high", "low", "close", "volume"):
        if need not in col_map:
            raise RuntimeError(f"{symbol}: missing column {need}, got {list(df.columns)}")

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
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch multi-symbol daily OHLCV (vnstock)")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=DEFAULT_OUT,
        help="Output JSON path",
    )
    parser.add_argument(
        "--symbols-file",
        type=Path,
        default=None,
        help="JSON: {symbols: [...]} or array of tickers / objects with symbol",
    )
    parser.add_argument(
        "--calendar-days",
        type=int,
        default=200,
        help="Lookback calendar days (>= 180 recommended)",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=3.2,
        help="Seconds between symbol requests (vnstock guest limit is ~20/min; use >=3.0)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max symbols (0 = all)",
    )
    args = parser.parse_args()

    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=max(args.calendar_days, 180))
    start_s = start.isoformat()
    end_s = end.isoformat()

    symbols = load_symbols(args.symbols_file)
    if args.limit > 0:
        symbols = symbols[: args.limit]

    if not symbols:
        raise SystemExit("No symbols to fetch.")

    args.output.parent.mkdir(parents=True, exist_ok=True)

    result: list[dict] = []
    failed: list[str] = []

    for i, sym in enumerate(symbols):
        try:
            bars = fetch_symbol_bars(sym, start_s, end_s)
            result.append({"symbol": sym, "bars": bars})
            if len(bars) < 120:
                print(
                    f"Warning: {sym} only {len(bars)} bars (want >=120 trading days where possible).",
                    file=sys.stderr,
                )
        except Exception as e:
            print(f"FAIL {sym}: {_safe_exc_text(e)}", file=sys.stderr)
            failed.append(sym)
            result.append({"symbol": sym, "bars": []})

        if i + 1 < len(symbols) and args.sleep > 0:
            time.sleep(args.sleep)

    text = json.dumps(result, indent=2)
    args.output.write_text(text, encoding="utf-8")

    ok_syms = sum(1 for x in result if len(x.get("bars") or []) > 0)
    total_bars = sum(len(x.get("bars") or []) for x in result)
    print(
        f"Wrote {len(result)} symbols, {total_bars} total bars ({ok_syms} non-empty) to {args.output.resolve()}",
        file=sys.stderr,
    )
    if failed:
        print(f"Failed symbols ({len(failed)}): {', '.join(failed)}", file=sys.stderr)


if __name__ == "__main__":
    main()
