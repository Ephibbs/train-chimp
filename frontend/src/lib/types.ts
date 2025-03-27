
export enum JobStatus {
  QUEUED = 'queued',
  PROVISIONING = 'provisioning',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export const COLLECTION_NAME = 'TrainChimp';

export interface FineTuneHFModel {
  id: string;
  name: string;
  author: string;
  tags: string[];
  status: "queued" | "provisioning" | "loading model" | "training" | "completed" | "failed" | "unknown";
  baseModel: string;
  dataset: string;
  downloads: number;
  likes: number;
  updatedAt: Date;
}

// Interface definitions for HF data
export interface HFModel {
  id: string;
  modelId: string;
  author: string;
  tags: string[];
  downloads: number;
  likes: number;
  lastModified: string;
}

export interface HFDataset {
  id: string;
  name: string;
  author: string;
  tags: string[];
  downloads: number;
  updatedAt: Date;
}
