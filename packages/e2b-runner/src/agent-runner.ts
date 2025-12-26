/**
 * E2B Agent Runner
 * Runs Conductor agents in E2B sandboxes
 */

import { SandboxManager } from './sandbox-manager.js';
import type {
  AgentRunnerConfig,
  AgentExecutionResult,
  SandboxInstance,
  SandboxEvent,
  E2BRunnerOptions,
} from './types.js';

/**
 * Setup scripts for different agent types
 */
const AGENT_SETUP_SCRIPTS: Record<string, string[]> = {
  'claude-code': [
    // Install Claude Code CLI
    'curl -fsSL https://claude.ai/install.sh | sh || true',
    // Verify installation
    'which claude || echo "Claude Code not found, using npx"',
  ],
  aider: [
    // Install aider via pip
    'pip install aider-chat',
    // Verify installation
    'aider --version',
  ],
  custom: [],
};

/**
 * Agent run commands for different types
 */
const AGENT_RUN_COMMANDS: Record<string, (config: AgentRunnerConfig) => string> = {
  'claude-code': (config) => {
    const mcpConfig = `--mcp-server ${config.mcpServerUrl}`;
    const workDir = config.workDir ? `--work-dir ${config.workDir}` : '';
    return `claude ${mcpConfig} ${workDir} --non-interactive`;
  },
  aider: (config) => {
    const workDir = config.workDir || '.';
    return `cd ${workDir} && aider --no-auto-commits --yes`;
  },
  custom: (config) => {
    return config.env?.AGENT_COMMAND || 'echo "No custom command specified"';
  },
};

/**
 * Runs agents in E2B sandboxes
 */
export class AgentRunner {
  private sandboxManager: SandboxManager;
  private runningAgents: Map<string, { sandboxId: string; startTime: Date }> = new Map();

  constructor(options: E2BRunnerOptions = {}) {
    this.sandboxManager = new SandboxManager({
      ...options,
      onEvent: (event) => {
        this.handleSandboxEvent(event);
        options.onEvent?.(event);
      },
    });
  }

  /**
   * Start an agent in a new sandbox
   */
  async startAgent(config: AgentRunnerConfig): Promise<SandboxInstance> {
    const { agentId, projectId, type, gitRepo, gitBranch, setupCommands, env } = config;

    // Check if agent is already running
    if (this.runningAgents.has(agentId)) {
      throw new Error(`Agent ${agentId} is already running`);
    }

    // Create sandbox
    const instance = await this.sandboxManager.createSandbox(agentId, projectId, {
      ...config.sandbox,
      env: {
        ...env,
        CONDUCTOR_MCP_URL: config.mcpServerUrl,
        CONDUCTOR_AGENT_ID: agentId,
        CONDUCTOR_PROJECT_ID: projectId,
      },
      metadata: {
        agentType: type,
        ...(config.sandbox?.metadata || {}),
      },
    });

    try {
      // Clone git repository if specified
      if (gitRepo) {
        const branch = gitBranch ? `-b ${gitBranch}` : '';
        const workDir = config.workDir || '/home/user/workspace';
        await this.sandboxManager.executeCommand(
          instance.id,
          `git clone ${branch} ${gitRepo} ${workDir}`,
          { timeout: 120 }
        );
      }

      // Run setup scripts for agent type
      const typeSetup = AGENT_SETUP_SCRIPTS[type] || [];
      for (const cmd of typeSetup) {
        await this.sandboxManager.executeCommand(instance.id, cmd, { timeout: 60 });
      }

      // Run custom setup commands
      if (setupCommands) {
        for (const cmd of setupCommands) {
          await this.sandboxManager.executeCommand(instance.id, cmd, { timeout: 60 });
        }
      }

      // Track running agent
      this.runningAgents.set(agentId, {
        sandboxId: instance.id,
        startTime: new Date(),
      });

      return instance;
    } catch (error) {
      // Cleanup on setup failure
      await this.sandboxManager.stopSandbox(instance.id);
      throw error;
    }
  }

  /**
   * Run an agent and wait for completion
   */
  async runAgent(config: AgentRunnerConfig): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    let instance: SandboxInstance | undefined;

