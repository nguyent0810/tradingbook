import { z } from "zod";
import { POSITION_LIFECYCLE } from "@/lib/paper-lab/contracts/position-lifecycle";

/**
 * Phase 0.5 contract — Position history event schema (types + zod only).
 *
 * NOT implemented and NOT persisted this phase. This is the forward contract for
 * an append-only per-position event log that a future position-management phase
 * will write. No table, no migration, no writer exists yet.
 */

export const POSITION_HISTORY_EVENT_TYPES = [
  "OPEN",
  "ADD",
  "REDUCE",
  "STOP",
  "TARGET",
  "ROTATE",
  "TIME_EXIT",
  "CLOSE",
] as const;

export type PositionHistoryEventType = (typeof POSITION_HISTORY_EVENT_TYPES)[number];

export const positionHistoryEventSchema = z.object({
  /** Stable event id (assigned by the future writer). */
  eventId: z.string().uuid().optional(),
  positionId: z.string().min(1),
  portfolioId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  type: z.enum(POSITION_HISTORY_EVENT_TYPES),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Signed share delta for the event (+ open/add, − reduce/close). */
  quantityDelta: z.number().int().nullable().optional(),
  /** Fill/mark price in kVND for the event, when applicable. */
  priceKvnd: z.number().positive().nullable().optional(),
  realizedPnlVnd: z.number().nullable().optional(),
  rMultiple: z.number().nullable().optional(),

  /** Lifecycle transition captured by the event (contract in position-lifecycle). */
  lifecycleFrom: z.enum(POSITION_LIFECYCLE).nullable().optional(),
  lifecycleTo: z.enum(POSITION_LIFECYCLE).nullable().optional(),

  /** Canonical or legacy reason codes (kept as strings for compatibility). */
  reasonCodes: z.array(z.string()).default([]),
  /** Originating decision, when the event was decision-driven. */
  decisionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PositionHistoryEvent = z.infer<typeof positionHistoryEventSchema>;

export function isPositionHistoryEventType(value: string): value is PositionHistoryEventType {
  return (POSITION_HISTORY_EVENT_TYPES as readonly string[]).includes(value);
}
