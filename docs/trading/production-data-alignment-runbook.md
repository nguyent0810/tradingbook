# Production data alignment — expand active universe beyond ~39 symbols

Use this when **cron and `/api/cron/daily-scan` are healthy** but production still scans **~39 symbols**. That almost always means **`StockSymbol.active`** (and/or **`SCAN_SYMBOL_LIMIT`** on Vercel) reflects an old **seed/ramp/curation** state—not scanner scoring.

This runbook **does not change application code or scanner rules**. It sequences **read-only checks**, then **explicit DB mutations** via existing scripts.

See also: [production-verification-runbook.md](./production-verification-runbook.md) (read-only checks), [universe-quality-curation.md](./universe-quality-curation.md), [scan-coverage-expansion-plan.md](./scan-coverage-expansion-plan.md).

---

## Safety (non-negotiable)

- **Never commit** production `DATABASE_URL`, `CRON_SECRET`, API keys, or any copy-pasted prod `.env` file.
- **Never paste secrets** into tickets, screenshots, or CI logs.
- Prefer **one shell session** with temporary variables only:

  **bash / zsh**

  ```bash
  export DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require'
  ```

  **PowerShell**

  ```powershell
  $env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require'
  ```

- Repo scripts load **`.env`** then **`.env.local`** ([`scripts/load-env.ts`](../../scripts/load-env.ts)). A file named **`.env.prod.local`** is **not** auto-loaded; use it only as a **local scratch pad** if you want—but **`.env*` is gitignored** and you must still **export variables into the shell** before running commands, or duplicate keys into session-only `.env.local` (also gitignored). **Do not commit.**

- Confirm **`DATABASE_URL`** points at **production** before any mutating script: the CLI prints a **host/database fingerprint** (not credentials)—read it every time.

---

## 1. Verify production baseline (read-only)

With **`DATABASE_URL`** aimed at **production**:

```bash
npx tsx scripts/verify-deployment-health.ts
npx tsx scripts/verify-deployment-health.ts --json
```

Interpret:

| Field | Meaning |
|--------|---------|
| **`activeSymbolsCount`** | Rows with **`StockSymbol.active === true`** — this drives “universe size” for scans when no low cap applies. |
| **`latestDailyScanRun.symbolCountTotal`** / **`symbolCountScanned`** | What the **last completed scan** actually considered; should move **above ~39** after alignment. |
| **`scanSymbolLimitEnv` / `scanSymbolLimitParsed`** | Effective **CLI/script** hint only here; **the deployed cron** uses **Vercel `SCAN_SYMBOL_LIMIT`**. |

**Vercel dashboard**

- **Settings → Environment Variables → Production**: ensure **`SCAN_SYMBOL_LIMIT`** is **unset** (full active universe) **or** set to an integer **≥** your target active count.  
  If it is **`39`**, the scanner will **never exceed 39** regardless of DB curation.

---

## 2. Ensure **VNINDEX** session alignment (required before curation)

[`scripts/curate-active-symbols.ts`](../../scripts/curate-active-symbols.ts) aborts if there is **no VNINDEX row** in **`IndexDailyBar`** (“cannot align session”).

With **`DATABASE_URL`** → production **and** working Python deps (`pip install -r requirements.txt`):

```bash
npm run fetch:vnindex
npx tsx scripts/import-bars.ts
```

That writes **`data/vnindex.json`** locally, then upserts **VNINDEX** bars into the DB pointed to by **`DATABASE_URL`**.

Optional sanity:

```bash
npx tsx scripts/verify-vnindex-bars.ts
```

*(If this fails, fix index data before stock curation.)*

---

## 3. Seed **stock symbols** into production

[`scripts/seed-stock-symbols.ts`](../../scripts/seed-stock-symbols.ts):

1. Tries **`python scripts/list_vn_symbols.py`** (provider / network).
2. Falls back to tracked **`data/vn-symbols-seed.json`**.

It **upserts every symbol** in the chosen source. **`--ramp-target=N`** activates only the **first N symbols alphabetically** and sets **`active: false`** for all others—use **only** when you intentionally want that pattern.

**Typical alignment toward a larger curated universe**

- Seed **without** `--ramp-target` **once**, so all listed symbols exist and default **`active: true`**—then **narrow with curation** (step 4).  
  **Or** use **`--ramp-target=300`** if you explicitly want an alphabetical cap **before** bars import (see docs in [scan-coverage-expansion-plan.md](./scan-coverage-expansion-plan.md)).

Example (production **`DATABASE_URL`** already exported):

```bash
npx tsx scripts/seed-stock-symbols.ts
# or, e.g. alphabetical ramp first:
# npx tsx scripts/seed-stock-symbols.ts --ramp-target=300
```

The script writes **`data/active-symbol-keys.json` locally** from **whatever DB `DATABASE_URL` pointed at**. After aiming at prod, that file represents **production’s active tickers**—use it for the **next fetch** step.

---

