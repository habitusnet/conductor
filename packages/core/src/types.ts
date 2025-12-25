import { z } from 'zod';

// ============================================================================
// Agent Types
// ============================================================================

export type AgentId = 'claude' | 'gemini' | 'codex' | (string & {});
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'offline';

export const AgentProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  capabilities: z.array(z.string()),
  costPerToken: z.object({
    input: z.number(),
    output: z.number(),
  }),
  quotaLimit: z.number().optional(),
  quotaUsed: z.number().optional(),
  quotaResetAt: z.date().optional(),
  status: z.enum(['idle', 'working', 'blocked', 'offline']).default('idle'),
  lastHeartbeat: z.date().optional(),
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;

// ============================================================================
// Task Types
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'claimed'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['pending', 'claimed', 'in_progress', 'completed', 'failed', 'blocked']).default('pending'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  assignedTo: z.string().optional(),
  claimedAt: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  dependencies: z.array(z.string()).default([]),
  blockedBy: z.array(z.string()).optional(),
  estimatedTokens: z.number().optional(),
  actualTokens: z.number().optional(),
  files: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date().default(() => new Date()),
});

export type Task = z.infer<typeof TaskSchema>;

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assignedTo?: AgentId;
  tags?: string[];
}

// ============================================================================
// Conflict Types
// ============================================================================

export type ConflictStrategy = 'lock' | 'merge' | 'zone' | 'review';
export type ConflictResolution = 'accepted' | 'rejected' | 'merged' | 'waiting';

export const FileConflictSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  agents: z.array(z.string()),
  strategy: z.enum(['lock', 'merge', 'zone', 'review']),
  resolvedAt: z.date().optional(),
  resolution: z.enum(['accepted', 'rejected', 'merged', 'waiting']).optional(),
  createdAt: z.date().default(() => new Date()),
});

export type FileConflict = z.infer<typeof FileConflictSchema>;

export const FileLockSchema = z.object({
  filePath: z.string(),
  projectId: z.string(),
  agentId: z.string(),
  lockedAt: z.date().default(() => new Date()),
  expiresAt: z.date().optional(),
});

export type FileLock = z.infer<typeof FileLockSchema>;

// ============================================================================
// Project Types
// ============================================================================

export const BudgetSchema = z.object({
  total: z.number(),
  spent: z.number().default(0),
  currency: z.literal('USD').default('USD'),
  alertThreshold: z.number().default(80), // percentage
});

export type Budget = z.infer<typeof BudgetSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  gitRemote: z.string().optional(),
  defaultBranch: z.string().default('main'),
  conflictStrategy: z.enum(['lock', 'merge', 'zone', 'review']).default('lock'),
  budget: BudgetSchema.optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Project = z.infer<typeof ProjectSchema>;

// ============================================================================
// Cost Types
// ============================================================================

export const CostEventSchema = z.object({
  id: z.number().optional(),
  projectId: z.string(),
  agentId: z.string(),
  taskId: z.string().optional(),
  tokensInput: z.number(),
  tokensOutput: z.number(),
  cost: z.number(),
  createdAt: z.date().default(() => new Date()),
});

export type CostEvent = z.infer<typeof CostEventSchema>;

export interface UsageReport {
  total: number;
  byAgent: Record<AgentId, number>;
  byTask: Record<string, number>;
  remaining: number;
  alertTriggered: boolean;
}

// ============================================================================
// Auction Types
// ============================================================================

export interface Bid {
  agentId: AgentId;
  taskId: string;
  estimatedTokens: number;
  estimatedCost: number;
  confidence: number; // 0-1
  capabilities: string[];
  submittedAt: Date;
}

export interface AuctionResult {
  taskId: string;
  winner: AgentId | null;
  bids: Bid[];
  reason: string;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType =
  | 'task:created'
  | 'task:claimed'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:blocked'
  | 'agent:status'
  | 'agent:heartbeat'
  | 'conflict:detected'
  | 'conflict:resolved'
  | 'budget:alert'
  | 'budget:exceeded';

export interface Message<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: Date;
  source: AgentId | 'system';
}
