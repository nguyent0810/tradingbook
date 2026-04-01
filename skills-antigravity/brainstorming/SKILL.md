---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design and get user approval.

<HARD-GATE>
Do NOT write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Checklist

You MUST complete these items in order (track via `task_boundary`):

1. **Explore project context** — use `view_file`, `find_by_name`, `grep_search` to check files, docs, recent commits
2. **Offer visual companion** (if topic involves visual questions) — offer to use `browser_subagent` for mockups/diagrams. This is its own message via `notify_user`, not combined with questions.
3. **Ask clarifying questions** — one at a time via `notify_user`, understand purpose/constraints/success criteria
4. **Propose 2-3 approaches** — with trade-offs and your recommendation
5. **Present design** — in sections scaled to complexity, get user approval after each section
6. **Write design doc** — save as an artifact using `write_to_file` with `IsArtifact=true`, `ArtifactType="implementation_plan"`
7. **Spec self-review** — scan for placeholders, contradictions, ambiguity, scope issues. Fix inline.
8. **User reviews written spec** — use `notify_user` with `PathsToReview` pointing to the spec file
9. **Transition to implementation** — read `writing-plans/SKILL.md` to create implementation plan

## The Process

**Understanding the idea:**

- Check out the current project state first (files, docs, recent commits via `run_command`)
- Before asking detailed questions, assess scope: if the request describes multiple independent subsystems, flag this immediately
- If the project is too large for a single spec, help decompose into sub-projects
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible
- Only one question per message — use `notify_user` for each
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**

- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**

- Present the design section by section
- Scale each section to its complexity: a few sentences if straightforward, up to 200-300 words if nuanced
- Ask after each section whether it looks right
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify

**Design for isolation and clarity:**

- Break the system into smaller units with one clear purpose
- Well-defined interfaces, independently understandable and testable
- Smaller files are easier for the agent to work with reliably

**Working in existing codebases:**

- Explore current structure before proposing changes. Follow existing patterns.
- Where existing code has problems, include targeted improvements — don't propose unrelated refactoring.

## After the Design

**Documentation:**
- Write the validated design (spec) as an artifact via `write_to_file` with `IsArtifact=true`
- Commit the design document to git via `run_command`

**Spec Self-Review:**
1. **Placeholder scan:** Any "TBD", "TODO", incomplete sections? Fix them.
2. **Internal consistency:** Do sections contradict each other?
3. **Scope check:** Focused enough for a single implementation plan?
4. **Ambiguity check:** Could any requirement be interpreted two ways? Pick one.

**User Review Gate:**
Use `notify_user` with `PathsToReview` to ask the user to review the spec. Wait for response.

**Implementation:**
- Read `writing-plans/SKILL.md` via `view_file` to create the implementation plan
- Do NOT skip to any other skill. writing-plans is the next step.

## Key Principles

- **One question at a time** — Don't overwhelm with multiple questions
- **Multiple choice preferred** — Easier to answer than open-ended
- **YAGNI ruthlessly** — Remove unnecessary features
- **Explore alternatives** — Always propose 2-3 approaches
- **Incremental validation** — Present design, get approval before moving on

## Visual Companion

When upcoming questions involve visual content (mockups, layouts, diagrams), offer using `browser_subagent`:

> "Some of what we're working on might be easier to explain if I can show it to you in a browser. I can put together mockups, diagrams, and visual comparisons. Want to try it?"

**This offer MUST be its own message via `notify_user`.** Do not combine with other content.

**Per-question decision:** Even after acceptance, decide for EACH question:
- **Use `browser_subagent`** for visual content — mockups, wireframes, layout comparisons, architecture diagrams
- **Use `notify_user`** for text content — requirements questions, conceptual choices, tradeoff lists
