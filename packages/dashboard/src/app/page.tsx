export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Conductor Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Multi-LLM orchestration overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Tasks"
          value="0"
          subtitle="0 in progress"
          color="blue"
        />
        <StatCard
          title="Active Agents"
          value="0"
          subtitle="0 working"
          color="green"
        />
        <StatCard
          title="Budget Used"
          value="$0.00"
          subtitle="0% of limit"
          color="purple"
        />
        <StatCard
          title="Conflicts"
          value="0"
          subtitle="0 unresolved"
          color="red"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-4">
          <button className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 transition-colors">
            Add Task
          </button>
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
            Register Agent
          </button>
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
            View Logs
          </button>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
          Getting Started
        </h2>
        <p className="text-amber-700 dark:text-amber-300 mb-4">
          This dashboard is a placeholder. To connect it to your Conductor project:
        </p>
        <ol className="list-decimal list-inside text-amber-700 dark:text-amber-300 space-y-2">
          <li>Initialize a project: <code className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">conductor init</code></li>
          <li>Register agents: <code className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">conductor agent:register -i claude</code></li>
          <li>Add tasks: <code className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">conductor task:add -t &quot;My task&quot;</code></li>
          <li>Set <code className="bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">CONDUCTOR_DB</code> environment variable</li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full ${colorClasses[color]} mr-3`} />
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </h3>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}
