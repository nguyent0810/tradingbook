> **ARCHIVED** — superseded by [`docs/design/PLAYBOOK.md`](../design/PLAYBOOK.md). Describes a `/trades` ledger IA that no longer exists as a route; principle-level guidance (density, color semantics, tone) has been ported forward. Kept for historical reference only.

# Design System — TradeLog / Playbook

**Audience:** Operators making end-of-day trading decisions and maintaining an audit-grade journal.  
**Posture:** Tooling, not marketing. Clarity first; emotion second.

---

## 1. North Star

| Priority | Meaning |
|----------|---------|
| **Clarity** | Any number, label, or state must be readable and unambiguous in under two seconds under fatigue. |
| **Discipline** | The UI rewards consistency (single playbook, structured tags) and does not gamify risk. |
| **Data-first** | Tables, metrics, and regime signals lead; chrome follows. |
| **Density without clutter** | Bloomberg-inspired information density; Notion-inspired grouping; Linear-inspired crisp feedback—not decorative polish. |

---

## 2. Principles

### 2.1 Serious fintech, not consumer SaaS

- No playful illustrations, mascot tone, or “delight” for its own sake.
- Copy is short, imperative where appropriate (“Log trade”, “Review regime”), never cute.
- Empty states explain *what to do next*, not brand personality.

### 2.2 Terminal lineage (simplified)

- **Grid-aligned** layouts; monospace for tickers, IDs, and numeric columns where it aids scanning.
- **Scannable columns**: symbol, direction, status, P&L—fixed mental model across list and detail.
- **No card sprawl** for tabular data: prefer tables; cards only for summary bands or isolated callouts (e.g. regime strip).

### 2.3 Notion lineage (structure)

- **Clear section hierarchy**: one primary page title, secondary section titles, tertiary labels.
- **Collapsible later** (when needed): long notes and audit fields must not push critical numbers below the fold on desktop.
- **Single source of truth per surface**: dashboard metrics vs. raw trade list must not contradict without an explicit “as of” or filter context.

### 2.4 Linear lineage (interactions)

- **Instant affordance**: buttons and links look actionable; disabled states are explicit.
- **Feedback on mutation**: save/update/delete returns to a stable list or clear success—no silent failures.
- **No engagement bait**: no streaks, badges, or nudges unrelated to the playbook.

---

## 3. Information Architecture (IA)

### 3.1 Surfaces (conceptual)

| Surface | Role |
|---------|------|
| **Dashboard** | Equity and risk-relevant aggregates; optional regime snapshot when wired. |
| **Trades** | Primary ledger: filter, sort, open vs closed. |
| **Trade detail / form** | Single record truth: entry, exit, playbook, notes. |
| **Regime (future)** | Read-only or advisory strip: market gate state, reasons, last update—never confusable with a trade action. |

### 3.2 Separation of concerns

- **Journal** = what you did (fills, P&L, notes).
- **Regime** = what the *market* allowed that day (gate output).
- UI must not merge these into one undifferentiated “score” that obscures accountability.

---

## 4. Visual Language

### 4.1 Density

- **Desktop default:** prioritize more rows and columns per viewport than a typical SaaS app; use comfortable padding inside cells, not between entire blocks.
- **Mobile:** same data model, reduced columns; horizontal scroll for wide tables is acceptable with sticky first column (symbol) when implemented.

### 4.2 Alignment

- **Numbers:** right-aligned in tables; use thousands separators and consistent currency (e.g. ₫) per product rules.
- **Text labels:** left-aligned; status and direction as compact pills or tags, not full sentences in cells.

### 4.3 Hierarchy

1. **Primary:** page title + primary metric or table header row.
2. **Secondary:** section headers (Performance, Regime, Journal).
3. **Tertiary:** field labels, helper text, meta (timestamps, source tags like data provider).

---

## 5. Typography

