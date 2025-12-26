import { NextRequest, NextResponse } from 'next/server';
import { getStateStore, getProjectId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = getStateStore();
    const projectId = getProjectId();

    const agents = store.listAgents(projectId);

    // Calculate additional stats for each agent
    const agentsWithStats = agents.map((agent) => {
      const spend = store.getAgentSpend(agent.id);
      return {
        ...agent,
        totalSpend: spend,
        lastHeartbeat: agent.lastHeartbeat?.toISOString(),
      };
    });

    return NextResponse.json({ agents: agentsWithStats });
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', agents: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const store = getStateStore();
    const projectId = getProjectId();
    const body = await request.json();

    store.registerAgent(projectId, {
      id: body.id,
      name: body.name,
      provider: body.provider || 'custom',
      model: body.model || body.id,
      capabilities: body.capabilities || [],
      costPerToken: body.costPerToken || { input: 0, output: 0 },
      status: 'idle',
      metadata: body.metadata || {},
    });

    const agent = store.getAgent(body.id);
    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Failed to register agent:', error);
    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
