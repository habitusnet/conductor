/**
 * E2B Sandboxes API
 * Manages E2B sandbox lifecycle for agent execution
 *
 * Note: Uses Node.js runtime (not edge) because E2B SDK requires Node.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { AgentRunner, SandboxManager } from '@conductor/e2b-runner';
import type { AgentRunnerType, SandboxStatus } from '@conductor/e2b-runner';

export const dynamic = 'force-dynamic';
// Note: NOT using edge runtime - E2B SDK requires Node.js

// Singleton instances
let sandboxManager: SandboxManager | null = null;
let agentRunner: AgentRunner | null = null;

function getSandboxManager(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager({
      apiKey: process.env.E2B_API_KEY,
      defaultTimeout: 300,
      maxConcurrent: 10,
    });
  }
  return sandboxManager;
}

function getAgentRunner(): AgentRunner {
  if (!agentRunner) {
    agentRunner = new AgentRunner({
      apiKey: process.env.E2B_API_KEY,
      defaultTimeout: 300,
      maxConcurrent: 10,
    });
  }
  return agentRunner;
}

/**
 * GET /api/sandboxes
 * List all sandboxes with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as SandboxStatus | null;
    const agentId = searchParams.get('agentId');

    const manager = getSandboxManager();
    const runner = getAgentRunner();

    const sandboxes = manager.listInstances({
      status: status || undefined,
      agentId: agentId || undefined,
    });

    const runningAgents = runner.listRunningAgents();
    const stats = manager.getStats();

    // Enrich sandboxes with agent info
    const enrichedSandboxes = sandboxes.map((sandbox) => {
      const agentInfo = runningAgents.find((a) => a.sandboxId === sandbox.id);
      return {
        ...sandbox,
        startedAt: sandbox.startedAt.toISOString(),
        lastActivityAt: sandbox.lastActivityAt.toISOString(),
        runningAgent: agentInfo
          ? {
              agentId: agentInfo.agentId,
              startTime: agentInfo.startTime.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json({
      sandboxes: enrichedSandboxes,
      stats,
      runningAgents: runningAgents.map((a) => ({
        ...a,
        startTime: a.startTime.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to list sandboxes:', error);
    return NextResponse.json(
      { error: 'Failed to list sandboxes', sandboxes: [], stats: { total: 0, running: 0, stopped: 0, failed: 0, timeout: 0 } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sandboxes
 * Create a new sandbox or spawn an agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      agentId,
      projectId,
      type,
      template,
      timeout,
      gitRepo,
      gitBranch,
      workDir,
      mcpServerUrl,
      runImmediately,
    } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const pId = projectId || process.env.CONDUCTOR_PROJECT || 'default';

    if (action === 'spawn' || type) {
      // Spawn an agent in a sandbox
      const runner = getAgentRunner();
      const agentType = (type || 'claude-code') as AgentRunnerType;
      const mcpUrl = mcpServerUrl || process.env.CONDUCTOR_MCP_URL || 'http://localhost:3001';

      if (runImmediately) {
        // Run agent and wait for completion
        const result = await runner.runAgent({
          type: agentType,
          agentId,
          projectId: pId,
          mcpServerUrl: mcpUrl,
          gitRepo,
          gitBranch,
          workDir: workDir || '/home/user/workspace',
          sandbox: {
            template: template || 'base',
            timeout: timeout || 300,
          },
        });

        return NextResponse.json({
          action: 'run',
          result: {
            ...result,
            success: result.success,
          },
        });
      } else {
        // Start agent without waiting
        const instance = await runner.startAgent({
          type: agentType,
          agentId,
          projectId: pId,
          mcpServerUrl: mcpUrl,
          gitRepo,
          gitBranch,
          workDir: workDir || '/home/user/workspace',
          sandbox: {
            template: template || 'base',
            timeout: timeout || 300,
          },
        });

        return NextResponse.json({
          action: 'spawn',
          sandbox: {
            ...instance,
            startedAt: instance.startedAt.toISOString(),
            lastActivityAt: instance.lastActivityAt.toISOString(),
          },
        });
      }
    } else {
      // Create a bare sandbox
      const manager = getSandboxManager();
      const instance = await manager.createSandbox(agentId, pId, {
        template: template || 'base',
        timeout: timeout || 300,
      });

      return NextResponse.json({
        action: 'create',
        sandbox: {
          ...instance,
          startedAt: instance.startedAt.toISOString(),
          lastActivityAt: instance.lastActivityAt.toISOString(),
        },
      });
    }
  } catch (error) {
    console.error('Failed to create sandbox:', error);
    return NextResponse.json(
      { error: `Failed to create sandbox: ${error}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sandboxes
 * Stop a sandbox or all sandboxes
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sandboxId = searchParams.get('sandboxId');
    const agentId = searchParams.get('agentId');
    const stopAll = searchParams.get('all') === 'true';

    const manager = getSandboxManager();
    const runner = getAgentRunner();

    if (stopAll) {
      await manager.stopAll();
      await runner.stopAllAgents();
      return NextResponse.json({ action: 'stop-all', success: true });
    }

    if (agentId) {
      await runner.stopAgent(agentId);
      return NextResponse.json({ action: 'stop-agent', agentId, success: true });
    }

    if (sandboxId) {
      await manager.stopSandbox(sandboxId);
      return NextResponse.json({ action: 'stop-sandbox', sandboxId, success: true });
    }

    return NextResponse.json({ error: 'sandboxId, agentId, or all=true is required' }, { status: 400 });
  } catch (error) {
    console.error('Failed to stop sandbox:', error);
    return NextResponse.json(
      { error: `Failed to stop sandbox: ${error}` },
      { status: 500 }
    );
  }
}
