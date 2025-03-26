'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserModels, getUserDatasets, getHFUsername } from '@/app/actions/hf';
import { FineTuneHFModel } from '@/lib/types';

// Define HFDataset type based on the existing code
interface HFDataset {
  id: string;
  name: string;
  author: string;
  tags: string[];
  downloads: number;
  updatedAt: string;
}

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

// Hook to use the data context
export const useData = () => useContext(DataContext);

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [models, setModels] = useState<FineTuneHFModel[]>([]);
  const [datasets, setDatasets] = useState<HFDataset[]>([]);
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