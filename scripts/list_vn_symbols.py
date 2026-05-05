#!/usr/bin/env python3
"""
Emit JSON array of {symbol, exchange, name} for scripts/seed-stock-symbols.ts (provider path).

Uses vnstock Listing(source='VCI'). Requires network. On failure exits with code 2.

Usage:
  python scripts/list_vn_symbols.py > /tmp/symbols.json
"""
from __future__ import annotations

import json
import sys

try:
    from vnstock import Listing
except ImportError:
    print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(2)


def main() -> None:
    listing = Listing(source="VCI")
    df = listing.all_symbols()
    if df is None or df.empty:
        print("Empty listing", file=sys.stderr)
        sys.exit(2)

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

    json.dump(out, sys.stdout, ensure_ascii=False)
    print()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)
