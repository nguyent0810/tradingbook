> **ARCHIVED** — superseded by [`docs/design/PLAYBOOK.md`](../design/PLAYBOOK.md). Its hierarchy/density/component rules were ported forward; the Setups-specific implementation mapping below is still accurate as of the 2026-07 UI overhaul but should be cross-checked against `src/components/setups-candidate-health-strip.tsx` before relying on it. Kept for historical reference only.

# UI DNA / Design System (Trading Dashboard)

## 1) Visual Hierarchy Rules

Design for fast decision flow, not visual novelty.

- Priority order on page: **Action -> Candidates -> Risk -> Diagnostics**.
- Keep "what to do now" above "why this happened."
- One primary message per card.
- Use contrast for states, not decoration.
- Numeric fields should scan vertically (right-aligned columns).

Example:
- Top card: `Today's Action: NO_TRADE`
- Next: surfaced candidates table
- Then: details + diagnostics

## 2) Component Usage

## Card

Use for top-level decision blocks.

- Good for: Today’s Action, Market Insight, Portfolio summaries.
- Not for: dense line-item data.

## Table

Use for compact comparison of surfaced setups.

- Main row fields only: symbol/status/health, quality, score label, close, zone, stop, bar date.
- Keep row height compact and consistent.

## Details (`<details>`)

Use for secondary context and verbose text.

- Good for: reasons, health explanation, extra notes.
- Default collapsed.

## Badges/Chips

Use for state tokens only.

- Lifecycle: `READY`, `WATCHING`, etc.
- Health level: `HEALTHY`, `WARNING`, `AT_RISK`, `DEAD`.
- Keep labels short and uppercase.

## 3) Density Rules (Main Row vs Details)

Main row = **decision essentials only**.

- Include: actionable status + core numbers.
- Exclude: long explanations, multi-line prose, diagnostic paragraphs.

Details panel = **context and rationale**.

- Include: health summary, health lines, scanner reasons, hints.
- Long text wraps only here.

Rule of thumb:
- If content needs more than ~8 words, move to details.

## 4) Color System for Trading States

Use consistent semantics across app:

- `HEALTHY`: green family (constructive, tradable).
- `WARNING`: yellow/amber (caution).
- `AT_RISK`: orange (elevated caution).
- `DEAD` / `INVALID`: red (do not initiate).
- Neutral/system text: muted gray scale.

Additional state styling:
- `READY`: accent positive highlight.
- `WATCHING`: subdued neutral chip.
- `NEW`: notification badge accent (small dot/count, not full-row takeover).
- `AT_RISK`: subtle warning-tint row background (low alpha).
- `DEAD`: faded row treatment (reduced emphasis, still readable).

Avoid:
- Multiple unrelated color meanings on same row.
- Using red for decorative emphasis.

## Attention System (Row Priority Cues)

Use minimal, consistent emphasis so priority is visible at a glance.

- **READY** -> highlighted row border/background (highest visual priority).
- **NEW** -> small notification badge near symbol/lifecycle chip.
- **AT_RISK** -> subtle warning background tint + warning chip retained.
- **DEAD** -> de-emphasized row (lower opacity text/chips), kept sortable and inspectable.

Rule: attention cues must never hide numbers or reduce readability of price/risk fields.

## 5) Copywriting Rules (Trader-Friendly)

Write for action, not explanation depth.

- Preferred tone: clear, direct, operational.
- Start with verb or decision implication.
- Replace jargon with concrete condition.

Good:
- "Wait for pullback into entry zone."
- "Setup is extended and volume is fading."

Avoid:
- "Potentially suboptimal momentum characteristics detected."
- "Interesting setup with some caveats."

Score copy:
- Inline format: `Strong (85)`, `Weak (52)`.

## 6) Interaction Rules (No Modal Abuse)

- Prefer inline expansion (`details`) over modal for row-level context.
- Keep users in table context while investigating one setup.
- Avoid blocking overlays for non-destructive reading tasks.
- Use one interaction step per intent:
  - click row details -> see rationale
  - edit sizing input -> see recalculated outputs

Only use modal for destructive confirmation or cross-page interruption.

## 7) Layout Consistency Rules

- Maintain stable column order and width behavior across sessions.
- Numeric columns right-aligned; dates fixed-width where possible.
- Use consistent spacing tokens between sections/cards.
- Prevent text clipping at normal laptop widths; allow horizontal table scroll only as fallback.
- Keep details content inside full-width row beneath candidate.
- Preserve position sizing block placement directly under each candidate.
- Keep portfolio panel structure consistent: `Allocated`, `Remaining`, `Sector exposure`.

## Portfolio Panel UI Pattern

Show a compact allocation card near surfaced setups:

- `Allocated: 31% / 60%`
- `Remaining capacity: 29%`
- `Sector exposure: Banking 22%, Tech 9%, Industrial 0%`
- Warning copy only when breached:
  - `Banking concentration above threshold (35%)`

This panel is operational, not analytical. Keep it short and action-oriented.

## Implementation Mapping (Current Next.js App)

- Server-derived decision content in route page (`app/(dashboard)/setups/page.tsx`).
- Reusable health presentation component (`setups-candidate-health-strip`).
- Health copy/summary generation in `src/lib/setup-health/health-ui-copy.ts`.
- Progressive disclosure using native `<details>` for low complexity and accessibility.

## Practical Examples

## Example A: Clean main row
- `SAB | READY | WARNING | Decent (67) | 38.2 | 37.4-38.0 | 35.9 | 2026-05-05`

## Example B: Details panel text
- `Setup is aging and failed to retest entry zone.`
- `-> 6 sessions since breakout`
- `-> No pullback interaction in window`
- `Hint: Avoid chasing. Wait for reset.`

## Example C: Risk block proximity
- Candidate row
- Details row (collapsed by default)
- Position sizing row immediately below

## Example D: Attention + allocation
- `AAA | READY | HEALTHY | Strong (88)` (highlighted row)
- `BBB | NEW | WATCHING | Decent (71)` (badge only)
- `CCC | READY | AT_RISK | Weak (52)` (subtle warning tint)
- `DDD | READY | DEAD | Risky (28)` (faded, low emphasis)
- Portfolio panel shows: `Allocated 42% / 60%, Remaining 18%, Banking 31%`

This DNA is intentionally conservative: maximize decision clarity and capital-preserving behavior using current system constraints.

