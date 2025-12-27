/**
 * Types Tests
 * Verify type exports and type guards
 */

import { describe, it, expect } from 'vitest';
import type {
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

describe('Types', () => {
  describe('SandboxStatus', () => {
    it('should accept valid status values', () => {
      const statuses: SandboxStatus[] = ['pending', 'running', 'stopped', 'failed', 'timeout'];
      expect(statuses).toHaveLength(5);
    });
  });

  describe('AgentRunnerType', () => {
    it('should accept valid agent types', () => {
      const types: AgentRunnerType[] = ['claude-code', 'aider', 'custom'];
      expect(types).toHaveLength(3);
    });
  });

  describe('SandboxConfig', () => {
    it('should allow minimal config', () => {
      const config: SandboxConfig = {};
      expect(config).toBeDefined();
    });

    it('should allow full config', () => {
      const config: SandboxConfig = {
        id: 'sandbox-1',
        template: 'base',
        timeout: 300,
        memory: 512,
        cpu: 2,
        env: { NODE_ENV: 'test' },
        metadata: { key: 'value' },
      };
      expect(config.template).toBe('base');
    });
  });

  describe('SandboxInstance', () => {
    it('should have required fields', () => {
      const instance: SandboxInstance = {
        id: 'sandbox-1',
        agentId: 'agent-1',
        projectId: 'project-1',
        status: 'running',
        template: 'base',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        metadata: {},
      };
      expect(instance.id).toBe('sandbox-1');
      expect(instance.status).toBe('running');
    });

    it('should allow optional url', () => {
      const instance: SandboxInstance = {
        id: 'sandbox-1',
        agentId: 'agent-1',
        projectId: 'project-1',
        status: 'running',
        template: 'base',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        metadata: {},
        url: 'https://sandbox.e2b.dev/...',
      };
      expect(instance.url).toBeDefined();
    });
  });

  describe('AgentRunnerConfig', () => {
    it('should require essential fields', () => {
      const config: AgentRunnerConfig = {
        type: 'claude-code',
        agentId: 'agent-1',
        projectId: 'project-1',
        mcpServerUrl: 'http://localhost:3001',
      };
      expect(config.type).toBe('claude-code');
    });

    it('should allow all optional fields', () => {
      const config: AgentRunnerConfig = {
        type: 'aider',
        agentId: 'agent-1',
        projectId: 'project-1',
        mcpServerUrl: '',
        workDir: '/app',
        gitRepo: 'https://github.com/org/repo',
        gitBranch: 'main',
        setupCommands: ['npm install'],
        env: { API_KEY: 'secret' },
        sandbox: { timeout: 600 },
      };
      expect(config.gitRepo).toBeDefined();
    });
  });

  describe('AgentExecutionResult', () => {
    it('should represent successful execution', () => {
      const result: AgentExecutionResult = {
        sandboxId: 'sandbox-1',
        agentId: 'agent-1',
        success: true,
        exitCode: 0,
        stdout: 'output',
        stderr: '',
        duration: 5000,
      };
      expect(result.success).toBe(true);
    });

    it('should represent failed execution', () => {
      const result: AgentExecutionResult = {
        sandboxId: 'sandbox-1',
        agentId: 'agent-1',
        success: false,
        duration: 1000,
        error: 'Something went wrong',
      };
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('CodeExecutionRequest', () => {
    it('should have required fields', () => {
      const request: CodeExecutionRequest = {
        sandboxId: 'sandbox-1',
        code: 'console.log("hello")',
      };
      expect(request.code).toBeDefined();
    });

    it('should allow optional fields', () => {
      const request: CodeExecutionRequest = {
        sandboxId: 'sandbox-1',
        code: 'print("hello")',
        language: 'python',
        timeout: 30,
        cwd: '/app',
      };
      expect(request.language).toBe('python');
    });
  });

  describe('CodeExecutionResult', () => {
    it('should have all result fields', () => {
      const result: CodeExecutionResult = {
        success: true,
        stdout: 'hello',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };
      expect(result.success).toBe(true);
    });

    it('should allow data field', () => {
      const result: CodeExecutionResult = {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        duration: 100,
        data: { result: 42 },
      };
      expect(result.data).toEqual({ result: 42 });
    });
  });

  describe('FileOperation', () => {
    it('should support read operation', () => {
      const op: FileOperation = {
        type: 'read',
        path: '/app/file.txt',
      };
      expect(op.type).toBe('read');
    });

    it('should support write operation with content', () => {
      const op: FileOperation = {
        type: 'write',
        path: '/app/file.txt',
        content: 'new content',
      };
      expect(op.content).toBe('new content');
    });

    it('should support all operation types', () => {
      const types: FileOperation['type'][] = ['read', 'write', 'delete', 'list', 'exists'];
      expect(types).toHaveLength(5);
    });
  });

  describe('FileOperationResult', () => {
    it('should represent read result', () => {
      const result: FileOperationResult = {
        success: true,
        path: '/app/file.txt',
        content: 'file content',
      };
      expect(result.content).toBeDefined();
    });

    it('should represent list result', () => {
      const result: FileOperationResult = {
        success: true,
        path: '/app',
        files: ['file1.txt', 'file2.txt'],
      };
      expect(result.files).toHaveLength(2);
    });

    it('should represent exists result', () => {
      const result: FileOperationResult = {
        success: true,
        path: '/app/file.txt',
        exists: true,
      };
      expect(result.exists).toBe(true);
    });

    it('should represent error result', () => {
      const result: FileOperationResult = {
        success: false,
        path: '/app/file.txt',
        error: 'File not found',
      };
      expect(result.error).toBeDefined();
    });
  });

  describe('SandboxEventType', () => {
    it('should have all event types', () => {
      const types: SandboxEventType[] = [
        'sandbox:created',
        'sandbox:started',
        'sandbox:stopped',
        'sandbox:failed',
        'sandbox:timeout',
        'agent:started',
        'agent:completed',
        'agent:failed',
        'execution:started',
        'execution:completed',
        'execution:failed',
      ];
      expect(types).toHaveLength(11);
    });
  });

  describe('SandboxEvent', () => {
    it('should have required fields', () => {
      const event: SandboxEvent = {
        type: 'sandbox:started',
        sandboxId: 'sandbox-1',
        timestamp: new Date(),
      };
      expect(event.type).toBe('sandbox:started');
    });

    it('should allow optional fields', () => {
      const event: SandboxEvent = {
        type: 'sandbox:failed',
        sandboxId: 'sandbox-1',
        agentId: 'agent-1',
        timestamp: new Date(),
        data: { error: 'Something failed' },
      };
      expect(event.agentId).toBe('agent-1');
      expect(event.data).toBeDefined();
    });
  });

  describe('E2BRunnerOptions', () => {
    it('should allow empty options', () => {
      const options: E2BRunnerOptions = {};
      expect(options).toBeDefined();
    });

    it('should allow all options', () => {
      const options: E2BRunnerOptions = {
        apiKey: 'test-key',
        defaultTemplate: 'base',
        defaultTimeout: 300,
        maxConcurrent: 10,
        autoCleanup: true,
        onEvent: (event) => console.log(event),
      };
      expect(options.apiKey).toBe('test-key');
    });
  });
});
