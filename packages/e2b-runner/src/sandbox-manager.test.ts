/**
 * SandboxManager Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SandboxManager } from './sandbox-manager.js';
import type { SandboxEvent } from './types.js';

// Mock the e2b module
vi.mock('e2b', () => {
  return {
    Sandbox: {
      create: vi.fn(),
    },
  };
});

import { Sandbox } from 'e2b';

describe('SandboxManager', () => {
  let manager: SandboxManager;
  let mockSandbox: any;
  let events: SandboxEvent[];

  beforeEach(() => {
    events = [];

    // Reset mocks
    vi.clearAllMocks();

    // Create mock sandbox instance
    mockSandbox = {
      sandboxId: 'sandbox-123',
      commands: {
        run: vi.fn().mockResolvedValue({
          stdout: 'output',
          stderr: '',
          exitCode: 0,
        }),
      },
      files: {
        read: vi.fn().mockResolvedValue('file content'),
        write: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([{ name: 'file1.txt' }, { name: 'file2.txt' }]),
      },
      kill: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Sandbox.create
    vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox);

    // Create manager with event tracking
    manager = new SandboxManager({
      apiKey: 'test-api-key',
      defaultTimeout: 60,
      maxConcurrent: 5,
      onEvent: (event) => events.push(event),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create manager with default options', () => {
      const defaultManager = new SandboxManager();
      expect(defaultManager).toBeInstanceOf(SandboxManager);
    });

    it('should warn when API key is not provided', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      new SandboxManager({ apiKey: '' });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('E2B API key not provided'));
      consoleSpy.mockRestore();
    });
  });

  describe('createSandbox', () => {
    it('should create a sandbox successfully', async () => {
      const instance = await manager.createSandbox('agent-1', 'project-1', {
        template: 'base',
        timeout: 120,
      });

      expect(instance).toBeDefined();
      expect(instance.id).toBe('sandbox-123');
      expect(instance.agentId).toBe('agent-1');
      expect(instance.projectId).toBe('project-1');
      expect(instance.status).toBe('running');
      expect(instance.template).toBe('base');
    });

    it('should emit sandbox:created and sandbox:started events', async () => {
      await manager.createSandbox('agent-1', 'project-1');

      expect(events.length).toBe(2);
      expect(events[0].type).toBe('sandbox:created');
      expect(events[1].type).toBe('sandbox:started');
      expect(events[1].sandboxId).toBe('sandbox-123');
    });

    it('should use default template when not specified', async () => {
      await manager.createSandbox('agent-1', 'project-1');

      expect(Sandbox.create).toHaveBeenCalledWith(
        'base', // default template
        expect.any(Object)
      );
    });

    it('should enforce max concurrent sandboxes limit', async () => {
      // Create sandboxes up to the limit
      for (let i = 0; i < 5; i++) {
        vi.mocked(Sandbox.create).mockResolvedValueOnce({
          ...mockSandbox,
          sandboxId: `sandbox-${i}`,
        });
        await manager.createSandbox(`agent-${i}`, 'project-1');
      }

      // Attempt to create one more
      await expect(manager.createSandbox('agent-extra', 'project-1')).rejects.toThrow(
        'Maximum concurrent sandboxes (5) reached'
      );
    });

    it('should emit sandbox:failed event on error', async () => {
      vi.mocked(Sandbox.create).mockRejectedValueOnce(new Error('API error'));

      await expect(manager.createSandbox('agent-1', 'project-1')).rejects.toThrow('API error');

      const failedEvent = events.find((e) => e.type === 'sandbox:failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.data?.['error']).toContain('API error');
    });
  });

  describe('getSandbox', () => {
    it('should return sandbox by ID', async () => {
      await manager.createSandbox('agent-1', 'project-1');

      const sandbox = manager.getSandbox('sandbox-123');
      expect(sandbox).toBeDefined();
      expect(sandbox).toBe(mockSandbox);
    });

    it('should return undefined for unknown ID', () => {
      const sandbox = manager.getSandbox('unknown-id');
      expect(sandbox).toBeUndefined();
    });
  });

  describe('getInstance', () => {
    it('should return instance info by ID', async () => {
      await manager.createSandbox('agent-1', 'project-1');

      const instance = manager.getInstance('sandbox-123');
      expect(instance).toBeDefined();
      expect(instance?.agentId).toBe('agent-1');
      expect(instance?.projectId).toBe('project-1');
    });

    it('should return undefined for unknown ID', () => {
      const instance = manager.getInstance('unknown-id');
      expect(instance).toBeUndefined();
    });
  });

  describe('listInstances', () => {
    it('should list all instances', async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-1',
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-2',
      });

      await manager.createSandbox('agent-1', 'project-1');
      await manager.createSandbox('agent-2', 'project-1');

      const instances = manager.listInstances();
      expect(instances.length).toBe(2);
    });

    it('should filter by status', async () => {
      await manager.createSandbox('agent-1', 'project-1');

      const running = manager.listInstances({ status: 'running' });
      expect(running.length).toBe(1);

      const stopped = manager.listInstances({ status: 'stopped' });
      expect(stopped.length).toBe(0);
    });

    it('should filter by agentId', async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-1',
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-2',
      });

      await manager.createSandbox('agent-1', 'project-1');
      await manager.createSandbox('agent-2', 'project-1');

      const agent1Instances = manager.listInstances({ agentId: 'agent-1' });
      expect(agent1Instances.length).toBe(1);
      expect(agent1Instances[0].agentId).toBe('agent-1');
    });

    it('should filter by projectId', async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-1',
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-2',
      });

      await manager.createSandbox('agent-1', 'project-1');
      await manager.createSandbox('agent-2', 'project-2');

      const project1Instances = manager.listInstances({ projectId: 'project-1' });
      expect(project1Instances.length).toBe(1);
      expect(project1Instances[0].projectId).toBe('project-1');
    });
  });

  describe('executeCommand', () => {
    it('should execute command in sandbox', async () => {
      await manager.createSandbox('agent-1', 'project-1');

      const result = await manager.executeCommand('sandbox-123', 'ls -la');

      expect(result.stdout).toBe('output');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(mockSandbox.commands.run).toHaveBeenCalledWith('ls -la', expect.any(Object));
    });

    it('should pass options to command', async () => {
      await manager.createSandbox('agent-1', 'project-1');

      await manager.executeCommand('sandbox-123', 'npm test', {
        cwd: '/app',
        timeout: 30,
        env: { NODE_ENV: 'test' },
      });

      expect(mockSandbox.commands.run).toHaveBeenCalledWith('npm test', {
        cwd: '/app',
        timeoutMs: 30000,
        envs: { NODE_ENV: 'test' },
      });
    });

    it('should throw error for unknown sandbox', async () => {
      await expect(manager.executeCommand('unknown', 'ls')).rejects.toThrow(
        'Sandbox unknown not found'
      );
    });

    it('should update lastActivityAt on command execution', async () => {
      await manager.createSandbox('agent-1', 'project-1');
      const instanceBefore = manager.getInstance('sandbox-123');
      const timeBefore = instanceBefore?.lastActivityAt.getTime();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await manager.executeCommand('sandbox-123', 'ls');
      const instanceAfter = manager.getInstance('sandbox-123');
      const timeAfter = instanceAfter?.lastActivityAt.getTime();

      expect(timeAfter).toBeGreaterThan(timeBefore!);
    });
  });

  describe('fileOperation', () => {
    beforeEach(async () => {
      await manager.createSandbox('agent-1', 'project-1');
    });

    it('should read file', async () => {
      const result = await manager.fileOperation('sandbox-123', {
        type: 'read',
        path: '/app/file.txt',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('file content');
      expect(mockSandbox.files.read).toHaveBeenCalledWith('/app/file.txt');
    });

    it('should write file', async () => {
      const result = await manager.fileOperation('sandbox-123', {
        type: 'write',
        path: '/app/file.txt',
        content: 'new content',
      });

      expect(result.success).toBe(true);
      expect(mockSandbox.files.write).toHaveBeenCalledWith('/app/file.txt', 'new content');
    });

    it('should delete file', async () => {
      const result = await manager.fileOperation('sandbox-123', {
        type: 'delete',
        path: '/app/file.txt',
      });

      expect(result.success).toBe(true);
      expect(mockSandbox.files.remove).toHaveBeenCalledWith('/app/file.txt');
    });

    it('should list files', async () => {
      const result = await manager.fileOperation('sandbox-123', {
        type: 'list',
        path: '/app',
      });

      expect(result.success).toBe(true);
      expect(result.files).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should check file exists', async () => {
      const result = await manager.fileOperation('sandbox-123', {
        type: 'exists',
        path: '/app/file.txt',
      });

      expect(result.success).toBe(true);
      expect(result.exists).toBe(true);
    });

    it('should return exists=false when file not found', async () => {
      mockSandbox.files.read.mockRejectedValueOnce(new Error('Not found'));

      const result = await manager.fileOperation('sandbox-123', {
        type: 'exists',
        path: '/app/missing.txt',
      });

      expect(result.success).toBe(true);
      expect(result.exists).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockSandbox.files.read.mockRejectedValueOnce(new Error('Read error'));

      const result = await manager.fileOperation('sandbox-123', {
        type: 'read',
        path: '/app/file.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Read error');
    });

    it('should throw error for unknown sandbox', async () => {
      await expect(
        manager.fileOperation('unknown', { type: 'read', path: '/app' })
      ).rejects.toThrow('Sandbox unknown not found');
    });
  });

  describe('stopSandbox', () => {
    it('should stop sandbox and emit event', async () => {
      await manager.createSandbox('agent-1', 'project-1');

      await manager.stopSandbox('sandbox-123');

      expect(mockSandbox.kill).toHaveBeenCalled();

      const stoppedEvent = events.find((e) => e.type === 'sandbox:stopped');
      expect(stoppedEvent).toBeDefined();
      expect(stoppedEvent?.sandboxId).toBe('sandbox-123');
    });

    it('should update instance status to stopped', async () => {
      // Disable auto-cleanup to check status
      const noCleanupManager = new SandboxManager({
        apiKey: 'test-key',
        autoCleanup: false,
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce(mockSandbox);

      await noCleanupManager.createSandbox('agent-1', 'project-1');
      await noCleanupManager.stopSandbox('sandbox-123');

      const instance = noCleanupManager.getInstance('sandbox-123');
      expect(instance?.status).toBe('stopped');
    });

    it('should handle errors gracefully', async () => {
      mockSandbox.kill.mockRejectedValueOnce(new Error('Kill error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await manager.createSandbox('agent-1', 'project-1');
      await manager.stopSandbox('sandbox-123');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should do nothing for unknown sandbox', async () => {
      await manager.stopSandbox('unknown');
      // Should not throw
    });
  });

  describe('stopAgentSandboxes', () => {
    it('should stop all sandboxes for an agent', async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-1',
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-2',
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await manager.createSandbox('agent-1', 'project-1');
      await manager.createSandbox('agent-1', 'project-2');

      await manager.stopAgentSandboxes('agent-1');

      const instances = manager.listInstances({ status: 'running' });
      expect(instances.length).toBe(0);
    });
  });

  describe('stopProjectSandboxes', () => {
    it('should stop all sandboxes for a project', async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-1',
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-2',
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await manager.createSandbox('agent-1', 'project-1');
      await manager.createSandbox('agent-2', 'project-1');

      await manager.stopProjectSandboxes('project-1');

      const instances = manager.listInstances({ status: 'running' });
      expect(instances.length).toBe(0);
    });
  });

  describe('stopAll', () => {
    it('should stop all running sandboxes', async () => {
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-1',
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-2',
        kill: vi.fn().mockResolvedValue(undefined),
      });

      await manager.createSandbox('agent-1', 'project-1');
      await manager.createSandbox('agent-2', 'project-2');

      await manager.stopAll();

      const instances = manager.listInstances({ status: 'running' });
      expect(instances.length).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove stopped sandboxes from memory', async () => {
      const noCleanupManager = new SandboxManager({
        apiKey: 'test-key',
        autoCleanup: false,
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce(mockSandbox);

      await noCleanupManager.createSandbox('agent-1', 'project-1');
      await noCleanupManager.stopSandbox('sandbox-123');

      expect(noCleanupManager.listInstances().length).toBe(1);

      noCleanupManager.cleanup();

      expect(noCleanupManager.listInstances().length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const noCleanupManager = new SandboxManager({
        apiKey: 'test-key',
        autoCleanup: false,
        onEvent: () => {},
      });

      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-1',
        kill: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(Sandbox.create).mockResolvedValueOnce({
        ...mockSandbox,
        sandboxId: 'sandbox-2',
      });

      await noCleanupManager.createSandbox('agent-1', 'project-1');
      await noCleanupManager.createSandbox('agent-2', 'project-1');
      await noCleanupManager.stopSandbox('sandbox-1');

      const stats = noCleanupManager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.running).toBe(1);
      expect(stats.stopped).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.timeout).toBe(0);
    });
  });
});
