#!/usr/bin/env python3
"""
Fetch forward-only EOD foreign snapshots via vnstock VCI Trading.price_board.

Writes grouped JSON for import-foreign-flow.ts. Does NOT use foreign_trade API.

Usage:
  python scripts/fetch_foreign_snapshot.py
  python scripts/fetch_foreign_snapshot.py \
    --symbols-file data/active-symbol-keys.json \
    --session-date 2026-06-03 \
    --output data/foreign-snapshot.json \
    --batch-size 10 \
    --sleep 3.2

Requires: pip install -r requirements.txt
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

try:
    from vnstock import Trading
except ImportError:
    print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "data" / "foreign-snapshot.json"
ACTIVE_KEYS = ROOT / "data" / "active-symbol-keys.json"
SOURCE = "vnstock:VCI"
CAPTURE_METHOD = "price_board_eod_snapshot"
EXCLUDED = {"VNINDEX", "HOSE", "HNX", "UPCOM"}


def _safe_exc_text(err: BaseException) -> str:
    return str(err).encode("ascii", errors="backslashreplace").decode("ascii")


def _flatten_columns(columns) -> list[str]:
    out: list[str] = []
    for col in columns:
        if isinstance(col, tuple):
            out.append("_".join(str(p) for p in col if p))
        else:
            out.append(str(col))
    return out


def _row_dict(df, row_idx: int = 0) -> dict:
    row = df.iloc[row_idx]
    cols = _flatten_columns(df.columns)
    data: dict = {}
    for col_name, val in zip(cols, row.tolist(), strict=False):
        if hasattr(val, "item"):
            try:
                val = val.item()
            except Exception:
                pass
        if isinstance(val, float) and val != val:
            val = None
        data[col_name] = val
    return data


def _finite_number(val) -> float | None:
    if isinstance(val, (int, float)) and val == val:
        return float(val)
    return None


def _extract_row(raw: dict) -> dict | None:
    buy_vol = _finite_number(raw.get("match_foreign_buy_volume"))
    sell_vol = _finite_number(raw.get("match_foreign_sell_volume"))
    buy_val = _finite_number(raw.get("match_foreign_buy_value"))
    sell_val = _finite_number(raw.get("match_foreign_sell_value"))
    if buy_vol is None and sell_vol is None and buy_val is None and sell_val is None:
        return None
    net_vol = buy_vol - sell_vol if buy_vol is not None and sell_vol is not None else None
    net_val = buy_val - sell_val if buy_val is not None and sell_val is not None else None
    return {
        "buyVolume": buy_vol,
        "sellVolume": sell_vol,
        "netVolume": net_vol,
        "buyValueVnd": buy_val,
        "sellValueVnd": sell_val,
        "netValueVnd": net_val,
    }


def load_symbols(symbols_file: Path | None) -> list[str]:
    path = symbols_file or ACTIVE_KEYS
    if not path.is_file():
        raise FileNotFoundError(f"Symbol list not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "symbols" in data:
        raw = data["symbols"]
    elif isinstance(data, list):
        raw = data
    else:
        raise ValueError("Expected { symbols: [] } or a JSON array")
    symbols = [str(s).strip().upper() for s in raw if str(s).strip()]
    return [s for s in symbols if s not in EXCLUDED]


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def fetch_foreign_snapshot(
    symbols: list[str],
    *,
    batch_size: int,
    sleep_sec: float,
) -> tuple[list[dict], list[str]]:
    trading = Trading(source="VCI", symbol=symbols[0] if symbols else "VIC", show_log=False)
    entries: list[dict] = []
    warnings: list[str] = []
    seen: set[str] = set()

    for batch in chunked(symbols, batch_size):
        try:
            df = trading.price_board(symbols_list=batch)
        except Exception as err:
            for sym in batch:
                entries.append(
                    {
                        "symbol": sym,
                        "status": "error",
                        "error": _safe_exc_text(err),
                        "sessionHint": None,
                        "row": None,
                    }
                )
            if sleep_sec > 0:
                time.sleep(sleep_sec)
            continue

        for i in range(len(df)):
            raw = _row_dict(df, i)
            symbol = raw.get("listing_symbol") or raw.get("symbol")
            if not isinstance(symbol, str) or not symbol.strip():
                continue
            sym = symbol.strip().upper()
            seen.add(sym)
            session_hint = raw.get("match_sending_time") or raw.get("listing_sending_time")
            row = _extract_row(raw)
            if row is None:
                entries.append(
                    {
                        "symbol": sym,
                        "status": "error",
                        "error": "missing foreign columns in price_board row",
                        "sessionHint": str(session_hint) if session_hint is not None else None,
                        "row": None,
                    }
                )
            else:
                entries.append(
                    {
                        "symbol": sym,
                        "status": "ok",
                        "error": None,
                        "sessionHint": str(session_hint) if session_hint is not None else None,
                        "row": row,
                    }
                )

        for sym in batch:
            if sym not in seen:
                entries.append(
                    {
                        "symbol": sym,
                        "status": "error",
                        "error": "symbol missing from price_board response",
                        "sessionHint": None,
                        "row": None,
                    }
                )

        if sleep_sec > 0:
            time.sleep(sleep_sec)

    ok_rows = [e for e in entries if e.get("status") == "ok" and e.get("row")]
    all_zero = [
        e["symbol"]
        for e in ok_rows
        if e.get("row")
        and all(e["row"].get(k) == 0 for k in ("buyVolume", "sellVolume", "buyValueVnd", "sellValueVnd"))
    ]
    if all_zero:
        warnings.append(f"{len(all_zero)} symbol(s) returned ALL_ZERO foreign fields")

    return entries, warnings


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch VCI price_board foreign EOD snapshots")
    parser.add_argument("--symbols-file", type=Path, default=None)
    parser.add_argument("--session-date", required=True, help="Expected VNINDEX session YYYY-MM-DD")
    parser.add_argument("--output", "-o", default=str(DEFAULT_OUT))
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--sleep", type=float, default=3.2, help="Seconds between batches")
    args = parser.parse_args()

    symbols = load_symbols(args.symbols_file)
    if not symbols:
        raise RuntimeError("No symbols to fetch")

    entries, warnings = fetch_foreign_snapshot(
        symbols,
        batch_size=max(1, args.batch_size),
        sleep_sec=max(0.0, args.sleep),
    )

    payload = {
        "meta": {
            "source": SOURCE,
            "captureMethod": CAPTURE_METHOD,
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "sessionDate": args.session_date,
            "symbolCount": len(symbols),
            "rowCount": len([e for e in entries if e.get("status") == "ok"]),
            "batchSize": args.batch_size,
            "sleepSec": args.sleep,
            "warnings": warnings,
        },
        "symbols": entries,
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(
        f"Wrote foreign snapshot: {len(entries)} entries ({payload['meta']['rowCount']} ok) -> {out_path.resolve()}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
