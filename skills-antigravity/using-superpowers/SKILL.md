---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill check before ANY response including clarifying questions
---

# Using Superpowers (Antigravity Edition)

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST read and follow the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

1. **User's explicit instructions** (GEMINI.md, direct requests) — highest priority
2. **Superpowers skills** — override default behavior where they conflict
3. **Default system prompt** — lowest priority

## How to Access Skills

**In Antigravity CLI:** Use `view_file` to read the skill's `SKILL.md` file. Skills live in `skills-antigravity/` in the workspace root:

```
skills-antigravity/
  brainstorming/SKILL.md
  writing-plans/SKILL.md
  executing-plans/SKILL.md
  test-driven-development/SKILL.md
  systematic-debugging/SKILL.md
  verification-before-completion/SKILL.md
  code-review/SKILL.md
  finishing-work/SKILL.md
  writing-skills/SKILL.md
  references/antigravity-tools.md
```

**Tool mapping:** Skills use Claude Code tool names. See `references/antigravity-tools.md` for Antigravity equivalents.

# Using Skills

## The Rule

**Read relevant skills BEFORE any response or action.** Even a 1% chance a skill might apply means you should read it. If it turns out to be wrong for the situation, you don't need to follow it.

## Skill Activation Flow

1. User message received
2. About to start work? → Check: has brainstorming been done?
   - No → Read `brainstorming/SKILL.md`
   - Yes → Continue
3. Might any skill apply? (even 1% chance)
   - Yes → Read the skill's `SKILL.md` via `view_file`
   - Definitely not → Respond normally
4. Announce: "Using [skill] to [purpose]"
5. Follow skill exactly

## Red Flags

These thoughts mean STOP — you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |

## Skill Priority

When multiple skills could apply:

1. **Process skills first** (brainstorming, debugging) — determine HOW to approach
2. **Implementation skills second** — guide execution

"Let's build X" → brainstorming first, then implementation skills.
"Fix this bug" → debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.
