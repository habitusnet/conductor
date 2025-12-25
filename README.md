# Conductor

Multi-LLM orchestration framework for autonomous agent coordination.

## Overview

Conductor enables multiple LLM agents (Claude, Gemini, Codex, etc.) to work autonomously on shared codebases with:

- **Task Management**: Claim, track, and complete tasks with priority and dependencies
- **File Locking**: Prevent conflicts with exclusive file locks
- **Cost Tracking**: Monitor token usage and budget across agents
- **MCP Integration**: Native Model Context Protocol server for Claude CLI and compatible tools
- **Real-time Dashboard**: Web-based monitoring and control

## Quick Start

```bash
# Install globally
npm install -g @conductor/cli

# Initialize in your project
cd your-project
conductor init

# Register agents
conductor agent:register -i claude
conductor agent:register -i gemini
conductor agent:register -i codex

# Add tasks
conductor task:add -t "Implement user authentication" --files src/auth/*.ts
conductor task:add -t "Write unit tests" --deps <auth-task-id>

# Check status
conductor status
```

## Packages

| Package | Description |
|---------|-------------|
| `@conductor/core` | Core types and utilities |
| `@conductor/state` | SQLite state management |
| `@conductor/mcp-server` | MCP protocol server |
| `@conductor/cli` | Command-line interface |
| `@conductor/dashboard` | Web dashboard (Next.js) |

## MCP Integration

Add Conductor to your Claude CLI configuration:

```json
{
  "mcpServers": {
    "conductor": {
      "command": "npx",
      "args": ["@conductor/mcp-server"],
      "env": {
        "CONDUCTOR_PROJECT": "<your-project-id>",
        "CONDUCTOR_DB": "./conductor.db"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `conductor_list_tasks` | List available tasks |
| `conductor_claim_task` | Claim a task to work on |
| `conductor_update_task` | Update task status |
| `conductor_lock_file` | Acquire file lock |
| `conductor_unlock_file` | Release file lock |
| `conductor_check_locks` | Check file lock status |
| `conductor_report_usage` | Report token usage |
| `conductor_get_budget` | Check budget status |
| `conductor_heartbeat` | Send agent heartbeat |
| `conductor_list_agents` | List registered agents |

## CLI Commands

```bash
# Project
conductor init              # Initialize project
conductor status            # Show project status

# Agents
conductor agent:register    # Register an agent
conductor agent:list        # List agents
conductor agent:profiles    # Show available profiles

# Tasks
conductor task:add          # Add a task
conductor task:list         # List tasks
conductor task:show <id>    # Show task details

# Server
conductor serve             # Start MCP server
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CONDUCTOR CORE                        │
├─────────────────────────────────────────────────────────┤
│  Agent Gateway (MCP) │ Task Manager │ Conflict Resolver │
│                      │              │                    │
│  ┌────────────────── State Manager (SQLite) ──────────┐ │
│  │                                                     │ │
│  │  Cost Manager  │  File Locks   │  Event Logger     │ │
└──┴─────────────────────────────────────────────────────┴─┘
         │                 │                 │
    Claude CLI        Gemini API        Codex API
```

## Development

```bash
# Clone and install
git clone https://github.com/habitusnet/conductor.git
cd conductor
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Development mode
npm run dev
```

## Conflict Resolution Strategies

| Strategy | Description |
|----------|-------------|
| `lock` | Exclusive file locks (default) |
| `merge` | Attempt automatic merge |
| `zone` | Assign file ownership zones |
| `review` | Queue for human review |

## Cost Tracking

Conductor tracks token usage and costs per agent:

```bash
# Check budget
conductor status

# View detailed costs in dashboard
open http://localhost:3100/costs
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines.
