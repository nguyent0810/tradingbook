/**
 * Phase 0.5 contract — Position lifecycle vocabulary.
 *
 * Frozen state set for future position management. The current engine only ever
 * initializes `OPEN` and never transitions. `PaperPositionStatus`
 * (OPEN/PARTIAL/CLOSED) remains the field the current engine reads/writes; this
 * lifecycle is a finer-grained forward contract persisted alongside it.
 *
 * The transition adjacency below documents the *intended* future flow. It is NOT
 * enforced anywhere yet (no transition engine, no reader). See
 * docs/trading/arena/position-lifecycle.md for the diagram.
 */

export const POSITION_LIFECYCLE = [
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
] as const;

export type PositionLifecycle = (typeof POSITION_LIFECYCLE)[number];

/** Terminal states — no outgoing transitions once reached. */
export const TERMINAL_LIFECYCLE_STATES: readonly PositionLifecycle[] = [
  "STOPPED",
  "TARGET_HIT",
  "TIME_EXIT",
  "ROTATED",
  "CLOSED",
];

/**
 * Documented (not-yet-enforced) allowed transitions. A future position-management
 * phase will validate transitions against this map. Empty arrays are terminal.
 */
export const LIFECYCLE_TRANSITIONS: Readonly<
  Record<PositionLifecycle, readonly PositionLifecycle[]>
> = {
  OPEN: ["RUNNING", "ADDING", "PARTIAL_EXIT", "TRAILING", "STOPPED", "TARGET_HIT", "TIME_EXIT", "ROTATED", "CLOSED"],
  RUNNING: ["ADDING", "PARTIAL_EXIT", "TRAILING", "STOPPED", "TARGET_HIT", "TIME_EXIT", "ROTATED", "CLOSED"],
  ADDING: ["RUNNING", "PARTIAL_EXIT", "TRAILING", "STOPPED", "TARGET_HIT", "TIME_EXIT", "ROTATED", "CLOSED"],
  PARTIAL_EXIT: ["RUNNING", "TRAILING", "STOPPED", "TARGET_HIT", "TIME_EXIT", "ROTATED", "CLOSED"],
  TRAILING: ["PARTIAL_EXIT", "STOPPED", "TARGET_HIT", "TIME_EXIT", "ROTATED", "CLOSED"],
  STOPPED: ["CLOSED"],
  TARGET_HIT: ["CLOSED"],
  TIME_EXIT: ["CLOSED"],
  ROTATED: ["CLOSED"],
  CLOSED: [],
};

export function isPositionLifecycle(value: string): value is PositionLifecycle {
  return (POSITION_LIFECYCLE as readonly string[]).includes(value);
}

export function isTerminalLifecycle(state: PositionLifecycle): boolean {
  return TERMINAL_LIFECYCLE_STATES.includes(state);
}
