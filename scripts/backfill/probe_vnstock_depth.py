#!/usr/bin/env python3
"""
Preflight probe: how much history does vnstock actually serve for OUR universe?

Gate 1 evidence for the 8-year backfill. Writes a reproducible artifact recording
the exact parameters, per-symbol row counts and date spans, and any failures —
so the volume/runtime estimates behind the backfill plan can be re-checked rather
than taken on trust.

Read-only. Touches no database.

Usage:
  python scripts/backfill/probe_vnstock_depth.py --sample 8 --seed 3 \
      --out docs/trading/backfill-8y/vnstock-depth-probe.json
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        try:
            _s.reconfigure(encoding="utf-8")
        except Exception:
            pass

try:
    from vnstock import Quote
except ImportError:
    print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[2]
ACTIVE_KEYS = ROOT / "data" / "active-symbol-keys.json"


def load_symbols() -> list[str]:
    data = json.loads(ACTIVE_KEYS.read_text(encoding="utf-8"))
    raw = data["symbols"] if isinstance(data, dict) else data
    return [str(s).strip().upper() for s in raw if str(s).strip()]


def main() -> None:
    ap = argparse.ArgumentParser(description="Probe vnstock history depth for the active universe")
    ap.add_argument("--sample", type=int, default=8, help="How many symbols to sample (0 = all)")
    ap.add_argument("--seed", type=int, default=3, help="RNG seed so the sample is reproducible")
    ap.add_argument("--start", default="2017-01-01", help="History start requested")
    ap.add_argument("--end", default="", help="History end (default: UTC today)")
    ap.add_argument("--sleep", type=float, default=3.2, help="Seconds between requests (guest quota)")
    ap.add_argument("--out", type=Path, default=None, help="Artifact JSON path")
    args = ap.parse_args()

    end = args.end.strip() or datetime.now(timezone.utc).date().isoformat()
    universe = load_symbols()
    if args.sample and args.sample < len(universe):
        rng = random.Random(args.seed)
        sample = sorted(rng.sample(universe, args.sample))
    else:
        sample = universe

    rows: list[dict] = []
    failures: list[dict] = []
    started = time.time()

    for i, sym in enumerate(sample):
        try:
            df = Quote(symbol=sym, source="VCI").history(start=args.start, end=end, interval="1D")
            if df is None or df.empty:
                failures.append({"symbol": sym, "error": "empty_result"})
                rows.append({"symbol": sym, "bars": 0, "firstDate": None, "lastDate": None})
            else:
                rows.append(
                    {
                        "symbol": sym,
                        "bars": int(len(df)),
                        "firstDate": str(df["time"].min())[:10],
                        "lastDate": str(df["time"].max())[:10],
                    }
                )
        except Exception as err:  # noqa: BLE001 - record and continue, one bad symbol must not abort the probe
            msg = str(err).encode("ascii", errors="backslashreplace").decode("ascii")
            failures.append({"symbol": sym, "error": msg[:200]})
            rows.append({"symbol": sym, "bars": 0, "firstDate": None, "lastDate": None})
        if i + 1 < len(sample) and args.sleep > 0:
            time.sleep(args.sleep)

    elapsed = time.time() - started
    ok = [r for r in rows if r["bars"] > 0]
    total_bars = sum(r["bars"] for r in rows)
    universe_size = len(universe)

    artifact = {
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "command": " ".join(sys.argv),
        "params": {
            "start": args.start,
            "end": end,
            "sampleSize": len(sample),
            "seed": args.seed,
            "sleepSeconds": args.sleep,
            "universeSize": universe_size,
        },
        "results": {
            "symbolsProbed": len(sample),
            "symbolsWithData": len(ok),
            "totalBars": total_bars,
            "maxBars": max((r["bars"] for r in rows), default=0),
            "minBarsAmongOk": min((r["bars"] for r in ok), default=0),
            "meanBarsAmongOk": round(sum(r["bars"] for r in ok) / len(ok), 1) if ok else 0,
            "earliestDate": min((r["firstDate"] for r in ok), default=None),
            "elapsedSeconds": round(elapsed, 1),
            "secondsPerSymbol": round(elapsed / len(sample), 2) if sample else 0,
        },
        "extrapolation": {
            "note": "Linear extrapolation from the sample to the full active universe.",
            "estimatedTotalBars": int(
                round(sum(r["bars"] for r in ok) / len(ok) * universe_size)
            )
            if ok
            else 0,
            "estimatedFetchMinutes": round(elapsed / len(sample) * universe_size / 60, 1)
            if sample
            else 0,
        },
        "perSymbol": rows,
        "failures": failures,
    }

    text = json.dumps(artifact, indent=2, ensure_ascii=False)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
        print(f"Wrote probe artifact to {args.out}", file=sys.stderr)
    else:
        print(text)

    r = artifact["results"]
    e = artifact["extrapolation"]
    print(
        f"{r['symbolsWithData']}/{r['symbolsProbed']} symbols, {r['totalBars']} bars, "
        f"earliest {r['earliestDate']}, {r['secondsPerSymbol']}s/symbol → "
        f"est. {e['estimatedTotalBars']} bars / {e['estimatedFetchMinutes']} min for {universe_size} symbols",
        file=sys.stderr,
    )
    if failures:
        print(f"failures ({len(failures)}): {[f['symbol'] for f in failures]}", file=sys.stderr)


if __name__ == "__main__":
    main()
