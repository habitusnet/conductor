// Mock data - will be replaced with API calls
const mockAgents = [
  {
    id: 'claude',
    name: 'Claude',
    provider: 'anthropic' as const,
    model: 'claude-3-opus',
    status: 'working' as const,
    capabilities: ['code-generation', 'code-review', 'debugging', 'documentation'],
    costPerToken: { input: 0.015, output: 0.075 },
    currentTask: 'Implement user authentication',
    tokensUsed: 125000,
    tasksCompleted: 12,
    lastHeartbeat: new Date(Date.now() - 30000), // 30 seconds ago
  },
  {
    id: 'gemini',
    name: 'Gemini',
    provider: 'google' as const,
    model: 'gemini-pro',
    status: 'idle' as const,
    capabilities: ['code-generation', 'testing', 'analysis'],
    costPerToken: { input: 0.00025, output: 0.0005 },
    currentTask: undefined,
    tokensUsed: 89000,
    tasksCompleted: 8,
    lastHeartbeat: new Date(Date.now() - 60000), // 1 minute ago
  },
  {
    id: 'codex',
    name: 'Codex',
    provider: 'openai' as const,
    model: 'gpt-4-turbo',
    status: 'blocked' as const,
    capabilities: ['code-generation', 'refactoring'],
    costPerToken: { input: 0.01, output: 0.03 },
    currentTask: 'Refactor logging module',
    tokensUsed: 45000,
    tasksCompleted: 5,
    lastHeartbeat: new Date(Date.now() - 120000), // 2 minutes ago
  },
  {
    id: 'gpt4',
    name: 'GPT-4',
    provider: 'openai' as const,
    model: 'gpt-4o',
    status: 'offline' as const,
    capabilities: ['code-generation', 'architecture', 'documentation'],
    costPerToken: { input: 0.005, output: 0.015 },
    currentTask: undefined,
    tokensUsed: 0,
    tasksCompleted: 0,
    lastHeartbeat: new Date(Date.now() - 3600000), // 1 hour ago
  },
];

type AgentStatus = 'idle' | 'working' | 'blocked' | 'offline';
type Provider = 'anthropic' | 'google' | 'openai' | 'meta' | 'custom';

export default function AgentsPage() {
  const activeAgents = mockAgents.filter(a => a.status !== 'offline').length;
  const workingAgents = mockAgents.filter(a => a.status === 'working').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agents</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Monitor and manage connected LLM agents
          </p>
        </div>
        <button className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 transition-colors">
          + Register Agent
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard label="Total Agents" value={mockAgents.length} color="blue" />
        <StatusCard label="Active" value={activeAgents} color="green" />
        <StatusCard label="Working" value={workingAgents} color="yellow" />
        <StatusCard label="Offline" value={mockAgents.length - activeAgents} color="gray" />
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mockAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
          Connecting Agents
        </h2>
        <p className="text-blue-700 dark:text-blue-300 mb-4">
          Agents connect via the Conductor MCP server. Each agent needs:
        </p>
        <ol className="list-decimal list-inside text-blue-700 dark:text-blue-300 space-y-2">
          <li>A valid API key for their provider (Anthropic, Google, OpenAI)</li>
          <li>The Conductor MCP server added to their configuration</li>
          <li>Access to the project directory or repository</li>
        </ol>
      </div>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'yellow' | 'gray' }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colorClasses[color]}`} />
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</div>
    </div>
  );
}

interface Agent {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  status: AgentStatus;
  capabilities: string[];
  costPerToken: { input: number; output: number };
  currentTask?: string;
  tokensUsed: number;
  tasksCompleted: number;
  lastHeartbeat: Date;
}

function AgentCard({ agent }: { agent: Agent }) {
  const statusStyles: Record<AgentStatus, { bg: string; text: string; dot: string }> = {
    idle: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-500' },
    working: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500 animate-pulse' },
    blocked: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
    offline: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  };

  const providerColors: Record<Provider, string> = {
    anthropic: 'text-orange-600 dark:text-orange-400',
    google: 'text-blue-600 dark:text-blue-400',
    openai: 'text-green-600 dark:text-green-400',
    meta: 'text-blue-600 dark:text-blue-400',
    custom: 'text-gray-600 dark:text-gray-400',
  };

  const style = statusStyles[agent.status];
  const timeSinceHeartbeat = Math.floor((Date.now() - agent.lastHeartbeat.getTime()) / 1000);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-xl font-bold text-gray-600 dark:text-gray-300">
              {agent.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.name}
              </h3>
              <p className={`text-sm ${providerColors[agent.provider]}`}>
                {agent.model}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${style.bg}`}>
            <div className={`w-2 h-2 rounded-full ${style.dot}`} />
            <span className={`text-sm font-medium ${style.text}`}>
              {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
            </span>
          </div>
        </div>

        {agent.currentTask && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Current Task
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
              {agent.currentTask}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              {cap}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {(agent.tokensUsed / 1000).toFixed(0)}k
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Tokens Used</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {agent.tasksCompleted}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Tasks Done</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              ${((agent.tokensUsed * agent.costPerToken.input + agent.tokensUsed * 0.3 * agent.costPerToken.output) / 1000).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Est. Cost</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          Last heartbeat: {formatTimeSince(timeSinceHeartbeat)}
        </span>
        <div className="flex gap-2">
          <button className="text-conductor-600 hover:text-conductor-700 dark:text-conductor-400 dark:hover:text-conductor-300 font-medium">
            Details
          </button>
          <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
            Configure
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimeSince(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
