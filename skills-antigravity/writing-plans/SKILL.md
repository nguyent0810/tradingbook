---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context and questionable taste. Document everything: which files to touch, code, testing, docs, how to verify. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Save plans as:** Antigravity artifact using `write_to_file` with `IsArtifact=true`, `ArtifactType="implementation_plan"`

## Scope Check

If the spec covers multiple independent subsystems, suggest breaking into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified:
- Design units with clear boundaries and well-defined interfaces
- Prefer smaller, focused files over large ones
- Files that change together should live together
- In existing codebases, follow established patterns

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" — step
- "Run it to make sure it fails" — step
- "Implement the minimal code to make the test pass" — step
- "Run the tests and make sure they pass" — step
- "Commit" — step

## Plan Document Header

**Every plan MUST start with:**

```markdown
# [Feature Name] Implementation Plan

> **For execution:** Use the `executing-plans` skill to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders

Every step must contain actual content. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later"
- "Add appropriate error handling"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code)
- Steps without code blocks for code steps

## Self-Review

After writing the plan, check against the spec:

1. **Spec coverage:** Each requirement maps to a task?
2. **Placeholder scan:** Any red-flag patterns from above?
3. **Type consistency:** Names, signatures match across tasks?

Fix issues inline. If a spec requirement has no task, add one.

## Execution Handoff

After saving the plan:

**"Plan complete and saved. Ready to execute using the executing-plans skill. Shall I proceed?"**

Use `notify_user` with `PathsToReview` pointing to the plan to get user approval before execution.

Then read `executing-plans/SKILL.md` via `view_file` and follow it.
