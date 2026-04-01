---
name: code-review
description: Use when completing tasks, implementing features, or before merging - covers both requesting and handling code review feedback
---

# Code Review

## Overview

Review early, review often. This skill covers both **requesting** review (self-review since Antigravity has no subagent dispatch) and **handling** review feedback.

**Core principle:** Evidence-based evaluation, not performative agreement.

## When to Request Review

**Mandatory:**
- After completing major feature
- Before merge to main
- After each batch of 3 tasks during plan execution

**Optional but valuable:**
- When stuck (fresh perspective from human partner)
- Before refactoring
- After fixing complex bug

## Self-Review Checklist

Since Antigravity doesn't support dispatching a separate review agent, perform self-review:

### 1. Get the diff

```bash
# Run via run_command
git diff HEAD~N  # N = number of commits for this feature
```

### 2. Review against requirements

For each requirement in the spec/plan:
- [ ] Is it implemented?
- [ ] Is it tested?
- [ ] Does the implementation match the spec?

### 3. Code quality scan

- [ ] No placeholder code (TODO, FIXME, "implement later")
- [ ] No dead code or unused imports
- [ ] Error handling present (not just happy path)
- [ ] Naming is clear and consistent
- [ ] No duplicated logic
- [ ] Functions are focused (single responsibility)

### 4. Test quality scan

- [ ] Tests cover behavior, not implementation
- [ ] Test names describe what's being tested
- [ ] No mocks where real code would work
- [ ] Edge cases covered

### 5. Report to user

Use `notify_user` to report:
```
**Self-Review Complete:**

Strengths: [What's working well]
Issues found:
  - Critical: [any blockers]
  - Important: [should fix before merge]
  - Minor: [nice-to-have improvements]

Assessment: [Ready to proceed / Needs fixes first]
```

## Handling Review Feedback

### The Response Pattern

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words
3. VERIFY: Check against codebase via view_file / grep_search
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

### Never Say

- "You're absolutely right!"
- "Great point!" / "Excellent feedback!"
- "Let me implement that now" (before verification)

### Instead

- Restate the technical requirement
- Ask clarifying questions via `notify_user`
- Push back with technical reasoning if wrong
- Just start working (actions > words)

### Implementation Order

For multi-item feedback:
1. Clarify anything unclear FIRST
2. Implement in order: Blocking → Simple fixes → Complex fixes
3. Test each fix via `run_command`
4. Verify no regressions

### When to Push Back

Push back when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI
- Technically incorrect for this stack

**How:** Use technical reasoning, reference working tests/code, involve human partner if architectural.

## The Bottom Line

**Self-review before claiming done. External feedback = suggestions to evaluate, not orders.**

Verify. Question. Then implement.
