#!/usr/bin/env bash
# Enable EARLY_ENTRY_V1_ENABLED on Vercel Production and redeploy.
# Requires .secrets/vercel.env (see .secrets/vercel.env.example).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRETS_FILE="$REPO_ROOT/.secrets/vercel.env"
ENV_NAME="EARLY_ENTRY_V1_ENABLED"
ENV_VALUE="true"
VERCEL_ENV="production"

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Missing $SECRETS_FILE"
  echo "Copy .secrets/vercel.env.example to .secrets/vercel.env and set VERCEL_TOKEN."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$SECRETS_FILE"
set +a

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is not set in .secrets/vercel.env"
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI not found. Install with: npm i -g vercel"
  exit 1
fi

if [[ ! -f "$REPO_ROOT/.vercel/project.json" ]]; then
  echo "Vercel project not linked in this repo."
  echo "From the repo root, run: vercel link"
  echo "Then re-run: npm run ops:vercel:enable-early-entry"
  exit 1
fi

cd "$REPO_ROOT"

TOKEN_ARGS=(--token "$VERCEL_TOKEN")

echo "Checking Vercel authentication..."
if ! vercel whoami "${TOKEN_ARGS[@]}" >/dev/null 2>&1; then
  echo "Vercel token rejected. Update VERCEL_TOKEN in .secrets/vercel.env"
  exit 1
fi

echo "Listing Production environment variables..."
ENV_LIST="$(vercel env ls "$VERCEL_ENV" "${TOKEN_ARGS[@]}" 2>/dev/null || true)"

VALUE_FILE="$(mktemp)"
trap 'rm -f "$VALUE_FILE"' EXIT
printf '%s' "$ENV_VALUE" >"$VALUE_FILE"

if echo "$ENV_LIST" | grep -qE "(^|[[:space:]])${ENV_NAME}([[:space:]]|$)"; then
  echo "Updating existing ${ENV_NAME} on ${VERCEL_ENV}..."
  vercel env rm "$ENV_NAME" "$VERCEL_ENV" --yes "${TOKEN_ARGS[@]}" >/dev/null
fi

echo "Setting ${ENV_NAME} on ${VERCEL_ENV}..."
vercel env add "$ENV_NAME" "$VERCEL_ENV" "${TOKEN_ARGS[@]}" <"$VALUE_FILE" >/dev/null

echo "Redeploying Production..."
DEPLOY_OUTPUT="$(vercel --prod "${TOKEN_ARGS[@]}" 2>&1)"
DEPLOY_URL="$(echo "$DEPLOY_OUTPUT" | grep -Eo 'https://[^[:space:]]+' | tail -1 || true)"

echo ""
echo "Done."
echo "- ${ENV_NAME}=${ENV_VALUE} set on Vercel ${VERCEL_ENV}"
if [[ -n "$DEPLOY_URL" ]]; then
  echo "- Deployment URL: ${DEPLOY_URL}"
fi
echo "- Dashboard: https://tradingbook-phi.vercel.app/dashboard"
echo ""
echo "Verify after deploy:"
echo "  - Early Entry Research panel visible on RS radar"
echo "  - Pilot Candidate shown as research-only (not BUY)"
echo "  - EXTENDED — Do Not Chase shown as anti-FOMO warning"
