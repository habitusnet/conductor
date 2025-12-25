import type { AgentProfile } from './types.js';

/**
 * Default agent profiles with known capabilities and pricing
 */
export const DEFAULT_AGENT_PROFILES: Record<string, AgentProfile> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    capabilities: [
      'typescript',
      'javascript',
      'react',
      'nextjs',
      'nodejs',
      'python',
      'architecture',
      'testing',
      'code-review',
      'refactoring',
      'mcp',
      'documentation',
    ],
    costPerToken: {
      input: 0.000015, // Claude Opus 4
      output: 0.000075,
    },
    status: 'idle',
  },
  'claude-sonnet': {
    id: 'claude-sonnet',
    name: 'Claude Sonnet',
    capabilities: [
      'typescript',
      'javascript',
      'react',
      'nodejs',
      'testing',
      'refactoring',
    ],
    costPerToken: {
      input: 0.000003, // Claude Sonnet 4
      output: 0.000015,
    },
    status: 'idle',
  },
  'claude-haiku': {
    id: 'claude-haiku',
    name: 'Claude Haiku',
    capabilities: [
      'typescript',
      'javascript',
      'simple-tasks',
      'formatting',
    ],
    costPerToken: {
      input: 0.00000025, // Claude Haiku
      output: 0.00000125,
    },
    status: 'idle',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini 2.0 Flash',
    capabilities: [
      'typescript',
      'javascript',
      'react',
      'nextjs',
      'frontend',
      'css',
      'accessibility',
      'documentation',
      'research',
    ],
    costPerToken: {
      input: 0.0000001, // Gemini 2.0 Flash
      output: 0.0000004,
    },
    status: 'idle',
  },
  codex: {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    capabilities: [
      'typescript',
      'javascript',
      'testing',
      'linting',
      'automation',
      'ci-cd',
      'refactoring',
    ],
    costPerToken: {
      input: 0, // Free tier
      output: 0,
    },
    status: 'idle',
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    capabilities: [
      'typescript',
      'javascript',
      'python',
      'architecture',
      'documentation',
    ],
    costPerToken: {
      input: 0.0000025, // GPT-4o
      output: 0.00001,
    },
    status: 'idle',
  },
};

/**
 * Model pricing per million tokens (for reference and calculations)
 */
export const MODEL_PRICING = {
  'claude-opus-4': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-sonnet-4': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-haiku': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'gemini-2.0-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  'gemini-2.0-pro': { inputPerMillion: 1.25, outputPerMillion: 5 },
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  codex: { inputPerMillion: 0, outputPerMillion: 0 },
} as const;

/**
 * Create an agent profile with defaults
 */
export function createAgentProfile(
  id: string,
  overrides: Partial<AgentProfile> = {}
): AgentProfile {
  const base = DEFAULT_AGENT_PROFILES[id];

  if (base) {
    return { ...base, ...overrides, id };
  }

  return {
    id,
    name: overrides.name || id,
    capabilities: overrides.capabilities || [],
    costPerToken: overrides.costPerToken || { input: 0, output: 0 },
    status: overrides.status || 'idle',
    ...overrides,
  };
}

/**
 * Check if an agent has a specific capability
 */
export function hasCapability(agent: AgentProfile, capability: string): boolean {
  return agent.capabilities.includes(capability);
}

/**
 * Check if an agent has all required capabilities
 */
export function hasAllCapabilities(
  agent: AgentProfile,
  capabilities: string[]
): boolean {
  return capabilities.every((cap) => agent.capabilities.includes(cap));
}

/**
 * Get agents that have a specific capability
 */
export function getAgentsWithCapability(
  agents: AgentProfile[],
  capability: string
): AgentProfile[] {
  return agents.filter((agent) => hasCapability(agent, capability));
}

/**
 * Calculate estimated cost for a task
 */
export function estimateCost(
  agent: AgentProfile,
  inputTokens: number,
  outputTokens: number
): number {
  return (
    inputTokens * agent.costPerToken.input +
    outputTokens * agent.costPerToken.output
  );
}