## 4. Fetch / import **equity** bars safely (provider throttling)

### Ordering

1. **Symbols must exist** in **`StockSymbol`** (step 3).  
2. **Bars must exist** before **`curate-active-symbols --require-latest-bar`** can succeed.

### Fetch ([`scripts/fetch_stock_bars.py`](../../scripts/fetch_stock_bars.py))

- **`--sleep`** (default **3.2** s): stay **≥ ~3.0** to respect **vnstock guest ~20 req/min** guidance (script docstring). Increase if you see rate errors (**e.g. `--sleep 4.5`**).
- **`--calendar-days`** (default **200**): **≥ 180** recommended for history depth.
- **`--limit N`**: fetch **only the first N** symbols from the JSON list—use for **pilot batches** (e.g. **50**, then **100**, …).
- **`--symbols-file`**: optional explicit list JSON if you do **not** want the default **`data/active-symbol-keys.json`**.

Examples:

```bash
# Pilot: first 80 active symbols, conservative throttle
python scripts/fetch_stock_bars.py --output data/stock-bars.json --limit 80 --sleep 3.5 --calendar-days 220

# Full active list from keys file (long-running)
python scripts/fetch_stock_bars.py --output data/stock-bars.json --sleep 3.2 --calendar-days 220
```

### Import ([`scripts/import-stock-bars.ts`](../../scripts/import-stock-bars.ts))

With **`DATABASE_URL`** → production:

```bash
npx tsx scripts/import-stock-bars.ts data/stock-bars.json
```

Repeat **fetch → import** in batches until coverage is acceptable (`report-bar-coverage.ts` / `universe-quality-curation.md`).

---

## 5. Curate **`active`** symbols on production (explicit opt-in)

[`scripts/curate-active-symbols.ts`](../../scripts/curate-active-symbols.ts) — **dry-run by default**; **`--apply`** persists **`StockSymbol.active`**.

**Dry-run** (no writes):

```bash
npx tsx scripts/curate-active-symbols.ts --target=300 --require-latest-bar --min-bars=120 --sort=liquidity20d
```

**Apply** after reviewing stderr output:

```bash
npx tsx scripts/curate-active-symbols.ts --target=300 --require-latest-bar --min-bars=120 --sort=liquidity20d --apply
```

Variations (documented in [`universe-quality-curation.md`](./universe-quality-curation.md)):

- Add **`--require-tradability`** when you want tradability evaluation reflected in who stays active (still **not** changing scanner scoring constants).

---

## 6. Trigger cron manually (production)

Use **`CRON_SECRET`** from Vercel (**never** log the value):

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://tradingbook-phi.vercel.app/api/cron/daily-scan"
```

Expect **HTTP 200** and **`ok: true`**.

---

## 7. Verify after alignment

Again with **`DATABASE_URL`** → production:

```bash
npx tsx scripts/verify-deployment-health.ts --json
```

Success criteria (adjust to your policy):

| Check | Expect |
|--------|--------|
| **`activeSymbolsCount`** | **> 39** (target depends on curation; staging reference ~208 is illustrative only). |
| **`latestDailyScanRun.symbolCountTotal`** | **> 39** when **`SCAN_SYMBOL_LIMIT`** is not capping lower. |
| **`symbolCountScanned`** | Close to **`symbolCountTotal`** minus intentional skips; **> 39** after alignment. |
| **`symbolCountFailed`** | **Low vs prior runs**; investigate spikes via **`errorSummary`** on the run row / Vercel logs—not via committing secrets. |

Confirm **Vercel production `SCAN_SYMBOL_LIMIT`** still matches intent (**unset** for full universe).

---

## 8. Quick decision tree

```text
verify-deployment-health → active ~39 & SCAN_SYMBOL_LIMIT unset?
  ├─ SCAN_SYMBOL_LIMIT caps at 39 → unset or raise on Vercel, redeploy, re-cron.
  └─ Limit OK → ensure VNINDEX imported → seed symbols → fetch/import bars → curate (--apply) → cron → verify counts again.
```

---

## 9. Operational checklist (copy for tickets)

- [ ] **`DATABASE_URL`** exported for **prod**; fingerprint in script output matches prod.
- [ ] **`SCAN_SYMBOL_LIMIT`** checked on **Vercel Production**.
- [ ] **VNINDEX** bars present (`fetch:vnindex` + `import-bars`).
- [ ] **Seed** run (`seed-stock-symbols.ts`; ramp flags intentional).
- [ ] **Equity bars** fetched with **`--sleep ≥ ~3`** (and pilot **`--limit`** if needed).
- [ ] **`import-stock-bars.ts`** run against prod.
- [ ] **Curate** dry-run reviewed → **`--apply`** if acceptable.
- [ ] **Cron** triggered with **Bearer** secret.
- [ ] **`verify-deployment-health.ts --json`** shows raised **`symbolCountTotal` / `symbolCountScanned` / `activeSymbolsCount`** and acceptable **`symbolCountFailed`**.
