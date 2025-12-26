/**
 * E2B Runner Package
 * Run Conductor agents in E2B sandboxes
 */

// Core exports
export { SandboxManager } from './sandbox-manager.js';
export { AgentRunner, createClaudeCodeRunner, createAiderRunner } from './agent-runner.js';

// Type exports
export type {
  SandboxStatus,
  AgentRunnerType,
  SandboxConfig,
  SandboxInstance,
  AgentRunnerConfig,
  AgentExecutionResult,
  CodeExecutionRequest,
  CodeExecutionResult,
  FileOperation,
  FileOperationResult,
  SandboxEventType,
  SandboxEvent,
  E2BRunnerOptions,
} from './types.js';
