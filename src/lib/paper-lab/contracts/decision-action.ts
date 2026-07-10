/**
 * Phase 0.5 contract — Decision action vocabulary.
 *
 * Forward-looking superset of agent actions. This is a TS-only contract; the
 * PERSISTED action enum remains `PaperAgentAction` (BUY/SELL/HOLD/EXIT/REDUCE/ADD)
 * and the runtime zod `AgentActionSchema` is unchanged. A future phase will
 * reconcile the persisted enum with this contract.
 *
 * Current agents continue emitting only BUY / SELL / HOLD.
 */

export const DECISION_ACTIONS = [
  "BUY",
  "SELL",
  "HOLD",
  "ADD",
  "REDUCE",
  "TRAIL",
  "ROTATE",
  "TIME_EXIT",
  "SKIP",
  // Retained for backward compatibility with the current engine / PaperAgentAction.
  "EXIT",
] as const;

export type DecisionAction = (typeof DECISION_ACTIONS)[number];

/** What the legacy mock agents actually emit today (unchanged this phase). */
export const CURRENTLY_EMITTED_ACTIONS = ["BUY", "SELL", "HOLD"] as const;
export type CurrentlyEmittedAction = (typeof CURRENTLY_EMITTED_ACTIONS)[number];

/**
 * Non-enforced mapping notes from the new contract to the persisted
 * `PaperAgentAction` values, for the future reconciliation phase:
 *   TRAIL      → (no persisted equivalent yet; position-state update)
 *   ROTATE     → composed of REDUCE/EXIT + BUY (see rotation model)
 *   TIME_EXIT  → EXIT (with a TIME_EXIT reason code / PaperExitReason.TIME_EXIT)
 *   SKIP       → HOLD (no order)
 */
export const DECISION_ACTION_TO_PERSISTED: Readonly<Record<DecisionAction, string | null>> = {
  BUY: "BUY",
  SELL: "SELL",
  HOLD: "HOLD",
  ADD: "ADD",
  REDUCE: "REDUCE",
  EXIT: "EXIT",
  TRAIL: null,
  ROTATE: null,
  TIME_EXIT: "EXIT",
  SKIP: "HOLD",
};

export function isDecisionAction(value: string): value is DecisionAction {
  return (DECISION_ACTIONS as readonly string[]).includes(value);
}
