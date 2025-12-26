// Mock data - will be replaced with API calls
const mockTasks = [
  {
    id: '1',
    title: 'Implement user authentication',
    description: 'Add JWT-based auth with refresh tokens',
    status: 'in_progress' as const,
    priority: 'high' as const,
    assignedTo: 'claude',
    files: ['src/auth/login.ts', 'src/auth/middleware.ts'],
    tags: ['auth', 'security'],
    estimatedTokens: 50000,
    actualTokens: 32000,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    title: 'Fix database connection pooling',
    description: 'Connection pool exhaustion under load',
    status: 'pending' as const,
    priority: 'critical' as const,
    assignedTo: undefined,
    files: ['src/db/pool.ts'],
    tags: ['database', 'performance'],
    estimatedTokens: 20000,
    createdAt: new Date('2024-01-16'),
  },
  {
    id: '3',
    title: 'Add unit tests for API endpoints',
    description: 'Increase test coverage to 80%',
    status: 'completed' as const,
    priority: 'medium' as const,
    assignedTo: 'gemini',
    files: ['tests/api/*.test.ts'],
    tags: ['testing'],
    estimatedTokens: 30000,
    actualTokens: 28500,
    createdAt: new Date('2024-01-14'),
    completedAt: new Date('2024-01-15'),
  },
  {
    id: '4',
    title: 'Refactor logging module',
    description: 'Switch to structured JSON logging',
    status: 'blocked' as const,
    priority: 'low' as const,
    assignedTo: 'codex',
    files: ['src/utils/logger.ts'],
    tags: ['refactor', 'observability'],
    estimatedTokens: 15000,
    createdAt: new Date('2024-01-16'),
    blockedBy: ['2'],
  },
  {
    id: '5',
    title: 'Update dependencies',
    description: 'Security patches for npm packages',
    status: 'claimed' as const,
    priority: 'high' as const,
    assignedTo: 'claude',
    files: ['package.json', 'package-lock.json'],
    tags: ['maintenance', 'security'],
    estimatedTokens: 10000,
    createdAt: new Date('2024-01-17'),
  },
];

type TaskStatus = 'pending' | 'claimed' | 'in_progress' | 'completed' | 'failed' | 'blocked' | 'cancelled';
type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage and monitor task assignments
          </p>
        </div>
        <button className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 transition-colors">
          + New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <FilterButton label="All" active />
        <FilterButton label="Pending" count={1} />
        <FilterButton label="In Progress" count={1} />
        <FilterButton label="Completed" count={1} />
        <FilterButton label="Blocked" count={1} />
      </div>

      {/* Task List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Task
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Files
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {mockTasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {task.title}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {task.description}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.assignedTo ? (
                    <AgentBadge agentId={task.assignedTo} />
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                      Unassigned
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {task.actualTokens ? (
                    <span>
                      {(task.actualTokens / 1000).toFixed(1)}k
                      <span className="text-gray-400 dark:text-gray-500">
                        {' '}/ {(task.estimatedTokens! / 1000).toFixed(1)}k
                      </span>
                    </span>
                  ) : task.estimatedTokens ? (
                    <span className="text-gray-400 dark:text-gray-500">
                      ~{(task.estimatedTokens / 1000).toFixed(1)}k
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {task.files.length} file{task.files.length !== 1 ? 's' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Total Tasks" value={mockTasks.length} />
        <MiniStat label="In Progress" value={mockTasks.filter(t => t.status === 'in_progress').length} />
        <MiniStat label="Completed" value={mockTasks.filter(t => t.status === 'completed').length} />
        <MiniStat label="Blocked" value={mockTasks.filter(t => t.status === 'blocked').length} />
      </div>
    </div>
  );
}

function FilterButton({ label, count, active }: { label: string; count?: number; active?: boolean }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-conductor-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 ${active ? 'text-conductor-200' : 'text-gray-400 dark:text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, string> = {
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    claimed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    blocked: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500',
  };

  const labels: Record<TaskStatus, string> = {
    pending: 'Pending',
    claimed: 'Claimed',
    in_progress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    blocked: 'Blocked',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = {
    critical: 'text-red-600 dark:text-red-400',
    high: 'text-orange-600 dark:text-orange-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-gray-600 dark:text-gray-400',
  };

  const icons: Record<TaskPriority, string> = {
    critical: '!!!',
    high: '!!',
    medium: '!',
    low: '-',
  };

  return (
    <span className={`text-sm font-medium ${styles[priority]}`}>
      {icons[priority]} {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}
