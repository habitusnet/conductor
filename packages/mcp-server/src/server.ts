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
    'Claim a task to work on. Returns task details and project context bundle for alignment.',
    {
      taskId: z.string().describe('The task ID to claim'),
      agentId: z.string().describe('Your agent ID (e.g., claude-session-123)'),
      agentType: z
        .enum(['claude', 'gemini', 'codex', 'gpt4', 'llama', 'custom'])
        .default('custom')
        .describe('Type of LLM agent (for context customization)'),
    },
    async ({ taskId, agentId, agentType }) => {
      const success = stateStore.claimTask(taskId, agentId);

      if (!success) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to claim task ${taskId}. It may already be claimed or not available.`,
            },
          ],
          isError: true,
        };
      }

      // Get the task details
      const task = stateStore.getTask(taskId);
      if (!task) {
        return {
          content: [{ type: 'text', text: `Task ${taskId} not found after claiming.` }],
          isError: true,
        };
      }

      // Generate context bundle
      const context = stateStore.generateContextBundle(projectId, agentId, agentType, task);

      // Record task claim for checkpoint tracking
      stateStore.recordTaskClaim(projectId, agentId, taskId);

      // Check if this is a checkpoint moment
      const isCheckpoint = stateStore.shouldRefreshContext(projectId, agentId);

      // Build response
      let responseText = `# Task Claimed Successfully\n\n`;
      responseText += `**Task ID:** ${task.id}\n`;
      responseText += `**Title:** ${task.title}\n`;
      if (task.description) {
        responseText += `**Description:** ${task.description}\n`;
      }
      responseText += `**Priority:** ${task.priority}\n`;
      if (task.files && task.files.length > 0) {
        responseText += `**Expected Files:** ${task.files.join(', ')}\n`;
      }
      responseText += '\n---\n\n';

      // Add context bundle
      responseText += `# Project Context\n\n`;
      responseText += `**Project:** ${context.projectName}\n`;

      if (context.isFirstTask) {
        responseText += `\n> **Welcome!** This is your first task on this project.\n`;
      }

      if (isCheckpoint) {
        responseText += `\n> **Checkpoint:** This is a periodic context refresh to keep you aligned.\n`;
      }

      if (context.currentFocus) {
        responseText += `\n**Current Focus:** ${context.currentFocus}\n`;
      }

      if (context.projectGoals && context.projectGoals.length > 0) {
        responseText += `\n**Project Goals:**\n`;
        context.projectGoals.forEach((goal, i) => {
          responseText += `${i + 1}. ${goal}\n`;
        });
      }

      if (context.agentInstructions) {
        responseText += `\n**Your Instructions:**\n${context.agentInstructions}\n`;
      }

      if (context.checkpointRules && context.checkpointRules.length > 0) {
        responseText += `\n**Remember:**\n`;
        context.checkpointRules.forEach((rule) => {
          responseText += `- ${rule}\n`;
        });
      }

      if (context.allowedPaths && context.allowedPaths.length > 0) {
        responseText += `\n**Your Zone (allowed paths):** ${context.allowedPaths.join(', ')}\n`;
      }

      if (context.taskContext?.relatedTasks && context.taskContext.relatedTasks.length > 0) {
        responseText += `\n**Related Tasks:** ${context.taskContext.relatedTasks.join(', ')}\n`;
        responseText += `(Coordinate with agents working on these tasks)\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
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
  // Access Request Tools (Agent Onboarding)
  // ============================================================================

  server.tool(
    'conductor_request_access',
    'Request access to work on this project. Must be approved before you can claim tasks.',
    {
      agentId: z.string().describe('Your unique agent ID (e.g., claude-session-123)'),
      agentName: z.string().describe('Human-readable name (e.g., Claude Code)'),
      agentType: z
        .enum(['claude', 'gemini', 'codex', 'gpt4', 'llama', 'custom'])
        .describe('Type of LLM agent'),
      capabilities: z
        .array(z.string())
        .default([])
        .describe('List of capabilities (e.g., typescript, react, testing)'),
      requestedRole: z
        .enum(['lead', 'contributor', 'reviewer', 'observer'])
        .default('contributor')
        .describe('Requested role in the project'),
    },
    async ({ agentId, agentName, agentType, capabilities, requestedRole }) => {
      // Check if agent already has approved access
      if (stateStore.hasApprovedAccess(projectId, agentId)) {
        return {
          content: [
            {
              type: 'text',
              text: `Access already approved for ${agentId}. You can proceed to claim tasks.`,
            },
          ],
        };
      }

      const request = stateStore.createAccessRequest(projectId, {
        agentId,
        agentName,
        agentType,
        capabilities,
        requestedRole,
      });

      if (request.status === 'approved') {
        return {
          content: [
            {
              type: 'text',
              text: `Access approved! You can now claim tasks.\nRole: ${request.requestedRole}\nCapabilities: ${request.capabilities.join(', ')}`,
            },
          ],
        };
      }

      const queuePosition = stateStore.getPendingAccessCount(projectId);

      return {
        content: [
          {
            type: 'text',
            text: `Access request submitted and pending approval.\nRequest ID: ${request.id}\nQueue position: ${queuePosition}\nRequested role: ${requestedRole}\n\nA human operator will review your request. Use conductor_check_access to check status.`,
          },
        ],
      };
    }
  );

  server.tool(
    'conductor_check_access',
    'Check if your access request has been approved',
    {
      agentId: z.string().describe('Your agent ID'),
    },
    async ({ agentId }) => {
      if (stateStore.hasApprovedAccess(projectId, agentId)) {
        const requests = stateStore.listAccessRequests(projectId, { status: 'approved' });
        const myRequest = requests.find((r) => r.agentId === agentId);

        return {
          content: [
            {
              type: 'text',
              text: `Access APPROVED.\nRole: ${myRequest?.requestedRole || 'contributor'}\nExpires: ${myRequest?.expiresAt?.toISOString() || 'Never'}\n\nYou can now use conductor_list_tasks and conductor_claim_task.`,
            },
          ],
        };
      }

      const requests = stateStore.listAccessRequests(projectId);
      const myRequest = requests.find((r) => r.agentId === agentId);

      if (!myRequest) {
        return {
          content: [
            {
              type: 'text',
              text: `No access request found for ${agentId}. Use conductor_request_access to submit a request.`,
            },
          ],
          isError: true,
        };
      }

      if (myRequest.status === 'denied') {
        return {
          content: [
            {
              type: 'text',
              text: `Access DENIED.\nReason: ${myRequest.denialReason || 'No reason provided'}\nReviewed by: ${myRequest.reviewedBy}\n\nYou may submit a new request with different parameters.`,
            },
          ],
          isError: true,
        };
      }

      if (myRequest.status === 'expired') {
        return {
          content: [
            {
              type: 'text',
              text: `Access request EXPIRED. Please submit a new request using conductor_request_access.`,
            },
          ],
          isError: true,
        };
      }

      // Status is pending
      const queuePosition = stateStore.getPendingAccessCount(projectId);
      return {
        content: [
          {
            type: 'text',
            text: `Access request PENDING.\nRequest ID: ${myRequest.id}\nQueue position: ${queuePosition}\nSubmitted: ${myRequest.requestedAt.toISOString()}\n\nWaiting for human approval...`,
          },
        ],
      };
    }
  );

  // ============================================================================
  // Context Management Tools
  // ============================================================================

  server.tool(
    'conductor_refresh_context',
    'Request a context refresh to realign with project goals and instructions. Use when feeling lost or after extended work.',
    {
      agentId: z.string().describe('Your agent ID'),
      agentType: z
        .enum(['claude', 'gemini', 'codex', 'gpt4', 'llama', 'custom'])
        .default('custom')
        .describe('Type of LLM agent (for context customization)'),
    },
    async ({ agentId, agentType }) => {
      const context = stateStore.generateContextRefresh(projectId, agentId, agentType);

      let responseText = `# Context Refresh\n\n`;
      responseText += `**Project:** ${context.projectName}\n`;

      if (context.currentFocus) {
        responseText += `\n**Current Focus:** ${context.currentFocus}\n`;
      }

      if (context.projectGoals && context.projectGoals.length > 0) {
        responseText += `\n**Project Goals:**\n`;
        context.projectGoals.forEach((goal, i) => {
          responseText += `${i + 1}. ${goal}\n`;
        });
      }

      if (context.agentInstructions) {
        responseText += `\n**Your Instructions:**\n${context.agentInstructions}\n`;
      }

      if (context.styleGuide) {
        responseText += `\n**Style Guide:**\n${context.styleGuide}\n`;
      }

      if (context.checkpointRules && context.checkpointRules.length > 0) {
        responseText += `\n**Remember:**\n`;
        context.checkpointRules.forEach((rule) => {
          responseText += `- ${rule}\n`;
        });
      }

      if (context.allowedPaths && context.allowedPaths.length > 0) {
        responseText += `\n**Your Zone (allowed paths):** ${context.allowedPaths.join(', ')}\n`;
      }

      if (context.deniedPaths && context.deniedPaths.length > 0) {
        responseText += `**Restricted paths:** ${context.deniedPaths.join(', ')}\n`;
      }

      if (context.relevantPatterns && context.relevantPatterns.length > 0) {
        responseText += `\n**Relevant Code Patterns:**\n`;
        context.relevantPatterns.forEach((pattern) => {
          responseText += `- ${pattern.file}${pattern.lineRange ? `:${pattern.lineRange}` : ''}: ${pattern.description}\n`;
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    }
  );

  server.tool(
    'conductor_get_onboarding_config',
    'Get the project onboarding configuration. Useful for understanding project setup.',
    {},
    async () => {
      const config = stateStore.getOnboardingConfig(projectId);
      const project = stateStore.getProject(projectId);

      if (!config && !project) {
        return {
          content: [
            {
              type: 'text',
              text: 'No onboarding configuration found for this project.',
            },
          ],
        };
      }

      let responseText = `# Project Onboarding Configuration\n\n`;
      responseText += `**Project:** ${project?.name || projectId}\n`;

      if (config?.welcomeMessage) {
        responseText += `\n**Welcome Message:**\n${config.welcomeMessage}\n`;
      }

      if (config?.currentFocus) {
        responseText += `\n**Current Focus:** ${config.currentFocus}\n`;
      }

      if (config?.goals && config.goals.length > 0) {
        responseText += `\n**Project Goals:**\n`;
        config.goals.forEach((goal, i) => {
          responseText += `${i + 1}. ${goal}\n`;
        });
      }

      if (config?.checkpointRules && config.checkpointRules.length > 0) {
        responseText += `\n**Checkpoint Rules:**\n`;
        config.checkpointRules.forEach((rule) => {
          responseText += `- ${rule}\n`;
        });
      }

      responseText += `\n**Context Refresh:** Every ${config?.checkpointEveryNTasks || 3} tasks`;
      responseText += `\n**Auto Refresh:** ${config?.autoRefreshContext ? 'Enabled' : 'Disabled'}`;

      return {
        content: [
          {
            type: 'text',
            text: responseText,
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
