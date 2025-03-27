"use client";

import { useState } from "react";
import { FineTuneHFModel } from "@/lib/types";
import { deployToTogetherAI, checkTogetherAIDeploymentStatus, deployToRunPod } from "@/app/actions/deployment";

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: FineTuneHFModel | null;
}

interface DeploymentStatus {
  stage: 'idle' | 'uploading' | 'processing' | 'polling' | 'complete' | 'error';
  message: string;
  jobId?: string;
  modelName?: string;
}

export default function DeploymentModal({ isOpen, onClose, model }: DeploymentModalProps) {
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>({
    stage: 'idle',
    message: '',
  });

  // Handle deployment to Together AI
  const deployTogetherAI = async () => {
    if (!model) return;
    
    try {
      setDeploymentLoading(true);
      setDeploymentStatus({
        stage: 'uploading',
        message: 'Preparing to upload LoRA adapter to Together AI...'
      });
      
      // Step 1: Get the HF model URL and determine base model
      const hfModelUrl = `https://huggingface.co/${model.name}`;
      const baseModel = model.tags.find(tag => tag.startsWith('base_model:'))?.split(':')[1];
      
      // Step 2: Call our server action to initiate the upload
      const response = await deployToTogetherAI({
        model_id: model.id,
        hf_model_id: model.name,
        hf_model_url: hfModelUrl,
        base_model: baseModel
      });
      
      if (!response || !response.job_id || !response.model_name) {
        throw new Error('Invalid response from deployment API');
      }
      
      const { job_id, model_name } = response;
      
      setDeploymentStatus({
        stage: 'polling',
        message: 'Adapter uploaded. Waiting for deployment to complete...',
        jobId: job_id,
        modelName: model_name
      });
      
      // Step 3: Poll the job status until complete
      let isCompleted = false;
      while (!isCompleted) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        
        const statusResponse = await checkTogetherAIDeploymentStatus(job_id);
        
        if (statusResponse.status === 'Complete') {
          isCompleted = true;
          setDeploymentStatus({
            stage: 'complete',
            message: 'Deployment completed successfully!',
            jobId: job_id,
            modelName: model_name
          });
        } else if (statusResponse.status === 'Failed') {
          throw new Error(`Deployment failed: ${statusResponse.error || 'Unknown error'}`);
        } else {
          setDeploymentStatus({
            stage: 'polling',
            message: `Current status: ${statusResponse.status}...`,
            jobId: job_id,
            modelName: model_name
          });
        }
      }
      
      alert(`Successfully deployed ${model.name} to Together AI as ${model_name}`);
      onClose();
      
    } catch (error) {
      console.error("Error deploying to Together AI:", error);
      setDeploymentStatus({
        stage: 'error',
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      alert(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeploymentLoading(false);
    }
  };
  
  // Handle deployment to RunPod
  const deployRunPod = async () => {
    if (!model) return;
    
    try {
      setDeploymentLoading(true);
      setDeploymentStatus({
        stage: 'processing',
        message: 'Deploying to RunPod Serverless...'
      });
      
      const result = await deployToRunPod(model.id, model.name);
      
      if (result.success) {
        setDeploymentStatus({
          stage: 'complete',
          message: result.message
        });
        alert(result.message);
      } else {
        throw new Error(result.message);
      }
      
      onClose();
    } catch (error) {
      console.error("Error deploying to RunPod:", error);
      setDeploymentStatus({
        stage: 'error',
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      alert(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeploymentLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-medium">Deploy Model</h3>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4">
            <p className="text-gray-600 dark:text-gray-300">
              Select a deployment option for {model?.name}:
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={deployTogetherAI}
              disabled={deploymentLoading}
              className="w-full px-4 py-3 text-left bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <div className="font-medium">Together AI</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Deploy as LoRA to Together AI serverless</div>
            </button>

            <button
              onClick={deployRunPod}
              disabled={deploymentLoading}
              className="w-full px-4 py-3 text-left bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <div className="font-medium">RunPod Serverless</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Deploy using RunPod&apos;s serverless platform</div>
            </button>
          </div>
          
          {deploymentLoading && (
            <div className="mt-4 text-center">
              <div className="inline-block animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {deploymentStatus.message || "Deploying model..."}
              </p>
              {deploymentStatus.stage === 'complete' && deploymentStatus.modelName && (
                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs text-left">
                  <p><span className="font-semibold">Model Name:</span> {deploymentStatus.modelName}</p>
                  <p className="mt-1"><span className="font-semibold">Job ID:</span> {deploymentStatus.jobId}</p>
                </div>
              )}
            </div>
          )}
          
          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              disabled={deploymentLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 