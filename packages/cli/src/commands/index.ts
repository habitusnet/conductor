import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { SQLiteStateStore } from '@conductor/state';
import { createAgentProfile, DEFAULT_AGENT_PROFILES } from '@conductor/core';
import type { ConflictStrategy, TaskPriority } from '@conductor/core';

export const program = new Command();

program
  .name('conductor')
  .description('Multi-LLM orchestration framework for autonomous agent coordination')
  .version('0.1.0');

// Helper to get or create store
function getStore(): SQLiteStateStore {
  const dbPath = process.env['CONDUCTOR_DB'] || './conductor.db';
  return new SQLiteStateStore(dbPath);
}

// Helper to find project in current directory
function findProject(store: SQLiteStateStore): string | null {
  const configPath = path.join(process.cwd(), '.conductor.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.projectId;
  }
  return null;
}

// ============================================================================
// Init Command
// ============================================================================

program
  .command('init')
  .description('Initialize Conductor in current directory')
  .option('-n, --name <name>', 'Project name')
  .option(
    '-s, --strategy <strategy>',
    'Conflict strategy (lock, merge, zone, review)',
    'lock'
  )
  .option('-b, --budget <amount>', 'Budget limit in USD')
  .action((options) => {
    const store = getStore();
    const name = options.name || path.basename(process.cwd());

    const project = store.createProject({
      name,
      rootPath: process.cwd(),
      defaultBranch: 'main',
      conflictStrategy: options.strategy as ConflictStrategy,
      budget: options.budget
        ? { total: parseFloat(options.budget), spent: 0, currency: 'USD', alertThreshold: 80 }
        : undefined,
    });

    // Write config file
    fs.writeFileSync(
      path.join(process.cwd(), '.conductor.json'),
      JSON.stringify({ projectId: project.id }, null, 2)
    );

    console.log(chalk.green('✓ Conductor initialized'));
    console.log(`  Project: ${chalk.bold(project.name)}`);
    console.log(`  ID: ${project.id}`);
    console.log(`  Strategy: ${project.conflictStrategy}`);
    if (project.budget) {
      console.log(`  Budget: $${project.budget.total}`);
    }
    console.log();
    console.log(chalk.dim('Next steps:'));
    console.log(chalk.dim('  conductor agent:register -i claude'));
    console.log(chalk.dim('  conductor task:add -t "Your first task"'));
  });

// ============================================================================
// Agent Commands
// ============================================================================

const agentCmd = program.command('agent').description('Manage agents');

agentCmd
  .command('register')
  .description('Register an agent with the project')
  .requiredOption('-i, --id <id>', 'Agent ID (e.g., claude, gemini, codex)')
  .option('-n, --name <name>', 'Agent display name')
  .option('-c, --capabilities <caps...>', 'Agent capabilities')
  .action((options) => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red('Error: Not in a Conductor project. Run `conductor init` first.'));
      process.exit(1);
    }

    const profile = createAgentProfile(options.id, {
      name: options.name,
      capabilities: options.capabilities,
    });

    store.registerAgent(projectId, profile);

    console.log(chalk.green(`✓ Registered agent: ${profile.name}`));
    console.log(`  ID: ${profile.id}`);
    console.log(`  Capabilities: ${profile.capabilities.join(', ')}`);
  });

agentCmd
  .command('list')
  .description('List all registered agents')
  .action(() => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red('Error: Not in a Conductor project.'));
      process.exit(1);
    }

    const agents = store.listAgents(projectId);

    if (agents.length === 0) {
      console.log(chalk.dim('No agents registered.'));
      console.log(chalk.dim('Register one with: conductor agent:register -i claude'));
      return;
    }

    console.log(chalk.bold('\nRegistered Agents:\n'));
    for (const agent of agents) {
      const statusColor =
        agent.status === 'working'
          ? chalk.green
          : agent.status === 'blocked'
            ? chalk.red
            : chalk.gray;

      console.log(`  ${chalk.bold(agent.name)} (${agent.id})`);
      console.log(`    Status: ${statusColor(agent.status)}`);
      console.log(`    Capabilities: ${agent.capabilities.slice(0, 5).join(', ')}${agent.capabilities.length > 5 ? '...' : ''}`);
      if (agent.lastHeartbeat) {
        console.log(`    Last seen: ${agent.lastHeartbeat.toLocaleString()}`);
      }
      console.log();
    }
  });

