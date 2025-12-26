import Database from 'better-sqlite3';
import type {
  Task,
  TaskFilters,
  AgentProfile,
  Project,
  FileConflict,
  FileLock,
  CostEvent,
  AgentStatus,
} from '@conductor/core';

export interface StateStoreOptions {
  dbPath: string;
  verbose?: boolean;
}

/**
 * SQLite-based state store for Conductor
 */
export class SQLiteStateStore {
  private db: Database.Database;
  private currentProjectId: string | null = null;

  constructor(options: StateStoreOptions | string) {
    const dbPath = typeof options === 'string' ? options : options.dbPath;
    const verbose = typeof options === 'object' && options.verbose;

    this.db = new Database(dbPath, { verbose: verbose ? console.log : undefined });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        root_path TEXT,
        git_remote TEXT,
        git_branch TEXT DEFAULT 'main',
        conflict_strategy TEXT DEFAULT 'lock',
        settings TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        budget_total REAL,
        budget_spent REAL DEFAULT 0,
        budget_alert_threshold REAL DEFAULT 80,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Agents table
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'custom',
        model TEXT,
        status TEXT DEFAULT 'idle',
        capabilities TEXT, -- JSON array
        cost_input REAL DEFAULT 0,
        cost_output REAL DEFAULT 0,
        quota_limit INTEGER,
        quota_used INTEGER DEFAULT 0,
        quota_reset_at TEXT,
        last_heartbeat TEXT,
        metadata TEXT DEFAULT '{}', -- JSON object
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        assigned_to TEXT,
        claimed_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        dependencies TEXT DEFAULT '[]', -- JSON array
        blocked_by TEXT, -- JSON array
        estimated_tokens INTEGER,
        actual_tokens INTEGER,
        files TEXT DEFAULT '[]', -- JSON array
        tags TEXT DEFAULT '[]', -- JSON array
        metadata TEXT DEFAULT '{}', -- JSON object
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES agents(id) ON DELETE SET NULL
      );

