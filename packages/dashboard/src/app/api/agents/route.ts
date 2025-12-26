import { NextResponse } from 'next/server';
import { getApiContext, listAgents } from '@/lib/edge-api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Enable edge runtime for Cloudflare

export async function GET() {
  try {
    const ctx = getApiContext();
    const agents = await listAgents(ctx);

    const agentsWithStats = agents.map((agent) => ({
      ...agent,
      lastHeartbeat: agent.lastHeartbeat?.toISOString(),
    }));

    return NextResponse.json({ agents: agentsWithStats });
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', agents: [] },
      { status: 500 }
    );
  }
}

// Note: POST for agent registration is not supported on edge runtime
// as it requires sync SQLite operations. Use the MCP server for agent registration.
