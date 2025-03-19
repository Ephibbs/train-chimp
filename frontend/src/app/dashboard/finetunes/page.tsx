"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

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
  const [datasetOption, setDatasetOption] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (file: File, datasetName: string) => {
    try {
      setIsUploading(true);
      setUploadError(null);
      
      // Get presigned URL
      const presignedUrlResponse = await fetch("/api/datasets/presigned-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename: `${datasetName}.jsonl` }),
      });

      if (!presignedUrlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { presignedUrl } = await presignedUrlResponse.json();

      // Upload file using presigned URL with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      await new Promise((resolve, reject) => {
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", "application/json");
        
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      setSelectedFile(null);
      setUploadProgress(0);
      // You might want to refresh the finetunes list here
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadError(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    
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
                      <button className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">
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
              <form className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                    placeholder="My Custom Model"
                  />
                </div>
                <div>
                  <label htmlFor="base-model" className="block text-sm font-medium mb-1">
                    Base Model
                  </label>
                  <select
                    id="base-model"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                  >
                    <option value="mistralai/Mistral-7B-v0.1">Mistral 7B</option>
                    <option value="meta-llama/Llama-2-7b">Meta Llama 2 7B</option>
                    <option value="microsoft/phi-2">Microsoft Phi-2</option>
                    <option value="meta-llama/Llama-2-13b">Meta Llama 2 13B</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="dataset" className="block text-sm font-medium mb-1">
                    Dataset
                  </label>
                  <select
                    id="dataset"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                    value={datasetOption}
                    onChange={(e) => setDatasetOption(e.target.value)}
                  >
                    <option value="">Select a dataset</option>
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
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create
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