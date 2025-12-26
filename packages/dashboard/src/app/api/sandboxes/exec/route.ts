/**
 * E2B Sandbox Exec API
 * Execute commands in running sandboxes
 */

import { NextRequest, NextResponse } from 'next/server';
import { AgentRunner, SandboxManager } from '@conductor/e2b-runner';

export const dynamic = 'force-dynamic';

// Singleton instances (shared with main sandboxes route)
let sandboxManager: SandboxManager | null = null;
let agentRunner: AgentRunner | null = null;

function getSandboxManager(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager({
      apiKey: process.env.E2B_API_KEY,
    });
  }
  return sandboxManager;
}

function getAgentRunner(): AgentRunner {
  if (!agentRunner) {
    agentRunner = new AgentRunner({
      apiKey: process.env.E2B_API_KEY,
    });
  }
  return agentRunner;
}

/**
 * POST /api/sandboxes/exec
 * Execute a command in a sandbox or agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sandboxId, agentId, command, cwd, timeout } = body;

    if (!command) {
      return NextResponse.json({ error: 'command is required' }, { status: 400 });
    }

    if (!sandboxId && !agentId) {
      return NextResponse.json(
        { error: 'Either sandboxId or agentId is required' },
        { status: 400 }
      );
    }

    let result: { stdout: string; stderr: string; exitCode: number };

    if (agentId) {
      const runner = getAgentRunner();
      result = await runner.executeInAgent(agentId, command, {
        cwd,
        timeout: timeout || 60,
      });
    } else {
      const manager = getSandboxManager();
      result = await manager.executeCommand(sandboxId!, command, {
        cwd,
        timeout: timeout || 60,
      });
    }

    return NextResponse.json({
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error) {
    console.error('Failed to execute command:', error);
    return NextResponse.json(
      { error: `Failed to execute command: ${error}`, success: false },
      { status: 500 }
    );
  }
}
