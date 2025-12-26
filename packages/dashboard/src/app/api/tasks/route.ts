import { NextRequest, NextResponse } from 'next/server';
import { getStateStore, getProjectId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const store = getStateStore();
    const projectId = getProjectId();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;

    const tasks = store.listTasks(projectId, {
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

export async function POST(request: NextRequest) {
  try {
    const store = getStateStore();
    const projectId = getProjectId();
    const body = await request.json();

    const task = store.createTask(projectId, {
      title: body.title,
      description: body.description,
      priority: body.priority || 'medium',
      status: 'pending',
      dependencies: body.dependencies || [],
      tags: body.tags || [],
      files: body.files || [],
      estimatedTokens: body.estimatedTokens,
      metadata: body.metadata || {},
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