agentCmd
  .command('profiles')
  .description('Show available agent profiles')
  .action(() => {
    console.log(chalk.bold('\nAvailable Agent Profiles:\n'));
    for (const [id, profile] of Object.entries(DEFAULT_AGENT_PROFILES)) {
      console.log(`  ${chalk.bold(profile.name)} (${id})`);
      console.log(`    Capabilities: ${profile.capabilities.join(', ')}`);
      console.log(
        `    Cost: $${(profile.costPerToken.input * 1_000_000).toFixed(2)}/M input, $${(profile.costPerToken.output * 1_000_000).toFixed(2)}/M output`
      );
      console.log();
    }
  });

// ============================================================================
// Task Commands
// ============================================================================

const taskCmd = program.command('task').description('Manage tasks');

taskCmd
  .command('add')
  .description('Add a new task')
  .requiredOption('-t, --title <title>', 'Task title')
  .option('-d, --description <desc>', 'Task description')
  .option('-p, --priority <priority>', 'Priority (critical, high, medium, low)', 'medium')
  .option('--deps <deps...>', 'Task dependencies (task IDs)')
  .option('--files <files...>', 'Related files')
  .option('--tags <tags...>', 'Task tags (use requires:X for capability requirements)')
  .action((options) => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red('Error: Not in a Conductor project.'));
      process.exit(1);
    }

    const task = store.createTask(projectId, {
      title: options.title,
      description: options.description,
      priority: options.priority as TaskPriority,
      dependencies: options.deps || [],
      files: options.files || [],
      tags: options.tags || [],
      status: 'pending',
      metadata: {},
    });

    console.log(chalk.green(`✓ Created task: ${task.title}`));
    console.log(`  ID: ${task.id}`);
    console.log(`  Priority: ${task.priority}`);
    if (task.files.length > 0) {
      console.log(`  Files: ${task.files.join(', ')}`);
    }
  });

taskCmd
  .command('list')
  .description('List all tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('-a, --assigned <agent>', 'Filter by assigned agent')
  .action((options) => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red('Error: Not in a Conductor project.'));
      process.exit(1);
    }

    const tasks = store.listTasks(projectId, {
      status: options.status,
      priority: options.priority,
      assignedTo: options.assigned,
    });

    if (tasks.length === 0) {
      console.log(chalk.dim('No tasks found.'));
      return;
    }

    console.log(chalk.bold(`\nTasks (${tasks.length}):\n`));

    for (const task of tasks) {
      const statusEmoji =
        task.status === 'completed'
          ? '✓'
          : task.status === 'in_progress'
            ? '▶'
            : task.status === 'failed'
              ? '✗'
              : task.status === 'blocked'
                ? '⏸'
                : '○';

      const statusColor =
        task.status === 'completed'
          ? chalk.green
          : task.status === 'in_progress'
            ? chalk.blue
            : task.status === 'failed'
              ? chalk.red
              : task.status === 'blocked'
                ? chalk.yellow
                : chalk.gray;

      const priorityColor =
        task.priority === 'critical'
          ? chalk.red
          : task.priority === 'high'
            ? chalk.yellow
            : chalk.gray;

      console.log(
        `  ${statusColor(statusEmoji)} ${chalk.bold(task.title)} ${priorityColor(`[${task.priority}]`)}`
      );
      console.log(chalk.dim(`    ID: ${task.id.slice(0, 8)}...`));
      if (task.assignedTo) {
        console.log(chalk.dim(`    Assigned: ${task.assignedTo}`));
      }
      console.log();
    }
  });