    try {
      instance = await this.startAgent(config);

      // Get the run command for this agent type
      const getCommand = AGENT_RUN_COMMANDS[config.type];
      if (!getCommand) {
        throw new Error(`Unknown agent type: ${config.type}`);
      }

      const command = getCommand(config);
      const timeout = config.sandbox?.timeout || 300;

      // Execute the agent
      const result = await this.sandboxManager.executeCommand(instance.id, command, {
        cwd: config.workDir,
        timeout,
        env: config.env,
      });

      const duration = Date.now() - startTime;

      return {
        sandboxId: instance.id,
        agentId: config.agentId,
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        sandboxId: instance?.id || 'unknown',
        agentId: config.agentId,
        success: false,
        duration,
        error: String(error),
      };
    } finally {
      // Cleanup
      if (instance) {
        this.runningAgents.delete(config.agentId);
        await this.sandboxManager.stopSandbox(instance.id);
      }
    }
  }

  /**
   * Execute a command in a running agent's sandbox
   */
  async executeInAgent(
    agentId: string,
    command: string,
    options: { cwd?: string; timeout?: number } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const agentInfo = this.runningAgents.get(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} is not running`);
    }

    return this.sandboxManager.executeCommand(agentInfo.sandboxId, command, options);
  }

  /**
   * Stop a running agent
   */
  async stopAgent(agentId: string): Promise<void> {
    const agentInfo = this.runningAgents.get(agentId);
    if (!agentInfo) {
      return; // Agent not running
    }

    await this.sandboxManager.stopSandbox(agentInfo.sandboxId);
    this.runningAgents.delete(agentId);
  }

  /**
   * Check if an agent is running
   */
  isAgentRunning(agentId: string): boolean {
    return this.runningAgents.has(agentId);
  }

  /**
   * Get running agent info
   */
  getRunningAgent(agentId: string): { sandboxId: string; startTime: Date; instance: SandboxInstance } | undefined {
    const agentInfo = this.runningAgents.get(agentId);
    if (!agentInfo) return undefined;

    const instance = this.sandboxManager.getInstance(agentInfo.sandboxId);
    if (!instance) return undefined;

    return {
      ...agentInfo,
      instance,
    };
  }

  /**
   * List all running agents
   */
  listRunningAgents(): Array<{ agentId: string; sandboxId: string; startTime: Date }> {
    return Array.from(this.runningAgents.entries()).map(([agentId, info]) => ({
      agentId,
      ...info,
    }));
  }

  /**
   * Stop all running agents
   */
  async stopAllAgents(): Promise<void> {
    const agents = Array.from(this.runningAgents.keys());
    await Promise.all(agents.map((agentId) => this.stopAgent(agentId)));
  }

  /**
   * Get sandbox manager for direct access
   */
  getSandboxManager(): SandboxManager {
    return this.sandboxManager;
  }

  /**
   * Handle sandbox events
   */
  private handleSandboxEvent(event: SandboxEvent): void {
    // Clean up running agents when sandbox stops
    if (event.type === 'sandbox:stopped' || event.type === 'sandbox:failed' || event.type === 'sandbox:timeout') {
      if (event.agentId) {
        this.runningAgents.delete(event.agentId);
      }
    }
  }

  /**
   * Get runner statistics
   */
  getStats(): {
    runningAgents: number;
    sandboxes: ReturnType<SandboxManager['getStats']>;
  } {
    return {
      runningAgents: this.runningAgents.size,
      sandboxes: this.sandboxManager.getStats(),
    };
  }
}

/**
 * Create a pre-configured agent runner for Claude Code
 */
export function createClaudeCodeRunner(
  mcpServerUrl: string,
  options: E2BRunnerOptions = {}
): {
  runner: AgentRunner;
  startAgent: (agentId: string, projectId: string, gitRepo?: string) => Promise<SandboxInstance>;
  runAgent: (agentId: string, projectId: string, gitRepo?: string) => Promise<AgentExecutionResult>;
} {
  const runner = new AgentRunner(options);

  return {
    runner,
    startAgent: (agentId, projectId, gitRepo) =>
      runner.startAgent({
        type: 'claude-code',
        agentId,
        projectId,
        mcpServerUrl,
        gitRepo,
        workDir: '/home/user/workspace',
      }),
    runAgent: (agentId, projectId, gitRepo) =>
      runner.runAgent({
        type: 'claude-code',
        agentId,
        projectId,
        mcpServerUrl,
        gitRepo,
        workDir: '/home/user/workspace',
      }),
  };
}

/**
 * Create a pre-configured agent runner for Aider
 */
export function createAiderRunner(
  options: E2BRunnerOptions = {}
): {
  runner: AgentRunner;
  startAgent: (agentId: string, projectId: string, gitRepo: string) => Promise<SandboxInstance>;
  runAgent: (agentId: string, projectId: string, gitRepo: string) => Promise<AgentExecutionResult>;
} {
  const runner = new AgentRunner(options);

  return {
    runner,
    startAgent: (agentId, projectId, gitRepo) =>
      runner.startAgent({
        type: 'aider',
        agentId,
        projectId,
        mcpServerUrl: '', // Aider doesn't use MCP
        gitRepo,
        workDir: '/home/user/workspace',
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        },
      }),
    runAgent: (agentId, projectId, gitRepo) =>
      runner.runAgent({
        type: 'aider',
        agentId,
        projectId,
        mcpServerUrl: '',
        gitRepo,
        workDir: '/home/user/workspace',
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        },
      }),
  };
}
