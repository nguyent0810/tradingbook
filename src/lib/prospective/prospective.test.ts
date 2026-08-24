/**
 * The four safety proofs the plan requires before this registry may collect
 * anything: immutability, production isolation, look-ahead impossibility, and
 * failure safety.
 *
 * These tests assert SAFETY AND CORRECTNESS ONLY. Nothing here says, or could
 * say, anything about whether feasibility predicts returns — no prospective
 * observation exists yet, by construction.
 */
import { execFileSync } from "node:child_process";
import {
  appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHECKPOINTS,
  CLASSIFIER_BLOBS,
  CLASSIFIER_PIN_ROOTS,
  OUTCOME_HORIZON_SESSIONS,
  OUTCOME_VERSION,
  PROSPECTIVE_START_EXCLUSIVE,
  SCHEMA_VERSION,
  GENESIS_HASH,
  hashEntry,
  isEligible,
  setupIdFor,
  type DecisionEntry,
} from "./registry-schema";
import {
  appendDecision,
  appendOutcome,
  decisionsPath,
  outcomesPath,
  readDecisions,
  readOutcomes,
  verifyClassifierBlobs,
  verifyRegistry,
} from "./registry-store";
import { buildDecisionEntry, guardSession, runRecorderSafely, type ObservationInput } from "./recorder";
import { computeOutcome, type FutureBar } from "./outcomes";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "prospective-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function observation(over: Partial<ObservationInput> = {}): ObservationInput {
  return {
    symbol: "AAA",
    session: "2026-09-01",
    decisionRecordedAt: "2026-09-01T10:00:00.000Z",
    sourceDataCutoff: "2026-09-01",
    codeSha: "deadbeef",
    classifierBlobs: CLASSIFIER_BLOBS,
    entryPriceKVnd: 20,
    structuralStopKVnd: 18.6,
    riskFrac: 0.07,
    atrKVnd: 0.5,
    board: "HOSE",
    avgDailyValueVnd: 5_000_000_000,
    minStopFrac: 0.03,
    bindingFloor: "volatility",
    v1Visibility: "SHOWN",
    feasibility: "FEASIBLE",
    feasibilityReasons: ["stop_executable"],
    gate1Level: "PASS",
    quality: "A",
    validity: "VALID",
    breakoutLevelKVnd: 19.8,
    stopDistancePct: 7,
    ma20DistPct: 2.1,
    ma50DistPct: 6.4,
    volRatioMedian: 1.8,
    volRatioMean: 1.6,
    lastInputBarDate: "2026-09-01",
    inputBarCount: 120,
    ...over,
  };
}

function bars(n: number, from = 2): FutureBar[] {
  return Array.from({ length: n }, (_, i) => {
    const d = String(from + i).padStart(2, "0");
    return { date: `2026-09-${d}`, open: 20, high: 20.5, low: 19.5, close: 20.1 };
  });
}

// ---------------------------------------------------------------- PROOF 1

