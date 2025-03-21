"use client";

import { useState, useEffect } from "react";
import { FileUpIcon, Database, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  
  const supabase = createClient();
  
  // Fetch datasets when component mounts
  useEffect(() => {
    fetchDatasets();
  }, []);
  
  const fetchDatasets = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error("User not authenticated");
        return;
      }
      
      // Fetch datasets for the current user
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      // Transform the data to match the Dataset type
      const formattedData = data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        fileCount: 1, // You might need to count files from storage
        size: "Unknown", // You might need to calculate this
        createdAt: new Date(item.created_at),
        datasetUrl: item.dataset_url
      }));
      
      setDatasets(formattedData);
    } catch (error) {
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
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      // Upload each file to storage
      const timestamp = Date.now();
      const filePath = `${user.id}/${timestamp}-${files[0].name}`;
      const { error: uploadError } = await supabase.storage
        .from('datasets')
        .upload(filePath, files[0]);
      
      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        throw uploadError;
      }
      
      // Create dataset record in the database
      const { error } = await supabase
        .from('datasets')
        .insert({
          user_id: user.id,
          name: formData.name,
          description: formData.description,
          dataset_url: filePath
        })
        .select();
      
      if (error) {
        console.error("Error creating dataset:", error);
        throw error;
      }

      // Reset form and close modal
      setFormData({ name: "", description: "" });
      setFiles([]);
      setIsModalOpen(false);
      
      // Refresh datasets list
      fetchDatasets();
      
    } catch (error) {
      console.error("Error creating dataset:", error);
      alert("Failed to create dataset. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteDataset = async (datasetId: string, datasetUrl: string) => {
    if (!confirm("Are you sure you want to delete this dataset? This action cannot be undone.")) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Delete the file from storage
      if (datasetUrl) {
        const { error: storageError } = await supabase.storage
          .from('datasets')
          .remove([datasetUrl]);
          
        if (storageError) {
          console.error("Error deleting file from storage:", storageError);
        }
      }
      
      // Delete the dataset record
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', datasetId);
        
      if (error) {
        console.error("Error deleting dataset:", error);
        throw error;
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
  
  // Update the handleViewDataset function with better error handling
  const handleViewDataset = async (datasetUrl: string) => {
    console.log("Dataset URL:", datasetUrl);
    
    if (!datasetUrl) {
      alert("Dataset URL not available");
      return;
    }
    
    try {
      // Create a signed URL with an expiration time (more reliable than public URL)
      const { data, error } = await supabase.storage
        .from('datasets')
        .createSignedUrl(datasetUrl, 60); // Valid for 60 seconds
      
      if (error) {
        console.error("Error creating signed URL:", error);
        alert(`Error accessing file: ${error.message}`);
        return;
      }
      
      if (data?.signedUrl) {
        // Open the URL in a new tab
        window.open(data.signedUrl, '_blank');
      } else {
        alert("Failed to generate a URL for this file");
      }
    } catch (error) {
      console.error("Error viewing dataset:", error);
      alert("Failed to open the dataset file. The storage bucket might not exist.");
    }
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
                      onClick={() => handleDeleteDataset(dataset.id, dataset.datasetUrl)}
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