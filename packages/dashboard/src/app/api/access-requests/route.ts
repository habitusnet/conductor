import { NextRequest, NextResponse } from 'next/server';
import {
  getApiContext,
  getAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  expireOldRequests
} from '@/lib/edge-api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Enable edge runtime for Cloudflare

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
    const ctx = getApiContext();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'approved' | 'denied' | 'expired' | null;

    const { requests, summary } = await getAccessRequests(ctx, status ? { status } : undefined);

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
    const ctx = getApiContext();
    const body = await request.json();
    const { action, requestId, reviewedBy, reason } = body;

    if (!requestId && action !== 'expire_old') {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'approve': {
        const result = await approveAccessRequest(ctx, requestId, reviewedBy || 'dashboard-user');
        return NextResponse.json({
          success: true,
          message: 'Access approved',
          request: {
            id: result.id,
            status: result.status,
          },
        });
      }

      case 'deny': {
        const result = await denyAccessRequest(ctx, requestId, reviewedBy || 'dashboard-user', reason);
        return NextResponse.json({
          success: true,
          message: 'Access denied',
          request: {
            id: result.id,
            status: result.status,
          },
        });
      }

      case 'expire_old': {
        const olderThanHours = body.olderThanHours || 24;
        const expiredCount = await expireOldRequests(ctx, olderThanHours);
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