describe("proof 1 — the registry is append-only and decision rows are immutable", () => {
  it("derives setupId and eligibility, and lets only the store seal a row", () => {
    const c = buildDecisionEntry(observation());
    expect(c.setupId).toBe(setupIdFor("AAA", "2026-09-01"));
    expect(c.schemaVersion).toBe(SCHEMA_VERSION);
    expect(c.eligible).toBe(true);
    expect("entryHash" in c).toBe(false); // the caller cannot supply the hash

    expect(appendDecision(c, dir).ok).toBe(true);
    const stored = readDecisions(dir)[0]!;
    expect(stored.seq).toBe(0);
    expect(stored.prevEntryHash).toBe(GENESIS_HASH);
    const { entryHash, ...body } = stored;
    expect(hashEntry(body)).toBe(entryHash);
  });

  it("chains rows, so deleting or reordering one is detectable", () => {
    for (const symbol of ["AAA", "BBB", "CCC"]) {
      expect(appendDecision(buildDecisionEntry(observation({ symbol })), dir).ok).toBe(true);
    }
    expect(verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE).ok).toBe(true);

    const lines = readFileSync(decisionsPath(dir), "utf-8").trim().split(/\r?\n/);
    expect(lines).toHaveLength(3);

    // Delete the middle row: every surviving row still hashes correctly on its
    // own, so only the chain can catch this.
    writeFileSync(decisionsPath(dir), `${[lines[0], lines[2]].join("\n")}\n`, "utf-8");
    const afterDelete = verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE);
    expect(afterDelete.ok).toBe(false);
    expect(afterDelete.chainBreaks.length).toBeGreaterThan(0);
    expect(afterDelete.hashMismatches).toHaveLength(0); // each row is individually valid

    // Reorder instead of deleting.
    writeFileSync(decisionsPath(dir), `${[lines[1], lines[0], lines[2]].join("\n")}\n`, "utf-8");
    expect(verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE).chainBreaks.length).toBeGreaterThan(0);

    // Truncate the tail.
    writeFileSync(decisionsPath(dir), `${lines[0]}\n`, "utf-8");
    expect(verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE).ok).toBe(true); // a prefix is still a valid chain
    expect(readDecisions(dir)).toHaveLength(1);
  });

  it("recomputes eligibility at the storage boundary, so it cannot be forged", () => {
    const forged = { ...buildDecisionEntry(observation({ feasibility: "NOT_FEASIBLE_LIQUIDITY" })), eligible: true };
    expect(appendDecision(forged, dir).ok).toBe(true);
    const stored = readDecisions(dir)[0]!;
    expect(stored.eligible).toBe(false); // the frozen rule wins over the caller
    expect(verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE).ok).toBe(true);
  });

  it("the verifier rejects a row whose eligibility contradicts the frozen rule", () => {
    appendDecision(buildDecisionEntry(observation({ feasibility: "NOT_FEASIBLE_LIQUIDITY" })), dir);
    const stored = readDecisions(dir)[0]!;
    const body: Record<string, unknown> = { ...stored };
    delete body.entryHash;
    const forgedBody = { ...body, eligible: true };
    writeFileSync(decisionsPath(dir), `${JSON.stringify({ ...forgedBody, entryHash: hashEntry(forgedBody) })}\n`, "utf-8");

    const report = verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE);
    expect(report.hashMismatches).toHaveLength(0); // rehashed, so the row looks internally consistent
    expect(report.forgedEligibility).toContain(stored.setupId);
    expect(report.ok).toBe(false);
  });

  it("detects any post-hoc edit to a decision row, field by field", () => {
    appendDecision(buildDecisionEntry(observation()), dir);
    const e = readDecisions(dir)[0]!;

    // Tamper with each decision-time field in turn; every one must be caught.
    const fields: (keyof DecisionEntry)[] = [
      "feasibility", "v1Visibility", "entryPriceKVnd", "structuralStopKVnd", "riskFrac",
      "gate1Level", "quality", "sourceDataCutoff", "codeSha", "session", "minStopFrac",
    ];
    for (const f of fields) {
      const tampered = { ...e, [f]: typeof e[f] === "number" ? (e[f] as number) + 1 : "TAMPERED" };
      writeFileSync(decisionsPath(dir), `${JSON.stringify(tampered)}\n`, "utf-8");
      const report = verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE);
      expect(report.ok, `edit to ${String(f)} went undetected`).toBe(false);
    }
  });

  it("refuses a duplicate setupId instead of overwriting the first record", () => {
    const e = buildDecisionEntry(observation());
    expect(appendDecision(e, dir).ok).toBe(true);

    const conflicting = buildDecisionEntry(observation({ feasibility: "NOT_FEASIBLE_NOISE" }));
    expect(conflicting.setupId).toBe(e.setupId); // same symbol+session
    const r = appendDecision(conflicting, dir);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.refusal).toBe("DUPLICATE_SETUP_ID");

    const stored = readDecisions(dir);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.feasibility).toBe("FEASIBLE"); // the original verdict survived
  });

  it("appending an outcome cannot alter the decision file", () => {
    const e = buildDecisionEntry(observation());
    appendDecision(e, dir);
    const before = readFileSync(decisionsPath(dir), "utf-8");

    const c = computeOutcome({ setupId: e.setupId, session: e.session, riskFrac: e.riskFrac, futureBars: bars(6) });
    expect(c.ready).toBe(true);
    if (!c.ready) return;
    expect(appendOutcome({ ...c.entry, outcomeRecordedAt: "2026-09-08T10:00:00.000Z" }, dir).ok).toBe(true);

    expect(readFileSync(decisionsPath(dir), "utf-8")).toBe(before);
    expect(verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE).ok).toBe(true);
  });

  it("refuses an outcome twice, and an outcome with no decision", () => {
    const e = buildDecisionEntry(observation());
    appendDecision(e, dir);
    const c = computeOutcome({ setupId: e.setupId, session: e.session, riskFrac: e.riskFrac, futureBars: bars(6) });
    if (!c.ready) throw new Error("unreachable");
    const row = { ...c.entry, outcomeRecordedAt: "2026-09-08T10:00:00.000Z" };

    expect(appendOutcome(row, dir).ok).toBe(true);
    const second = appendOutcome(row, dir);
    expect(second.ok === false && second.refusal).toBe("OUTCOME_ALREADY_EXISTS");

    const orphan = appendOutcome({ ...row, setupId: "not-a-real-setup" }, dir);
    expect(orphan.ok === false && orphan.refusal).toBe("NO_DECISION_FOR_OUTCOME");
    expect(readOutcomes(dir)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- PROOF 2

describe("proof 2 — production isolation", () => {
  const files = ["registry-schema.ts", "registry-store.ts", "recorder.ts", "outcomes.ts"];

  it("has zero production call sites", () => {
    // Walking the working tree, not `git grep`: git grep skips untracked files, so
    // a freshly-written production import could sneak past it — including this
    // module itself while it is still untracked. The filesystem cannot be fooled
    // that way.
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, e.name).split(/[\\/]/).join("/");
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(e.name)) {
          if (readFileSync(full, "utf-8").includes("lib/prospective")) hits.push(full);
        }
      }
    };
    for (const root of ["src", "app", "scripts"]) if (existsSync(root)) walk(root);

    // Only the module itself and the standalone replay scripts may reference it.
    for (const h of hits) {
      expect(
        h.startsWith("src/lib/prospective/") || h.startsWith("scripts/replay/"),
        `unexpected importer of the prospective registry: ${h}`,
      ).toBe(true);
    }
    expect(hits.length).toBeGreaterThan(0); // the walk actually found this module
  });

  it("imports nothing from the scanner, the database, or any request path", () => {
    for (const f of files) {
      const src = readFileSync(join("src/lib/prospective", f), "utf-8");
      const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!);
      for (const i of imports) {
        expect(
          i.startsWith("node:") || i.startsWith("./"),
          `${f} imports ${i} — the registry must depend on nothing but node builtins and itself`,
        ).toBe(true);
      }
      expect(src).not.toMatch(/prisma/i);
    }
  });

  it("cannot write to the production database: no client, no mutation verbs", () => {
    for (const f of files) {
      const src = readFileSync(join("src/lib/prospective", f), "utf-8");
      expect(src).not.toMatch(/\.(createMany|updateMany|upsert|deleteMany|\$executeRaw|\$queryRaw)\b/);
      expect(src).not.toMatch(/\b(prisma|PrismaClient)\b/);
    }
  });

  it("has no truncating write path at all — the only registry verb is append", () => {
    for (const f of files) {
      const src = readFileSync(join("src/lib/prospective", f), "utf-8");
      expect(src, `${f} must not truncate or overwrite registry files`)
        .not.toMatch(/\b(writeFileSync|writeFile|truncateSync|createWriteStream)\\s*\(/);
      // `rmSync` exists only to release the lock file. It must never be pointed at
      // a registry file, so every call site is checked, not just the verb.
      for (const m of src.matchAll(/rmSync\(([^)]*)\)/g)) {
        expect(m[1], `${f}: rmSync must only remove the lock`).toContain("path");
      }
      expect(src).not.toMatch(/rmSync\((decisionsPath|outcomesPath)/);
    }
  });

  it("does not export anything that decides visibility, ordering or size", () => {
    for (const f of files) {
      const src = readFileSync(join("src/lib/prospective", f), "utf-8");
      expect(src).not.toMatch(/export function (decide|rank|size|surface)/);
    }
  });
});

