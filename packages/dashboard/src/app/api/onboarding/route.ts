import { NextRequest, NextResponse } from 'next/server';
import { getStateStore, getProjectId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = getStateStore();
    const projectId = getProjectId();

    const config = store.getOnboardingConfig(projectId);
    const project = store.getProject(projectId);

    return NextResponse.json({
      projectId,
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
    const store = getStateStore();
    const projectId = getProjectId();
    const body = await request.json();

    const { action, ...data } = body;

    if (action === 'save') {
      store.setOnboardingConfig(projectId, {
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
