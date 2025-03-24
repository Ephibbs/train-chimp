
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
  downloads: number;
  likes: number;
  updatedAt: Date;
}