import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * Prospective count N for the Trạng thái kiểm chứng "Chưa kiểm chứng (N/100)".
 *
 * The registry lives on the public `prospective-registry` branch as an
 * append-only `decisions.ndjson`, written once per session by CI. N is the
 * number of rows the store marked `eligible` — the rows that count toward the
 * ADR 0001 checkpoint. The row schema is the prospective module's
 * `registry-schema.ts`, which is shadow-only: production code must not import
 * (or even name the path of) that module, so only `eligible` is read here.
 *
 * This is the network edge of the trade suggestion: the pure builder takes N as
 * an input. Any failure — network, HTTP status, a malformed row — yields `null`
 * ("N không rõ"); it never throws into the page and never guesses a number.
 */
const REGISTRY_URL =
  "https://raw.githubusercontent.com/nguyent0810/tradingbook/prospective-registry/decisions.ndjson";
const FETCH_TIMEOUT_MS = 5_000;

function countEligible(ndjson: string): number {
  let n = 0;
  for (const line of ndjson.split("\n")) {
    if (line.trim() === "") continue;
    // A malformed row throws: a partly read registry is not a count.
    const row = JSON.parse(line) as { eligible?: unknown };
    if (row.eligible === true) n += 1;
  }
  return n;
}

/** Cached for hours; throws on failure so a failure is never cached as a count. */
async function fetchProspectiveCountCached(): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag("prospective-registry");
  const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`prospective registry HTTP ${res.status}`);
  return countEligible(await res.text());
}

export async function loadProspectiveCount(): Promise<number | null> {
  try {
    return await fetchProspectiveCountCached();
  } catch (e) {
    console.error("[evidence] prospective registry read failed:", e);
    return null;
  }
}
