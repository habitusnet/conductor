import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SQLiteStateStore } from '@conductor/state';
import type { Task } from '@conductor/core';

export interface ConductorServerOptions {
  stateStore: SQLiteStateStore;
  projectId: string;
}

/**
 * Create the Conductor MCP server with all tools
 */
export function createConductorServer(options: ConductorServerOptions): McpServer {
  const { stateStore, projectId } = options;

  const server = new McpServer({
    name: 'conductor',
    version: '0.1.0',
  });

  // ============================================================================
  // Task Tools
  // ============================================================================

  server.tool(
    'conductor_list_tasks',
    'List tasks available for claiming or in progress',
    {
      status: z
        .enum(['pending', 'claimed', 'in_progress', 'completed', 'failed', 'blocked'])
        .optional()
        .describe('Filter by task status'),
      priority: z
        .enum(['critical', 'high', 'medium', 'low'])
        .optional()
        .describe('Filter by priority'),
      assignedTo: z.string().optional().describe('Filter by assigned agent'),
    },
    async ({ status, priority, assignedTo }) => {
      const tasks = stateStore.listTasks(projectId, {
        status: status as Task['status'],
        priority: priority as Task['priority'],
        assignedTo,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              tasks.map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                assignedTo: t.assignedTo,
                files: t.files,
                tags: t.tags,
              })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'conductor_get_task',
    'Get full details of a specific task',
    {
      taskId: z.string().describe('The task ID to retrieve'),
    },
    async ({ taskId }) => {
      const task = stateStore.getTask(taskId);

      if (!task) {
        return {
          content: [{ type: 'text', text: `Task not found: ${taskId}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    }
  );

  server.tool(
    'conductor_claim_task',
    'Claim a task to work on. Only pending tasks can be claimed.',
    {
      taskId: z.string().describe('The task ID to claim'),
      agentId: z.string().describe('Your agent ID (e.g., claude, gemini, codex)'),
    },
    async ({ taskId, agentId }) => {
      const success = stateStore.claimTask(taskId, agentId);

      return {
        content: [
          {
            type: 'text',
            text: success
              ? `Successfully claimed task ${taskId}. You can now start working on it.`
              : `Failed to claim task ${taskId}. It may already be claimed or not available.`,
          },
        ],
        isError: !success,
      };
    }
  );

  server.tool(
    'conductor_update_task',
    'Update task status, add notes, or report progress',
    {
      taskId: z.string().describe('The task ID to update'),
      status: z
        .enum(['in_progress', 'completed', 'failed', 'blocked'])
        .optional()
        .describe('New task status'),
      notes: z.string().optional().describe('Progress notes or completion summary'),
      tokensUsed: z.number().optional().describe('Total tokens used for this task'),
      blockedBy: z
        .array(z.string())
        .optional()
        .describe('Task IDs blocking this task'),
    },
    async ({ taskId, status, notes, tokensUsed, blockedBy }) => {
      try {
        const updates: Partial<Task> = {};

        if (status) updates.status = status;
        if (tokensUsed) updates.actualTokens = tokensUsed;
        if (blockedBy) updates.blockedBy = blockedBy;
        if (notes) {
          const current = stateStore.getTask(taskId);
          updates.metadata = {
            ...(current?.metadata || {}),
            notes,
            lastUpdated: new Date().toISOString(),
          };
        }

        const task = stateStore.updateTask(taskId, updates);

        return {
          content: [
            {
              type: 'text',
              text: `Task ${taskId} updated successfully.\nStatus: ${task.status}\n${notes ? `Notes: ${notes}` : ''}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================================
  // File Lock Tools
  // ============================================================================

  server.tool(
    'conductor_lock_file',
    'Acquire exclusive lock on a file before modifying it',
    {
      filePath: z.string().describe('Relative file path from project root'),
      agentId: z.string().describe('Your agent ID'),
      ttlSeconds: z
        .number()
        .default(300)
        .describe('Lock time-to-live in seconds (default: 300)'),
    },
    async ({ filePath, agentId, ttlSeconds }) => {
      const success = stateStore.acquireLock(projectId, filePath, agentId, ttlSeconds);

      if (success) {
        return {
          content: [
            {
              type: 'text',
              text: `Lock acquired on ${filePath}. Expires in ${ttlSeconds} seconds. Remember to release when done.`,
            },
          ],
        };
      }

      const lockInfo = stateStore.checkLock(projectId, filePath);
      return {
        content: [
          {
            type: 'text',
            text: `Failed to acquire lock on ${filePath}. Currently held by: ${lockInfo.holder}. Expires at: ${lockInfo.expiresAt?.toISOString()}`,
          },
        ],
        isError: true,
      };
    }
  );

  server.tool(
    'conductor_unlock_file',
    'Release lock on a file after you are done modifying it',
    {
      filePath: z.string().describe('Relative file path'),
      agentId: z.string().describe('Your agent ID'),
    },
    async ({ filePath, agentId }) => {
      stateStore.releaseLock(projectId, filePath, agentId);

      return {
        content: [{ type: 'text', text: `Lock released on ${filePath}` }],
      };
    }
  );

  server.tool(
    'conductor_check_locks',
    'Check if files are locked before attempting to modify them',
    {
      filePaths: z.array(z.string()).describe('List of file paths to check'),
    },
    async ({ filePaths }) => {
      const results = filePaths.map((fp) => {
        const lockInfo = stateStore.checkLock(projectId, fp);
        return {
          path: fp,
          locked: lockInfo.locked,
          holder: lockInfo.holder,
          expiresAt: lockInfo.expiresAt?.toISOString(),
        };
      });

      const locked = results.filter((r) => r.locked);
      const summary =
        locked.length === 0
          ? 'All files are available for modification.'
          : `${locked.length} file(s) are locked: ${locked.map((r) => r.path).join(', ')}`;

      return {
        content: [
          {
            type: 'text',
            text: `${summary}\n\nDetails:\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    }
  );

  // ============================================================================
  // Cost/Usage Tools
  // ============================================================================

  server.tool(
    'conductor_report_usage',
    'Report token usage for cost tracking and budget monitoring',
    {
      agentId: z.string().describe('Your agent ID'),
      tokensInput: z.number().describe('Number of input tokens used'),
      tokensOutput: z.number().describe('Number of output tokens used'),
      taskId: z.string().optional().describe('Associated task ID if applicable'),
    },
    async ({ agentId, tokensInput, tokensOutput, taskId }) => {
      const agent = stateStore.getAgent(agentId);
      if (!agent) {
        return {
          content: [{ type: 'text', text: `Agent not found: ${agentId}` }],
          isError: true,
        };
      }

      const cost =
        tokensInput * agent.costPerToken.input +
        tokensOutput * agent.costPerToken.output;

      const project = stateStore.getProject(projectId);
      stateStore.recordCost({
        organizationId: project?.organizationId || 'unknown',
        projectId,
        agentId,
        model: agent.model || 'unknown',
        taskId,
        tokensInput,
        tokensOutput,
        cost,
      });

      const totalSpend = stateStore.getProjectSpend(projectId);
      const budgetInfo = project?.budget
        ? ` Budget: $${totalSpend.toFixed(4)} / $${project.budget.total}`
        : '';

      return {
        content: [
          {
            type: 'text',
            text: `Usage recorded: ${tokensInput} input + ${tokensOutput} output = $${cost.toFixed(4)}.${budgetInfo}`,
          },
        ],
      };
    }
  );

  server.tool(
    'conductor_get_budget',
    'Check current project budget and spending',
    {},
    async () => {
      const project = stateStore.getProject(projectId);
      const totalSpend = stateStore.getProjectSpend(projectId);

      if (!project) {
        return {
          content: [{ type: 'text', text: 'Project not found' }],
          isError: true,
        };
      }

      const budget = project.budget;
      const remaining = budget ? budget.total - totalSpend : null;
      const percentage = budget ? ((totalSpend / budget.total) * 100).toFixed(1) : null;

      return {
        content: [
          {
            type: 'text',
            text: budget
              ? `Budget Status:\n  Spent: $${totalSpend.toFixed(4)} (${percentage}%)\n  Remaining: $${remaining?.toFixed(4)}\n  Total: $${budget.total}\n  Alert Threshold: ${budget.alertThreshold}%`
              : `No budget set. Total spend: $${totalSpend.toFixed(4)}`,
          },
        ],
      };
    }
  );

  // ============================================================================
  // Agent Tools
  // ============================================================================

  server.tool(
    'conductor_heartbeat',
    'Send heartbeat to indicate agent is active',
    {
      agentId: z.string().describe('Your agent ID'),
      status: z
        .enum(['idle', 'working', 'blocked'])
        .optional()
        .describe('Current agent status'),
    },
    async ({ agentId, status }) => {
      stateStore.heartbeat(agentId);
      if (status) {
        stateStore.updateAgentStatus(agentId, status);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Heartbeat recorded for ${agentId}${status ? `. Status: ${status}` : ''}`,
          },
        ],
      };
    }
  );

  server.tool(
    'conductor_list_agents',
    'List all registered agents and their status',
    {},
    async () => {
      const agents = stateStore.listAgents(projectId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              agents.map((a) => ({
                id: a.id,
                name: a.name,
                status: a.status,
                capabilities: a.capabilities,
                lastHeartbeat: a.lastHeartbeat?.toISOString(),
              })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ============================================================================
  // Resources
  // ============================================================================

  server.resource(
    `conductor://project/${projectId}/status`,
    'Current project status including tasks, agents, and budget',
    async () => {
      const project = stateStore.getProject(projectId);
      const tasks = stateStore.listTasks(projectId);
      const agents = stateStore.listAgents(projectId);
      const spend = stateStore.getProjectSpend(projectId);

      const taskSummary = {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === 'pending').length,
        inProgress: tasks.filter((t) => t.status === 'in_progress').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
        failed: tasks.filter((t) => t.status === 'failed').length,
        blocked: tasks.filter((t) => t.status === 'blocked').length,
      };

      return {
        contents: [
          {
            uri: `conductor://project/${projectId}/status`,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                project: {
                  id: project?.id,
                  name: project?.name,
                  conflictStrategy: project?.conflictStrategy,
                },
                tasks: taskSummary,
                agents: agents.map((a) => ({
                  id: a.id,
                  status: a.status,
                  lastHeartbeat: a.lastHeartbeat,
                })),
                budget: project?.budget
                  ? {
                      spent: spend,
                      total: project.budget.total,
                      remaining: project.budget.total - spend,
                      percentUsed: ((spend / project.budget.total) * 100).toFixed(1),
                    }
                  : null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
