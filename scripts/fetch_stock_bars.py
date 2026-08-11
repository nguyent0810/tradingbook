#!/usr/bin/env python3
"""
Fetch daily OHLCV for active Vietnam stocks via vnstock (VCI), write grouped JSON.

Reads symbol list from (in order):
  --symbols-file PATH
  else data/active-symbol-keys.json (from seed-stock-symbols.ts)
  else data/vn-symbols-seed.json (fallback)

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
    parser.add_argument(
        "--end-date",
        type=str,
        default="",
        help=(
            "Inclusive history end as YYYY-MM-DD (UTC calendar day). "
            "Defaults to UTC today. Prefer matching latest VNINDEX session date "
            "(see: npx tsx scripts/report-bar-coverage.ts)."
        ),
    )
    parser.add_argument(
        "--start",
        type=str,
        default="",
        help=(
            "Explicit history start YYYY-MM-DD. Overrides --calendar-days. Required for "
            "backfills: an explicit range makes the same command reproducible on any day, "
            "whereas a relative window silently shifts."
        ),
    )
    parser.add_argument(
        "--format",
        choices=("json", "ndjson"),
        default="json",
        help=(
            "json = single array (default, unchanged for the daily job). "
            "ndjson = one symbol per line, streamed — required at backfill scale, where "
            "holding ~570k bars in memory before serialising is the failure mode."
        ),
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Write a per-symbol fetch manifest (counts + date spans) for reconciliation.",
    )
    parser.add_argument(
        "--max-failure-pct",
        type=float,
        default=100.0,
        help=(
            "Exit non-zero if more than this percent of symbols returned no data. "
            "Default 100 keeps the daily job's behaviour; a backfill should set it low "
            "so a partial fetch is never mistaken for a complete one."
        ),
    )
    parser.add_argument(
        "--require-settled-end",
        action="store_true",
        help=(
            "Fail if the requested end date is today or later (UTC). VCI serves a "
            "PROVISIONAL bar for a session still in progress, so a backfill run during "
            "market hours would persist a partial bar that never gets corrected once it "
            "falls outside the refresh window. Pass the last settled session instead "
            "(scripts/print-expected-session-day.ts)."
        ),
    )
    parser.add_argument(
        "--retry-file",
        type=Path,
        default=None,
        help=(
            "Optional JSON {symbols: [...]} merged into the symbol list "
            "(e.g. data/fetch-retry-queue.json from build-fetch-retry-queue.ts)."
        ),
    )
    args = parser.parse_args()

    if args.end_date.strip():
        try:
            end = datetime.strptime(args.end_date.strip(), "%Y-%m-%d").date()
        except ValueError as e:
            raise SystemExit(f"Invalid --end-date {args.end_date!r}; use YYYY-MM-DD.") from e
    else:
        end = datetime.now(timezone.utc).date()
    if args.start.strip():
        try:
            start = datetime.strptime(args.start.strip(), "%Y-%m-%d").date()
        except ValueError as e:
            raise SystemExit(f"Invalid --start {args.start!r}; use YYYY-MM-DD.") from e
        if start >= end:
            raise SystemExit(f"--start {start} must be before end {end}")
    else:
        start = end - timedelta(days=max(args.calendar_days, 180))
    start_s = start.isoformat()
    end_s = end.isoformat()

    today_utc = datetime.now(timezone.utc).date()
    if end >= today_utc:
        msg = (
            f"end date {end} is today or later (UTC {today_utc}); the final bar may be a "
            f"provisional intraday snapshot rather than a settled session."
        )
        if args.require_settled_end:
            raise SystemExit(f"Refusing to fetch: {msg}")
        print(f"Warning: {msg}", file=sys.stderr)

    symbols = load_symbols(args.symbols_file)
    if args.retry_file is not None:
        extra = load_symbols(args.retry_file)
        symbols = sorted({*symbols, *extra})
    if args.limit > 0:
        symbols = symbols[: args.limit]

    if not symbols:
        raise SystemExit("No symbols to fetch.")

    args.output.parent.mkdir(parents=True, exist_ok=True)

    result: list[dict] = []
    # Two distinct failure modes, kept apart because they need different responses:
    # `errored` means the provider raised (retryable), `empty` means it answered
    # with nothing (often a delisted or not-yet-listed symbol). Collapsing them
    # would let an all-empty fetch report symbolsFailed = 0.
    errored: list[str] = []
    empty_symbols: list[str] = []
    manifest_rows: list[dict] = []
    total_bars = 0
    ok_syms = 0

    streaming = args.format == "ndjson"
    stream = args.output.open("w", encoding="utf-8") if streaming else None

    try:
        for i, sym in enumerate(symbols):
            try:
                bars = fetch_symbol_bars(sym, start_s, end_s)
                if len(bars) < 120:
                    print(
                        f"Warning: {sym} only {len(bars)} bars (want >=120 trading days where possible).",
                        file=sys.stderr,
                    )
            except Exception as e:
                print(f"FAIL {sym}: {_safe_exc_text(e)}", file=sys.stderr)
                errored.append(sym)
                bars = []

            entry = {"symbol": sym, "bars": bars}
            if streaming:
                # One symbol per line: peak memory stays at a single symbol
                # instead of the whole universe.
                stream.write(json.dumps(entry, separators=(",", ":")) + "\n")
            else:
                result.append(entry)

            total_bars += len(bars)
            if bars:
                ok_syms += 1
            elif sym not in errored:
                empty_symbols.append(sym)
            manifest_rows.append(
                {
                    "symbol": sym,
                    "bars": len(bars),
                    "firstTimeMs": bars[0]["time"] if bars else None,
                    "lastTimeMs": bars[-1]["time"] if bars else None,
                }
            )

            if i + 1 < len(symbols) and args.sleep > 0:
                time.sleep(args.sleep)
    finally:
        if stream is not None:
            stream.close()

    if not streaming:
        args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(
        f"Wrote {len(symbols)} symbols, {total_bars} total bars ({ok_syms} non-empty) "
        f"to {args.output.resolve()} [{args.format}]",
        file=sys.stderr,
    )

    if args.manifest is not None:
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(
            json.dumps(
                {
                    "capturedAt": datetime.now(timezone.utc).isoformat(),
                    "command": " ".join(sys.argv),
                    "params": {
                        "start": start_s,
                        "end": end_s,
                        "format": args.format,
                        "sleepSeconds": args.sleep,
                        "maxFailurePct": args.max_failure_pct,
                    },
                    "totals": {
                        "symbolsRequested": len(symbols),
                        "symbolsWithData": ok_syms,
                        # Anything without data, however it got there. Consumers
                        # must not infer completeness from `erroredSymbols` alone.
                        "symbolsFailed": len(symbols) - ok_syms,
                        "symbolsErrored": len(errored),
                        "symbolsEmpty": len(empty_symbols),
                        "totalBars": total_bars,
                    },
                    "failedSymbols": sorted({*errored, *empty_symbols}),
                    "erroredSymbols": errored,
                    "emptySymbols": empty_symbols,
                    "perSymbol": manifest_rows,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"Wrote manifest to {args.manifest.resolve()}", file=sys.stderr)

    if errored:
        print(f"Errored symbols ({len(errored)}): {', '.join(errored)}", file=sys.stderr)
    if empty_symbols:
        print(
            f"Empty (no data, no error) symbols ({len(empty_symbols)}): {', '.join(empty_symbols)}",
            file=sys.stderr,
        )

    # A partial fetch must never be handed downstream as a complete one.
    empty = len(symbols) - ok_syms
    empty_pct = (empty / len(symbols) * 100.0) if symbols else 0.0
    if empty_pct > args.max_failure_pct:
        raise SystemExit(
            f"{empty}/{len(symbols)} symbols ({empty_pct:.1f}%) returned no data, "
            f"over the --max-failure-pct {args.max_failure_pct} threshold. "
            f"Refusing to report success."
        )


if __name__ == "__main__":
    main()
