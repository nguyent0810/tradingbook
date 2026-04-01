# Antigravity CLI Tool Mapping

Skills use Claude Code tool names. When you encounter these in a skill, use your Antigravity equivalent:

| Skill references | Antigravity CLI equivalent |
|-----------------|---------------------------|
| `Read` (file reading) | `view_file` |
| `Write` (file creation) | `write_to_file` |
| `Edit` (file editing) | `replace_file_content` / `multi_replace_file_content` |
| `Bash` (run commands) | `run_command` |
| `Grep` (search file content) | `grep_search` |
| `Glob` (search files by name) | `find_by_name` |
| `TodoWrite` (task tracking) | `task_boundary` + `task.md` artifact |
| `Skill` tool (invoke a skill) | `view_file` on skill's `SKILL.md` |
| `WebSearch` | `search_web` |
| `WebFetch` | `read_url_content` |
| `Task` tool (dispatch subagent) | No equivalent — use inline execution via `executing-plans` |

## Antigravity-Specific Tools

| Tool | Purpose |
|------|---------|
| `task_boundary` | Progress tracking UI — set mode (PLANNING/EXECUTION/VERIFICATION), task name, status |
| `notify_user` | Only way to communicate with user during task mode — use for checkpoints, questions, reviews |
| `browser_subagent` | Launch browser-based actions — use for visual companion, testing web UIs |
| `generate_image` | Create images for mockups, assets |
| `find_by_name` | Search files/dirs by glob pattern |
| `command_status` | Check status of background commands |
| `send_command_input` | Send stdin to running processes |

## Key Differences from Claude Code / Gemini CLI

1. **No subagent dispatch** — All work is done in a single session. Use `executing-plans` for plan execution.
2. **Task boundaries** — Use `task_boundary` to structure work into PLANNING → EXECUTION → VERIFICATION phases.
3. **Artifacts** — Use `write_to_file` with `IsArtifact=true` for specs, plans, and walkthroughs.
4. **User communication** — During active tasks, `notify_user` is the ONLY way to reach the user.
5. **No TodoWrite** — Track progress via `task.md` artifact and `task_boundary` status updates.
