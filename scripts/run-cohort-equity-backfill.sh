#!/usr/bin/env bash
# Cohort-only equity backfill: fetch + import upserts only. Never sets active=true on
# existing symbols (import-stock-bars only sets active=true when creating a new row).
#
# Preflight (read-only DB) runs before fetch. Shards fail if overlapCount != 0 or
# per-shard failure rate exceeds FETCH_SHARD_FAIL_THRESHOLD_PCT (default 5%).
#
#   SMOKE_DATABASE=production bash scripts/run-cohort-equity-backfill.sh \
#     --tier=a \
#     --cohort-file=data/expansion-300-cohort.json
#
# Tier B (+71):
#   SMOKE_DATABASE=production bash scripts/run-cohort-equity-backfill.sh --tier=b
#
# Full additive (+94):
#   SMOKE_DATABASE=production bash scripts/run-cohort-equity-backfill.sh --tier=all
set -euo pipefail

if [ -n "${PYTHON_BIN:-}" ]; then
  PYTHON=("$PYTHON_BIN")
elif command -v python3 >/dev/null 2>&1; then
  PYTHON=(python3)
elif command -v python >/dev/null 2>&1; then
  PYTHON=(python)
elif command -v py >/dev/null 2>&1; then
  PYTHON=(py -3)
else
  echo "Python not found. Set PYTHON_BIN." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TIER="a"
COHORT_FILE="data/expansion-300-cohort.json"
END_DATE=""
SHARD_COUNT="${FETCH_SHARD_COUNT:-2}"
FAIL_THRESHOLD_PCT="${FETCH_SHARD_FAIL_THRESHOLD_PCT:-5}"
ALLOW_BASELINE_FETCH=0
WORK_DIR="${COHORT_BACKFILL_WORK_DIR:-$ROOT/reports/cohort-backfill}"
WORK_DIR_REL="reports/cohort-backfill"
if [ -n "${COHORT_BACKFILL_RUNNER_TEMP:-}" ]; then
  RUNNER_TEMP="$COHORT_BACKFILL_RUNNER_TEMP"
else
  RUNNER_TEMP="$(mktemp -d -t cohort-backfill.XXXXXX)"
fi
MANIFEST_PATH="${COHORT_BACKFILL_MANIFEST:-$WORK_DIR/cohort-backfill-manifest.json}"

while [ $# -gt 0 ]; do
  case "$1" in
    --tier=*) TIER="${1#*=}" ;;
    --cohort-file=*) COHORT_FILE="${1#*=}" ;;
    --end-date=*) END_DATE="${1#*=}" ;;
    --shard-count=*) SHARD_COUNT="${1#*=}" ;;
    --work-dir=*) WORK_DIR="${1#*=}" ;;
    --fail-threshold-pct=*) FAIL_THRESHOLD_PCT="${1#*=}" ;;
    --allow-baseline-fetch) ALLOW_BASELINE_FETCH=1 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

if [ "$SHARD_COUNT" != "1" ] && [ "$SHARD_COUNT" != "2" ]; then
  echo "FETCH_SHARD_COUNT / --shard-count must be 1 or 2 (got $SHARD_COUNT)" >&2
  exit 1
fi

if [ -z "$END_DATE" ]; then
  END_DATE="$(npx tsx scripts/print-expected-session-day.ts)"
fi

mkdir -p "$WORK_DIR" "$RUNNER_TEMP"

echo "Cohort backfill: tier=$TIER symbols from $COHORT_FILE end-date=$END_DATE shards=$SHARD_COUNT"
echo "WORK_DIR=$WORK_DIR fail_threshold_pct=$FAIL_THRESHOLD_PCT"

PREFLIGHT_ARGS=(--cohort-file="$COHORT_FILE" --tier="$TIER")
if [ "$ALLOW_BASELINE_FETCH" -eq 1 ]; then
  PREFLIGHT_ARGS+=(--allow-baseline-fetch)
fi
echo "Running preflight (read-only)..."
npx tsx scripts/validate-cohort-backfill-preflight.ts "${PREFLIGHT_ARGS[@]}"

FREEZE_ARGS=(
  --cohort-file="$COHORT_FILE"
  --tier="$TIER"
  --shard-count="$SHARD_COUNT"
  --work-dir="$WORK_DIR"
  --runner-temp="$RUNNER_TEMP"
)
if [ "$ALLOW_BASELINE_FETCH" -eq 1 ]; then
  FREEZE_ARGS+=(--allow-baseline-fetch)
fi

FREEZE_META="$(npx tsx scripts/write-cohort-shard-files.ts "${FREEZE_ARGS[@]}")"
echo "$FREEZE_META"

OVERLAP_COUNT="$(echo "$FREEZE_META" | "${PYTHON[@]}" -c "import json,sys; print(json.load(sys.stdin)['overlapCount'])")"
REQUESTED="$(echo "$FREEZE_META" | "${PYTHON[@]}" -c "import json,sys; print(json.load(sys.stdin)['initialFetchTargetCount'])")"
if [ "$OVERLAP_COUNT" != "0" ]; then
  echo "Cohort shard overlap $OVERLAP_COUNT (expected 0)" >&2
  exit 1
