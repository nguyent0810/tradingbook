---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue:
- Test failures
- Bugs in production
- Unexpected behavior
- Performance problems
- Build failures
- Integration issues

**Use this ESPECIALLY when:**
- Under time pressure
- "Just one quick fix" seems obvious
- You've already tried multiple fixes

## The Four Phases

Complete each phase before the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Don't skip past errors or warnings
   - Read stack traces completely via `run_command` output
   - Note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   - Use `run_command` to check: `git diff`, `git log -n 5`
   - New dependencies, config changes?

4. **Gather Evidence in Multi-Component Systems**
   - Add diagnostic logging at each component boundary
   - Run once to gather evidence showing WHERE it breaks
   - THEN analyze to identify failing component

5. **Trace Data Flow**
   - Where does bad value originate?
   - What called this with bad value?
   - Keep tracing up until you find the source
   - Use `grep_search` to find all callers
   - Fix at source, not at symptom

### Phase 2: Pattern Analysis

1. **Find Working Examples** — Use `grep_search` to locate similar working code
2. **Compare Against References** — Read reference implementations COMPLETELY via `view_file`
3. **Identify Differences** — List every difference, however small
4. **Understand Dependencies** — What components, settings, environment does this need?

### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis** — "I think X is the root cause because Y"
2. **Test Minimally** — SMALLEST possible change via `replace_file_content`, one variable at a time
3. **Verify Before Continuing** — Did it work? Yes → Phase 4. No → NEW hypothesis (don't add more fixes)
4. **When You Don't Know** — Say "I don't understand X". Don't pretend.

### Phase 4: Implementation

1. **Create Failing Test Case** — Use TDD skill
2. **Implement Single Fix** — ONE change at a time
3. **Verify Fix** — Run tests via `run_command`
4. **If Fix Doesn't Work:**
   - Count: How many fixes tried?
   - If < 3: Return to Phase 1
   - **If ≥ 3: STOP — question the architecture.** Use `notify_user` to discuss with human partner.

## Red Flags — STOP and Follow Process

- "Quick fix for now, investigate later"
- "Just try changing X and see"
- "I don't fully understand but this might work"
- Proposing solutions before tracing data flow
- **"One more fix attempt" (when already tried 2+)**

**ALL of these mean: STOP. Return to Phase 1.**

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple" | Simple issues have root causes too. |
| "Emergency, no time" | Systematic is FASTER than thrashing. |
| "Just try this first" | First fix sets the pattern. Do it right. |
| "Multiple fixes saves time" | Can't isolate what worked. |
| "I see the problem" | Seeing symptoms ≠ understanding root cause. |

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|-----------------|
| **1. Root Cause** | Read errors, reproduce, check changes | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |
