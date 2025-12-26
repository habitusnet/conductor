# Conductor

**Multi-LLM Orchestration Platform for Autonomous Agent Coordination**

Conductor is a project-agnostic orchestration platform that enables multiple LLM agents (Claude, Gemini, GPT-4, Codex, etc.) to work autonomously and collaboratively on shared codebases.

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CONDUCTOR PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │Organization │───▶│   Project   │───▶│    Agent    │             │
│  │  (Account)  │    │  (Repo Link)│    │  Instances  │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│         │                  │                  │                     │
│         ▼                  ▼                  ▼                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Billing   │    │   Custom    │    │  Heartbeat  │             │
│  │  & Quotas   │    │Instructions │    │  & Status   │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  CONNECTORS                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│  │ GitHub │ │ Claude │ │ Gemini │ │ OpenAI │ │Webhooks│            │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘            │
├─────────────────────────────────────────────────────────────────────┤
│  DASHBOARD                                                           │
│  • Portfolio view (all projects)                                    │
│  • Project drill-down (tasks, agents, costs)                        │
│  • Agent performance & utilization                                  │
│  • Conflict resolution queue                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Features

### Multi-Tenancy
- **Organizations**: Account-level isolation with billing and quotas
- **Projects**: Link any Git repository for orchestrated development
- **Agents**: Register and manage multiple LLM agents per project

### Task Orchestration
- **Task Auction**: Agents bid on tasks based on capabilities and cost
- **Dependency Management**: Tasks can have prerequisites and blockers
- **Progress Tracking**: Real-time updates from working agents

### Conflict Resolution
- **File Locking**: Prevent concurrent edits to the same files
- **Zone-based Ownership**: Assign file patterns to specific agents
- **Merge Strategies**: Automatic or human-reviewed conflict resolution
- **Review Queue**: Dashboard for manual intervention

### Cost Management
- **Token Tracking**: Monitor usage per agent, project, and task
- **Budget Alerts**: Notifications at configurable thresholds
- **Usage Reports**: Detailed breakdowns for optimization

### Agent Coordination
- **Heartbeat Monitoring**: Detect stale or crashed agents
- **Auto-reassignment**: Recover from agent failures
- **Custom Instructions**: Per-project CLAUDE.md, GEMINI.md files

## Package Structure

```
conductor/
├── packages/
│   ├── core/           # Type definitions and shared logic
│   ├── db/             # Database layer (SQLite + PostgreSQL)
│   ├── mcp-server/     # MCP tools for LLM agents
│   ├── connectors/     # External service integrations
│   ├── cli/            # Command-line interface
│   └── dashboard/      # Web-based oversight UI (coming soon)
├── templates/
│   ├── CLAUDE.md       # Claude agent instructions
│   ├── GEMINI.md       # Gemini agent instructions
│   └── project.yaml    # Project configuration schema
└── apps/
    └── dashboard/      # Next.js dashboard app (coming soon)
```

## Quick Start

### 1. Install CLI

```bash
npm install -g @conductor/cli
```

### 2. Initialize a Project

```bash
cd your-project
conductor init
```

This creates a `.conductor/` directory with:
- `project.yaml` - Project configuration
- `CLAUDE.md` - Claude agent instructions
- `GEMINI.md` - Gemini agent instructions

### 3. Configure Agents

Edit `.conductor/project.yaml`:

```yaml
agents:
  claude:
    enabled: true
    role: lead
    allowed_paths: ["src/**/*"]

  gemini:
    enabled: true
    role: contributor
    allowed_paths: ["docs/**/*"]
```

### 4. Start the MCP Server

```bash
conductor serve
```

### 5. Connect Your Agents

Add to Claude's MCP configuration:
```json
{
  "mcpServers": {
    "conductor": {
      "command": "conductor",
      "args": ["mcp"]
    }
  }
}
```

## MCP Tools

Conductor exposes these tools to connected agents:

| Tool | Description |
|------|-------------|
| `conductor_list_tasks` | List available tasks for the project |
| `conductor_claim_task` | Claim a pending task |
| `conductor_start_task` | Mark task as in progress |
| `conductor_update_progress` | Report progress on current task |
| `conductor_complete_task` | Mark task as completed with result |
| `conductor_fail_task` | Report task failure with error |
| `conductor_lock_file` | Acquire exclusive lock on a file |
| `conductor_unlock_file` | Release file lock |
| `conductor_check_conflicts` | Check for active conflicts |
| `conductor_heartbeat` | Send keepalive signal |

## CLI Commands

```bash
# Project Management
conductor init              # Initialize project
conductor status            # Show project status
conductor sync              # Sync with remote repository

# Agent Management
conductor agent:register    # Register an agent
conductor agent:list        # List agents
conductor agent:profiles    # Show available profiles

# Task Management
conductor task:add          # Add a task
conductor task:list         # List tasks
conductor task:show <id>    # Show task details

# Server
conductor serve             # Start MCP server
conductor mcp               # Run as MCP subprocess
```

## Configuration

### Environment Variables

```bash
# Database (SQLite for local, Postgres for production)
CONDUCTOR_DB_PATH=./conductor.db
CONDUCTOR_DATABASE_URL=postgresql://...

# API Keys (for LLM connectors)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
OPENAI_API_KEY=sk-...

# GitHub (for repo sync)
GITHUB_TOKEN=ghp_...
```

### Project Configuration

See `templates/project.yaml` for full configuration options.

## Conflict Resolution Strategies

| Strategy | Description |
|----------|-------------|
| `lock` | Exclusive file locks (default) |
| `merge` | Attempt automatic merge |
| `zone` | Assign file ownership zones |
| `review` | Queue for human review |

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Start development
npm run dev
```

## Architecture

### Database

Conductor supports two database backends:
- **SQLite**: Local development, single-machine deployments
- **PostgreSQL (Neon)**: Production, multi-region, serverless

Schema includes:
- `organizations` - Multi-tenant accounts
- `projects` - Linked repositories
- `agents` - Registered LLM agents
- `project_agents` - Per-project agent configuration
- `tasks` - Work items with status, priority, assignments
- `task_activities` - Audit log of task changes
- `file_locks` - Active file locks
- `file_conflicts` - Conflict records
- `cost_events` - Token usage tracking

### MCP Server

The MCP server runs as a local process and exposes Conductor's functionality to connected LLM agents. It handles:
- Tool registration and execution
- Database operations
- File lock management
- Heartbeat processing

### Dashboard (Coming Soon)

Web-based UI for:
- Project portfolio overview
- Real-time agent status
- Task management
- Conflict resolution queue
- Cost analytics

## Roadmap

- [x] Core types and schemas
- [x] SQLite + PostgreSQL database layer
- [x] MCP server with basic tools
- [x] GitHub connector
- [x] LLM connectors (Claude, Gemini, OpenAI)
- [ ] Dashboard UI
- [ ] Real-time notifications (WebSocket)
- [ ] Advanced conflict resolution
- [ ] Agent capability matching
- [ ] Cost optimization recommendations

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.
