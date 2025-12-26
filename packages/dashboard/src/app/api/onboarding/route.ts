import { NextRequest, NextResponse } from 'next/server';
import { getApiContext, getOnboardingConfig, setOnboardingConfig } from '@/lib/edge-api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Enable edge runtime for Cloudflare

export async function GET() {
  try {
    const ctx = getApiContext();
    const { config, project } = await getOnboardingConfig(ctx);

    return NextResponse.json({
      projectId: ctx.projectId,
      projectName: project?.name || 'Unknown Project',
      config: config || {
        welcomeMessage: '',
        currentFocus: '',
        goals: [],
        styleGuide: '',
        checkpointRules: [],
        checkpointEveryNTasks: 3,
        autoRefreshContext: true,
        agentInstructionsFiles: {},
      },
    });
  } catch (error) {
    console.error('Failed to fetch onboarding config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = getApiContext();
    const body = await request.json();

    const { action, ...data } = body;

    if (action === 'save') {
      await setOnboardingConfig(ctx, {
        welcomeMessage: data.welcomeMessage || undefined,
        currentFocus: data.currentFocus || undefined,
        goals: data.goals || [],
        styleGuide: data.styleGuide || undefined,
        checkpointRules: data.checkpointRules || [],
        checkpointEveryNTasks: data.checkpointEveryNTasks || 3,
        autoRefreshContext: data.autoRefreshContext !== false,
        agentInstructionsFiles: data.agentInstructionsFiles || {},
      });

      return NextResponse.json({
        success: true,
        message: 'Onboarding config saved',
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to update onboarding config:', error);
    return NextResponse.json(
      { error: 'Failed to update onboarding config' },
      { status: 500 }
    );
  }
}
