#!/usr/bin/env python3
"""
Step 0 spike: probe vnstock foreign-flow APIs for market-context Phase 1.

Tests:
  - Trading.foreign_trade (historical) on VCI for liquid symbols + VNINDEX
  - Trading.price_board session foreign snapshot (fallback path)
  - Missing/invalid symbols, VNINDEX aggregate, rate-limit behavior

Writes a JSON report (default: data/spike-foreign-trade-report.json).

Usage:
  python scripts/spike_foreign_trade.py
  python scripts/spike_foreign_trade.py --output data/spike-foreign-trade-report.json

Requires: pip install -r requirements.txt (tested with vnstock 4.0.2 / 4.0.4)
"""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Windows: vnstock / tqdm may emit Unicode; avoid cp1252 encode errors.
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
DEFAULT_OUT = ROOT / "data" / "spike-foreign-trade-report.json"
DEFAULT_SYMBOLS = ["VIC", "VNM", "FPT"]
LOOKBACK_CALENDAR_DAYS = 30


def _safe_exc(err: BaseException) -> dict[str, str]:
    root = err
    if hasattr(err, "last_attempt") and err.last_attempt is not None:
        try:
            root = err.last_attempt.exception() or err
        except Exception:
            root = err
    return {
        "type": type(err).__name__,
        "message": str(err).encode("ascii", errors="backslashreplace").decode("ascii"),
        "root_type": type(root).__name__,
        "root_message": str(root).encode("ascii", errors="backslashreplace").decode("ascii"),
    }


def _flatten_columns(columns: Any) -> list[str]:
    out: list[str] = []
    for col in columns:
        if isinstance(col, tuple):
            out.append("_".join(str(p) for p in col if p))
        else:
            out.append(str(col))
    return out


def _row_dict(df: Any, row_idx: int = 0) -> dict[str, Any]:
    row = df.iloc[row_idx]
    cols = _flatten_columns(df.columns)
    data: dict[str, Any] = {}
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


