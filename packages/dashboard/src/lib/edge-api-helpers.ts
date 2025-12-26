/**
 * Edge-compatible API Helpers for Conductor Dashboard
 * This file ONLY uses D1 - no SQLite/Node.js dependencies
 */

import { getEdgeApiContext, D1StateStore, isEdgeRuntime } from './edge-db';

export interface EdgeApiContext {
  store: D1StateStore;
  projectId: string;
}

/**
 * Get API context for edge runtime
 */
export function getApiContext(): EdgeApiContext {
  return getEdgeApiContext();
}

/**
 * Check if edge runtime is available
 */
export function isEdge(): boolean {
  return isEdgeRuntime();
}

/**
 * Helper for common project data fetching
 */
export async function getProjectData(ctx: EdgeApiContext) {
  const [project, tasks, agents, totalSpend] = await Promise.all([
    ctx.store.getProject(ctx.projectId),
    ctx.store.listTasks(ctx.projectId),
    ctx.store.listAgents(ctx.projectId),
    ctx.store.getProjectSpend(ctx.projectId),
  ]);
  return { project, tasks, agents, totalSpend };
}

/**
 * Helper for access request operations
 */
export async function getAccessRequests(
  ctx: EdgeApiContext,
  filters?: { status?: 'pending' | 'approved' | 'denied' | 'expired' }
) {
  const [requests, summary] = await Promise.all([
    ctx.store.listAccessRequests(ctx.projectId, filters),
    ctx.store.getAccessRequestSummary(ctx.projectId),
  ]);
  return { requests, summary };
}

/**
 * Helper for onboarding config operations
 */
export async function getOnboardingConfig(ctx: EdgeApiContext) {
  const [config, project] = await Promise.all([
    ctx.store.getOnboardingConfig(ctx.projectId),
    ctx.store.getProject(ctx.projectId),
  ]);
  return { config, project };
}

export async function setOnboardingConfig(ctx: EdgeApiContext, config: any) {
  await ctx.store.setOnboardingConfig(ctx.projectId, config);
}

/**
 * Helper for approving access requests
 */
export async function approveAccessRequest(
  ctx: EdgeApiContext,
  requestId: string,
  reviewedBy: string
) {
  await ctx.store.approveAccessRequest(requestId, reviewedBy);
  return { id: requestId, status: 'approved' as const };
}

/**
 * Helper for denying access requests
 */
export async function denyAccessRequest(
  ctx: EdgeApiContext,
  requestId: string,
  reviewedBy: string,
  reason?: string
) {
  await ctx.store.denyAccessRequest(requestId, reviewedBy, reason);
  return { id: requestId, status: 'denied' as const };
}

/**
 * Helper for expiring old requests (D1 doesn't have this yet)
 */
export async function expireOldRequests(
  _ctx: EdgeApiContext,
  _olderThanHours: number
) {
  // D1 doesn't have this method yet, return 0
  return 0;
}

/**
 * Helper for task operations
 */
export async function listTasks(ctx: EdgeApiContext, filters?: any) {
  return ctx.store.listTasks(ctx.projectId, filters);
}

/**
 * Helper for agent operations
 */
export async function listAgents(ctx: EdgeApiContext) {
  return ctx.store.listAgents(ctx.projectId);
}

/**
 * Helper for cost operations
 */
export async function getCostData(ctx: EdgeApiContext) {
  const [totalSpend, events] = await Promise.all([
    ctx.store.getProjectSpend(ctx.projectId),
    ctx.store.getCostEvents(ctx.projectId),
  ]);
  return { totalSpend, events };
}

/**
 * Helper for getting pending actions (conflicts, locks, escalations)
 */
export async function getPendingActions(ctx: EdgeApiContext) {
  const [conflicts, locks, blockedTasks, agents] = await Promise.all([
    ctx.store.getUnresolvedConflicts(ctx.projectId),
    ctx.store.getActiveLocks(ctx.projectId),
    ctx.store.listTasks(ctx.projectId, { status: 'blocked' }),
    ctx.store.listAgents(ctx.projectId),
  ]);
  return { conflicts, locks, blockedTasks, agents };
}

/**
 * Helper for resolving a conflict
 */
export async function resolveConflict(
  ctx: EdgeApiContext,
  conflictId: string,
  resolution: string
) {
  await ctx.store.resolveConflict(ctx.projectId, conflictId, resolution);
}

/**
 * Helper for releasing a file lock
 */
export async function releaseLock(
  ctx: EdgeApiContext,
  filePath: string,
  agentId: string
) {
  await ctx.store.releaseLock(ctx.projectId, filePath, agentId);
}

/**
 * Helper for updating a task
 */
export async function updateTask(
  ctx: EdgeApiContext,
  taskId: string,
  updates: any
) {
  await ctx.store.updateTask(taskId, updates);
}

/**
 * Helper for updating agent status
 */
export async function updateAgentStatus(
  ctx: EdgeApiContext,
  agentId: string,
  status: 'idle' | 'working' | 'blocked' | 'offline'
) {
  await ctx.store.updateAgentStatus(agentId, status);
}
