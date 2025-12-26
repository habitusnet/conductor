import { NextRequest, NextResponse } from 'next/server';
import { getStateStore, getProjectId } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Types for access requests
interface AccessRequestResponse {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  capabilities: string[];
  requestedRole: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  expiresAt?: string;
  denialReason?: string;
}

/**
 * GET /api/access-requests
 * List all access requests for the current project
 */
export async function GET(request: NextRequest) {
  try {
    const store = getStateStore();
    const projectId = getProjectId();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'approved' | 'denied' | 'expired' | null;

    const requests = store.listAccessRequests(projectId, status ? { status } : undefined);

    const formattedRequests: AccessRequestResponse[] = requests.map((req) => ({
      id: req.id,
      agentId: req.agentId,
      agentName: req.agentName,
      agentType: req.agentType,
      capabilities: req.capabilities,
      requestedRole: req.requestedRole,
      status: req.status,
      requestedAt: req.requestedAt.toISOString(),
      reviewedAt: req.reviewedAt?.toISOString(),
      reviewedBy: req.reviewedBy,
      expiresAt: req.expiresAt?.toISOString(),
      denialReason: req.denialReason,
    }));

    // Get summary stats
    const allRequests = store.listAccessRequests(projectId);
    const summary = {
      total: allRequests.length,
      pending: allRequests.filter((r) => r.status === 'pending').length,
      approved: allRequests.filter((r) => r.status === 'approved').length,
      denied: allRequests.filter((r) => r.status === 'denied').length,
      expired: allRequests.filter((r) => r.status === 'expired').length,
    };

    return NextResponse.json({
      requests: formattedRequests,
      summary,
    });
  } catch (error) {
    console.error('Failed to fetch access requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch access requests', requests: [], summary: { total: 0, pending: 0, approved: 0, denied: 0, expired: 0 } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/access-requests
 * Approve or deny an access request
 */
export async function POST(request: NextRequest) {
  try {
    const store = getStateStore();
    const projectId = getProjectId();
    const body = await request.json();
    const { action, requestId, reviewedBy, reason, expiresInDays } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'approve': {
        const result = store.approveAccessRequest(
          requestId,
          reviewedBy || 'dashboard-user',
          expiresInDays
        );
        return NextResponse.json({
          success: true,
          message: `Access approved for ${result.agentName}`,
          request: {
            id: result.id,
            agentId: result.agentId,
            agentName: result.agentName,
            status: result.status,
            reviewedAt: result.reviewedAt?.toISOString(),
            expiresAt: result.expiresAt?.toISOString(),
          },
        });
      }

      case 'deny': {
        const result = store.denyAccessRequest(
          requestId,
          reviewedBy || 'dashboard-user',
          reason
        );
        return NextResponse.json({
          success: true,
          message: `Access denied for ${result.agentName}`,
          request: {
            id: result.id,
            agentId: result.agentId,
            agentName: result.agentName,
            status: result.status,
            reviewedAt: result.reviewedAt?.toISOString(),
            denialReason: result.denialReason,
          },
        });
      }

      case 'expire_old': {
        const olderThanHours = body.olderThanHours || 24;
        const expiredCount = store.expireOldRequests(projectId, olderThanHours);
        return NextResponse.json({
          success: true,
          message: `Expired ${expiredCount} old request(s)`,
          expiredCount,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Failed to process access request action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
