#!/usr/bin/env bash
# Production equity fetch + import for GHA (single path or stale-only shards).
# No DB writes except import-stock-bars upserts. Requires env from workflow.
set -euo pipefail

SHARD_COUNT="${FETCH_SHARD_COUNT:-1}"
USE_STALE="${USE_STALE:-0}"
FAIL_THRESHOLD_PCT="${FETCH_SHARD_FAIL_THRESHOLD_PCT:-5}"
MANIFEST_PATH="${FETCH_SHARD_MANIFEST_PATH:-fetch-shard-manifest.json}"
WORK_DIR="${GITHUB_WORKSPACE:-$(pwd)}"

END_DATE="${1:-}"
if [ -z "$END_DATE" ]; then
  echo "Usage: run-production-equity-fetch.sh <end-date YYYY-MM-DD>" >&2
  exit 1
fi

for var in STOCK_JSON RUNNER_TEMP SYMBOLS_JSON; do
  if [ -z "${!var:-}" ]; then
    echo "Missing env $var" >&2
    exit 1
  fi
done

if [ "$SHARD_COUNT" != "1" ] && [ "$SHARD_COUNT" != "2" ]; then
  echo "FETCH_SHARD_COUNT must be 1 or 2 (got $SHARD_COUNT)" >&2
  exit 1
fi

if [ "$SHARD_COUNT" -eq 2 ] && [ "$USE_STALE" != "1" ]; then
  echo "fetch_shard_count=2 requires stale-only mode (0 < stale < full universe)." >&2
  exit 1
fi

if [ "$SHARD_COUNT" -eq 2 ] && [ -z "${STALE_SYMBOLS_JSON:-}" ]; then
  echo "Missing env STALE_SYMBOLS_JSON (frozen stale snapshot from workflow listing step)" >&2
  exit 1
fi

python3 <<'PY' > "$MANIFEST_PATH.partial"
import json, os, datetime
summary_path = os.environ.get("STALE_TARGET_SUMMARY_JSON", "")
summary = {}
if summary_path and os.path.isfile(summary_path):
    with open(summary_path) as f:
        summary = json.load(f)
initial = summary.get("fetchTargetCount")
print(json.dumps({
    "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
    "fetchShardCount": int(os.environ.get("FETCH_SHARD_COUNT", "1")),
    "fetchTargetCount": initial,
    "initialFetchTargetCount": initial,
    "universeSize": summary.get("universeSize"),
    "expectedLatestSessionDay": summary.get("expectedLatestSessionDay"),
    "equityFetchMode": "stale-only" if os.environ.get("USE_STALE") == "1" else "full-universe",
    "frozenSnapshotPath": None,
    "shardTargetCounts": [],
    "uniqueTargetCount": None,
    "overlapCount": None,
    "shards": [],
}, indent=2))
PY

fail_if_over_threshold() {
  local failed="$1"
  local total="$2"
  local shard_label="$3"
  if [ "$total" -le 0 ]; then
    return 0
  fi
  local pct=$((failed * 100 / total))
  if [ "$pct" -gt "$FAIL_THRESHOLD_PCT" ]; then
    echo "Shard $shard_label: failed symbols $failed / $total (${pct}%) exceeds threshold ${FAIL_THRESHOLD_PCT}%" >&2
    return 1
  fi
  if [ "$failed" -gt 0 ]; then
    echo "Shard $shard_label: $failed failed symbol(s) (within ${FAIL_THRESHOLD_PCT}% threshold)."
  fi
  return 0
}

append_shard_manifest() {
  local idx="$1"
  local count="$2"
  local sym_file="$3"
  local stock_file="$4"
  local retry_file="$5"
  local target_count="$6"
  local failed="$7"
  local duration="$8"
  local import_ok="$9"
  python3 - "$MANIFEST_PATH.partial" "$idx" "$count" "$sym_file" "$stock_file" "$retry_file" "$target_count" "$failed" "$duration" "$import_ok" <<'PY'
import json, sys
path, idx, count, sym, stock, retry, target_count, failed, duration, import_ok = sys.argv[1:11]
target_count = int(target_count)
failed = int(failed)
fetched = max(0, target_count - failed)
with open(path) as f:
    doc = json.load(f)
doc["shards"].append({
    "shardIndex": int(idx),
    "shardCount": int(count),
    "targetSymbolCount": target_count,
    "symbolCount": target_count,
    "fetchedSymbolCount": fetched,
    "importedSymbolCount": fetched if import_ok == "true" else 0,
    "symbolsFile": sym,
    "stockBarsFile": stock,
    "retryQueueFile": retry,
    "failedSymbolCount": failed,
    "fetchDurationSeconds": int(duration),
    "importOk": import_ok == "true",
})
with open(path, "w") as f:
    json.dump(doc, f, indent=2)
PY
}

