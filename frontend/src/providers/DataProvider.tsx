'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserModels, getUserDatasets, getHFUsername } from '@/app/actions/hf';
import { FineTuneHFModel, HFDataset } from '@/lib/types';
import { getAllTogetherAIModels } from '@/app/actions/deployment';

// Define interface for the context
interface DataContextType {
  models: FineTuneHFModel[];
  datasets: HFDataset[];
  isLoadingModels: boolean;
  isLoadingDatasets: boolean;
  refreshModels: () => Promise<void>;
  refreshDatasets: () => Promise<void>;
  hfUsername: string | null;
}

// Create context with default values
const DataContext = createContext<DataContextType>({
  models: [],
  datasets: [],
  isLoadingModels: true,
  isLoadingDatasets: true,
  refreshModels: async () => {},
  refreshDatasets: async () => {},
  hfUsername: null,
});

interface ProcessedTogetherAIModel {
  display_name: string;
}

// Hook to use the data context
export const useData = () => useContext(DataContext);

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [models, setModels] = useState<FineTuneHFModel[]>([]);
  const [datasets, setDatasets] = useState<HFDataset[]>([]);
  const [togetherModels, setTogetherModels] = useState<ProcessedTogetherAIModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true);
  const [hfUsername, setHFUsername] = useState<string | null>(null);
  useEffect(() => {
    const fetchHFUsername = async () => {
      const hfUsername = await getHFUsername();
      if (!hfUsername) {
        console.error("Hugging Face username not found");
      }
      setHFUsername(hfUsername);
    };
    fetchHFUsername();
  }, []);
  
  // Function to fetch models
  const fetchModels = async (username: string | null) => {
    try {
      if (!username) {
        console.error("Hugging Face username not found");
        return;
      }
      const data = await getUserModels({ username: username });
      setModels(data);
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    // Check if any of the Together AI models match our fine-tuned models
    // and mark them as deployed to Together AI
    if (togetherModels && togetherModels.length > 0 && models && models.length > 0) {
      // Create a map for O(1) lookups
      const togetherModelMap = new Map(
        togetherModels.map(model => [model.display_name, model.id])
      );

      const updatedModels = models.map(model => {
        const togetherModelName = togetherModelMap.get(model.name);
        console.log(model.name, togetherModelName);
        if (togetherModelName) {
          console.log(togetherModelName);
          return {
            ...model,
            together_deployed: togetherModelName
          };
        }
        return model;
      });
      
      setModels(updatedModels);
    }
  }, [togetherModels, models.length]);

  const fetchTogetherModels = async () => {
    const data = await getAllTogetherAIModels();
    setTogetherModels(data);
  }
  
  // Function to fetch datasets
  const fetchDatasets = async (username: string | null) => {
    try {
      if (!username) {
        console.error("Hugging Face username not found");
        return;
      }
      const data = await getUserDatasets({ username: username });
      setDatasets(data);
    } catch (error) {
      console.error('Error fetching datasets:', error);
    } finally {
      setIsLoadingDatasets(false);
    }
  };
  
  // Initial data fetching
  useEffect(() => {
    if (hfUsername) {
      fetchModels(hfUsername);
      fetchDatasets(hfUsername);
      fetchTogetherModels();
    }
  }, [hfUsername]);
  
  // Polling for models with adaptive interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const setupPolling = async () => {
      // Check if any model is in an active state (not completed or failed)
      const hasActiveModel = models.some(model => 
        !['completed', 'failed'].includes(model.status)
      );
      
      // Set polling interval: 5s if active models, 30s otherwise
      const pollingInterval = hasActiveModel ? 5000 : 30000;
      
      interval = setInterval(() => {
        fetchModels(hfUsername);
      }, pollingInterval);
    };
    
    setupPolling();
    
    // Cleanup on unmount
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [models, hfUsername]);
  
  // Polling for datasets (always every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDatasets(hfUsername);
    }, 30000);
    
    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [hfUsername]);
  
  // Context value
  const value = {
    models,
    datasets,
    isLoadingModels,
    isLoadingDatasets,
    hfUsername,
    refreshModels: async () => { await fetchModels(hfUsername); },
    refreshDatasets: async () => { await fetchDatasets(hfUsername); },
  };
  
  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
} 