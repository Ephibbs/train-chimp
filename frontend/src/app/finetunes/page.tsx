"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Brain, Database } from "lucide-react";
import { 
  deleteModelRepo,
  createDatasetRepo,
  uploadFileToDataset,
  createDatasetCard,
} from "@/app/actions/hf";
import { COLLECTION_NAME, FineTuneHFModel } from "@/lib/types";
import { startFinetune } from "../actions/finetune";
import { useData } from "@/providers/DataProvider";
import DeploymentModal from "@/components/DeploymentModal";

export default function FinetunesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedModelForDeploy, setSelectedModelForDeploy] = useState<FineTuneHFModel | null>(null);
  const [datasetOption, setDatasetOption] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { models, datasets, isLoadingModels, refreshModels, refreshDatasets, hfUsername } = useData();
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [trainingMethod, setTrainingMethod] = useState("lora");
  
  // Upload dataset function (for when creating a new dataset during finetune)
  const handleFileUpload = async (file: File, datasetName: string) => {
    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      
      // Create dataset repository name (sanitize the name for URL safety)
      const repoName = datasetName
        .trim()
        .toLowerCase()
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-');
      
      // Get the username from token
      const datasetId = `${hfUsername}/${repoName}`;
      
      // Create progress simulation (since HF API doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + 5;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 500);
      
      // 1. Create the dataset repository
      const createResult = await createDatasetRepo({
        name: repoName,
        options: {
          description: `Dataset for fine-tuning: ${datasetName}`,
          private: false,
        },
      });
      
      // Add tag to identify this as a TrainChimp dataset
      await createDatasetCard({
        repoId: datasetId,
        cardData: {
          tags: [COLLECTION_NAME],
          dataset_description: `Dataset for fine-tuning: ${datasetName}`
        }
      });

      if (!createResult) {
        throw new Error("Failed to create dataset repository");
      }
      
      // 2. Upload the file to the dataset
      const uploadSuccess = await uploadFileToDataset({
        repoId: datasetId,
        filePath: file.name,
        fileContent: file,
      });
      
      clearInterval(progressInterval);
      
      if (!uploadSuccess) {
        throw new Error("Failed to upload file");
      }
      
      setUploadProgress(100);

      refreshDatasets();
      
      // Select the newly created dataset
      setDatasetOption(datasetId);
      
      // Reset file selection
      setSelectedFile(null);
      
    } catch (error) {
      console.error("Error uploading dataset:", error);
      setUploadError(`Failed to upload dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 3000);
    }
  };

  // Handle form submission to create a new fine-tune
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    try {
      setIsLoading(true);
      
      // Extract form values
      const name = formData.get('name') as string;
      const baseModel = formData.get('base-model') as string;
      const datasetId = formData.get('dataset') as string;
      const epochs = parseInt(formData.get('epochs') as string, 10);
      
      // Extract advanced params if they exist
      const learningRate = formData.get('learning_rate') ? parseFloat(formData.get('learning_rate') as string) : undefined;
      const batchSize = formData.get('batch_size') ? parseInt(formData.get('batch_size') as string, 10) : undefined;
      const cutoffLength = formData.get('cutoff_length') ? parseInt(formData.get('cutoff_length') as string, 10) : undefined;
      const warmupSteps = formData.get('warmup_steps') ? parseInt(formData.get('warmup_steps') as string, 10) : undefined;

      // LoRA specific params
      const loraRank = formData.get('lora_rank') ? parseInt(formData.get('lora_rank') as string, 10) : undefined;
      const loraAlpha = formData.get('lora_alpha') ? parseInt(formData.get('lora_alpha') as string, 10) : undefined;
      const loraDropout = formData.get('lora_dropout') ? parseFloat(formData.get('lora_dropout') as string) : undefined;
      const targetModules = formData.get('target_modules') as string || undefined;
      
      if (!name || !baseModel || !datasetId || isNaN(epochs)) {
        throw new Error("Please fill out all required fields");
      }

      console.log("Name:", name);
      console.log("Base model:", baseModel);
      console.log("Dataset ID:", datasetId);
      console.log("Epochs:", epochs);
      
      // Get HF token for authorization header
      const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN || '';
      
      if (!hfToken) {
        throw new Error("Hugging Face token not found");
      }
      
      // Call the API endpoint with advanced parameters
      const advancedParams = {
        training_method: trainingMethod,
        learning_rate: learningRate,
        batch_size: batchSize,
        cutoff_length: cutoffLength,
        warmup_steps: warmupSteps,
        lora_rank: loraRank,
        lora_alpha: loraAlpha,
        lora_dropout: loraDropout,
        target_modules: targetModules ? targetModules.split(',').map(m => m.trim()) : undefined,
      };
      
      const job = await startFinetune(name, baseModel, datasetId, epochs, advancedParams);
      
      console.log('Fine-tune created:', job);

      // Close modal and refresh finetunes list
      setIsModalOpen(false);
      refreshModels();
      
    } catch (error) {
      console.error("Error creating fine-tune:", error);
      alert(`Failed to create fine-tune: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle deployment modal open
  const handleDeployClick = (finetune: FineTuneHFModel) => {
    setSelectedModelForDeploy(finetune);
    setIsDeployModalOpen(true);
  };
  
  const handleDeleteModel = async (modelId: string) => {
    if (window.confirm(`Are you sure you want to delete this model: ${modelId}?`)) {
      try {
        const success = await deleteModelRepo({ name: modelId });
        if (success) {
          // Refresh models after deleting
          refreshModels();
        } else {
          throw new Error("Failed to delete model");
        }
      } catch (error) {
        console.error("Error deleting model:", error);
        alert(`Failed to delete model: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Use models from the provider for rendering
  return (
    <div className="container mx-auto p-4">
      {/* Render the models (finetunes) from the provider */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Fine-tunes</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Fine-tune
        </button>
      </div>

      {isLoadingModels ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">No Fine-tunes Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You haven&apos;t created any fine-tunes yet. Get started by creating your first fine-tune.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Create Fine-tune
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {models.map((finetune) => (
            <div
              key={finetune.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
            >
              {/* Model card content */}
              <div className="p-6">
                <h3 className="text-lg font-medium mb-2">{finetune.name.split('/')[1]}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 flex items-center">
                  <Brain className="h-4 w-4 mr-1" />{' '}
                  <a 
                    href={`https://huggingface.co/${finetune.baseModel}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    {finetune.baseModel || 'Unknown model'}
                  </a>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center">
                  <Database className="h-4 w-4 mr-1" />{' '}
                  <a 
                    href={`https://huggingface.co/datasets/${finetune.dataset}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    {finetune.dataset || 'Unknown dataset'}
                  </a>
                </p>
                
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${finetune.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                      finetune.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                      finetune.status === 'training' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}
                  >
                    {finetune.status.charAt(0).toUpperCase() + finetune.status.slice(1)}
                  </span>
                  {finetune.updatedAt && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Updated: {new Date(finetune.updatedAt).toLocaleDateString()} {new Date(finetune.updatedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {/* Add a modal here for creating new fine-tunes */}
     
                <div className="flex justify-between items-center">
                  <Link
                    href={`/finetunes/${finetune.name}`}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    View Details
                  </Link>
                  <div>
                    {finetune.status === 'completed' && (
                      <button
                        className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
                        onClick={() => handleDeployClick(finetune)}
                      >
                        Deploy
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteModel(finetune.name)}
                      className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Add Together AI deployment status indicator */}
                {finetune.together_deployed && (
                  <div className="mt-2 flex items-center">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                      Deployed on Together AI
                    </span>
                    <span className="text-xs text-gray-500">ID: {finetune.together_deployed}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-medium">Create New Fine-tune</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                    placeholder="My Custom Model"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="base-model" className="block text-sm font-medium mb-1">
                    Base Model
                  </label>
                  <select
                    id="base-model"
                    name="base-model"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                    required
                  >
                    <option value="">Select a base model</option>
                    <option value="meta-llama/Llama-3.2-1B-Instruct">Llama 3.2 1B Instruct</option>
                    <option value="meta-llama/Llama-3.2-3B-Instruct">Llama 3.2 3B Instruct</option>
                    <option value="meta-llama/Llama-3.1-8B-Instruct">Llama 3.1 8B Instruct</option>
                    <option value="meta-llama/Llama-3.3-70B-Instruct">Llama 3.3 70B Instruct</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="dataset" className="block text-sm font-medium mb-1">
                    Dataset
                  </label>
                  <select
                    id="dataset"
                    name="dataset"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                    value={datasetOption}
                    onChange={(e) => setDatasetOption(e.target.value)}
                    required
                  >
                    <option value="">Select a dataset</option>
                    {datasets.map(dataset => (
                      <option key={dataset.name} value={dataset.name}>
                        {dataset.name}
                      </option>
                    ))}
                    <option value="upload">Upload new dataset</option>
                  </select>
                </div>
                
                {datasetOption === "upload" && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="dataset-name" className="block text-sm font-medium mb-1">
                        Dataset Name
                      </label>
                      <input
                        type="text"
                        id="dataset-name"
                        name="dataset-name"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                        placeholder="My Dataset"
                        onChange={(e) => {
                          if (selectedFile && e.target.value) {
                            handleFileUpload(selectedFile, e.target.value);
                          }
                        }}
                      />
                    </div>
                    
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                      <div className="space-y-2">
                        <div className="text-gray-500 dark:text-gray-400">
                          <p>Drag and drop your dataset file here</p>
                          <p className="text-xs">Supported formats: JSON (.jsonl)</p>
                        </div>
                        <div className="flex justify-center">
                          <label className="cursor-pointer px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                            Browse Files
                            <input
                              type="file"
                              name="file"
                              accept=".jsonl"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSelectedFile(file);
                                  const datasetName = (document.getElementById("dataset-name") as HTMLInputElement)?.value;
                                  if (datasetName) {
                                    handleFileUpload(file, datasetName);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>
                        {isUploading && (
                          <div className="space-y-2">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                              <div 
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Uploading... {uploadProgress}%
                            </p>
                          </div>
                        )}
                        {uploadError && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                            {uploadError}
                          </p>
                        )}
                        {selectedFile && !isUploading && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                            Selected file: {selectedFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Advanced options toggle - moved up since epochs is now in advanced */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
                  >
                    {showAdvancedOptions ? '- Hide' : '+ Show'} Advanced Options
                  </button>
                </div>
                
                {/* Advanced options section */}
                {showAdvancedOptions && (
                  <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                    <h4 className="font-medium text-sm">Training Method</h4>
                    <div className="flex space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="training_method"
                          value="lora"
                          checked={trainingMethod === "lora"}
                          onChange={() => setTrainingMethod("lora")}
                          className="form-radio"
                        />
                        <span className="ml-2">LoRA</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="training_method"
                          value="full"
                          checked={trainingMethod === "full"}
                          onChange={() => setTrainingMethod("full")}
                          className="form-radio"
                        />
                        <span className="ml-2">Full Fine-tuning</span>
                      </label>
                    </div>
                    
                    {/* General parameters */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">General Parameters</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="epochs" className="block text-xs font-medium mb-1">
                            Epochs
                          </label>
                          <input
                            type="number"
                            id="epochs"
                            name="epochs"
                            min="1"
                            max="20"
                            defaultValue="3"
                            className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                          />
                        </div>
                        <div>
                          <label htmlFor="learning_rate" className="block text-xs font-medium mb-1">
                            Learning Rate
                          </label>
                          <input
                            type="number"
                            id="learning_rate"
                            name="learning_rate"
                            step="0.0000001"
                            defaultValue="0.0002"
                            className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                          />
                        </div>
                        <div>
                          <label htmlFor="batch_size" className="block text-xs font-medium mb-1">
                            Batch Size
                          </label>
                          <input
                            type="number"
                            id="batch_size"
                            name="batch_size"
                            min="1"
                            defaultValue="4"
                            className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                          />
                        </div>
                        <div>
                          <label htmlFor="cutoff_length" className="block text-xs font-medium mb-1">
                            Max Sequence Length
                          </label>
                          <input
                            type="number"
                            id="cutoff_length"
                            name="cutoff_length"
                            min="128"
                            max="8192"
                            defaultValue="2048"
                            className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                          />
                        </div>
                        <div>
                          <label htmlFor="warmup_steps" className="block text-xs font-medium mb-1">
                            Warmup Steps
                          </label>
                          <input
                            type="number"
                            id="warmup_steps"
                            name="warmup_steps"
                            min="0"
                            defaultValue="100"
                            className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* LoRA specific parameters */}
                    {trainingMethod === "lora" && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">LoRA Parameters</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="lora_rank" className="block text-xs font-medium mb-1">
                              LoRA Rank
                            </label>
                            <input
                              type="number"
                              id="lora_rank"
                              name="lora_rank"
                              min="1"
                              max="256"
                              defaultValue="16"
                              className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                            />
                          </div>
                          <div>
                            <label htmlFor="lora_alpha" className="block text-xs font-medium mb-1">
                              LoRA Alpha
                            </label>
                            <input
                              type="number"
                              id="lora_alpha"
                              name="lora_alpha"
                              min="1"
                              defaultValue="32"
                              className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                            />
                          </div>
                          <div>
                            <label htmlFor="lora_dropout" className="block text-xs font-medium mb-1">
                              LoRA Dropout
                            </label>
                            <input
                              type="number"
                              id="lora_dropout"
                              name="lora_dropout"
                              min="0"
                              max="1"
                              step="0.01"
                              defaultValue="0.05"
                              className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                            />
                          </div>
                          <div>
                            <label htmlFor="target_modules" className="block text-xs font-medium mb-1">
                              Target Modules
                            </label>
                            <input
                              type="text"
                              id="target_modules"
                              name="target_modules"
                              placeholder="q_proj,v_proj"
                              className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || isUploading}
                  >
                    {isLoading ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Replace the deployment modal with the new component */}
      <DeploymentModal 
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        model={selectedModelForDeploy}
      />
    </div>
  );
} 