      -- File locks table
      CREATE TABLE IF NOT EXISTS file_locks (
        file_path TEXT NOT NULL,
        project_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        locked_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT,
        PRIMARY KEY (file_path, project_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      );

      -- Conflicts table
      CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        agents TEXT NOT NULL, -- JSON array
        strategy TEXT NOT NULL,
        resolved_at TEXT,
        resolution TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Cost events table
      CREATE TABLE IF NOT EXISTS cost_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        model TEXT NOT NULL,
        task_id TEXT,
        tokens_input INTEGER NOT NULL,
        tokens_output INTEGER NOT NULL,
        cost REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_file_locks_project ON file_locks(project_id);
      CREATE INDEX IF NOT EXISTS idx_cost_events_project ON cost_events(project_id);
      CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);
    `);
  }

  // ============================================================================
  // Project Methods
  // ============================================================================

  createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO projects (id, organization_id, name, slug, root_path, git_remote, git_branch, conflict_strategy, settings, is_active, budget_total, budget_spent, budget_alert_threshold, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        project.organizationId,
        project.name,
        project.slug,
        project.rootPath || null,
        project.gitRemote || null,
        project.gitBranch || 'main',
        project.conflictStrategy || 'lock',
        JSON.stringify(project.settings || {}),
        project.isActive !== false ? 1 : 0,
        project.budget?.total || null,
        project.budget?.spent || 0,
        project.budget?.alertThreshold || 80,
        now,
        now
      );

    this.currentProjectId = id;
    return this.getProject(id)!;
  }

  getProject(projectId: string): Project | null {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: row['id'] as string,
      organizationId: row['organization_id'] as string,
      name: row['name'] as string,
      slug: row['slug'] as string,
      rootPath: (row['root_path'] as string) || undefined,
      gitRemote: (row['git_remote'] as string) || undefined,
      gitBranch: (row['git_branch'] as string) || 'main',
      conflictStrategy: row['conflict_strategy'] as Project['conflictStrategy'],
      settings: JSON.parse((row['settings'] as string) || '{}'),
      isActive: row['is_active'] === 1,
      budget: row['budget_total']
        ? {
            total: row['budget_total'] as number,
            spent: row['budget_spent'] as number,
            currency: 'USD',
            alertThreshold: row['budget_alert_threshold'] as number,
          }
        : undefined,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }

  setCurrentProject(projectId: string): void {
    this.currentProjectId = projectId;
  }

  getProjectId(): string {
    if (!this.currentProjectId) {
      throw new Error('No project selected. Call setCurrentProject() first.');
    }
    return this.currentProjectId;
  }

  // ============================================================================
  // Agent Methods
  // ============================================================================

  registerAgent(projectId: string, agent: AgentProfile): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO agents (id, project_id, name, provider, model, status, capabilities, cost_input, cost_output, quota_limit, quota_used, quota_reset_at, last_heartbeat, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        agent.id,
        projectId,
        agent.name,
        agent.provider || 'custom',
        agent.model || null,
        agent.status || 'idle',
        JSON.stringify(agent.capabilities),
        agent.costPerToken.input,
        agent.costPerToken.output,
        agent.quotaLimit || null,
        agent.quotaUsed || 0,
        agent.quotaResetAt?.toISOString() || null,
        agent.lastHeartbeat?.toISOString() || null,
        JSON.stringify(agent.metadata || {})
      );
  }

  getAgent(agentId: string): AgentProfile | null {
    const row = this.db
      .prepare('SELECT * FROM agents WHERE id = ?')
      .get(agentId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.rowToAgent(row);
  }

  listAgents(projectId: string): AgentProfile[] {
    const rows = this.db
      .prepare('SELECT * FROM agents WHERE project_id = ?')
      .all(projectId) as Record<string, unknown>[];

    return rows.map((row) => this.rowToAgent(row));
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.db
      .prepare('UPDATE agents SET status = ?, last_heartbeat = ? WHERE id = ?')
      .run(status, new Date().toISOString(), agentId);
  }

  heartbeat(agentId: string): void {
    this.db
      .prepare('UPDATE agents SET last_heartbeat = ? WHERE id = ?')
      .run(new Date().toISOString(), agentId);
  }

  private rowToAgent(row: Record<string, unknown>): AgentProfile {
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      provider: (row['provider'] as AgentProfile['provider']) || 'custom',
      model: (row['model'] as string) || row['id'] as string,
      status: row['status'] as AgentStatus,
      capabilities: JSON.parse((row['capabilities'] as string) || '[]'),
      costPerToken: {
        input: row['cost_input'] as number,
        output: row['cost_output'] as number,
      },
      quotaLimit: (row['quota_limit'] as number) || undefined,
      quotaUsed: (row['quota_used'] as number) || undefined,
      quotaResetAt: row['quota_reset_at']
        ? new Date(row['quota_reset_at'] as string)
        : undefined,
      lastHeartbeat: row['last_heartbeat']
        ? new Date(row['last_heartbeat'] as string)
        : undefined,
      metadata: JSON.parse((row['metadata'] as string) || '{}'),
    };
  }

  // ============================================================================
  // Task Methods
  // ============================================================================

  createTask(projectId: string, task: Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>): Task {
    const id = crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, dependencies, files, tags, metadata, estimated_tokens)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        projectId,
        task.title,
        task.description || null,
        task.status || 'pending',
        task.priority || 'medium',
        task.assignedTo || null,
        JSON.stringify(task.dependencies || []),
        JSON.stringify(task.files || []),
        JSON.stringify(task.tags || []),
        JSON.stringify(task.metadata || {}),
        task.estimatedTokens || null
      );

    return this.getTask(id)!;
  }

  getTask(taskId: string): Task | null {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(taskId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.rowToTask(row);
  }

  updateTask(taskId: string, updates: Partial<Task>): Task {
    const current = this.getTask(taskId);
    if (!current) throw new Error(`Task not found: ${taskId}`);

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);

      // Set timestamps based on status
      if (updates.status === 'in_progress' && !current.startedAt) {
        setClauses.push('started_at = ?');
        values.push(new Date().toISOString());
      }
      if (updates.status === 'completed' || updates.status === 'failed') {
        setClauses.push('completed_at = ?');
        values.push(new Date().toISOString());
      }
    }

    if (updates.priority !== undefined) {
      setClauses.push('priority = ?');
      values.push(updates.priority);
    }

    if (updates.assignedTo !== undefined) {
      setClauses.push('assigned_to = ?');
      values.push(updates.assignedTo);
    }

    if (updates.actualTokens !== undefined) {
      setClauses.push('actual_tokens = ?');
      values.push(updates.actualTokens);
    }

    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    if (updates.blockedBy !== undefined) {
      setClauses.push('blocked_by = ?');
      values.push(JSON.stringify(updates.blockedBy));
    }

    if (setClauses.length > 0) {
      values.push(taskId);
      this.db
        .prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`)
        .run(...values);
    }

    return this.getTask(taskId)!;
  }

  listTasks(projectId: string, filters?: TaskFilters): Task[] {
    let query = 'SELECT * FROM tasks WHERE project_id = ?';
    const params: unknown[] = [projectId];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      query += ` AND status IN (${statuses.map(() => '?').join(', ')})`;
      params.push(...statuses);
    }

    if (filters?.priority) {
      const priorities = Array.isArray(filters.priority)
        ? filters.priority
        : [filters.priority];
      query += ` AND priority IN (${priorities.map(() => '?').join(', ')})`;
      params.push(...priorities);
    }

    if (filters?.assignedTo) {
      query += ' AND assigned_to = ?';
      params.push(filters.assignedTo);
    }

    query += " ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at";

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map((row) => this.rowToTask(row));
  }

  claimTask(taskId: string, agentId: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE tasks SET assigned_to = ?, claimed_at = ?, status = 'claimed'
         WHERE id = ? AND (assigned_to IS NULL OR assigned_to = ?) AND status = 'pending'`
      )
      .run(agentId, new Date().toISOString(), taskId, agentId);

    return result.changes > 0;
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id: row['id'] as string,
      projectId: row['project_id'] as string,
      title: row['title'] as string,
      description: (row['description'] as string) || undefined,
      status: row['status'] as Task['status'],
      priority: row['priority'] as Task['priority'],
      assignedTo: (row['assigned_to'] as string) || undefined,
      claimedAt: row['claimed_at']
        ? new Date(row['claimed_at'] as string)
        : undefined,
      startedAt: row['started_at']
        ? new Date(row['started_at'] as string)
        : undefined,
      completedAt: row['completed_at']
        ? new Date(row['completed_at'] as string)
        : undefined,
      dependencies: JSON.parse((row['dependencies'] as string) || '[]'),
      blockedBy: row['blocked_by']
        ? JSON.parse(row['blocked_by'] as string)
        : undefined,
      estimatedTokens: (row['estimated_tokens'] as number) || undefined,
      actualTokens: (row['actual_tokens'] as number) || undefined,
      files: JSON.parse((row['files'] as string) || '[]'),
      tags: JSON.parse((row['tags'] as string) || '[]'),
      metadata: JSON.parse((row['metadata'] as string) || '{}'),
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date((row['updated_at'] as string) || (row['created_at'] as string)),
    };
  }

  // ============================================================================
  // Lock Methods
  // ============================================================================

  acquireLock(
    projectId: string,
    filePath: string,
    agentId: string,
    ttlSeconds = 300
  ): boolean {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // Clean up expired locks first
    this.db
      .prepare('DELETE FROM file_locks WHERE project_id = ? AND expires_at < ?')
      .run(projectId, now.toISOString());

    try {
      this.db
        .prepare(
          `INSERT INTO file_locks (file_path, project_id, agent_id, locked_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(filePath, projectId, agentId, now.toISOString(), expiresAt.toISOString());
      return true;
    } catch {
      // Lock already exists
      return false;
    }
  }

  releaseLock(projectId: string, filePath: string, agentId: string): void {
    this.db
      .prepare(
        'DELETE FROM file_locks WHERE project_id = ? AND file_path = ? AND agent_id = ?'
      )
      .run(projectId, filePath, agentId);
  }

  checkLock(
    projectId: string,
    filePath: string
  ): { locked: boolean; holder?: string; expiresAt?: Date } {
    // Clean up expired locks
    this.db
      .prepare('DELETE FROM file_locks WHERE project_id = ? AND expires_at < ?')
      .run(projectId, new Date().toISOString());

    const row = this.db
      .prepare('SELECT * FROM file_locks WHERE project_id = ? AND file_path = ?')
      .get(projectId, filePath) as Record<string, unknown> | undefined;

    if (!row) {
      return { locked: false };
    }

    return {
      locked: true,
      holder: row['agent_id'] as string,
      expiresAt: new Date(row['expires_at'] as string),
    };
  }

  // ============================================================================
  // Cost Methods
  // ============================================================================

  recordCost(event: Omit<CostEvent, 'id' | 'createdAt'>): void {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO cost_events (id, organization_id, project_id, agent_id, model, task_id, tokens_input, tokens_output, cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        event.organizationId,
        event.projectId,
        event.agentId,
        event.model,
        event.taskId || null,
        event.tokensInput,
        event.tokensOutput,
        event.cost
      );

    // Update project budget spent
    this.db
      .prepare(
        'UPDATE projects SET budget_spent = budget_spent + ? WHERE id = ?'
      )
      .run(event.cost, event.projectId);
  }

  getProjectSpend(projectId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(cost), 0) as total FROM cost_events WHERE project_id = ?')
      .get(projectId) as { total: number };

    return row.total;
  }

  getAgentSpend(agentId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(cost), 0) as total FROM cost_events WHERE agent_id = ?')
      .get(agentId) as { total: number };

    return row.total;
  }

  getCostEvents(projectId: string): CostEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM cost_events WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row['id'] as string,
      organizationId: row['organization_id'] as string,
      projectId: row['project_id'] as string,
      agentId: row['agent_id'] as string,
      model: row['model'] as string,
      taskId: (row['task_id'] as string) || undefined,
      tokensInput: row['tokens_input'] as number,
      tokensOutput: row['tokens_output'] as number,
      cost: row['cost'] as number,
      createdAt: new Date(row['created_at'] as string),
    }));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  close(): void {
    this.db.close();
  }

  /**
   * Run operations in a transaction
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
