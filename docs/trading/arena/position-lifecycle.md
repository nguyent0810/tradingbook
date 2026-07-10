# Arena Position Lifecycle (Phase 0.5 contract)

Status: **contract only** — the vocabulary is frozen, but no transition engine,
reader, or position-management logic exists yet. The engine initializes every new
position to `OPEN` and never transitions it. `PaperPositionStatus`
(`OPEN` / `PARTIAL` / `CLOSED`) remains the field the current engine reads and
writes; `PositionLifecycle` is a finer-grained forward contract persisted
alongside it (`paper_positions.lifecycle`).

Defined in `src/lib/paper-lab/contracts/position-lifecycle.ts` and the Prisma enum
`PositionLifecycle`.

## States

| State | Meaning (future) |
|---|---|
| `OPEN` | Position just opened; initial fill recorded. |
| `RUNNING` | Live and unmanaged this session (baseline holding). |
| `ADDING` | A pyramiding add is being applied. |
| `PARTIAL_EXIT` | A partial profit / reduce has been taken. |
| `TRAILING` | A trailing stop is active and ratcheting. |
| `STOPPED` | Closed by stop-loss. |
| `TARGET_HIT` | Closed by take-profit / target. |
| `TIME_EXIT` | Closed by time-stop or dead-money stop. |
| `ROTATED` | Reduced/exited to fund a stronger opportunity (rotation). |
| `CLOSED` | Fully closed; terminal record state. |

Terminal states: `STOPPED`, `TARGET_HIT`, `TIME_EXIT`, `ROTATED`, `CLOSED`.

## Transition diagram (intended future flow)

```
                 OPEN
                  │
                  ▼
                RUNNING ─────────────┐
                  │                  │
        ┌─────────┼─────────┐        │
        ▼         ▼         ▼        │
     ADDING   PARTIAL_EXIT  TRAILING │
        │         │          │       │
        └────►────┴────►─────┘       │
                  │                  │
     ┌────────────┼───────────┬──────┤
     ▼            ▼           ▼      ▼
 TARGET_HIT   STOPPED    TIME_EXIT  ROTATED
     │            │           │      │
     └─────►──────┴─────►─────┴───►──┘
                       │
                       ▼
                    CLOSED
```

- `OPEN → RUNNING` is the normal first step once a position is being managed.
- `RUNNING` may branch into `ADDING`, `PARTIAL_EXIT`, or `TRAILING`, and those may
  return to `RUNNING` or proceed to an exit state.
- Any managed state may transition directly to an exit state
  (`STOPPED` / `TARGET_HIT` / `TIME_EXIT` / `ROTATED`).
- Every exit state resolves to `CLOSED` when quantity reaches zero.

The machine-readable adjacency lives in `LIFECYCLE_TRANSITIONS`
(`position-lifecycle.ts`) and will be enforced by a future position-management
phase. It is **not enforced today**.

## Related contracts

- **Decision actions** — `src/lib/paper-lab/contracts/decision-action.ts`
  (`BUY, SELL, HOLD, ADD, REDUCE, TRAIL, ROTATE, TIME_EXIT, SKIP`; `EXIT` retained
  for backward compatibility). Agents still emit only `BUY / SELL / HOLD`.
- **Reason codes** — `src/lib/paper-lab/contracts/reason-codes.ts` (canonical
  catalog; `reason_codes` stays `string[]` for backward compatibility).
- **Position history events** — `src/lib/paper-lab/contracts/position-history.ts`
  (`OPEN, ADD, REDUCE, STOP, TARGET, ROTATE, TIME_EXIT, CLOSE`; types/schema only,
  not persisted).