- **Sans** for UI chrome and body; **monospace** for tickers, optional for strict numeric columns to improve vertical scan.
- **Scale:** small number of steps (e.g. page title, section, body, label, caption). Avoid large marketing headlines.
- **Weight:** use weight change sparingly; hierarchy mainly via size and position.
- **Line length:** notes and prose fields capped by layout width; avoid full-bleed paragraphs beside dense tables.

---

## 6. Color & Semantics

### 6.1 Non-negotiable semantic colors

- **Positive P&L:** distinct from neutral text; consistent green family—not neon “crypto app” green.
- **Negative P&L:** distinct red family; same saturation discipline as positive.
- **Warning / caution:** amber oramber-adjacent—not error red—for regime WARNING or soft validations.
- **Critical / fail regime:** red distinct from loss P&L if both appear together (e.g. border vs fill).

### 6.2 Restraint

- Background layers: at most three discernible levels (page, panel, inset field).
- No gradient backgrounds for metrics; no decorative blobs behind charts.
- Charts (equity, etc.): minimal grid; axes readable; no chartjunk.

---

## 7. Components (conceptual—no implementation here)

### 7.1 Tables

- Default ledger component for trades.
- Zebra optional; row hover for readability on dense screens.
- Actions (“Edit”) as compact secondary controls, not competing with data.

### 7.2 Metrics / KPI tiles

- Compact blocks: label above, number below; optional delta later.
- No oversized hero metrics that push the ledger off screen.

### 7.3 Forms

- Labels explicit; validation messages factual (“Required”, “Must be positive”).
- Playbook locked to product strategy: **show as read-only context**, not a distractible free-form marketing field.

### 7.4 Regime display (Gate 1+)

- **PASS / WARNING / FAIL** as discrete states with short reason list—not paragraph prose.
- Timestamp and symbol context (“VNINDEX”, last bar date) visible so the signal is auditable.

### 7.5 Navigation

- Minimal top or side nav; current section clearly indicated.
- No redundant breadcrumbs unless IA deepens beyond three levels.

---

## 8. Interaction Patterns

- **Filtering & sorting** on trades: persistent in URL where possible so sharing and refresh preserve context.
- **Destructive actions** (delete trade): confirm with plain language; no joke copy.
- **Loading:** skeleton or terse “Loading…”—no branded loaders.
- **Errors:** surface server truth (“Trade not found”) without stack traces to users.

---

## 9. Trading-Specific UX Rules

- **End-of-day mindset:** defaults and copy assume review after the session, not intraday noise.
- **Regime awareness:** when shown, it must be obvious whether it is **advisory** vs **trade outcome**—never imply regime replaces journal accountability.
- **Single playbook discipline:** UI reinforces one strategy; no dark patterns suggesting multi-strategy tagging.

---

## 10. Accessibility & Legibility

- Contrast meets readable text on all semantic colors (P&L, regime).
- Focus states visible for keyboard users (operators may prefer keyboard on desk setups).
- Do not rely on color alone for PASS/WARNING/FAIL—pair with label text or icon with text equivalent.

---

## 11. Anti-patterns (explicitly out of scope)

- Gamification: streaks, leaderboards, confetti, arbitrary badges.
- Marketing dashboards: vanity charts with no decision link.
- “Friendly” error personalities or humorous empty states.
- Stock imagery, lifestyle photography, or mascot illustrations.

---

## 12. Evolution

- New surfaces (Gate 2, sizing, EOD risk) must **extend** this system: same density discipline, same semantic color rules, same separation between **market state** and **your actions**.
- Any visual refresh must preserve **scannability** and **numeric honesty** over aesthetic trends.

---

## 13. Summary metaphor

**Bloomberg (light):** dense, tabular, numeric honesty.  
**Notion (light):** clean sections, structured pages.  
**Linear (light):** tight interactions, no fluff.

**Adapted for:** daily EOD decisions, explicit regime awareness, and an audit-grade trade journal—**discipline encoded in layout**, not decoration.
