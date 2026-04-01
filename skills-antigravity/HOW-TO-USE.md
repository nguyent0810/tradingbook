# Superpowers for Antigravity CLI — User Guide

## What Is This?

A set of **development workflow skills** adapted from [Superpowers](https://github.com/obra/superpowers) for **Antigravity CLI**. These skills guide your AI agent through a structured, disciplined development process — from brainstorming to shipping.

## Quick Start

### 1. Setup (Already Done)

The `GEMINI.md` in your workspace root auto-loads the skills. No additional setup needed.

### 2. Verify It Works

Start a new Antigravity conversation in this workspace and say:
```
What superpowers skills do you have available?
```

The agent should list all available skills from `skills-antigravity/`.

### 3. Start Using

Just describe what you want to build. The agent will **automatically**:
1. Check if a skill applies (brainstorming, debugging, etc.)
2. Announce which skill it's using
3. Follow the skill's structured process

---

## The Workflow Chain

```
You: "Build me a feature"
        │
        ▼
┌─────────────────┐
│  BRAINSTORMING   │ ← Ask questions, explore design,
│                  │   get user approval on spec
└────────┬────────┘
         ▼
┌─────────────────┐
│  WRITING PLANS   │ ← Break work into bite-sized
│                  │   tasks with exact code + tests
└────────┬────────┘
         ▼
┌─────────────────┐
│ EXECUTING PLANS  │ ← Step through tasks one by one
│                  │   with checkpoints every 3 tasks
└────────┬────────┘
         │    ┌──────────────────┐
         ├───▶│ TDD              │ ← RED → GREEN → REFACTOR
         │    └──────────────────┘   for each code change
         │    ┌──────────────────┐
         ├───▶│ CODE REVIEW      │ ← Self-review after
         │    └──────────────────┘   each batch
         │    ┌──────────────────┐
         └───▶│ VERIFICATION     │ ← Evidence before claims
              └──────────────────┘
         ▼
┌─────────────────┐
│ FINISHING WORK   │ ← Merge/PR/keep/discard
└─────────────────┘
```

---

## Available Skills

| Skill | When It Activates | What It Does |
|-------|-------------------|-------------|
| **brainstorming** | Before any creative work | Explores ideas, proposes approaches, writes spec |
| **writing-plans** | After spec is approved | Breaks work into 2-5 min tasks with code + tests |
| **executing-plans** | When plan is ready | Step-by-step execution with checkpoints |
| **test-driven-development** | During any implementation | RED-GREEN-REFACTOR cycle |
| **systematic-debugging** | Any bug or failure | 4-phase root cause investigation |
| **verification-before-completion** | Before claiming "done" | Run command → read output → then claim |
| **code-review** | After completing tasks | Self-review checklist + handling feedback |
| **finishing-work** | When all tasks complete | Verify tests → merge/PR/keep/discard |
| **writing-skills** | When creating new skills | Guide for writing new skill files |

---

## How To Trigger Skills

### Automatic (Default)

Skills trigger automatically because `GEMINI.md` loads the `using-superpowers` skill at session start. The agent checks for relevant skills before every action.

### Manual

You can explicitly request a skill:
```
Use the brainstorming skill for this feature
```
or
```
Debug this using the systematic-debugging skill
```

### Skip a Skill

If a skill is getting in the way:
```
Skip brainstorming, I already have the spec ready
```

Your instructions always take priority over skill rules.

---

## Customizing

### Add a New Skill

1. Create `skills-antigravity/<skill-name>/SKILL.md`
2. Follow the template in `writing-skills/SKILL.md`
3. Add it to the skill list in `using-superpowers/SKILL.md`
4. Optionally, add `@skills-antigravity/<skill-name>/SKILL.md` to `GEMINI.md` for auto-loading

### Auto-Load More Skills

Add `@` references to `GEMINI.md`:
```
@d:\Git Tools\Obra-superpowers\skills-antigravity\systematic-debugging\SKILL.md
```

> **Note:** Auto-loading consumes context. Only auto-load skills you use in every session. Other skills are discovered and loaded on-demand by the `using-superpowers` master skill.

### Disable a Skill

Remove or comment out its `@` reference in `GEMINI.md`, or tell the agent:
```
Don't use TDD for this prototype
```

---

## Key Differences from Original Superpowers

| Feature | Original (Claude Code) | This Adaptation (Antigravity) |
|---------|----------------------|-------------------------------|
| Skill loading | `Skill` tool / `activate_skill` | `view_file` on SKILL.md |
| Task tracking | `TodoWrite` | `task_boundary` + `task.md` artifact |
| Subagent dispatch | `Task` tool | Not available — inline execution |
| Checkpoints | Automatic between subagents | Manual via `notify_user` every 3 tasks |
| Design docs | `docs/superpowers/specs/` | Antigravity artifacts |
| Plan docs | `docs/superpowers/plans/` | Antigravity artifacts |
| Git worktrees | Automatic setup | Manual (standard git branches) |

---

## Tips

1. **Start small** — Try a simple feature first to see the workflow in action
2. **Let it ask** — The brainstorming skill works best when you answer its questions honestly
3. **Don't rush** — The structured process feels slow at first but prevents rework
4. **Override when needed** — Say "skip X" or "don't do Y" — your instructions always win
5. **Check the plan** — Always review the implementation plan before saying "go"
