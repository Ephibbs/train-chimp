"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, GitBranch, Award, Clock, Download, Heart, ExternalLink } from "lucide-react";
import { getUserModels } from "@/app/actions/hf";
import { FineTuneHFModel } from "@/lib/types";

// Define the props for this component
interface FineTuneDetailsPageProps {
  params: {
    id: string;
  };
}

export default function FineTuneDetailsPage({ params }: FineTuneDetailsPageProps) {
  const { id: nameList } = use(params) as { id: string[] };
  const id = nameList[0] + "/" + nameList[1];
  const [finetune, setFinetune] = useState<FineTuneHFModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFineTuneDetails();
  }, [id]);

  // Set up polling for models that are still processing
  useEffect(() => {
    // Only poll if the finetune is in a processing state
    if (finetune && ["queued", "provisioning", "loading_model", "training"].includes(finetune.status)) {
      const pollingInterval = setInterval(() => {
        fetchFineTuneDetails();
      }, 10000); // Poll every 10 seconds
      
      // Clean up the interval when component unmounts or status changes
      return () => clearInterval(pollingInterval);
    }
  }, [finetune]);

  const fetchFineTuneDetails = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all finetunes
        const finetunes = await getUserModels();
        
        // Find the specific finetune by ID (which is the name in our case)
        const foundFinetune = finetunes.find(
          (ft) => ft.name === id || ft.id === id
        );
        
        if (foundFinetune) {
          setFinetune(foundFinetune);
        } else {
          setError("Fine-tune not found");
        }
      } catch (err) {
        setError("Failed to load fine-tune details");
        console.error("Error fetching fine-tune details:", err);
      } finally {
        setIsLoading(false);
      }
    };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error || !finetune) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <div className="flex items-center mb-6">
            <Link href="/finetunes" className="flex items-center text-blue-500 hover:text-blue-700">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Fine-tunes
            </Link>
          </div>
          <div className="text-center py-8">
            <h3 className="text-xl font-medium mb-2 text-red-600 dark:text-red-400">
              {error || "Fine-tune not found"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Unable to load the requested fine-tune. Please try again later or check the ID.
            </p>
            <Link
              href="/finetunes"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Return to Fine-tunes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Extract metadata from tags
  const metadataFromTags = finetune.tags.reduce((acc, tag) => {
    const key = tag.split(':')[0];
    const value = tag.substring(tag.indexOf(':') + 1);
    if (value.startsWith("finetune:")) {
      // Skip this tag as it's a prefix
      return acc;
    }
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);

  // Get error details if status is failed
  const errorDetails = finetune.status === "failed" ? metadataFromTags.error_details : null;

  // Helper function to ensure date strings end with 'Z' for UTC
  const ensureUTC = (dateString: string) => {
    if (!dateString) return dateString;
    return dateString.endsWith('Z') ? dateString : `${dateString}Z`;
  };

  // Helper function to format time duration
  const formatDuration = (startDate: Date, endDate: Date) => {
    const diffMs = endDate.getTime() - startDate.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Timeline dates
  const queuedAt = metadataFromTags.queued_at ? new Date(ensureUTC(metadataFromTags.queued_at)) : null;
  const startedAt = metadataFromTags.started_at ? new Date(ensureUTC(metadataFromTags.started_at)) : null;
  const startedTrainingAt = metadataFromTags.started_training_at ? new Date(ensureUTC(metadataFromTags.started_training_at)) : null;
  const completedAt = metadataFromTags.completed_at ? new Date(ensureUTC(metadataFromTags.completed_at)) : null;
  
  // Other metadata
  const costPerHour = metadataFromTags.costPerHour ? parseFloat(metadataFromTags.costPerHour) : null;
  const dataset = metadataFromTags.dataset || '';
  const baseModel = metadataFromTags.base_model || '';

  // Calculate total cost
  let totalCost = null;
  if (costPerHour !== null && queuedAt && completedAt) {
    const durationMinutes = (completedAt.getTime() - queuedAt.getTime()) / (1000 * 60);
    totalCost = (costPerHour / 60) * durationMinutes;
  }

  const timeInCurrentState = finetune.status === "queued" ? formatDuration(queuedAt!, new Date()) : 
    finetune.status === "provisioning" ? formatDuration(startedAt!, new Date()) : 
    finetune.status === "loading_model" ? formatDuration(startedTrainingAt!, new Date()) : 
    finetune.status === "training" ? formatDuration(startedTrainingAt!, new Date()) : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
        <div className="flex items-center mb-6">
          <Link href="/finetunes" className="flex items-center text-blue-500 hover:text-blue-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Fine-tunes
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row items-start gap-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{finetune.name}</h1>
            <div className="flex items-center mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">by {finetune.author}</span>
            </div>
            
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex items-center">
                <Heart className="h-4 w-4 text-red-500 mr-1" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{finetune.likes} likes</span>
              </div>
              <div className="flex items-center">
                <Download className="h-4 w-4 text-gray-500 mr-1" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{finetune.downloads} downloads</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-gray-500 mr-1" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Updated {finetune.updatedAt.toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-medium">Status</h3>
              </div>
              <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full 
                ${finetune.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : 
                  finetune.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : 
                  finetune.status === "training" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : 
                  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}
              `}>
                {finetune.status.charAt(0).toUpperCase() + finetune.status.slice(1)}
                {timeInCurrentState && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  ({timeInCurrentState})
                </span>}
              </span>
              {errorDetails && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Error: {errorDetails}
                  </p>
                </div>
              )}
            </div>
            
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <GitBranch className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-medium">Base Model</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                {baseModel || finetune.baseModel}
              </p>
            </div>
            
            {/* Training Timeline Section */}
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <Clock className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-medium">Training Timeline</h3>
              </div>
              <div className="relative pb-4">
                {/* Timeline vertical line */}
                <div className="absolute left-4 top-0 bottom-10 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                
                {/* Queued */}
                {queuedAt && (
                  <div className="relative flex items-start mb-6 pl-12">
                    <div className="absolute left-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Queued</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {queuedAt.toLocaleString()}
                         {queuedAt && startedAt && <span className="ml-2 text-xs text-blue-500">
                          (Setup took {formatDuration(queuedAt, startedAt)})
                        </span>}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Started */}
                {startedAt && (
                  <div className="relative flex items-start mb-6 pl-12">
                    <div className="absolute left-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
                      <ArrowLeft className="h-4 w-4 text-indigo-600 dark:text-indigo-300 rotate-45" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Loading Model</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {startedAt.toLocaleString()}
                        {startedAt && startedTrainingAt && <span className="ml-2 text-xs text-blue-500">
                          (Model loading took {formatDuration(startedAt, startedTrainingAt)})
                        </span>}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Started Training */}
                {startedTrainingAt && (
                  <div className="relative flex items-start mb-6 pl-12">
                    <div className="absolute left-0 w-8 h-8 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                      <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Started Training</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {startedTrainingAt.toLocaleString()}
                        {startedTrainingAt && completedAt && <span className="ml-2 text-xs text-blue-500">
                          (Training took {formatDuration(startedTrainingAt, completedAt)})
                        </span>}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Completed */}
                {completedAt && (
                  <div className="relative flex items-start pl-12">
                    <div className="absolute left-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                      <Award className="h-4 w-4 text-green-600 dark:text-green-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Completed</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {completedAt.toLocaleString()}
                      </p>
                      {queuedAt && <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                        Total time: {formatDuration(queuedAt, completedAt)}
                      </p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Additional Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {costPerHour !== null && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <Download className="h-4 w-4 text-gray-500 mr-1" />
                    Cost Per Hour
                  </div>
                  <div className="text-md font-medium text-gray-800 dark:text-gray-200">
                    ${costPerHour.toFixed(2)}
                  </div>
                  {totalCost !== null && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Total: ${totalCost.toFixed(2)} ({Math.round((completedAt!.getTime() - queuedAt!.getTime()) / (1000 * 60))} minutes)
                    </div>
                  )}
                </div>
              )}
              
              {dataset && (
                <a 
                  href={`https://huggingface.co/datasets/${dataset}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-600 transition duration-200"
                >
                  <div className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <GitBranch className="h-4 w-4 text-gray-500 mr-1" />
                    Dataset
                  </div>
                  <div className="text-md font-medium text-gray-800 dark:text-gray-200 flex items-center">
                    {dataset}
                    <ExternalLink className="h-3 w-3 ml-1 text-gray-400" />
                  </div>
                </a>
              )}
              
              {baseModel && (
                <a 
                  href={`https://huggingface.co/${baseModel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-600 transition duration-200"
                >
                  <div className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <ExternalLink className="h-4 w-4 text-gray-500 mr-1" />
                    Base Model
                  </div>
                  <div className="text-md font-medium text-gray-800 dark:text-gray-200 flex items-center">
                    {baseModel}
                    <ExternalLink className="h-3 w-3 ml-1 text-gray-400" />
                  </div>
                </a>
              )}
            </div>
          </div>
          
          <div className="w-full md:w-1/3 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Actions</h3>
              
              <div className="space-y-3">
                <a
                  href={`https://huggingface.co/${finetune.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Hugging Face
                </a>
                
                {finetune.status === "completed" && (
                  <button className="flex items-center justify-center w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">
                    Deploy Model
                  </button>
                )}
                
                <button className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                  Delete Model
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 