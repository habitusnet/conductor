'use client';

import { useState } from 'react';

// Mock data - will be replaced with API calls
const mockCostEvents = [
  { id: '1', agentId: 'claude', model: 'claude-3-opus', taskId: 'task-1', tokensInput: 15000, tokensOutput: 5000, cost: 0.60, createdAt: new Date('2024-01-17T10:30:00') },
  { id: '2', agentId: 'gemini', model: 'gemini-pro', taskId: 'task-2', tokensInput: 25000, tokensOutput: 8000, cost: 0.01, createdAt: new Date('2024-01-17T09:15:00') },
  { id: '3', agentId: 'claude', model: 'claude-3-opus', taskId: 'task-3', tokensInput: 8000, tokensOutput: 3000, cost: 0.35, createdAt: new Date('2024-01-17T08:45:00') },
  { id: '4', agentId: 'codex', model: 'gpt-4-turbo', taskId: 'task-4', tokensInput: 12000, tokensOutput: 4000, cost: 0.24, createdAt: new Date('2024-01-16T16:20:00') },
  { id: '5', agentId: 'claude', model: 'claude-3-opus', taskId: 'task-5', tokensInput: 20000, tokensOutput: 7000, cost: 0.83, createdAt: new Date('2024-01-16T14:10:00') },
  { id: '6', agentId: 'gemini', model: 'gemini-pro', taskId: 'task-6', tokensInput: 30000, tokensOutput: 10000, cost: 0.01, createdAt: new Date('2024-01-16T11:30:00') },
  { id: '7', agentId: 'claude', model: 'claude-3-opus', taskId: 'task-7', tokensInput: 5000, tokensOutput: 2000, cost: 0.23, createdAt: new Date('2024-01-15T15:45:00') },
  { id: '8', agentId: 'codex', model: 'gpt-4-turbo', taskId: 'task-8', tokensInput: 18000, tokensOutput: 6000, cost: 0.36, createdAt: new Date('2024-01-15T10:20:00') },
];

const mockBudget = {
  total: 50.00,
  spent: 12.47,
  alertThreshold: 80,
};

const mockUsageByAgent = [
  { agentId: 'claude', cost: 8.50, tokens: 450000, percentage: 68 },
  { agentId: 'gemini', cost: 0.25, tokens: 500000, percentage: 2 },
  { agentId: 'codex', cost: 2.80, tokens: 140000, percentage: 22 },
  { agentId: 'gpt4', cost: 0.92, tokens: 46000, percentage: 8 },
];

const mockDailySpend = [
  { date: '2024-01-11', amount: 1.20 },
  { date: '2024-01-12', amount: 0.85 },
  { date: '2024-01-13', amount: 2.10 },
  { date: '2024-01-14', amount: 1.75 },
  { date: '2024-01-15', amount: 0.59 },
  { date: '2024-01-16', amount: 1.08 },
  { date: '2024-01-17', amount: 0.96 },
];

export default function CostsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  const percentUsed = (mockBudget.spent / mockBudget.total) * 100;
  const isNearLimit = percentUsed >= mockBudget.alertThreshold;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Costs</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Track spending and usage across agents
          </p>
        </div>
        <div className="flex gap-2">
          <TimeRangeButton label="7 Days" value="7d" current={timeRange} onChange={setTimeRange} />
          <TimeRangeButton label="30 Days" value="30d" current={timeRange} onChange={setTimeRange} />
          <TimeRangeButton label="All Time" value="all" current={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Budget Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Budget Status</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monthly spending limit</p>
          </div>
          <button className="text-sm text-conductor-600 hover:text-conductor-700 dark:text-conductor-400 font-medium">
            Edit Budget
          </button>
        </div>

        <div className="flex items-end gap-4 mb-4">
          <div className="text-4xl font-bold text-gray-900 dark:text-white">
            ${mockBudget.spent.toFixed(2)}
          </div>
          <div className="text-lg text-gray-500 dark:text-gray-400 mb-1">
            / ${mockBudget.total.toFixed(2)}
          </div>
        </div>

        <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              isNearLimit ? 'bg-red-500' : 'bg-conductor-500'
            }`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
          <div
            className="absolute inset-y-0 border-r-2 border-dashed border-orange-400"
            style={{ left: `${mockBudget.alertThreshold}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-sm">
          <span className={isNearLimit ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
            {percentUsed.toFixed(1)}% used
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            ${(mockBudget.total - mockBudget.spent).toFixed(2)} remaining
          </span>
        </div>

        {isNearLimit && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">
              Warning: You&apos;ve exceeded {mockBudget.alertThreshold}% of your budget. Consider reviewing task assignments.
            </p>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Spend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Spending</h2>
          <div className="h-48 flex items-end gap-2">
            {mockDailySpend.map((day, i) => {
              const maxAmount = Math.max(...mockDailySpend.map(d => d.amount));
              const height = (day.amount / maxAmount) * 100;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">${day.amount.toFixed(2)}</div>
                  <div
                    className="w-full bg-conductor-500 rounded-t transition-all hover:bg-conductor-600"
                    style={{ height: `${height}%`, minHeight: '8px' }}
                  />
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Usage by Agent */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage by Agent</h2>
          <div className="space-y-4">
            {mockUsageByAgent.map((agent) => (
              <AgentUsageRow key={agent.agentId} {...agent} />
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Usage</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {mockCostEvents.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDateTime(event.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <AgentBadge agentId={event.agentId} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                  {event.model}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  <span className="text-green-600 dark:text-green-400">{(event.tokensInput / 1000).toFixed(1)}k</span>
                  {' / '}
                  <span className="text-blue-600 dark:text-blue-400">{(event.tokensOutput / 1000).toFixed(1)}k</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-right">
                  ${event.cost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cost Tips */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
          Cost Optimization Tips
        </h2>
        <ul className="list-disc list-inside text-green-700 dark:text-green-300 space-y-2">
          <li>Use Gemini for high-volume, simpler tasks - it&apos;s 60x cheaper than Claude Opus</li>
          <li>Set token estimates on tasks to help the auction system choose cost-effective agents</li>
          <li>Review completed tasks for token efficiency and adjust future estimates</li>
          <li>Consider zone-based conflict resolution to reduce agent coordination overhead</li>
        </ul>
      </div>
    </div>
  );
}

function TimeRangeButton({
  label,
  value,
  current,
  onChange,
}: {
  label: string;
  value: '7d' | '30d' | 'all';
  current: string;
  onChange: (v: '7d' | '30d' | 'all') => void;
}) {
  return (
    <button
      onClick={() => onChange(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        current === value
          ? 'bg-conductor-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );
}

function AgentUsageRow({
  agentId,
  cost,
  tokens,
  percentage,
}: {
  agentId: string;
  cost: number;
  tokens: number;
  percentage: number;
}) {
  const colors: Record<string, string> = {
    claude: 'bg-orange-500',
    gemini: 'bg-blue-500',
    codex: 'bg-green-500',
    gpt4: 'bg-purple-500',
  };

  return (
    <div>
      <div className="flex justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${colors[agentId] || 'bg-gray-500'}`} />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{agentId}</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          ${cost.toFixed(2)} ({(tokens / 1000).toFixed(0)}k tokens)
        </div>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colors[agentId] || 'bg-gray-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function AgentBadge({ agentId }: { agentId: string }) {
  const colors: Record<string, string> = {
    claude: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    gemini: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    codex: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    gpt4: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[agentId] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
      {agentId}
    </span>
  );
}

function formatDateTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 24) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