fi

export FREEZE_META SHARD_COUNT END_DATE FAIL_THRESHOLD_PCT
"${PYTHON[@]}" <<'PY' > "$MANIFEST_PATH.partial"
import json, os, datetime
meta = json.loads(os.environ["FREEZE_META"])
print(json.dumps({
    "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
    "mode": "cohort_backfill_only",
    "activatesSymbols": False,
    "cohortFile": meta.get("cohortFile"),
    "tier": meta.get("tier"),
    "allowBaselineFetch": meta.get("allowBaselineFetch", False),
    "fetchShardCount": int(os.environ.get("SHARD_COUNT", "2")),
    "failThresholdPct": int(os.environ.get("FAIL_THRESHOLD_PCT", "5")),
    "initialFetchTargetCount": meta.get("initialFetchTargetCount"),
    "shardTargetCounts": meta.get("shardTargetCounts"),
    "uniqueTargetCount": meta.get("uniqueTargetCount"),
    "overlapCount": meta.get("overlapCount"),
    "frozenSnapshotPath": meta.get("frozenSnapshotPath"),
    "endDate": os.environ.get("END_DATE"),
    "shards": [],
}, indent=2))
PY

fail_if_over_threshold() {
  local failed="$1"
  local total="$2"
  local shard_label="$3"
  if [ "$total" -le 0 ]; then return 0; fi
  local pct=$((failed * 100 / total))
  if [ "$pct" -gt "$FAIL_THRESHOLD_PCT" ]; then
    echo "Shard $shard_label: failed $failed / $total (${pct}%) exceeds threshold ${FAIL_THRESHOLD_PCT}%" >&2
    return 1
  fi
  if [ "$failed" -gt 0 ]; then
    echo "Shard $shard_label: $failed failed symbol(s) (within ${FAIL_THRESHOLD_PCT}% threshold)."
  fi
  return 0
}

append_shard_manifest() {
  "${PYTHON[@]}" - "$@" <<'PY'
import json, sys
path, idx, count, sym, stock, retry, target_count, failed, duration = sys.argv[1:10]
target_count, failed, duration = int(target_count), int(failed), int(duration)
fetched = max(0, target_count - failed)
with open(path) as f:
    doc = json.load(f)
doc["shards"].append({
    "shardIndex": int(idx),
    "shardCount": int(count),
    "targetSymbolCount": target_count,
    "fetchedSymbolCount": fetched,
    "importedSymbolCount": fetched,
    "symbolsFile": sym,
    "stockBarsFile": stock,
    "retryQueueFile": retry,
    "failedSymbolCount": failed,
    "fetchDurationSeconds": duration,
    "importOk": True,
})
with open(path, "w") as f:
    json.dump(doc, f, indent=2)
PY
}

i=0
while [ "$i" -lt "$SHARD_COUNT" ]; do
  sym_file="$WORK_DIR/cohort-fetch-targets-shard-${i}.json"
  sym_file_rel="$WORK_DIR_REL/cohort-fetch-targets-shard-${i}.json"
  stock_file="$WORK_DIR/cohort-stock-bars-shard-${i}.json"
  label="cohort-shard-${i}"
  start=$(date +%s)

  "${PYTHON[@]}" scripts/fetch_stock_bars.py \
    --symbols-file "$sym_file" \
    --output "$stock_file" \
    --sleep 3.2 \
    --calendar-days 200 \
    --end-date "$END_DATE"

  retry_file="$WORK_DIR/cohort-retry-queue-shard-${i}.json"
  retry_meta="$(npx tsx scripts/build-fetch-retry-queue.ts "$stock_file" --out="$retry_file")"
  failed="$(echo "$retry_meta" | "${PYTHON[@]}" -c "import json,sys; print(json.load(sys.stdin).get('failedSymbolCount',0))")"
  sym_count="$(cd "$ROOT" && "${PYTHON[@]}" -c "import json; print(len(json.load(open('$sym_file_rel')).get('symbols',[])))")"

  if ! fail_if_over_threshold "$failed" "$sym_count" "$label"; then
    exit 1
  fi

  npx tsx scripts/import-stock-bars.ts "$stock_file"

  end=$(date +%s)
  duration=$((end - start))

  append_shard_manifest "$MANIFEST_PATH.partial" "$i" "$SHARD_COUNT" \
    "$sym_file" \
    "$stock_file" \
    "$retry_file" \
    "$sym_count" "$failed" "$duration"

  i=$((i + 1))
done

mv "$MANIFEST_PATH.partial" "$MANIFEST_PATH"
echo "Wrote $MANIFEST_PATH (requested=$REQUESTED symbols, tier=$TIER)"
echo "Post-run: SMOKE_DATABASE=production npx tsx scripts/verify-cohort-backfill-alignment.ts --tier=$TIER --cohort-file=$COHORT_FILE"
