#!/usr/bin/env python3
"""
Emit JSON array of {symbol, exchange, name} for scripts/seed-stock-symbols.ts (provider path).

Uses vnstock Listing with provider fallback (`VCI` -> `KBS` -> `MSN`).
Requires network. On failure exits with code 2.

Usage:
  python scripts/list_vn_symbols.py > /tmp/symbols.json
"""
from __future__ import annotations

import json
import sys
import argparse

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

try:
    from vnstock import Listing
except ImportError:
    print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(2)


def _load_listing_with_fallback():
    last_error: Exception | None = None
    for source in ("VCI", "KBS", "MSN"):
        try:
            listing = Listing(source=source)
            df = listing.all_symbols()
            if df is None or df.empty:
                raise RuntimeError(f"{source}: empty listing")
            return source, df
        except Exception as e:
            last_error = e
            print(f"[list_vn_symbols] provider {source} failed: {e}", file=sys.stderr)
    if last_error:
        raise last_error
    raise RuntimeError("Unable to load any listing provider")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export VN symbol universe to JSON")
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Optional file path to save JSON with UTF-8 encoding",
    )
    args = parser.parse_args()

    source, df = _load_listing_with_fallback()

    col_map = {c.lower(): c for c in df.columns}
    sym_col = col_map.get("symbol")
    if not sym_col:
        print(f"No symbol column in {list(df.columns)}", file=sys.stderr)
        sys.exit(2)

    name_col = col_map.get("organ_name") or col_map.get("name")
    exch_col = col_map.get("exchange") or col_map.get("floor")

    out: list[dict] = []
    for _, row in df.iterrows():
        sym = str(row[sym_col]).strip().upper()
        if not sym or sym == "NAN":
            continue
        item: dict = {"symbol": sym}
        if exch_col:
            ex = row[exch_col]
            if ex is not None and str(ex).strip():
                item["exchange"] = str(ex).strip()
        if name_col:
            nm = row[name_col]
            if nm is not None and str(nm).strip():
                item["name"] = str(nm).strip()
        out.append(item)

    print(f"[list_vn_symbols] provider {source} returned {len(out)} symbols", file=sys.stderr)
    if args.output:
      with open(args.output, "w", encoding="utf-8") as f:
          json.dump(out, f, ensure_ascii=False, indent=2)
          f.write("\n")
      print(f"[list_vn_symbols] wrote {args.output}", file=sys.stderr)
    else:
      json.dump(out, sys.stdout, ensure_ascii=False)
      print()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)
