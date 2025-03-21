"use client";

import { useState, useEffect } from "react";
import { FileUpIcon, Database, Plus } from "lucide-react";
import { 
  getUserDatasets, 
  createDatasetRepo, 
  uploadFileToDataset, 
  deleteDatasetRepo, 
  COLLECTION_NAME,
  getHFUsername,
  createDatasetCard
} from "@/lib/hf";
// Import any additional dependencies as needed

type Dataset = {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  size: string;
  createdAt: Date;
  datasetUrl: string;
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  
  // Fetch datasets when component mounts
  useEffect(() => {
    fetchDatasets();
  }, []);
  
  // Fetch datasets from Hugging Face
  const fetchDatasets = async () => {
    try {
      setIsLoading(true);
      
      // Get the username from the token
      const username = await getHFUsername() as string;
      
      // Use the getUserDatasets function from hf.ts
      const userDatasets = await getUserDatasets({username});
      
      // Transform to our Dataset type
      const formattedDatasets: Dataset[] = userDatasets.map(ds => ({
        id: ds.id,
        name: ds.id,
        description: '', // No description from HF API function, use empty string
        fileCount: 1, // Set default since we don't have this info
        size: '0 Bytes', // Set default since we don't have this info
        createdAt: new Date(ds.lastModified),
        datasetUrl: `https://huggingface.co/datasets/${ds.id}`
      }));
      
      setDatasets(formattedDatasets);
      
    } catch (error: unknown) {
      console.error("Error fetching datasets:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
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
        
      const username = await getHFUsername();
      const datasetId = `${username}/${repoName}`;
      
      // 1. Create the dataset repository on Hugging Face
      const createResult = await createDatasetRepo({
        name: repoName,
        options: {
          description: formData.description,
          private: false,
          tags: [COLLECTION_NAME]
        },
        token: hfToken
      });
      
      if (!createResult) {
        throw new Error("Failed to create dataset repository");
      }

      // 2. Tag it as a TrainChimp dataset
      await createDatasetCard({
        repoId: datasetId,
        cardData: {
          tags: [COLLECTION_NAME],
          dataset_description: formData.description
        },
        token: hfToken
      });
      
      // 3. Upload the files to the dataset
      for (const file of files) {
        const uploadSuccess = await uploadFileToDataset({
          repoId: datasetId,
          filePath: file.name,
          fileContent: file,
          token: hfToken
        });
        
        if (!uploadSuccess) {
          throw new Error(`Failed to upload file: ${file.name}`);
        }
      }
      
      // Reset form and close modal
      setFormData({ name: "", description: "" });
      setFiles([]);
      setIsModalOpen(false);
      
      // Refresh datasets list
      fetchDatasets();
      
    } catch (error: unknown) {
      console.error("Error creating dataset:", error);
      alert(`Failed to create dataset: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm("Are you sure you want to delete this dataset? This action cannot be undone.")) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Delete the dataset using our utility function
      const deleteSuccess = await deleteDatasetRepo({
        repoId: datasetId
      });
      
      if (!deleteSuccess) {
        throw new Error("Failed to delete dataset");
      }
      
      // Update the UI
      setDatasets(prev => prev.filter(dataset => dataset.id !== datasetId));
      
    } catch (error) {
      console.error("Error deleting dataset:", error);
      alert("Failed to delete dataset. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewDataset = async (datasetUrl: string) => {
    if (!datasetUrl) {
      alert("Dataset URL not available");
      return;
    }
    
    // Simply open the Hugging Face dataset URL
    window.open(datasetUrl, '_blank');
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Datasets</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Dataset
        </button>
      </div>
      
      {isLoading && datasets.length === 0 ? (
        <div className="text-center py-8">
          <p>Loading datasets...</p>
        </div>
      ) : datasets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-500 mb-4">
            <Database size={24} />
          </div>
          <h3 className="text-xl font-medium mb-2">Create your first dataset</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Upload your training data to fine-tune custom models tailored to your needs.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Create Dataset
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
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Files
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Size
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
              {datasets.map((dataset) => (
                <tr key={dataset.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {dataset.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {dataset.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {dataset.fileCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {dataset.size}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {dataset.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button 
                      onClick={() => handleViewDataset(dataset.datasetUrl)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                    >
                      View
                    </button>
                    <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">
                      Use
                    </button>
                    <button 
                      onClick={() => handleDeleteDataset(dataset.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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