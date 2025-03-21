"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { 
  getUserModels, 
  getUserDatasets, 
  createModelRepo, 
  createDatasetRepo,
  uploadFileToDataset,
  COLLECTION_NAME,
  getHFUsername,
  createDatasetCard,
  createModelCard
} from "@/lib/hf";
import { startGpuInstance } from "@/lib/runpod/startup";

type FineTune = {
  id: string;
  name: string;
  baseModel: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
};

export default function FinetunesPage() {
  const [finetunes, setFinetunes] = useState<FineTune[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [selectedModelForDeploy, setSelectedModelForDeploy] = useState<FineTune | null>(null);
  const [deploymentType, setDeploymentType] = useState<string | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [datasetOption, setDatasetOption] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Array<{id: string, name: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch finetunes and datasets when component mounts
  useEffect(() => {
    fetchFinetunes();
    fetchDatasets();
  }, []);
  
  const fetchFinetunes = async () => {
    try {
      setIsLoading(true);
      
      // Get HF token from environment or storage
      const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN || localStorage.getItem('hfToken');
      
      if (!hfToken) {
        console.error("Hugging Face token not found");
        return;
      }
      
      // Get the username from the token
      const username = await getHFUsername() as string;
      
      // Use the getUserModels function from hf.ts
      const userModels = await getUserModels({username});
      
      // Transform to our FineTune type
      // Filter models tagged with TrainChimp
      const formattedData = userModels
        .filter(model => model.tags.includes(COLLECTION_NAME))
        .map(item => ({
          id: item.id,
          name: item.modelId,
          baseModel: item.tags.find(tag => tag.startsWith('base-model:'))?.replace('base-model:', '') || 'Unknown',
          status: getModelStatus(item),
          createdAt: new Date(),  // Use current date as fallback
          updatedAt: new Date(item.lastModified)
        }));
      
      setFinetunes(formattedData);
    } catch (error) {
      console.error("Error fetching finetunes:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to determine model status based on model tags
  const getModelStatus = (model: { tags: string[] }): "queued" | "running" | "completed" | "failed" => {
    if (model.tags.includes('status:failed')) return "failed";
    if (model.tags.includes('status:running')) return "running";
    if (model.tags.includes('status:queued')) return "queued";
    return "completed"; // Default to completed if the model exists without status tags
  };
  
  const fetchDatasets = async () => {
    try {
      // Get the username from the token
      const username = await getHFUsername() as string;
      
      // Use the getUserDatasets function from hf.ts
      const userDatasets = await getUserDatasets({username});
      
      // Transform to the format we need
      const datasetsList = userDatasets.map(dataset => ({
        id: dataset.id,
        name: dataset.id.split('/').pop() || dataset.id
      }));
      
      setDatasets(datasetsList);
    } catch (error) {
      console.error("Error fetching datasets:", error);
    }
  };

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
      const username = await getHFUsername() as string;
      const datasetId = `${username}/${repoName}`;
      
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
      
      // Add the new dataset to the datasets list
      const newDataset = {
        id: datasetId,
        name: datasetName
      };
      
      setDatasets(prev => [...prev, newDataset]);
      
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
      
      if (!name || !baseModel || !datasetId || isNaN(epochs)) {
        throw new Error("Please fill out all required fields");
      }
      
      // Get HF token
      const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN || localStorage.getItem('hfToken');
      
      if (!hfToken) {
        throw new Error("Hugging Face token not found");
      }
      
      // Create repository name for the fine-tuned model
      const repoName = name
        .trim()
        .toLowerCase()
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-');

      const username = await getHFUsername() as string;
      const modelId = `${username}/${repoName}`;
      
      // Create model repository on Hugging Face
      const createResult = await createModelRepo({
        name: modelId,
        options: {
          description: `Fine-tuned model: ${name}`,
          private: false,
        },
        token: hfToken
      });

      await createModelCard({
        repoId: modelId,
        cardData: {
          base_model: baseModel,
          datasets: [datasetId],
          tags: [
            COLLECTION_NAME
          ],
          status: 'queued',
          queued_at: new Date().toISOString(),
          model_description: `Fine-tuned model: ${name}`,
          trainParams: {
            epochs: epochs,
            learning_rate: 0.0001,
            batch_size: 16,
            max_length: 1024
          }
        }
      });
      
      if (!createResult) {
        throw new Error("Failed to create model repository");
      }

      const gpuInstance = await startGpuInstance(modelId, 16);
      console.log(gpuInstance);

      // Close modal and refresh finetunes list
      setIsModalOpen(false);
      fetchFinetunes();
      
    } catch (error) {
      console.error("Error creating fine-tune:", error);
      alert(`Failed to create fine-tune: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle deployment modal open
  const handleDeployClick = (finetune: FineTune) => {
    setSelectedModelForDeploy(finetune);
    setIsDeployModalOpen(true);
  };
  
  // Deploy with Together AI
  const deployTogetherAI = async () => {
    if (!selectedModelForDeploy) return;
    
    try {
      setDeploymentLoading(true);
      // TODO: Implement Together AI deployment
      console.log(`Deploying ${selectedModelForDeploy.name} to Together AI`);
      
      // Simulate deployment process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert(`Successfully deployed ${selectedModelForDeploy.name} to Together AI`);
      setIsDeployModalOpen(false);
    } catch (error) {
      console.error("Error deploying to Together AI:", error);
      alert(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeploymentLoading(false);
    }
  };
  
  // Deploy with RunPod
  const deployRunPod = async () => {
    if (!selectedModelForDeploy) return;
    
    try {
      setDeploymentLoading(true);
      // TODO: Implement RunPod deployment
      console.log(`Deploying ${selectedModelForDeploy.name} to RunPod Serverless`);
      
      // Simulate deployment process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert(`Successfully deployed ${selectedModelForDeploy.name} to RunPod Serverless`);
      setIsDeployModalOpen(false);
    } catch (error) {
      console.error("Error deploying to RunPod:", error);
      alert(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeploymentLoading(false);
    }
  };
  
  // Deploy with Hugging Face
  const deployHuggingFace = async () => {
    if (!selectedModelForDeploy) return;
    
    try {
      setDeploymentLoading(true);
      // TODO: Implement HF dedicated deployment
      console.log(`Deploying ${selectedModelForDeploy.name} to Hugging Face Dedicated`);
      
      // Simulate deployment process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert(`Successfully deployed ${selectedModelForDeploy.name} to Hugging Face Dedicated`);
      setIsDeployModalOpen(false);
    } catch (error) {
      console.error("Error deploying to Hugging Face:", error);
      alert(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeploymentLoading(false);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fine-tunes</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Fine-tune
        </button>
      </div>
      
      {finetunes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-500 mb-4">
            <Plus size={24} />
          </div>
          <h3 className="text-xl font-medium mb-2">Create your first fine-tune</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Train custom models using your own data to get better results for your specific use case.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Start Fine-tuning
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Base Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {finetunes.map((finetune) => (
                <tr key={finetune.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {finetune.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {finetune.baseModel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${finetune.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : 
                        finetune.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : 
                        finetune.status === "running" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : 
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}
                    `}>
                      {finetune.status.charAt(0).toUpperCase() + finetune.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {finetune.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">
                      View
                    </button>
                    {finetune.status === "completed" && (
                      <button 
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        onClick={() => handleDeployClick(finetune)}
                      >
                        Deploy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Add a modal here for creating new fine-tunes */}
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
                      <option key={dataset.id} value={dataset.id}>
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
                
                <div>
                  <label htmlFor="epochs" className="block text-sm font-medium mb-1">
                    Epochs
                  </label>
                  <input
                    type="number"
                    id="epochs"
                    name="epochs"
                    min="1"
                    max="10"
                    defaultValue="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                  />
                </div>
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
      
      {/* Deployment Modal */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-medium">Deploy Model</h3>
                <button 
                  onClick={() => setIsDeployModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600 dark:text-gray-300">
                  Select a deployment option for {selectedModelForDeploy?.name}:
                </p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => deployTogetherAI()}
                  disabled={deploymentLoading}
                  className="w-full px-4 py-3 text-left bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <div className="font-medium">Together AI</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Deploy as LoRA to Together AI serverless</div>
                </button>
                
                <button
                  onClick={() => deployRunPod()}
                  disabled={deploymentLoading}
                  className="w-full px-4 py-3 text-left bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <div className="font-medium">RunPod Serverless</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Deploy using RunPod's serverless platform</div>
                </button>
                
                <button
                  onClick={() => deployHuggingFace()}
                  disabled={deploymentLoading}
                  className="w-full px-4 py-3 text-left bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <div className="font-medium">Hugging Face Dedicated</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Deploy to Hugging Face Inference API</div>
                </button>
              </div>
              
              {deploymentLoading && (
                <div className="mt-4 text-center">
                  <div className="inline-block animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Deploying model...</p>
                </div>
              )}
              
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsDeployModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  disabled={deploymentLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 