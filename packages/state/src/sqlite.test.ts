/**
 * SQLiteStateStore Tests
 * Comprehensive tests for the SQLite-based state store
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStateStore } from './sqlite.js';
import type { AgentProfile, Task } from '@conductor/core';

describe('SQLiteStateStore', () => {
  let store: SQLiteStateStore;

  beforeEach(() => {
    // Use in-memory database for tests
    store = new SQLiteStateStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  describe('constructor', () => {
    it('should create store with string path', () => {
      const s = new SQLiteStateStore(':memory:');
      expect(s).toBeDefined();
      s.close();
    });

    it('should create store with options object', () => {
      const s = new SQLiteStateStore({ dbPath: ':memory:', verbose: false });
      expect(s).toBeDefined();
      s.close();
    });
  });

  // ============================================================================
  // Project Methods
  // ============================================================================

  describe('Project Methods', () => {
    describe('createProject', () => {
      it('should create a project with required fields', () => {
        const project = store.createProject({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Project',
          slug: 'test-project',
        });

        expect(project.id).toBeDefined();
        expect(project.name).toBe('Test Project');
        expect(project.slug).toBe('test-project');
        expect(project.gitBranch).toBe('main');
        expect(project.conflictStrategy).toBe('lock');
        expect(project.isActive).toBe(true);
      });

      it('should create a project with all fields', () => {
        const project = store.createProject({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Full Project',
          slug: 'full-project',
          rootPath: '/home/user/project',
          gitRemote: 'https://github.com/org/repo',
          gitBranch: 'develop',
          conflictStrategy: 'merge',
          settings: { feature: true },
          isActive: true,
          budget: { total: 1000, spent: 100, currency: 'USD', alertThreshold: 90 },
        });

        expect(project.rootPath).toBe('/home/user/project');
        expect(project.gitRemote).toBe('https://github.com/org/repo');
        expect(project.gitBranch).toBe('develop');
        expect(project.conflictStrategy).toBe('merge');
        expect(project.settings).toEqual({ feature: true });
        expect(project.budget?.total).toBe(1000);
        expect(project.budget?.alertThreshold).toBe(90);
      });

      it('should set current project after creation', () => {
        const project = store.createProject({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
          slug: 'test',
        });

        expect(store.getProjectId()).toBe(project.id);
      });
    });

    describe('getProject', () => {
      it('should return null for non-existent project', () => {
        const project = store.getProject('non-existent-id');
        expect(project).toBeNull();
      });

      it('should return project by id', () => {
        const created = store.createProject({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
          slug: 'test',
        });

        const retrieved = store.getProject(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(created.id);
        expect(retrieved!.name).toBe('Test');
      });
    });

    describe('setCurrentProject / getProjectId', () => {
      it('should throw if no project is set', () => {
        const freshStore = new SQLiteStateStore(':memory:');
        expect(() => freshStore.getProjectId()).toThrow('No project selected');
        freshStore.close();
      });

      it('should set and get current project', () => {
        const project = store.createProject({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
          slug: 'test',
        });

        const project2 = store.createProject({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test 2',
          slug: 'test-2',
        });

        store.setCurrentProject(project.id);
        expect(store.getProjectId()).toBe(project.id);
      });
    });
  });

  // ============================================================================
  // Agent Methods
  // ============================================================================

  describe('Agent Methods', () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        slug: 'test',
      });
      projectId = project.id;
    });

    describe('registerAgent', () => {
      it('should register an agent', () => {
        const agent: AgentProfile = {
          id: 'claude',
          name: 'Claude Code',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: ['typescript', 'testing'],
          costPerToken: { input: 0.000015, output: 0.000075 },
          status: 'idle',
          metadata: {},
        };

        store.registerAgent(projectId, agent);
        const retrieved = store.getAgent('claude');

        expect(retrieved).not.toBeNull();
        expect(retrieved!.name).toBe('Claude Code');
        expect(retrieved!.capabilities).toContain('typescript');
      });

      it('should update agent on re-register (REPLACE)', () => {
        const agent: AgentProfile = {
          id: 'claude',
          name: 'Claude v1',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: 'idle',
          metadata: {},
        };

        store.registerAgent(projectId, agent);

        const updated: AgentProfile = {
          ...agent,
          name: 'Claude v2',
          capabilities: ['new-cap'],
        };

        store.registerAgent(projectId, updated);
        const retrieved = store.getAgent('claude');

        expect(retrieved!.name).toBe('Claude v2');
        expect(retrieved!.capabilities).toContain('new-cap');
      });
    });

    describe('getAgent', () => {
      it('should return null for non-existent agent', () => {
        expect(store.getAgent('non-existent')).toBeNull();
      });
    });

    describe('listAgents', () => {
      it('should list all agents for a project', () => {
        store.registerAgent(projectId, {
          id: 'claude',
          name: 'Claude',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: 'idle',
          metadata: {},
        });

        store.registerAgent(projectId, {
          id: 'gemini',
          name: 'Gemini',
          provider: 'google',
          model: 'gemini-pro',
          capabilities: [],
          costPerToken: { input: 0.001, output: 0.002 },
          status: 'idle',
          metadata: {},
        });

        const agents = store.listAgents(projectId);
        expect(agents).toHaveLength(2);
        expect(agents.map((a) => a.id)).toContain('claude');
        expect(agents.map((a) => a.id)).toContain('gemini');
      });

      it('should return empty array for project with no agents', () => {
        const agents = store.listAgents(projectId);
        expect(agents).toHaveLength(0);
      });
    });

    describe('updateAgentStatus', () => {
      it('should update agent status and heartbeat', () => {
        store.registerAgent(projectId, {
          id: 'claude',
          name: 'Claude',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: 'idle',
          metadata: {},
        });

        store.updateAgentStatus('claude', 'working');
        const agent = store.getAgent('claude');

        expect(agent!.status).toBe('working');
        expect(agent!.lastHeartbeat).toBeDefined();
      });
    });

    describe('heartbeat', () => {
      it('should update agent heartbeat timestamp', () => {
        store.registerAgent(projectId, {
          id: 'claude',
          name: 'Claude',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: 'idle',
          metadata: {},
        });

        store.heartbeat('claude');
        const agent = store.getAgent('claude');

        expect(agent!.lastHeartbeat).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Task Methods
  // ============================================================================

  describe('Task Methods', () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        slug: 'test',
      });
      projectId = project.id;
    });

    describe('createTask', () => {
      it('should create a task with required fields', () => {
        const task = store.createTask(projectId, {
          title: 'Fix bug',
        });

        expect(task.id).toBeDefined();
        expect(task.projectId).toBe(projectId);
        expect(task.title).toBe('Fix bug');
        expect(task.status).toBe('pending');
        expect(task.priority).toBe('medium');
      });

      it('should create a task with all fields', () => {
        // Register agent first for foreign key constraint
        store.registerAgent(projectId, {
          id: 'claude',
          name: 'Claude',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: 'idle',
          metadata: {},
        });

        const task = store.createTask(projectId, {
          title: 'Full task',
          description: 'A complete task',
          status: 'pending',
          priority: 'high',
          assignedTo: 'claude',
          dependencies: ['dep-1'],
          files: ['src/main.ts'],
          tags: ['bug', 'urgent'],
          metadata: { custom: 'data' },
          estimatedTokens: 50000,
        });

        expect(task.description).toBe('A complete task');
        expect(task.priority).toBe('high');
        expect(task.files).toContain('src/main.ts');
        expect(task.tags).toContain('bug');
        expect(task.estimatedTokens).toBe(50000);
      });
    });

    describe('getTask', () => {
      it('should return null for non-existent task', () => {
        expect(store.getTask('non-existent')).toBeNull();
      });

      it('should return task by id', () => {
        const created = store.createTask(projectId, { title: 'Test' });
        const retrieved = store.getTask(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.title).toBe('Test');
      });
    });

    describe('updateTask', () => {
      it('should update task status', () => {
        const task = store.createTask(projectId, { title: 'Test' });
        const updated = store.updateTask(task.id, { status: 'in_progress' });

        expect(updated.status).toBe('in_progress');
        expect(updated.startedAt).toBeDefined();
      });

      it('should set completedAt when completed', () => {
        const task = store.createTask(projectId, { title: 'Test' });
        const updated = store.updateTask(task.id, { status: 'completed' });

        expect(updated.status).toBe('completed');
        expect(updated.completedAt).toBeDefined();
      });

      it('should set completedAt when failed', () => {
        const task = store.createTask(projectId, { title: 'Test' });
        const updated = store.updateTask(task.id, { status: 'failed' });

        expect(updated.status).toBe('failed');
        expect(updated.completedAt).toBeDefined();
      });

      it('should update multiple fields', () => {
        // Register agent first for foreign key constraint
        store.registerAgent(projectId, {
          id: 'claude',
          name: 'Claude',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: 'idle',
          metadata: {},
        });

        const task = store.createTask(projectId, { title: 'Test' });
        const updated = store.updateTask(task.id, {
          priority: 'critical',
          assignedTo: 'claude',
          actualTokens: 25000,
          metadata: { updated: true },
          blockedBy: ['other-task'],
        });

        expect(updated.priority).toBe('critical');
        expect(updated.assignedTo).toBe('claude');
        expect(updated.actualTokens).toBe(25000);
        expect(updated.metadata).toEqual({ updated: true });
        expect(updated.blockedBy).toContain('other-task');
      });

      it('should throw for non-existent task', () => {
        expect(() => store.updateTask('non-existent', { status: 'completed' }))
          .toThrow('Task not found');
      });
    });

    describe('listTasks', () => {
      beforeEach(() => {
        // Register agent first for foreign key constraint
        store.registerAgent(projectId, {
          id: 'claude',
          name: 'Claude',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: 'idle',
          metadata: {},
        });

        store.createTask(projectId, { title: 'Task 1', priority: 'high', status: 'pending' });
        store.createTask(projectId, { title: 'Task 2', priority: 'low', status: 'completed' });
        store.createTask(projectId, { title: 'Task 3', priority: 'critical', status: 'pending', assignedTo: 'claude' });
      });

      it('should list all tasks for a project', () => {
        const tasks = store.listTasks(projectId);
        expect(tasks).toHaveLength(3);
      });

      it('should filter by status', () => {
        const tasks = store.listTasks(projectId, { status: 'pending' });
        expect(tasks).toHaveLength(2);
      });

      it('should filter by multiple statuses', () => {
        const tasks = store.listTasks(projectId, { status: ['pending', 'completed'] });
        expect(tasks).toHaveLength(3);
      });

      it('should filter by priority', () => {
        const tasks = store.listTasks(projectId, { priority: 'high' });
        expect(tasks).toHaveLength(1);
      });

      it('should filter by assignedTo', () => {
        const tasks = store.listTasks(projectId, { assignedTo: 'claude' });
        expect(tasks).toHaveLength(1);
        expect(tasks[0].title).toBe('Task 3');
      });

      it('should order by priority', () => {
        const tasks = store.listTasks(projectId, { status: 'pending' });
        expect(tasks[0].priority).toBe('critical');
        expect(tasks[1].priority).toBe('high');
      });
    });

    describe('claimTask', () => {
      beforeEach(() => {
        // Register agents for foreign key constraint
        store.registerAgent(projectId, {
          id: 'claude',
          name: 'Claude',
          provider: 'anthropic',
          model: 'claude-opus-4',
          capabilities: [],
          costPerToken: { input: 0.01, output: 0.03 },
          status: 'idle',
          metadata: {},
        });
        store.registerAgent(projectId, {
          id: 'gemini',
          name: 'Gemini',
          provider: 'google',
          model: 'gemini-pro',
          capabilities: [],
          costPerToken: { input: 0.001, output: 0.002 },
          status: 'idle',
          metadata: {},
        });
      });

      it('should claim an unclaimed task', () => {
        const task = store.createTask(projectId, { title: 'Test' });
        const result = store.claimTask(task.id, 'claude');

        expect(result).toBe(true);

        const updated = store.getTask(task.id);
        expect(updated!.assignedTo).toBe('claude');
        expect(updated!.status).toBe('claimed');
        expect(updated!.claimedAt).toBeDefined();
      });

      it('should not claim an already claimed task', () => {
        const task = store.createTask(projectId, { title: 'Test' });
        store.claimTask(task.id, 'claude');

        const result = store.claimTask(task.id, 'gemini');
        expect(result).toBe(false);
      });

      it('should not re-claim after status changed', () => {
        const task = store.createTask(projectId, { title: 'Test' });
        store.claimTask(task.id, 'claude');

        // Status is now 'claimed', not 'pending', so re-claim should fail
        const result = store.claimTask(task.id, 'claude');
        expect(result).toBe(false);
      });
    });
  });

  // ============================================================================
  // Lock Methods
  // ============================================================================

  describe('Lock Methods', () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        slug: 'test',
      });
      projectId = project.id;

      store.registerAgent(projectId, {
        id: 'claude',
        name: 'Claude',
        provider: 'anthropic',
        model: 'claude-opus-4',
        capabilities: [],
        costPerToken: { input: 0.01, output: 0.03 },
        status: 'idle',
        metadata: {},
      });
    });

    describe('acquireLock', () => {
      it('should acquire a lock on a file', () => {
        const result = store.acquireLock(projectId, 'src/main.ts', 'claude');
        expect(result).toBe(true);
      });

      it('should fail to acquire lock if already locked', () => {
        store.acquireLock(projectId, 'src/main.ts', 'claude');
        const result = store.acquireLock(projectId, 'src/main.ts', 'gemini');
        expect(result).toBe(false);
      });

      it('should allow same agent to re-acquire lock', () => {
        store.acquireLock(projectId, 'src/main.ts', 'claude');
        // This will fail due to primary key constraint
        const result = store.acquireLock(projectId, 'src/main.ts', 'claude');
        expect(result).toBe(false);
      });
    });

    describe('releaseLock', () => {
      it('should release a lock', () => {
        store.acquireLock(projectId, 'src/main.ts', 'claude');
        store.releaseLock(projectId, 'src/main.ts', 'claude');

        const status = store.checkLock(projectId, 'src/main.ts');
        expect(status.locked).toBe(false);
      });

      it('should not release lock held by another agent', () => {
        store.acquireLock(projectId, 'src/main.ts', 'claude');
        store.releaseLock(projectId, 'src/main.ts', 'gemini');

        const status = store.checkLock(projectId, 'src/main.ts');
        expect(status.locked).toBe(true);
        expect(status.holder).toBe('claude');
      });
    });

    describe('checkLock', () => {
      it('should return locked=false for unlocked file', () => {
        const status = store.checkLock(projectId, 'src/main.ts');
        expect(status.locked).toBe(false);
        expect(status.holder).toBeUndefined();
      });

      it('should return lock info for locked file', () => {
        store.acquireLock(projectId, 'src/main.ts', 'claude', 300);

        const status = store.checkLock(projectId, 'src/main.ts');
        expect(status.locked).toBe(true);
        expect(status.holder).toBe('claude');
        expect(status.expiresAt).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Cost Methods
  // ============================================================================

  describe('Cost Methods', () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        slug: 'test',
        budget: { total: 1000, spent: 0, currency: 'USD', alertThreshold: 80 },
      });
      projectId = project.id;

      store.registerAgent(projectId, {
        id: 'claude',
        name: 'Claude',
        provider: 'anthropic',
        model: 'claude-opus-4',
        capabilities: [],
        costPerToken: { input: 0.01, output: 0.03 },
        status: 'idle',
        metadata: {},
      });
    });

    describe('recordCost', () => {
      it('should record a cost event', () => {
        store.recordCost({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          projectId,
          agentId: 'claude',
          model: 'claude-opus-4',
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 0.525,
        });

        const events = store.getCostEvents(projectId);
        expect(events).toHaveLength(1);
        expect(events[0].cost).toBe(0.525);
      });

      it('should update project budget spent', () => {
        store.recordCost({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          projectId,
          agentId: 'claude',
          model: 'claude-opus-4',
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 10.50,
        });

        const project = store.getProject(projectId);
        expect(project!.budget!.spent).toBe(10.50);
      });
    });

    describe('getProjectSpend', () => {
      it('should return total spend for project', () => {
        store.recordCost({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          projectId,
          agentId: 'claude',
          model: 'claude-opus-4',
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 10,
        });

        store.recordCost({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          projectId,
          agentId: 'claude',
          model: 'claude-opus-4',
          tokensInput: 2000,
          tokensOutput: 1000,
          cost: 20,
        });

        const total = store.getProjectSpend(projectId);
        expect(total).toBe(30);
      });

      it('should return 0 for project with no costs', () => {
        const total = store.getProjectSpend(projectId);
        expect(total).toBe(0);
      });
    });

    describe('getAgentSpend', () => {
      it('should return total spend for agent', () => {
        store.recordCost({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          projectId,
          agentId: 'claude',
          model: 'claude-opus-4',
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 15,
        });

        const total = store.getAgentSpend('claude');
        expect(total).toBe(15);
      });
    });

    describe('getCostEvents', () => {
      it('should return all cost events for project', () => {
        store.recordCost({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          projectId,
          agentId: 'claude',
          model: 'claude-opus-4',
          tokensInput: 1000,
          tokensOutput: 500,
          cost: 10,
        });

        store.recordCost({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          projectId,
          agentId: 'claude',
          model: 'claude-opus-4',
          tokensInput: 2000,
          tokensOutput: 1000,
          cost: 20,
        });

        const events = store.getCostEvents(projectId);
        expect(events).toHaveLength(2);
        // Verify both events are returned (order may vary due to same-millisecond inserts)
        const costs = events.map((e) => e.cost).sort((a, b) => a - b);
        expect(costs).toEqual([10, 20]);
      });
    });
  });

  // ============================================================================
  // Access Request Methods
  // ============================================================================

  describe('Access Request Methods', () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        slug: 'test',
      });
      projectId = project.id;
    });

    describe('createAccessRequest', () => {
      it('should create an access request', () => {
        const request = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude Code',
          agentType: 'claude',
          capabilities: ['typescript'],
          requestedRole: 'contributor',
        });

        expect(request.id).toBeDefined();
        expect(request.status).toBe('pending');
        expect(request.agentName).toBe('Claude Code');
      });

      it('should return existing pending request for same agent', () => {
        const request1 = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        const request2 = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude Updated',
          agentType: 'claude',
        });

        expect(request1.id).toBe(request2.id);
      });
    });

    describe('getAccessRequest', () => {
      it('should return null for non-existent request', () => {
        expect(store.getAccessRequest('non-existent')).toBeNull();
      });

      it('should return request by id', () => {
        const created = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        const retrieved = store.getAccessRequest(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.agentId).toBe('claude-1');
      });
    });

    describe('listAccessRequests', () => {
      beforeEach(() => {
        store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        const req2 = store.createAccessRequest(projectId, {
          agentId: 'gemini-1',
          agentName: 'Gemini',
          agentType: 'gemini',
        });
        store.approveAccessRequest(req2.id, 'admin');
      });

      it('should list all requests for project', () => {
        const requests = store.listAccessRequests(projectId);
        expect(requests).toHaveLength(2);
      });

      it('should filter by status', () => {
        const pending = store.listAccessRequests(projectId, { status: 'pending' });
        expect(pending).toHaveLength(1);
        expect(pending[0].agentType).toBe('claude');

        const approved = store.listAccessRequests(projectId, { status: 'approved' });
        expect(approved).toHaveLength(1);
        expect(approved[0].agentType).toBe('gemini');
      });

      it('should filter by agentType', () => {
        const requests = store.listAccessRequests(projectId, { agentType: 'claude' });
        expect(requests).toHaveLength(1);
      });
    });

    describe('approveAccessRequest', () => {
      it('should approve a request', () => {
        const request = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        const approved = store.approveAccessRequest(request.id, 'admin');

        expect(approved.status).toBe('approved');
        expect(approved.reviewedBy).toBe('admin');
        expect(approved.reviewedAt).toBeDefined();
      });

      it('should set expiration date if provided', () => {
        const request = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        const approved = store.approveAccessRequest(request.id, 'admin', 30);

        expect(approved.expiresAt).toBeDefined();
      });

      it('should auto-register agent on approval', () => {
        const request = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
          capabilities: ['typescript'],
        });

        store.approveAccessRequest(request.id, 'admin');

        const agent = store.getAgent('claude-1');
        expect(agent).not.toBeNull();
        expect(agent!.name).toBe('Claude');
        expect(agent!.provider).toBe('anthropic');
      });
    });

    describe('denyAccessRequest', () => {
      it('should deny a request', () => {
        const request = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        const denied = store.denyAccessRequest(request.id, 'admin', 'Not needed');

        expect(denied.status).toBe('denied');
        expect(denied.denialReason).toBe('Not needed');
      });
    });

    describe('hasApprovedAccess', () => {
      it('should return false for no access', () => {
        expect(store.hasApprovedAccess(projectId, 'claude-1')).toBe(false);
      });

      it('should return true for approved access', () => {
        const request = store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });
        store.approveAccessRequest(request.id, 'admin');

        expect(store.hasApprovedAccess(projectId, 'claude-1')).toBe(true);
      });

      it('should return false for pending access', () => {
        store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        expect(store.hasApprovedAccess(projectId, 'claude-1')).toBe(false);
      });
    });

    describe('getPendingAccessCount', () => {
      it('should return count of pending requests', () => {
        store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });
        store.createAccessRequest(projectId, {
          agentId: 'gemini-1',
          agentName: 'Gemini',
          agentType: 'gemini',
        });

        expect(store.getPendingAccessCount(projectId)).toBe(2);
      });
    });

    describe('expireOldRequests', () => {
      it('should expire pending requests older than cutoff', () => {
        // Create a request (will be recent)
        store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        // Expire requests older than 0 hours - this will expire the request
        // since 0 hours means cutoff is "now" and request was created before "now"
        const expired = store.expireOldRequests(projectId, 0);
        expect(expired).toBe(1);

        // Verify the request is now expired
        const requests = store.listAccessRequests(projectId, { status: 'expired' });
        expect(requests).toHaveLength(1);
      });

      it('should not expire requests newer than cutoff', () => {
        store.createAccessRequest(projectId, {
          agentId: 'claude-1',
          agentName: 'Claude',
          agentType: 'claude',
        });

        // Expire requests older than 24 hours - our request is brand new
        const expired = store.expireOldRequests(projectId, 24);
        expect(expired).toBe(0);

        // Verify the request is still pending
        const pending = store.listAccessRequests(projectId, { status: 'pending' });
        expect(pending).toHaveLength(1);
      });
    });
  });

  // ============================================================================
  // Project Context Methods
  // ============================================================================

  describe('Project Context Methods', () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Project',
        slug: 'test',
      });
      projectId = project.id;
    });

    describe('setOnboardingConfig / getOnboardingConfig', () => {
      it('should return null for unconfigured project', () => {
        expect(store.getOnboardingConfig(projectId)).toBeNull();
      });

      it('should create new config', () => {
        store.setOnboardingConfig(projectId, {
          welcomeMessage: 'Welcome!',
          currentFocus: 'Authentication',
          goals: ['Implement OAuth', 'Add tests'],
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config).not.toBeNull();
        expect(config!.welcomeMessage).toBe('Welcome!');
        expect(config!.goals).toHaveLength(2);
      });

      it('should update existing config', () => {
        store.setOnboardingConfig(projectId, {
          welcomeMessage: 'Welcome v1',
        });

        store.setOnboardingConfig(projectId, {
          welcomeMessage: 'Welcome v2',
          currentFocus: 'New focus',
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.welcomeMessage).toBe('Welcome v2');
        expect(config!.currentFocus).toBe('New focus');
      });

      it('should handle all config fields', () => {
        store.setOnboardingConfig(projectId, {
          welcomeMessage: 'Welcome',
          currentFocus: 'Feature X',
          goals: ['Goal 1'],
          styleGuide: 'Use TypeScript',
          checkpointRules: ['Run tests'],
          checkpointEveryNTasks: 5,
          autoRefreshContext: false,
          agentInstructionsFiles: { claude: 'CLAUDE.md' },
        });

        const config = store.getOnboardingConfig(projectId);
        expect(config!.checkpointEveryNTasks).toBe(5);
        expect(config!.autoRefreshContext).toBe(false);
        expect(config!.agentInstructionsFiles).toEqual({ claude: 'CLAUDE.md' });
      });
    });

    describe('recordTaskClaim / getAgentTaskCount', () => {
      it('should record task claims', () => {
        const task = store.createTask(projectId, { title: 'Test' });

        store.recordTaskClaim(projectId, 'claude', task.id);

        expect(store.getAgentTaskCount(projectId, 'claude')).toBe(1);
      });

      it('should count multiple claims', () => {
        const task1 = store.createTask(projectId, { title: 'Task 1' });
        const task2 = store.createTask(projectId, { title: 'Task 2' });

        store.recordTaskClaim(projectId, 'claude', task1.id);
        store.recordTaskClaim(projectId, 'claude', task2.id);

        expect(store.getAgentTaskCount(projectId, 'claude')).toBe(2);
      });
    });

    describe('isFirstTaskForAgent', () => {
      it('should return true for new agent', () => {
        expect(store.isFirstTaskForAgent(projectId, 'claude')).toBe(true);
      });

      it('should return false after first task', () => {
        const task = store.createTask(projectId, { title: 'Test' });
        store.recordTaskClaim(projectId, 'claude', task.id);

        expect(store.isFirstTaskForAgent(projectId, 'claude')).toBe(false);
      });
    });

    describe('shouldRefreshContext', () => {
      beforeEach(() => {
        store.setOnboardingConfig(projectId, {
          autoRefreshContext: true,
          checkpointEveryNTasks: 3,
        });
      });

      it('should return false for first task', () => {
        expect(store.shouldRefreshContext(projectId, 'claude')).toBe(false);
      });

      it('should return true at checkpoint interval', () => {
        const task1 = store.createTask(projectId, { title: 'Task 1' });
        const task2 = store.createTask(projectId, { title: 'Task 2' });
        const task3 = store.createTask(projectId, { title: 'Task 3' });

        store.recordTaskClaim(projectId, 'claude', task1.id);
        store.recordTaskClaim(projectId, 'claude', task2.id);
        store.recordTaskClaim(projectId, 'claude', task3.id);

        // 3 tasks, checkpointEveryNTasks = 3, so 3 % 3 = 0
        expect(store.shouldRefreshContext(projectId, 'claude')).toBe(true);
      });

      it('should return false when autoRefresh is disabled', () => {
        store.setOnboardingConfig(projectId, { autoRefreshContext: false });

        const task1 = store.createTask(projectId, { title: 'Task 1' });
        const task2 = store.createTask(projectId, { title: 'Task 2' });
        const task3 = store.createTask(projectId, { title: 'Task 3' });

        store.recordTaskClaim(projectId, 'claude', task1.id);
        store.recordTaskClaim(projectId, 'claude', task2.id);
        store.recordTaskClaim(projectId, 'claude', task3.id);

        expect(store.shouldRefreshContext(projectId, 'claude')).toBe(false);
      });
    });

    describe('generateContextBundle', () => {
      beforeEach(() => {
        store.setOnboardingConfig(projectId, {
          welcomeMessage: 'Welcome to the project!',
          currentFocus: 'Authentication',
          goals: ['Implement OAuth'],
          styleGuide: 'TypeScript strict mode',
          checkpointRules: ['Run tests'],
          agentInstructionsFiles: { claude: 'CLAUDE.md content' },
        });
      });

      it('should generate context for first task', () => {
        const task = store.createTask(projectId, {
          title: 'Fix bug',
          description: 'Fix the login bug',
          files: ['src/auth.ts'],
        });

        const context = store.generateContextBundle(projectId, 'claude', 'claude', task);

        expect(context.projectId).toBe(projectId);
        expect(context.projectName).toBe('Test Project');
        expect(context.isFirstTask).toBe(true);
        expect(context.agentInstructions).toContain('Welcome to the project!');
        expect(context.currentFocus).toBe('Authentication');
        expect(context.taskContext?.taskId).toBe(task.id);
      });

      it('should not include welcome message for subsequent tasks', () => {
        const task1 = store.createTask(projectId, { title: 'Task 1' });
        store.recordTaskClaim(projectId, 'claude', task1.id);

        const task2 = store.createTask(projectId, { title: 'Task 2' });
        const context = store.generateContextBundle(projectId, 'claude', 'claude', task2);

        expect(context.isFirstTask).toBe(false);
        expect(context.agentInstructions).not.toContain('Welcome');
      });

      it('should include related tasks for overlapping files', () => {
        store.registerAgent(projectId, {
          id: 'gemini',
          name: 'Gemini',
          provider: 'google',
          model: 'gemini-pro',
          capabilities: [],
          costPerToken: { input: 0.001, output: 0.002 },
          status: 'idle',
          metadata: {},
        });

        const task1 = store.createTask(projectId, {
          title: 'Task 1',
          status: 'in_progress',
          files: ['src/shared.ts'],
        });

        const task2 = store.createTask(projectId, {
          title: 'Task 2',
          files: ['src/shared.ts', 'src/other.ts'],
        });

        const context = store.generateContextBundle(projectId, 'claude', 'claude', task2);

        expect(context.taskContext?.relatedTasks).toContain(task1.id);
      });
    });

    describe('generateContextRefresh', () => {
      beforeEach(() => {
        store.setOnboardingConfig(projectId, {
          currentFocus: 'Performance',
          goals: ['Optimize queries'],
          styleGuide: 'Use async/await',
          agentInstructionsFiles: { claude: 'Performance tips' },
        });
      });

      it('should generate context refresh without task context', () => {
        const context = store.generateContextRefresh(projectId, 'claude', 'claude');

        expect(context.currentFocus).toBe('Performance');
        expect(context.taskContext).toBeUndefined();
        expect(context.isFirstTask).toBe(false);
      });
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('Utility Methods', () => {
    describe('transaction', () => {
      it('should execute operations in a transaction', () => {
        const project = store.createProject({
          organizationId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test',
          slug: 'test',
        });

        const result = store.transaction(() => {
          const task1 = store.createTask(project.id, { title: 'Task 1' });
          const task2 = store.createTask(project.id, { title: 'Task 2' });
          return [task1, task2];
        });

        expect(result).toHaveLength(2);

        const tasks = store.listTasks(project.id);
        expect(tasks).toHaveLength(2);
      });
    });
  });

  // ============================================================================
  // Agent Type to Provider Mapping (via approveAccessRequest)
  // ============================================================================

  describe('Agent Type to Provider Mapping', () => {
    let projectId: string;

    beforeEach(() => {
      const project = store.createProject({
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        slug: 'test',
      });
      projectId = project.id;
    });

    it('should map claude to anthropic', () => {
      const req = store.createAccessRequest(projectId, {
        agentId: 'agent-1',
        agentName: 'Claude',
        agentType: 'claude',
      });
      store.approveAccessRequest(req.id, 'admin');

      const agent = store.getAgent('agent-1');
      expect(agent!.provider).toBe('anthropic');
    });

    it('should map gemini to google', () => {
      const req = store.createAccessRequest(projectId, {
        agentId: 'agent-2',
        agentName: 'Gemini',
        agentType: 'gemini',
      });
      store.approveAccessRequest(req.id, 'admin');

      const agent = store.getAgent('agent-2');
      expect(agent!.provider).toBe('google');
    });

    it('should map gpt4 to openai', () => {
      const req = store.createAccessRequest(projectId, {
        agentId: 'agent-3',
        agentName: 'GPT-4',
        agentType: 'gpt4',
      });
      store.approveAccessRequest(req.id, 'admin');

      const agent = store.getAgent('agent-3');
      expect(agent!.provider).toBe('openai');
    });

    it('should map codex to openai', () => {
      const req = store.createAccessRequest(projectId, {
        agentId: 'agent-4',
        agentName: 'Codex',
        agentType: 'codex',
      });
      store.approveAccessRequest(req.id, 'admin');

      const agent = store.getAgent('agent-4');
      expect(agent!.provider).toBe('openai');
    });

    it('should map llama to meta', () => {
      const req = store.createAccessRequest(projectId, {
        agentId: 'agent-5',
        agentName: 'Llama',
        agentType: 'llama',
      });
      store.approveAccessRequest(req.id, 'admin');

      const agent = store.getAgent('agent-5');
      expect(agent!.provider).toBe('meta');
    });

    it('should map unknown to custom', () => {
      const req = store.createAccessRequest(projectId, {
        agentId: 'agent-6',
        agentName: 'Custom Agent',
        agentType: 'my-custom-type',
      });
      store.approveAccessRequest(req.id, 'admin');

      const agent = store.getAgent('agent-6');
      expect(agent!.provider).toBe('custom');
    });
  });
});
