# CLAUDE.md

This file provides guidance to Claude Code when working with the Conductor codebase.

## Project Overview

Conductor is a multi-LLM orchestration framework that enables autonomous agent coordination on shared codebases. It provides task management, file locking, cost tracking, and MCP integration.

## Development Commands

```bash
# Build all packages
npm run build

# Run in development mode
npm run dev

# Run tests
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint

# Clean build artifacts
npm run clean
```

## Architecture

### Monorepo Structure

```
conductor/
├── packages/
│   ├── core/           # Types, utilities, agent profiles
│   ├── state/          # SQLite state management
│   ├── mcp-server/     # MCP protocol server
│   ├── cli/            # Commander.js CLI
│   └── dashboard/      # Next.js web dashboard
├── turbo.json          # Turborepo configuration
└── tsconfig.base.json  # Shared TypeScript config
```

### Key Concepts

1. **Tasks**: Units of work with status, priority, dependencies, and file associations
2. **Agents**: LLM instances (Claude, Gemini, Codex) with capabilities and cost profiles
3. **File Locks**: Exclusive locks to prevent concurrent modifications
4. **Cost Events**: Token usage and cost tracking per agent/task

### State Management

All state is stored in SQLite via `@conductor/state`:

```typescript
import { SQLiteStateStore } from '@conductor/state';

const store = new SQLiteStateStore('./conductor.db');
const project = store.createProject({ name: 'my-project', rootPath: '.' });
store.registerAgent(project.id, createAgentProfile('claude'));
```

### MCP Server

The MCP server exposes tools for agent coordination:

```typescript
import { createConductorServer } from '@conductor/mcp-server';

const server = createConductorServer({ stateStore, projectId });
```

## Code Patterns

### Adding a New MCP Tool

```typescript
// In packages/mcp-server/src/server.ts
server.tool(
  'conductor_my_tool',
  'Description of what this tool does',
  {
    param1: z.string().describe('Parameter description'),
  },
  async ({ param1 }) => {
    // Implementation
    return {
      content: [{ type: 'text', text: 'Result' }],
    };
  }
);
```

### Adding a CLI Command

```typescript
// In packages/cli/src/commands/index.ts
program
  .command('mycommand')
  .description('What this command does')
  .option('-f, --flag <value>', 'Option description')
  .action((options) => {
    // Implementation
  });
```

## Testing

Each package has its own test setup with Vitest:

```bash
# Run all tests
npm run test

# Run tests for specific package
cd packages/core && npm run test

# Watch mode
npm run test:watch
```

## Dependencies

### Core Dependencies
- `zod`: Schema validation
- `better-sqlite3`: SQLite database
- `@modelcontextprotocol/sdk`: MCP protocol
- `commander`: CLI framework
- `ink`: React for CLI
- `next`: Dashboard framework

### Key Version Requirements
- Node.js >= 20.0.0
- TypeScript >= 5.7.0

## Common Tasks

### Initialize a New Project
```bash
conductor init -n "project-name" -s lock -b 100
```

### Register Agents
```bash
conductor agent:register -i claude
conductor agent:register -i gemini -c typescript react nextjs
```

### Add Tasks
```bash
conductor task:add -t "Task title" -p high --files src/*.ts
```

### Start MCP Server
```bash
CONDUCTOR_PROJECT=<id> npx @conductor/mcp-server
```