def _extract_foreign_snapshot(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize VCI price_board foreign fields when present."""
    buy_vol = row.get("match_foreign_buy_volume")
    sell_vol = row.get("match_foreign_sell_volume")
    buy_val = row.get("match_foreign_buy_value")
    sell_val = row.get("match_foreign_sell_value")
    symbol = row.get("listing_symbol") or row.get("symbol")
    session_hint = row.get("match_sending_time") or row.get("listing_sending_time")

    net_vol = None
    net_val = None
    if isinstance(buy_vol, (int, float)) and isinstance(sell_vol, (int, float)):
        net_vol = buy_vol - sell_vol
    if isinstance(buy_val, (int, float)) and isinstance(sell_val, (int, float)):
        net_val = buy_val - sell_val

    return {
        "symbol": symbol,
        "sessionHint": session_hint,
        "buyVolume": buy_vol,
        "sellVolume": sell_vol,
        "netVolume": net_vol,
        "buyValueVnd": buy_val,
        "sellValueVnd": sell_val,
        "netValueVnd": net_val,
        "units": {
            "volume": "shares",
            "value": "vnd_nominal",
        },
    }


def probe_foreign_trade(
    source: str,
    symbol: str,
    start: str,
    end: str,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "symbol": symbol,
        "source": source,
        "method": "foreign_trade",
        "start": start,
        "end": end,
        "ok": False,
    }
    t0 = time.time()
    try:
        trading = Trading(source=source, symbol=symbol, show_log=False)
        df = trading.foreign_trade(start=start, end=end)
        elapsed = time.time() - t0
        result["elapsedSec"] = round(elapsed, 3)
        if df is None:
            result["error"] = {"type": "NoneResult", "message": "foreign_trade returned None"}
            return result
        if hasattr(df, "empty"):
            result["rowCount"] = int(len(df))
            result["columns"] = list(df.columns)
            if len(df) > 0:
                result["sampleRows"] = df.head(3).to_dict(orient="records")
                if hasattr(df, "dtypes"):
                    result["dtypes"] = {str(k): str(v) for k, v in df.dtypes.items()}
            result["ok"] = len(df) > 0
        else:
            result["rawType"] = type(df).__name__
            result["rawValue"] = str(df)[:500]
    except Exception as err:
        result["elapsedSec"] = round(time.time() - t0, 3)
        result["error"] = _safe_exc(err)
    return result


def probe_price_board_foreign(
    source: str,
    symbols: list[str],
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "source": source,
        "method": "price_board",
        "symbols": symbols,
        "ok": False,
    }
    t0 = time.time()
    try:
        trading = Trading(source=source, symbol=symbols[0], show_log=False)
        kwargs: dict[str, Any] = {"symbols_list": symbols}
        if source.upper() == "KBS":
            kwargs["get_all"] = True
        df = trading.price_board(**kwargs)
        elapsed = time.time() - t0
        result["elapsedSec"] = round(elapsed, 3)
        result["rowCount"] = int(len(df))
        flat_cols = _flatten_columns(df.columns)
        result["columns"] = flat_cols
        result["foreignColumns"] = [c for c in flat_cols if "foreign" in c.lower()]

        snapshots: list[dict[str, Any]] = []
        for i in range(len(df)):
            row = _row_dict(df, i)
            snap = _extract_foreign_snapshot(row)
            snap["rowIndex"] = i
            snapshots.append(snap)
        result["snapshots"] = snapshots
        result["ok"] = len(snapshots) > 0
    except Exception as err:
        result["elapsedSec"] = round(time.time() - t0, 3)
        result["error"] = _safe_exc(err)
    return result


def probe_rate_limit(source: str, symbol: str, calls: int, sleep_sec: float) -> dict[str, Any]:
    trading = Trading(source=source, symbol=symbol, show_log=False)
    errors: list[dict[str, Any]] = []
    durations: list[float] = []

    for i in range(calls):
        t0 = time.time()
        try:
            trading.price_board(symbols_list=[symbol])
        except Exception as err:
            errors.append({"call": i, **_safe_exc(err)})
        durations.append(time.time() - t0)
        if sleep_sec > 0:
            time.sleep(sleep_sec)

    return {
        "source": source,
        "method": "price_board_rate_probe",
        "calls": calls,
        "sleepSec": sleep_sec,
        "errors": errors,
        "durationSec": {
            "min": round(min(durations), 3) if durations else None,
            "max": round(max(durations), 3) if durations else None,
            "avg": round(sum(durations) / len(durations), 3) if durations else None,
            "total": round(sum(durations), 3) if durations else None,
        },
        "note": (
            "Guest tier: ~20 requests/minute (vnstock rate-limit banner). "
            "Repo bar fetch uses --sleep 3.2 (~18/min). Burst probes may terminate the process."
        ),
    }


def build_report(symbols: list[str]) -> dict[str, Any]:
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=LOOKBACK_CALENDAR_DAYS)
    start_s = start.isoformat()
    end_s = end.isoformat()

    try:
        vnstock_version = importlib.metadata.version("vnstock")
    except importlib.metadata.PackageNotFoundError:
        vnstock_version = "unknown"

    report: dict[str, Any] = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "repo": {
            "requirementsTxt": (ROOT / "requirements.txt").read_text(encoding="utf-8").strip(),
            "runtimeVnstockVersion": vnstock_version,
            "existingBarFetchSource": "vnstock Quote source=VCI (scripts/fetch_vnindex.py, fetch_stock_bars.py)",
        },
        "probeWindow": {"start": start_s, "end": end_s},
        "foreignTradeHistorical": [],
        "priceBoardSnapshot": None,
        "indexAndAggregate": {},
        "missingSymbolBehavior": {},
        "rateLimit": {},
        "findings": {},
        "recommendedImportJsonShape": {},
    }

    for sym in symbols + ["VNINDEX"]:
        report["foreignTradeHistorical"].append(
            probe_foreign_trade("VCI", sym, start_s, end_s)
        )

    probe_symbols = symbols + ["VNINDEX", "HPG"]
    report["priceBoardSnapshot"] = probe_price_board_foreign("VCI", probe_symbols)

    report["indexAndAggregate"] = {
        "VNINDEX_priceBoard": next(
            (
                s
                for s in report["priceBoardSnapshot"].get("snapshots", [])
                if s.get("symbol") == "VNINDEX"
            ),
            None,
        ),
        "HOSE_aggregateViaForeignTrade": probe_foreign_trade("VCI", "HOSE", start_s, end_s),
        "note": "HOSE is not a valid equity symbol for VCI validate_symbol; expect validation error.",
    }

    invalid = probe_price_board_foreign("VCI", ["XYZFAKE"])
    report["missingSymbolBehavior"] = {
        "invalidSymbol": "XYZFAKE",
        "priceBoard": invalid,
    }

    report["rateLimit"] = {
        "paced": probe_rate_limit("VCI", symbols[0], calls=5, sleep_sec=3.2),
    }

    hist_ok = [p for p in report["foreignTradeHistorical"] if p.get("ok")]
    snap_ok = bool(report["priceBoardSnapshot"] and report["priceBoardSnapshot"].get("ok"))

    report["findings"] = {
        "historicalForeignTradeSupportedOnVciFree": len(hist_ok) > 0,
        "historicalForeignTradeError": (
            report["foreignTradeHistorical"][0].get("error") if report["foreignTradeHistorical"] else None
        ),
        "sessionForeignSnapshotSupportedOnVciPriceBoard": snap_ok,
        "vnindexForeignAvailable": bool(
            report["indexAndAggregate"].get("VNINDEX_priceBoard", {}).get("buyVolume")
            or report["indexAndAggregate"].get("VNINDEX_priceBoard", {}).get("sellVolume")
        ),
        "phase1Blocker": (
            "Free vnstock 4.x VCI does not implement Trading.foreign_trade; "
            "historical 5D/10D cannot be backfilled from this API alone."
            if len(hist_ok) == 0
            else None
        ),
        "phase1Fallback": (
            "Use VCI Trading.price_board session cumulative foreign fields and persist once per EOD import; "
            "or adopt vnstock_data sponsor package for foreign_flow()/foreign_trade history."
            if len(hist_ok) == 0
            else "foreign_trade historical rows available"
        ),
        "rateLimitGuestTier": "~20 requests/minute; align foreign fetch sleep with bar fetch (--sleep 3.2).",
    }

    report["recommendedImportJsonShape"] = {
        "description": "Normalized JSON for import-foreign-flow.ts (one file per import run).",
        "schema": {
            "meta": {
                "source": "vnstock:VCI",
                "method": "foreign_trade | price_board_eod_snapshot",
                "fetchedAt": "ISO-8601 UTC timestamp",
                "sessionDate": "YYYY-MM-DD UTC calendar day (expected VNINDEX session when known)",
                "startDate": "YYYY-MM-DD inclusive (historical only)",
                "endDate": "YYYY-MM-DD inclusive (historical only)",
                "symbolCount": "integer",
                "rowCount": "integer",
                "warnings": ["string"],
            },
            "symbols": [
                {
                    "symbol": "VIC",
                    "status": "ok | partial | error | not_found",
                    "error": "nullable string",
                    "rows": [
                        {
                            "date": "YYYY-MM-DD UTC calendar day",
                            "timeMs": "nullable UTC midnight epoch ms (align with import-bars.ts)",
                            "buyVolume": "nullable number (shares)",
                            "sellVolume": "nullable number (shares)",
                            "netVolume": "nullable number (shares, buy - sell)",
                            "buyValueVnd": "nullable number (full VND, not thousand-VND)",
                            "sellValueVnd": "nullable number (full VND)",
                            "netValueVnd": "nullable number (full VND, buy - sell)",
                        }
                    ],
                }
            ],
        },
        "notes": [
            "Value fields from VCI price_board are full VND nominal (e.g. 61388138000), not thousand-VND/share.",
            "Volume fields are share counts (integer-like floats).",
            "price_board rows are session-cumulative snapshots; set meta.method accordingly and date=sessionDate.",
            "Compute netVolume/netValueVnd at import if provider omits them.",
            "Use timeMs only when a reliable session date is resolved; else reject row or mark partial.",
        ],
    }

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Spike vnstock foreign flow APIs (Step 0)")
    parser.add_argument(
        "--output",
        "-o",
        default=str(DEFAULT_OUT),
        help="JSON report output path",
    )
    parser.add_argument(
        "--symbols",
        nargs="+",
        default=DEFAULT_SYMBOLS,
        help="Liquid symbols to probe (default: VIC VNM FPT)",
    )
    args = parser.parse_args()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    report = build_report([s.upper() for s in args.symbols])
    text = json.dumps(report, indent=2, ensure_ascii=False)
    out_path.write_text(text, encoding="utf-8")

    findings = report.get("findings", {})
    print(f"Wrote spike report to {out_path.resolve()}", file=sys.stderr)
    print(
        f"historical foreign_trade on VCI free: {findings.get('historicalForeignTradeSupportedOnVciFree')}",
        file=sys.stderr,
    )
    print(
        f"price_board foreign snapshot on VCI: {findings.get('sessionForeignSnapshotSupportedOnVciPriceBoard')}",
        file=sys.stderr,
    )
    if findings.get("phase1Blocker"):
        print(f"blocker: {findings['phase1Blocker']}", file=sys.stderr)
    if findings.get("phase1Fallback"):
        print(f"fallback: {findings['phase1Fallback']}", file=sys.stderr)


if __name__ == "__main__":
    main()