merge_frozen_split_into_manifest() {
  local freeze_meta="$1"
  python3 - "$MANIFEST_PATH.partial" "$freeze_meta" <<'PY'
import json, sys
path, meta_raw = sys.argv[1], sys.argv[2]
meta = json.loads(meta_raw)
with open(path) as f:
    doc = json.load(f)
doc["initialFetchTargetCount"] = meta["initialFetchTargetCount"]
doc["fetchTargetCount"] = meta["initialFetchTargetCount"]
doc["shardTargetCounts"] = meta["shardTargetCounts"]
doc["uniqueTargetCount"] = meta["uniqueTargetCount"]
doc["overlapCount"] = meta["overlapCount"]
doc["frozenSnapshotPath"] = meta["frozenSnapshotPath"]
with open(path, "w") as f:
    json.dump(doc, f, indent=2)
PY
}

fetch_and_import_shard() {
  local shard_index="${1:-}"
  local shard_count="${2:-1}"
  local symbols_json="$3"
  local stock_json="$4"
  local label="${5:-single}"

  local start end duration failed
  start=$(date +%s)
  python scripts/fetch_stock_bars.py \
    --symbols-file "$symbols_json" \
    --output "$stock_json" \
    --sleep 3.2 \
    --calendar-days 200 \
    --end-date "$END_DATE"

  local retry_file="${RUNNER_TEMP}/fetch-retry-queue-${label}.json"
  local retry_meta
  retry_meta="$(npx tsx scripts/build-fetch-retry-queue.ts "$stock_json" --out="$retry_file")"
  failed="$(echo "$retry_meta" | python3 -c "import json,sys; print(json.load(sys.stdin).get('failedSymbolCount',0))")"
  local sym_count
  sym_count="$(python3 -c "import json; print(len(json.load(open('$symbols_json')).get('symbols',[])))")"

  if ! fail_if_over_threshold "$failed" "$sym_count" "$label"; then
    exit 1
  fi

  npx tsx scripts/import-stock-bars.ts "$stock_json"

  end=$(date +%s)
  duration=$((end - start))

  if [ -n "$shard_index" ]; then
    cp "$stock_json" "${WORK_DIR}/stock-bars-shard-${shard_index}.json"
    cp "$retry_file" "${WORK_DIR}/fetch-retry-queue-shard-${shard_index}.json"
    append_shard_manifest "$shard_index" "$shard_count" \
      "${WORK_DIR}/stale-fetch-targets-shard-${shard_index}.json" \
      "${WORK_DIR}/stock-bars-shard-${shard_index}.json" \
      "${WORK_DIR}/fetch-retry-queue-shard-${shard_index}.json" \
      "$sym_count" "$failed" "$duration" "true"
  else
    cp "$retry_file" "${WORK_DIR}/fetch-retry-queue.json" 2>/dev/null || true
    append_shard_manifest "0" "1" "$symbols_json" "$stock_json" "${WORK_DIR}/fetch-retry-queue.json" \
      "$sym_count" "$failed" "$duration" "true"
  fi
}

if [ "$SHARD_COUNT" -eq 1 ]; then
  if [ "$USE_STALE" = "1" ]; then
    fetch_and_import_shard "" "1" "${FETCH_SYMBOLS_JSON}" "$STOCK_JSON" "single"
  else
    fetch_and_import_shard "" "1" "$SYMBOLS_JSON" "$STOCK_JSON" "single"
  fi
else
  echo "Freezing stale targets from ${STALE_SYMBOLS_JSON} before shard fetch/import"
  FREEZE_META="$(npx tsx scripts/write-frozen-stale-shard-files.ts \
    --frozen-file="$STALE_SYMBOLS_JSON" \
    --shard-count="$SHARD_COUNT" \
    --work-dir="$WORK_DIR" \
    --runner-temp="$RUNNER_TEMP")"
  echo "$FREEZE_META"
  merge_frozen_split_into_manifest "$FREEZE_META"

  OVERLAP_COUNT="$(echo "$FREEZE_META" | python3 -c "import json,sys; print(json.load(sys.stdin)['overlapCount'])")"
  if [ "$OVERLAP_COUNT" != "0" ]; then
    echo "Frozen shard overlap count $OVERLAP_COUNT (expected 0)" >&2
    exit 1
  fi

  i=0
  while [ "$i" -lt "$SHARD_COUNT" ]; do
    shard_symbols="${RUNNER_TEMP}/stale-fetch-targets-shard-${i}.json"
    shard_stock="${RUNNER_TEMP}/stock-bars-shard-${i}.json"
    fetch_and_import_shard "$i" "$SHARD_COUNT" "$shard_symbols" "$shard_stock" "shard-${i}"
    i=$((i + 1))
  done
fi

mv "$MANIFEST_PATH.partial" "$MANIFEST_PATH"
echo "Wrote $MANIFEST_PATH"
