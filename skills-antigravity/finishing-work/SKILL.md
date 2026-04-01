---
name: finishing-work
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work
---

# Finishing Work

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Present options → Execute choice.

**Announce at start:** "I'm using the finishing-work skill to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass via `run_command`:**

```bash
npm test / cargo test / pytest / go test ./...
```

**If tests fail:** Report failures. Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Determine Current Branch

```bash
# Run via run_command
git branch --show-current
git log --oneline -5
```

### Step 3: Present Options

Use `notify_user` to present exactly these options:

```
Implementation complete. What would you like to do?

1. Merge back to main/master locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

### Step 4: Execute Choice

#### Option 1: Merge Locally

```bash
git checkout main        # or master
git pull
git merge <feature-branch>
# Run tests again
git branch -d <feature-branch>
```

#### Option 2: Push and Create PR

```bash
git push -u origin <feature-branch>
gh pr create --title "<title>" --body "<summary>"
```

#### Option 3: Keep As-Is

Report: "Keeping branch `<name>`. You can return to it anytime."

#### Option 4: Discard

**Confirm first via `notify_user`:**
```
This will permanently delete branch <name> and all commits.
Please confirm by replying "discard".
```

Wait for exact confirmation. If confirmed:
```bash
git checkout main
git branch -D <feature-branch>
```

## Quick Reference

| Option | Merge | Push | Cleanup Branch |
|--------|-------|------|----------------|
| 1. Merge locally | ✓ | - | ✓ |
| 2. Create PR | - | ✓ | - |
| 3. Keep as-is | - | - | - |
| 4. Discard | - | - | ✓ (force) |

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request