// ---------------------------------------------------------------- PROOF 3

describe("proof 3 — look-ahead is impossible, not merely avoided", () => {
  it("refuses to record a session when any later bar already exists", () => {
    const r = guardSession({ session: "2026-09-01", maxBarDateInDb: "2026-09-08", lastInputBarDate: "2026-09-01" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.refusal).toBe("OUTCOME_DATA_ALREADY_EXISTS");
  });

  it("accepts a session recorded on the day it settled", () => {
    expect(guardSession({ session: "2026-09-01", maxBarDateInDb: "2026-09-01", lastInputBarDate: "2026-09-01" }).ok).toBe(true);
  });

  it("refuses anything at or before the frozen boundary, forever", () => {
    for (const s of ["2026-08-21", "2026-08-24", "2015-01-05"]) {
      const r = guardSession({ session: s, maxBarDateInDb: s, lastInputBarDate: s });
      expect(r.ok, `${s} must never enter the prospective set`).toBe(false);
      expect(r.ok === false && r.refusal).toBe("BEFORE_PROSPECTIVE_BOUNDARY");
    }
    expect(isEligible("2026-08-24", "FEASIBLE")).toBe(false);
    expect(isEligible("2026-08-25", "FEASIBLE")).toBe(true);
  });

  it("refuses when the input bars do not reach the session being recorded", () => {
    const r = guardSession({ session: "2026-09-01", maxBarDateInDb: "2026-08-31", lastInputBarDate: "2026-08-31" });
    expect(r.ok === false && r.refusal).toBe("STALE_INPUT_BARS");
  });

  it("refuses outright to compute an outcome from a bar at or before the decision", () => {
    // A same-session bar stored at 07:00Z passes a SQL `date > 2026-09-01T00:00Z`
    // filter. The refusal here is what stops that becoming a written row.
    const c = computeOutcome({
      setupId: "x",
      session: "2026-09-01",
      riskFrac: 0.07,
      futureBars: [{ date: "2026-09-01", open: 20, high: 21, low: 19, close: 20 }, ...bars(5)],
    });
    expect(c.ready).toBe(false);
    expect(c.ready === false && c.reason).toBe("BAR_AT_OR_BEFORE_DECISION");
  });

  it("the verifier also rejects an outcome whose recorded bars precede the decision", () => {
    const e = buildDecisionEntry(observation());
    appendDecision(e, dir);
    const c = computeOutcome({ setupId: e.setupId, session: e.session, riskFrac: e.riskFrac, futureBars: bars(6) });
    if (!c.ready) throw new Error("unreachable");
    appendOutcome(
      { ...c.entry, outcomeRecordedAt: "2026-09-08T10:00:00.000Z", barDatesUsed: ["2026-09-01", ...c.entry.barDatesUsed] },
      dir,
    );
    const report = verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE);
    expect(report.ok).toBe(false);
    expect(report.outcomesBeforeDecision).toContain(e.setupId);
  });

  it("outcome windows are T+5 for every path, matching the primary endpoint", () => {
    const c = computeOutcome({ setupId: "x", session: "2026-09-01", riskFrac: 0.07, futureBars: bars(30) });
    if (!c.ready) throw new Error("unreachable");
    expect(OUTCOME_HORIZON_SESSIONS).toBe(5);
    // T+1 through T+5 inclusive, where T+1 is the entry bar. Not one bar more.
    expect(c.entry.barDatesUsed).toHaveLength(5);
    expect(c.entry.outcomeVersion).toBe(OUTCOME_VERSION);
  });

  it("reports not-ready rather than a truncated window when outcomes have not settled", () => {
    for (let n = 0; n < 5; n++) {
      const c = computeOutcome({ setupId: "x", session: "2026-09-01", riskFrac: 0.07, futureBars: bars(n) });
      expect(c.ready, `${n} bars must not produce an outcome`).toBe(false);
    }
    expect(computeOutcome({ setupId: "x", session: "2026-09-01", riskFrac: 0.07, futureBars: bars(5) }).ready).toBe(true);
  });

  it("anchors fwd1 on the entry bar itself, not the session after it", () => {
    const seq: FutureBar[] = [
      { date: "2026-09-02", open: 100, high: 105, low: 99, close: 110 },
      { date: "2026-09-03", open: 110, high: 111, low: 109, close: 120 },
      { date: "2026-09-04", open: 120, high: 121, low: 119, close: 130 },
      { date: "2026-09-05", open: 130, high: 131, low: 129, close: 140 },
      { date: "2026-09-06", open: 140, high: 141, low: 139, close: 150 },
    ];
    const c = computeOutcome({ setupId: "x", session: "2026-09-01", riskFrac: null, futureBars: seq });
    if (!c.ready) throw new Error("unreachable");
    // entry = open of T+1 = 100; fwd1 = close of T+1 = 110, NOT the close of T+2.
    expect(c.entry.fwd1).toBeCloseTo(0.10, 10);
    expect(c.entry.fwd3).toBeCloseTo(0.30, 10);
    expect(c.entry.fwd5).toBeCloseTo(0.50, 10);
    expect(c.entry.barDatesUsed[0]).toBe("2026-09-02");
    expect(c.entry.barDatesUsed[4]).toBe("2026-09-06");
  });

  it("computes stop-first, MFE and MAE from the forward window only", () => {
    const custom: FutureBar[] = [
      { date: "2026-09-02", open: 100, high: 101, low: 99, close: 100 },
      { date: "2026-09-03", open: 100, high: 102, low: 92, close: 93 },  // stop (93) hit here
      { date: "2026-09-04", open: 93, high: 115, low: 93, close: 114 },  // target (114) only later
      { date: "2026-09-05", open: 114, high: 116, low: 113, close: 115 },
      { date: "2026-09-06", open: 115, high: 117, low: 114, close: 116 },
    ];
    const c = computeOutcome({ setupId: "x", session: "2026-09-01", riskFrac: 0.07, futureBars: custom });
    if (!c.ready) throw new Error("unreachable");
    expect(c.entry.entryOpenKVnd).toBe(100);
    expect(c.entry.stopFirst).toBe(true);      // stop (93) on T+2, target (114) only on T+3
    expect(c.entry.mae5).toBeCloseTo(-0.08, 6); // low 92
    expect(c.entry.mfe5).toBeCloseTo(0.17, 6);  // high 117
    expect(c.entry.fwd5).toBeCloseTo(0.16, 6);  // close 116
    expect(c.entry.win5).toBe(true);
  });
});

// ---------------------------------------------------------------- PROOF 4

describe("proof 4 — failure safety", () => {
  it("never throws out of the recorder, whatever the inner failure", () => {
    const r = runRecorderSafely(() => { throw new Error("disk on fire"); });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toBe("disk on fire");
  });

  it("reads an absent or empty registry as empty rather than failing", () => {
    expect(readDecisions(dir)).toEqual([]);
    expect(readOutcomes(dir)).toEqual([]);
    writeFileSync(decisionsPath(dir), "", "utf-8");
    expect(readDecisions(dir)).toEqual([]);
    expect(verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE).ok).toBe(true);
  });

  it("survives a crash mid-append instead of being bricked by one bad line", () => {
    const e = buildDecisionEntry(observation());
    appendDecision(e, dir);
    // Simulate a process killed between the record and its newline.
    appendFileSync(decisionsPath(dir), `${JSON.stringify(buildDecisionEntry(observation({ symbol: "BBB" }))).slice(0, 120)}`, "utf-8");

    // The intact record is still readable — one interrupted write does not
    // destroy the cohort.
    const rows = readDecisions(dir);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.symbol).toBe("AAA");

    // And the damage is reported rather than silently tolerated.
    const report = verifyRegistry(dir, PROSPECTIVE_START_EXCLUSIVE);
    expect(report.ok).toBe(false);
    expect(report.malformedLines).toHaveLength(1);
  });

  it("refuses to append onto an unterminated line rather than splicing two records", () => {
    appendDecision(buildDecisionEntry(observation()), dir);
    appendFileSync(decisionsPath(dir), "{\"partial\":", "utf-8");
    const r = appendDecision(buildDecisionEntry(observation({ symbol: "CCC" })), dir);
    expect(r.ok === false && r.refusal).toBe("TRAILING_PARTIAL_LINE");
    expect(readFileSync(decisionsPath(dir), "utf-8").endsWith("{\"partial\":")).toBe(true);
  });

  it("returns a refusal instead of throwing when the filesystem rejects the write", () => {
    // `package.json/decisions.ndjson` cannot exist: the parent is a file. The old
    // version let this escape as an exception from the actual write path.
    const r = appendDecision(buildDecisionEntry(observation()), "package.json");
    expect(r.ok).toBe(false);
    expect(r.ok === false && (r.refusal === "WRITE_FAILED" || r.refusal === "REGISTRY_LOCKED")).toBe(true);
  });

  it("refuses a second concurrent writer rather than racing it", () => {
    // Hold the lock the way a running recorder would.
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, ".registry.lock"), "", "utf-8");

    const r = appendDecision(buildDecisionEntry(observation()), dir);
    expect(r.ok === false && r.refusal).toBe("REGISTRY_LOCKED");
    expect(existsSync(decisionsPath(dir))).toBe(false);

    rmSync(join(dir, ".registry.lock"));
    expect(appendDecision(buildDecisionEntry(observation()), dir).ok).toBe(true);
  });

  it("refuses to append onto a file whose existing rows are corrupt", () => {
    mkdirSync(dir, { recursive: true });
    appendFileSync(decisionsPath(dir), `not json${"\n"}`, "utf-8");
    const r = appendDecision(buildDecisionEntry(observation()), dir);
    expect(r.ok === false && r.refusal).toBe("MALFORMED_EXISTING_ROWS");
  });

  it("refuses to write when the classifier is not byte-identical to the frozen version", () => {
    const bad = verifyClassifierBlobs(() => "0000000000000000000000000000000000000000");
    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.mismatches).toHaveLength(Object.keys(CLASSIFIER_BLOBS).length);
  });

  it("pins the whole classifier closure, not just its entry points", () => {
    // Recompute the transitive closure of local imports from the four roots. If a
    // future edit adds an import, that file must be pinned too — otherwise a
    // threshold could move with the pin still reporting OK, which is exactly the
    // hole the reviewer found in the first version of this list.
    const seen = new Set<string>();
    const stack = [...CLASSIFIER_PIN_ROOTS];
    while (stack.length) {
      const f = stack.pop()!;
      if (seen.has(f) || !existsSync(f)) continue;
      seen.add(f);
      const src = readFileSync(f, "utf-8");
      for (const m of src.matchAll(/from "([^"]+)"/g)) {
        const spec = m[1]!;
        const base = spec.startsWith("@/")
          ? `src/${spec.slice(2)}`
          : spec.startsWith(".")
            ? join(f, "..", spec).split(/[\\/]/).join("/")
            : null;
        if (!base) continue;
        for (const cand of [`${base}.ts`, `${base}/index.ts`, base]) {
          if (existsSync(cand)) { stack.push(cand); break; }
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(CLASSIFIER_BLOBS).sort());
  });

  it("the frozen classifier still matches the blob hashes recorded in the plan", () => {
    const check = verifyClassifierBlobs((p) =>
      execFileSync("git", ["hash-object", p], { encoding: "utf-8" }).trim(),
    );
    expect(check.ok === false ? check.mismatches : []).toEqual([]);
  });
});

// ---------------------------------------------------------------- freeze

describe("frozen constants — changing one of these invalidates the cohort", () => {
  it("holds the boundary, schema, outcome version and checkpoints fixed", () => {
    expect(PROSPECTIVE_START_EXCLUSIVE).toBe("2026-08-24");
    expect(SCHEMA_VERSION).toBe("prospective-registry@1.0.0");
    expect(OUTCOME_VERSION).toBe("outcomes@1.0.0");
    expect([...CHECKPOINTS]).toEqual([100, 250, 500]);
  });

  it("admits only FEASIBLE and NOT_FEASIBLE_NOISE to the primary", () => {
    expect(isEligible("2026-09-01", "FEASIBLE")).toBe(true);
    expect(isEligible("2026-09-01", "NOT_FEASIBLE_NOISE")).toBe(true);
    expect(isEligible("2026-09-01", "NOT_FEASIBLE_LIQUIDITY")).toBe(false);
    expect(isEligible("2026-09-01", "UNKNOWN_INPUT")).toBe(false);
  });

  it("records ineligible setups rather than discarding them", () => {
    const e = buildDecisionEntry(observation({ feasibility: "NOT_FEASIBLE_LIQUIDITY" }));
    expect(e.eligible).toBe(false);
    expect(appendDecision(e, dir).ok).toBe(true);
    expect(readDecisions(dir)).toHaveLength(1);
  });

  it("the live registry, whatever it contains, passes every integrity check", () => {
    const live = "docs/trading/replay/prospective";
    if (!existsSync(decisionsPath(live)) && !existsSync(outcomesPath(live))) return;
    expect(verifyRegistry(live, PROSPECTIVE_START_EXCLUSIVE).ok).toBe(true);
  });
});
