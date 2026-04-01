---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills (Antigravity Edition)

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

You write test cases (try the workflow without the skill), watch them fail (see what goes wrong), write the skill, verify the workflow improves.

## What is a Skill?

A **skill** is a reference guide for proven techniques, patterns, or tools in markdown format.

**Skills are:** Reusable techniques, patterns, tools, reference guides
**Skills are NOT:** Narratives about how you solved a problem once

## When to Create

**Create when:**
- Technique wasn't intuitively obvious
- You'd reference this again across projects
- Pattern applies broadly
- Others would benefit

**Don't create for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put in GEMINI.md)

## Directory Structure

```
skills-antigravity/
  skill-name/
    SKILL.md              # Main reference (required)
    supporting-file.*     # Only if needed
```

## SKILL.md Structure

```markdown
---
name: skill-name-with-hyphens
description: Use when [specific triggering conditions]
---

# Skill Name

## Overview
Core principle in 1-2 sentences.

## When to Use
Bullet list with symptoms and use cases.

## Core Pattern
Before/after comparison or key process.

## Quick Reference
Table or bullets for scanning.

## Common Mistakes
What goes wrong + fixes.
```

**Frontmatter rules:**
- `name`: letters, numbers, hyphens only
- `description`: Start with "Use when...", describe triggering conditions ONLY (not what the skill does)

## Key Principles

- **One excellent example** beats many mediocre ones
- **YAGNI** — Don't add sections for hypothetical cases
- **Flowcharts only for** non-obvious decision points
- **Token efficiency** — Keep skills concise (<500 words for most)
- **Descriptive naming** — Use active voice: `condition-based-waiting` not `async-helpers`

## Adding a New Skill

1. Create `skills-antigravity/<skill-name>/SKILL.md`
2. Follow the structure above
3. Add a reference in `using-superpowers/SKILL.md` skill list
4. Optionally add an `@` reference in `GEMINI.md` for auto-loading
5. Test by starting a new conversation and checking if the skill activates appropriately
