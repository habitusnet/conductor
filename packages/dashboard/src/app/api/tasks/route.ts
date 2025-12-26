import { NextRequest, NextResponse } from 'next/server';
import { getApiContext, listTasks } from '@/lib/edge-api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Enable edge runtime for Cloudflare

export async function GET(request: NextRequest) {
  try {
    const ctx = getApiContext();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;

    const tasks = await listTasks(ctx, {
      status: status as any,
      priority: priority as any,
      assignedTo,
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks', tasks: [] },
      { status: 500 }
    );
  }
}

// Note: POST for task creation is not supported on edge runtime
// as it requires sync SQLite operations. Use the MCP server for task creation.
