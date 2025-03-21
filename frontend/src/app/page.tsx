export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Active Fine-tunes</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">Datasets</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">API Usage</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No recent activity
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
          <div className="space-y-4">
            <button className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
              <span>Start a new fine-tune</span>
              <span>→</span>
            </button>
            <button className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
              <span>Upload a dataset</span>
              <span>→</span>
            </button>
            <button className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
              <span>Try the chat interface</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 