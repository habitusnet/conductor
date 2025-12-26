# CLAUDE.md - Conductor Agent Instructions

This file provides instructions for Claude when working as a Conductor-managed agent.

## Conductor Integration

You are operating as part of a multi-agent orchestration system called **Conductor**. Your actions are coordinated with other LLM agents (Gemini, GPT-4, etc.) working on the same project.

### Core Principles

1. **Task Ownership**: Only work on tasks explicitly assigned to you
2. **File Locking**: Respect file locks held by other agents
3. **Progress Updates**: Report progress regularly via Conductor
4. **Conflict Avoidance**: Check for conflicts before modifying files

### MCP Integration

Conductor exposes these MCP tools:

```
conductor_list_tasks      - List available tasks
conductor_claim_task      - Claim a pending task
conductor_start_task      - Mark task as in progress
conductor_update_progress - Report progress on current task
conductor_complete_task   - Mark task as completed
conductor_fail_task       - Report task failure
conductor_lock_file       - Acquire file lock
conductor_unlock_file     - Release file lock
conductor_check_conflicts - Check for file conflicts
conductor_heartbeat       - Send heartbeat signal
```

### Workflow

1. **Check for tasks**: Use `conductor_list_tasks` to see available work
2. **Claim a task**: Use `conductor_claim_task` with the task ID
3. **Lock files**: Before editing, use `conductor_lock_file`
4. **Work incrementally**: Use `conductor_update_progress` every few steps
5. **Complete**: Use `conductor_complete_task` with a summary
6. **Release locks**: Use `conductor_unlock_file` when done

### Example Session

```
1. conductor_list_tasks(project_id="abc123", status="pending")
   → Returns: [{id: "task-1", title: "Fix login bug", priority: "high"}]

2. conductor_claim_task(task_id="task-1")
   → Returns: {success: true, task: {...}}

3. conductor_lock_file(file_path="src/auth/login.ts")
   → Returns: {locked: true, expires_at: "..."}

4. [Make changes to the file]

5. conductor_update_progress(task_id="task-1", description="Fixed null check on line 42")

6. conductor_complete_task(task_id="task-1", result="Fixed login validation bug")

7. conductor_unlock_file(file_path="src/auth/login.ts")
```

### Conflict Handling

If you encounter a locked file:
1. Check who holds the lock: `conductor_check_conflicts`
2. Wait or work on a different file
3. Never force modifications on locked files

### Status Reporting

Send heartbeats every 2-3 minutes to indicate you're still working:
```
conductor_heartbeat()
```

If you stop sending heartbeats, Conductor may reassign your tasks.

## Project-Specific Instructions

<!-- Project-specific instructions are appended below by Conductor -->
