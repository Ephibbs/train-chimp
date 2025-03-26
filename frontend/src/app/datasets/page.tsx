"use client";

import { useState, useEffect } from "react";
import { FileUpIcon, Database, Plus } from "lucide-react";
import { 
  createDatasetRepo, 
  uploadFileToDataset, 
  deleteDatasetRepo, 
  createDatasetCard
} from "@/app/actions/hf";
import { COLLECTION_NAME } from "@/lib/types";
import { useData } from "@/providers/DataProvider";
// Import any additional dependencies as needed

type Dataset = {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  size: string;
  updatedAt: Date;
  datasetUrl: string;
};

export default function DatasetsPage() {
  const { datasets: userDatasets, isLoadingDatasets, refreshDatasets, hfUsername } = useData();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  
  // Transform datasets from provider to our local format
  useEffect(() => {
    if (userDatasets && userDatasets.length > 0) {
      const formattedDatasets: Dataset[] = userDatasets.map(ds => ({
        id: ds.id,
        name: ds.name,
        description: '', // No description from HF API function, use empty string
        fileCount: 1, // Set default since we don't have this info
        size: '0 Bytes', // Set default since we don't have this info
        updatedAt: ds.updatedAt,
        datasetUrl: `https://huggingface.co/datasets/${ds.name}`
      }));

      // Sort datasets by updatedAt in descending order (newest first)
      formattedDatasets.sort((a, b) => {
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      
      setDatasets(formattedDatasets);
    }
  }, [userDatasets]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };
  
  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || files.length === 0) {
      alert("Please provide a name and upload at least one file");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get the HF token
      const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN || localStorage.getItem('hfToken');
      
      if (!hfToken) {
        throw new Error("Hugging Face token not found");
      }
      
      // Create dataset repository name (sanitize the name for URL safety)
      const repoName = formData.name
        .trim()
        .toLowerCase()
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-');
        
      const datasetId = `${hfUsername}/${repoName}`;
      
      // 1. Create the dataset repository on Hugging Face
      const createResult = await createDatasetRepo({
        name: datasetId,
        options: {
          description: formData.description,
          private: false,
        }
      });

      console.log("Create result:", createResult);
      const name = createResult?.id.split('/').pop();
      const repoId = `${hfUsername}/${name}`;
      
      if (!createResult) {
        throw new Error("Failed to create dataset repository");
      }

      // 2. Tag it as a TrainChimp dataset
      await createDatasetCard({
        repoId: repoId,
        cardData: {
          tags: [COLLECTION_NAME],
          dataset_description: formData.description
        }
      });
      
      // 3. Upload the files to the dataset
      for (const file of files) {
        const uploadSuccess = await uploadFileToDataset({
          repoId: repoId,
          filePath: file.name,
          fileContent: file,
        });
        
        if (!uploadSuccess) {
          throw new Error(`Failed to upload file: ${file.name}`);
        }
      }
      
      // Reset form and close modal
      setFormData({ name: "", description: "" });
      setFiles([]);
      setIsModalOpen(false);
      
      // Refresh datasets from the provider
      refreshDatasets();
      
    } catch (error: unknown) {
      console.error("Error creating dataset:", error);
      alert(`Failed to create dataset: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteDataset = async (name: string) => {
    if (!confirm("Are you sure you want to delete this dataset? This action cannot be undone.")) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Delete the dataset using our utility function
      const deleteSuccess = await deleteDatasetRepo({
        name: name
      });
      
      if (!deleteSuccess) {
        throw new Error("Failed to delete dataset");
      }
      
      // Refresh the datasets list from the provider
      refreshDatasets();
      
    } catch (error: unknown) {
      console.error("Error deleting dataset:", error);
      alert(`Failed to delete dataset: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  console.log(datasets);
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Datasets</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Dataset
        </button>
      </div>

      {isLoadingDatasets && datasets.length === 0 ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-2">No Datasets Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You haven&apos;t created any datasets yet. Get started by creating your first dataset.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Create Dataset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {datasets.map((dataset) => (
            <div
              key={dataset.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-lg font-medium mb-2">{dataset.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">
                  {dataset.description || "No description provided"}
                </p>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Database className="h-4 w-4 text-blue-500 mr-2" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {dataset.fileCount} file{dataset.fileCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {dataset.updatedAt?.toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <a
                    href={dataset.datasetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    View on HF
                  </a>
                  <button
                    onClick={() => handleDeleteDataset(dataset.name)}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dataset creation modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-medium">Create New Dataset</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleCreateDataset}>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                    placeholder="My Training Dataset"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                    placeholder="A brief description of your dataset"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Upload Files
                  </label>
                  <div 
                    className="mt-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md px-6 pt-5 pb-6 flex justify-center"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <div className="space-y-1 text-center">
                      <FileUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600 dark:text-gray-400">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                        >
                          <span>Upload files</span>
                          <input 
                            id="file-upload" 
                            name="file-upload" 
                            type="file" 
                            multiple 
                            className="sr-only" 
                            onChange={handleFileChange}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        JSONL, CSV, or TXT up to 50MB
                      </p>
                      {files.length > 0 && (
                        <div className="mt-2 text-sm text-left">
                          <p className="font-medium">Selected files:</p>
                          <ul className="list-disc pl-5">
                            {files.map((file, index) => (
                              <li key={index}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
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
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 