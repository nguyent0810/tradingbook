---
name: executing-plans
description: Use when you have a written implementation plan to execute, with review checkpoints and progress tracking
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks with progress tracking, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan

1. Read plan file via `view_file`
2. Review critically — identify any questions or concerns
3. If concerns: Use `notify_user` to raise them before starting
4. If no concerns: Update `task.md` and proceed

### Step 2: Execute Tasks

Use `task_boundary` to track progress through each task:

For each task:
1. Update `task_boundary` with current task status
2. Mark task as `[/]` in `task.md`
3. Follow each step exactly (plan has bite-sized steps)
4. Run verifications via `run_command` as specified
5. Mark task as `[x]` in `task.md`

**Checkpoint every 3 tasks:**
- Use `notify_user` to report progress
- Show: tasks completed, any issues, next steps
- Wait for user acknowledgment before continuing

### Step 3: Complete Development

After all tasks are complete and verified:
- Read `finishing-work/SKILL.md` via `view_file`
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps
- You don't understand an instruction
- Verification fails repeatedly

**Use `notify_user` to ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- User updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** — stop and ask.

## Remember

- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications (use `run_command` to run tests)
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
- Use `task_boundary` to keep user informed of progress

## Integration

**Required workflow skills:**
- **writing-plans** — Creates the plan this skill executes
- **finishing-work** — Complete development after all tasks
- **test-driven-development** — For TDD steps within tasks
- **verification-before-completion** — Before claiming anything is done
