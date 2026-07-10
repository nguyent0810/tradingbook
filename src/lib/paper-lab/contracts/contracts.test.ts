import { describe, expect, it } from "vitest";
import {
  DECISION_ACTIONS,
  CURRENTLY_EMITTED_ACTIONS,
  DECISION_ACTION_TO_PERSISTED,
  isDecisionAction,
} from "@/lib/paper-lab/contracts/decision-action";
import {
  POSITION_LIFECYCLE,
  TERMINAL_LIFECYCLE_STATES,
  LIFECYCLE_TRANSITIONS,
  isPositionLifecycle,
  isTerminalLifecycle,
} from "@/lib/paper-lab/contracts/position-lifecycle";
import {
  KNOWN_REASON_CODES,
  REASON_CODES,
  isKnownReasonCode,
} from "@/lib/paper-lab/contracts/reason-codes";
import {
  POSITION_HISTORY_EVENT_TYPES,
  positionHistoryEventSchema,
} from "@/lib/paper-lab/contracts/position-history";

describe("PositionLifecycle contract", () => {
  it("freezes the full 10-state vocabulary", () => {
    expect(POSITION_LIFECYCLE).toEqual([
      "OPEN",
      "ADDING",
      "PARTIAL_EXIT",
      "RUNNING",
      "TRAILING",
      "STOPPED",
      "TARGET_HIT",
      "TIME_EXIT",
      "ROTATED",
      "CLOSED",
    ]);
  });

  it("defines transitions for every state and terminal states have none", () => {
    for (const state of POSITION_LIFECYCLE) {
      expect(LIFECYCLE_TRANSITIONS[state]).toBeDefined();
    }
    for (const terminal of TERMINAL_LIFECYCLE_STATES) {
      if (terminal !== "CLOSED") {
        expect(LIFECYCLE_TRANSITIONS[terminal]).toEqual(["CLOSED"]);
      }
    }
    expect(LIFECYCLE_TRANSITIONS.CLOSED).toEqual([]);
    expect(isTerminalLifecycle("CLOSED")).toBe(true);
    expect(isTerminalLifecycle("OPEN")).toBe(false);
  });

  it("guards membership", () => {
    expect(isPositionLifecycle("TRAILING")).toBe(true);
    expect(isPositionLifecycle("NOPE")).toBe(false);
  });
});

describe("DecisionAction contract", () => {
  it("includes the required forward vocabulary plus retained EXIT", () => {
    for (const a of ["BUY", "SELL", "HOLD", "ADD", "REDUCE", "TRAIL", "ROTATE", "TIME_EXIT", "SKIP"]) {
      expect(DECISION_ACTIONS).toContain(a);
    }
    expect(DECISION_ACTIONS).toContain("EXIT"); // backward compat
  });

  it("keeps currently-emitted actions a subset of the contract", () => {
    for (const a of CURRENTLY_EMITTED_ACTIONS) {
      expect(DECISION_ACTIONS).toContain(a);
    }
    expect(CURRENTLY_EMITTED_ACTIONS).toEqual(["BUY", "SELL", "HOLD"]);
  });

  it("maps every action toward a persisted value (or null)", () => {
    for (const a of DECISION_ACTIONS) {
      expect(a in DECISION_ACTION_TO_PERSISTED).toBe(true);
    }
    expect(DECISION_ACTION_TO_PERSISTED.SKIP).toBe("HOLD");
    expect(DECISION_ACTION_TO_PERSISTED.TIME_EXIT).toBe("EXIT");
    expect(DECISION_ACTION_TO_PERSISTED.TRAIL).toBeNull();
    expect(isDecisionAction("ROTATE")).toBe(true);
    expect(isDecisionAction("FOO")).toBe(false);
  });
});

describe("ReasonCode contract", () => {
  it("exposes a unique catalog", () => {
    expect(KNOWN_REASON_CODES.length).toBeGreaterThan(0);
    expect(new Set(KNOWN_REASON_CODES).size).toBe(KNOWN_REASON_CODES.length);
    expect(REASON_CODES.BRK_A_VOL_CONFIRM).toBe("BRK_A_VOL_CONFIRM");
  });

  it("recognizes canonical codes but still tolerates legacy strings", () => {
    expect(isKnownReasonCode("ROTATE_INTO_LEADER")).toBe(true);
    // Legacy/free-form strings are not "known" but remain valid string[] payloads.
    expect(isKnownReasonCode("gate2_quality_A")).toBe(false);
  });
});

describe("PositionHistory event schema (contract only)", () => {
  it("lists the 8 supported event types", () => {
    expect(POSITION_HISTORY_EVENT_TYPES).toEqual([
      "OPEN",
      "ADD",
      "REDUCE",
      "STOP",
      "TARGET",
      "ROTATE",
      "TIME_EXIT",
      "CLOSE",
    ]);
  });

  it("parses a valid OPEN event and defaults reasonCodes to []", () => {
    const parsed = positionHistoryEventSchema.safeParse({
      positionId: "pos-1",
      type: "OPEN",
      sessionDate: "2026-07-08",
      quantityDelta: 1000,
      priceKvnd: 18.2,
      lifecycleTo: "OPEN",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reasonCodes).toEqual([]);
    }
  });

  it("rejects an unknown event type", () => {
    const parsed = positionHistoryEventSchema.safeParse({
      positionId: "pos-1",
      type: "FROBNICATE",
      sessionDate: "2026-07-08",
    });
    expect(parsed.success).toBe(false);
  });
});
