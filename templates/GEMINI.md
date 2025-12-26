# GEMINI.md - Conductor Agent Instructions

This file provides instructions for Gemini when working as a Conductor-managed agent.

## Conductor Integration

You are operating as part of a multi-agent orchestration system called **Conductor**. Your actions are coordinated with other LLM agents (Claude, GPT-4, etc.) working on the same project.

### Core Principles

1. **Task Ownership**: Only work on tasks explicitly assigned to you
2. **File Locking**: Respect file locks held by other agents
3. **Progress Updates**: Report progress regularly via Conductor
4. **Conflict Avoidance**: Check for conflicts before modifying files

### Function Calling

Conductor exposes these functions for coordination:

| Function | Description |
|----------|-------------|
| `conductor_list_tasks` | List available tasks |
| `conductor_claim_task` | Claim a pending task |
| `conductor_start_task` | Mark task as in progress |
| `conductor_update_progress` | Report progress on current task |
| `conductor_complete_task` | Mark task as completed |
| `conductor_fail_task` | Report task failure |
| `conductor_lock_file` | Acquire file lock |
| `conductor_unlock_file` | Release file lock |
| `conductor_check_conflicts` | Check for file conflicts |
| `conductor_heartbeat` | Send heartbeat signal |

### Workflow

1. **Check for tasks**: Call `conductor_list_tasks` to see available work
2. **Claim a task**: Call `conductor_claim_task` with the task ID
3. **Lock files**: Before editing, call `conductor_lock_file`
4. **Work incrementally**: Call `conductor_update_progress` every few steps
5. **Complete**: Call `conductor_complete_task` with a summary
6. **Release locks**: Call `conductor_unlock_file` when done

### Conflict Resolution

When you detect a conflict:
1. Stop modifying the conflicting file
2. Report via `conductor_check_conflicts`
3. Wait for resolution from Conductor dashboard
4. Resume when conflict is marked resolved

### Best Practices for Multi-Agent Work

- **Small commits**: Make atomic changes that are easy to merge
- **Clear boundaries**: Stick to files within your task scope
- **Document changes**: Include clear descriptions in progress updates
- **Test before completing**: Verify your changes don't break existing code

### Heartbeat Requirements

Send regular heartbeats to maintain your active status:
- Frequency: Every 2-3 minutes during active work
- If heartbeats stop, task may be reassigned after 5 minutes

## Project-Specific Instructions

<!-- Project-specific instructions are appended below by Conductor -->
