<div className="space-y-4">
  <h1 className="text-2xl font-bold">{model.name}</h1>
  
  {/* ... existing model details ... */}
  
  {/* Add Together AI deployment status indicator */}
  {model.together_deployed && (
    <div className="flex flex-col space-y-1 bg-gray-50 p-4 rounded-md">
      <h3 className="font-medium">Deployment Status</h3>
      <div className="flex items-center">
        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
        <span className="font-medium">Deployed on Together AI</span>
      </div>
      <div className="text-sm text-gray-500">
        <span className="font-medium">Model ID:</span> {model.together_deployed}
      </div>
      <a 
        href={`https://api.together.xyz/playground/chat/${model.together_deployed}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:underline"
      >
        Try on Together AI Playground →
      </a>
    </div>
  )}
  
  {/* ... other model details ... */}
</div> 