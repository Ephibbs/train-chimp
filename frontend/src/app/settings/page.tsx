"use client";

import { useState, useEffect } from "react";
import { Save, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const [hfToken, setHfToken] = useState("");
  const [runpodToken, setRunpodToken] = useState("");
  const [togetherAiToken, setTogetherAiToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load saved tokens on component mount
  useEffect(() => {
    const savedHfToken = localStorage.getItem("hfToken") || "";
    const savedRunpodToken = localStorage.getItem("runpodToken") || "";
    const savedTogetherAiToken = localStorage.getItem("togetherAiToken") || "";
    
    setHfToken(savedHfToken);
    setRunpodToken(savedRunpodToken);
    setTogetherAiToken(savedTogetherAiToken);
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      // Store tokens in localStorage
      localStorage.setItem("hfToken", hfToken);
      localStorage.setItem("runpodToken", runpodToken);
      localStorage.setItem("togetherAiToken", togetherAiToken);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSaveSuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">API Keys</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Configure your API keys for various services used by the application.
              </p>
              
              <div>
                <label htmlFor="hf-token" className="block text-sm font-medium mb-1">
                  Hugging Face Token
                </label>
                <input
                  type="password"
                  id="hf-token"
                  value={hfToken}
                  onChange={(e) => setHfToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                  placeholder="hf_••••••••••••••••••••••••••••••"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Required for managing datasets and models on Hugging Face.
                </p>
              </div>
              
              <div>
                <label htmlFor="runpod-token" className="block text-sm font-medium mb-1">
                  RunPod API Key
                </label>
                <input
                  type="password"
                  id="runpod-token"
                  value={runpodToken}
                  onChange={(e) => setRunpodToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                  placeholder="••••••••••••••••••••••••••••••"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Used for deploying models to RunPod Serverless.
                </p>
              </div>
              
              <div>
                <label htmlFor="together-token" className="block text-sm font-medium mb-1">
                  Together AI API Key
                </label>
                <input
                  type="password"
                  id="together-token"
                  value={togetherAiToken}
                  onChange={(e) => setTogetherAiToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                  placeholder="••••••••••••••••••••••••••••••"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Used for deploying models to Together AI.
                </p>
              </div>
            </div>
            
            <div className="pt-4 flex justify-end items-center space-x-3">
              {saveSuccess && (
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <CheckCircle className="w-5 h-5 mr-1" />
                  <span>Settings saved</span>
                </div>
              )}
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 