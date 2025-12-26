import { NextRequest, NextResponse } from 'next/server';
import { getStateStore, getProjectId } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Types for pending actions
interface PendingConflict {
  id: string;
  type: 'conflict';
  filePath: string;
  agents: string[];
  strategy: string;
  createdAt: string;
}

interface PendingApproval {
  id: string;
  type: 'approval';
  title: string;
  description: string;
  requestedBy: string;
  taskId?: string;
  createdAt: string;
}

interface PendingEscalation {
  id: string;
  type: 'escalation';
  title: string;
  description: string;
  agentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
}

type PendingAction = PendingConflict | PendingApproval | PendingEscalation;

interface FileLock {
  filePath: string;
  agentId: string;
  lockedAt: string;
  expiresAt: string;
}

export async function GET() {
  try {
    const store = getStateStore();
    const projectId = getProjectId();

    // Get conflicts from database
    const db = (store as any).db;

    // Get unresolved conflicts
    const conflictRows = db
      .prepare('SELECT * FROM conflicts WHERE project_id = ? AND resolved_at IS NULL ORDER BY created_at DESC')
      .all(projectId) as Record<string, unknown>[];

    const conflicts: PendingConflict[] = conflictRows.map((row) => ({
      id: row['id'] as string,
      type: 'conflict' as const,
      filePath: row['file_path'] as string,
      agents: JSON.parse((row['agents'] as string) || '[]'),
      strategy: row['strategy'] as string,
      createdAt: row['created_at'] as string,
    }));

    // Get active file locks
    const lockRows = db
      .prepare("SELECT * FROM file_locks WHERE project_id = ? AND expires_at > datetime('now') ORDER BY locked_at DESC")
      .all(projectId) as Record<string, unknown>[];

    const locks: FileLock[] = lockRows.map((row) => ({
      filePath: row['file_path'] as string,
      agentId: row['agent_id'] as string,
      lockedAt: row['locked_at'] as string,
      expiresAt: row['expires_at'] as string,
    }));

    // Get blocked tasks (these need human decision)
    const blockedTasks = store.listTasks(projectId, { status: 'blocked' });

    const escalations: PendingEscalation[] = blockedTasks.map((task) => ({
      id: task.id,
      type: 'escalation' as const,
      title: `Task blocked: ${task.title}`,
      description: task.description || 'Task is blocked and requires attention',
      agentId: task.assignedTo || 'unassigned',
      severity: task.priority === 'critical' ? 'critical' : task.priority === 'high' ? 'high' : 'medium',
      createdAt: task.createdAt.toISOString(),
    }));

    // Mock approvals for demo (in production, these would come from a pending_approvals table)
    const approvals: PendingApproval[] = [];

    // Get agent stats
    const agents = store.listAgents(projectId);
    const workingAgents = agents.filter(a => a.status === 'working');
    const blockedAgents = agents.filter(a => a.status === 'blocked');

    return NextResponse.json({
      conflicts,
      approvals,
      escalations,
      locks,
      summary: {
        totalPending: conflicts.length + approvals.length + escalations.length,
        conflictCount: conflicts.length,
        approvalCount: approvals.length,
        escalationCount: escalations.length,
        lockCount: locks.length,
        workingAgents: workingAgents.length,
        blockedAgents: blockedAgents.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch actions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch actions', conflicts: [], approvals: [], escalations: [], locks: [], summary: { totalPending: 0 } },
      { status: 500 }
    );
  }
}

// Execute an action
export async function POST(request: NextRequest) {
  try {
    const store = getStateStore();
    const projectId = getProjectId();
    const body = await request.json();
    const { actionType, actionId, resolution, data } = body;

    const db = (store as any).db;

    switch (actionType) {
      case 'resolve_conflict': {
        // resolution: 'accept_first' | 'accept_second' | 'merge' | 'defer'
        db.prepare(
          'UPDATE conflicts SET resolved_at = datetime("now"), resolution = ? WHERE id = ? AND project_id = ?'
        ).run(resolution, actionId, projectId);

        return NextResponse.json({ success: true, message: `Conflict resolved: ${resolution}` });
      }

      case 'force_release_lock': {
        const { filePath, agentId } = data;
        db.prepare(
          'DELETE FROM file_locks WHERE project_id = ? AND file_path = ? AND agent_id = ?'
        ).run(projectId, filePath, agentId);

        return NextResponse.json({ success: true, message: `Lock released for ${filePath}` });
      }

      case 'unblock_task': {
        store.updateTask(actionId, { status: 'pending', blockedBy: [] });
        return NextResponse.json({ success: true, message: 'Task unblocked' });
      }

      case 'cancel_task': {
        store.updateTask(actionId, { status: 'cancelled' });
        return NextResponse.json({ success: true, message: 'Task cancelled' });
      }

      case 'reassign_task': {
        const { newAgentId } = data;
        store.updateTask(actionId, { assignedTo: newAgentId, status: 'pending' });
        return NextResponse.json({ success: true, message: `Task reassigned to ${newAgentId}` });
      }

      case 'pause_agent': {
        store.updateAgentStatus(data.agentId, 'blocked');
        return NextResponse.json({ success: true, message: 'Agent paused' });
      }

      case 'resume_agent': {
        store.updateAgentStatus(data.agentId, 'idle');
        return NextResponse.json({ success: true, message: 'Agent resumed' });
      }

      case 'pause_all': {
        const agents = store.listAgents(projectId);
        for (const agent of agents) {
          if (agent.status === 'working' || agent.status === 'idle') {
            store.updateAgentStatus(agent.id, 'blocked');
          }
        }
        return NextResponse.json({ success: true, message: 'All agents paused' });
      }

      case 'resume_all': {
        const agents = store.listAgents(projectId);
        for (const agent of agents) {
          if (agent.status === 'blocked') {
            store.updateAgentStatus(agent.id, 'idle');
          }
        }
        return NextResponse.json({ success: true, message: 'All agents resumed' });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action type: ${actionType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Failed to execute action:', error);
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}