taskCmd
  .command('show <taskId>')
  .description('Show task details')
  .action((taskId) => {
    const store = getStore();
    const task = store.getTask(taskId);

    if (!task) {
      console.error(chalk.red(`Task not found: ${taskId}`));
      process.exit(1);
    }

    console.log(chalk.bold(`\n${task.title}\n`));
    console.log(`ID: ${task.id}`);
    console.log(`Status: ${task.status}`);
    console.log(`Priority: ${task.priority}`);
    if (task.description) console.log(`Description: ${task.description}`);
    if (task.assignedTo) console.log(`Assigned to: ${task.assignedTo}`);
    if (task.files.length > 0) console.log(`Files: ${task.files.join(', ')}`);
    if (task.tags.length > 0) console.log(`Tags: ${task.tags.join(', ')}`);
    if (task.dependencies.length > 0) console.log(`Dependencies: ${task.dependencies.join(', ')}`);
    console.log(`Created: ${task.createdAt.toLocaleString()}`);
    if (task.startedAt) console.log(`Started: ${task.startedAt.toLocaleString()}`);
    if (task.completedAt) console.log(`Completed: ${task.completedAt.toLocaleString()}`);
  });

// ============================================================================
// Status Command
// ============================================================================

program
  .command('status')
  .description('Show project status overview')
  .action(() => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red('Error: Not in a Conductor project.'));
      process.exit(1);
    }

    const project = store.getProject(projectId);
    const tasks = store.listTasks(projectId);
    const agents = store.listAgents(projectId);
    const spend = store.getProjectSpend(projectId);

    if (!project) {
      console.error(chalk.red('Project not found.'));
      process.exit(1);
    }

    console.log(chalk.bold(`\n${project.name}\n`));

    // Task summary
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const blocked = tasks.filter((t) => t.status === 'blocked').length;

    console.log(chalk.bold('Tasks:'));
    console.log(`  ○ Pending: ${pending}`);
    console.log(`  ▶ In Progress: ${inProgress}`);
    console.log(`  ✓ Completed: ${completed}`);
    if (blocked > 0) console.log(chalk.yellow(`  ⏸ Blocked: ${blocked}`));
    console.log();

    // Agent summary
    console.log(chalk.bold('Agents:'));
    if (agents.length === 0) {
      console.log(chalk.dim('  None registered'));
    } else {
      for (const agent of agents) {
        const statusIcon =
          agent.status === 'working' ? '🟢' : agent.status === 'blocked' ? '🔴' : '⚪';
        console.log(`  ${statusIcon} ${agent.name}: ${agent.status}`);
      }
    }
    console.log();

    // Budget
    if (project.budget) {
      const pct = ((spend / project.budget.total) * 100).toFixed(1);
      const remaining = project.budget.total - spend;
      const budgetColor = parseFloat(pct) > 80 ? chalk.red : chalk.green;

      console.log(chalk.bold('Budget:'));
      console.log(`  Spent: ${budgetColor(`$${spend.toFixed(4)} (${pct}%)`)}`);
      console.log(`  Remaining: $${remaining.toFixed(4)}`);
      console.log(`  Total: $${project.budget.total}`);
    } else if (spend > 0) {
      console.log(chalk.bold('Spending:'));
      console.log(`  Total: $${spend.toFixed(4)}`);
    }
  });

// ============================================================================
// Serve Command
// ============================================================================

program
  .command('serve')
  .description('Start MCP server (stdio mode)')
  .action(() => {
    const store = getStore();
    const projectId = findProject(store);
    if (!projectId) {
      console.error(chalk.red('Error: Not in a Conductor project.'));
      process.exit(1);
    }

    console.log(chalk.dim('Starting MCP server...'));
    console.log(chalk.dim('Use with Claude CLI:'));
    console.log(
      chalk.dim(`  CONDUCTOR_PROJECT=${projectId} npx @conductor/mcp-server`)
    );

    // In a full implementation, we'd spawn the MCP server process here
    console.log();
    console.log(
      chalk.yellow('Note: Run the MCP server directly with:')
    );
    console.log(
      `  CONDUCTOR_PROJECT=${projectId} npx @conductor/mcp-server`
    );
  });

export default program;
