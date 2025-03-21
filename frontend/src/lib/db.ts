import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

let dbInstance: Database | null = null;

// Define types
export interface JobParameters {
  epochs: number;
  [key: string]: string | number | boolean;
}

export interface JobQueueMessage {
  job_id: string;
  user_id: string;
  dataset_id: string;
  parameters: {
    base_model: string;
    epochs: number;
    [key: string]: string | number | boolean;
  };
}

export interface Job {
  id: string;
  user_id: string;
  name: string;
  dataset_id: string;
  parameters: string; // JSON string
  status: string;
  created_at: string;
}

export interface QueuedJob {
  id: string;
  job_id: string;
  message: string; // JSON string
  processed: boolean;
  created_at: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  dataset_url: string;
  created_at: string;
}

// Define storage directory
const STORAGE_DIR = path.join(process.cwd(), 'storage');

/**
 * Initialize the SQLite database connection
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  // Make sure the data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbInstance = await open({
    filename: path.join(dataDir, 'data.db'),
    driver: sqlite3.Database
  });

  await initDb(dbInstance);
  return dbInstance;
}

/**
 * Initialize database schema
 */
async function initDb(db: Database): Promise<void> {
  await db.exec(`
    -- Jobs related tables
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      parameters TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS job_queue (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      message TEXT NOT NULL,
      processed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    -- Storage related tables
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      dataset_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Ensure storage directory exists
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    // Create bucket directories
    fs.mkdirSync(path.join(STORAGE_DIR, 'datasets'), { recursive: true });
    fs.mkdirSync(path.join(STORAGE_DIR, 'models'), { recursive: true });
  }
}

// ==================== JOB RELATED FUNCTIONS ====================

/**
 * Create a new job in the database
 */
export async function createJob(
  jobId: string,
  userId: string, 
  name: string, 
  datasetId: string, 
  parameters: JobParameters
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO jobs (id, user_id, name, dataset_id, parameters, status) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      jobId,
      userId,
      name,
      datasetId,
      JSON.stringify(parameters),
      'queued'
    ]
  );
}

/**
 * Add a job to the queue
 */
export async function queueJob(
  jobId: string, 
  queueId: string,
  message: JobQueueMessage
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO job_queue (id, job_id, message, processed) 
     VALUES (?, ?, ?, ?)`,
    [queueId, jobId, JSON.stringify(message), false]
  );
}

/**
 * Get next unprocessed job from the queue
 */
export async function getNextQueuedJob(): Promise<QueuedJob | null> {
  const db = await getDb();
  const job = await db.get<QueuedJob>(
    `SELECT * FROM job_queue 
     WHERE processed = FALSE 
     ORDER BY created_at ASC 
     LIMIT 1`
  );
  
  return job || null;
}

/**
 * Mark a job as processed in the queue
 */
export async function markJobAsProcessed(queueId: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE job_queue SET processed = TRUE WHERE id = ?`,
    [queueId]
  );
}

/**
 * Update job status
 */
export async function updateJobStatus(jobId: string, status: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE jobs SET status = ? WHERE id = ?`,
    [status, jobId]
  );
}

/**
 * Get job by ID
 */
export async function getJobById(jobId: string): Promise<Job | null> {
  const db = await getDb();
  const job = await db.get<Job>(
    `SELECT * FROM jobs WHERE id = ?`,
    [jobId]
  );
  
  return job || null;
}

// ==================== DATASET RELATED FUNCTIONS ====================

/**
 * Create a new dataset
 */
export async function createDataset(
  name: string,
  description: string,
  datasetUrl: string
): Promise<{ datasetId: string | null; error: string | null }> {
  try {
    const db = await getDb();
    const datasetId = crypto.randomUUID();
    
    await db.run(
      `INSERT INTO datasets (id, name, description, dataset_url) 
       VALUES (?, ?, ?, ?)`,
      [datasetId, userId, name, description, datasetUrl]
    );
    
    return { datasetId, error: null };
  } catch (err) {
    console.error('Error creating dataset:', err);
    return { datasetId: null, error: 'Failed to create dataset' };
  }
}

/**
 * Get all datasets for a user
 */
export async function getDatasets(): Promise<Dataset[]> {
  try {
    const db = await getDb();
    
    const datasets = await db.all<Dataset[]>(
      `SELECT * FROM datasets ORDER BY created_at DESC`
    );
    
    return datasets || [];
  } catch (err) {
    console.error('Error getting user datasets:', err);
    return [];
  }
}

/**
 * Delete a dataset
 */
export async function deleteDataset(datasetId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await getDb();
    
    // Get the dataset to get its URL
    const dataset = await db.get<Dataset>(
      `SELECT * FROM datasets WHERE id = ?`,
      [datasetId]
    );
    
    if (!dataset) {
      return { success: false, error: 'Dataset not found' };
    }
    
    // Delete the dataset record
    await db.run(
      `DELETE FROM datasets WHERE id = ?`,
      [datasetId]
    );
    
    // Delete the storage object record
    await db.run(
      `DELETE FROM storage_objects WHERE path = ? AND bucket = 'datasets'`,
      [dataset.dataset_url]
    );
    
    // Delete the actual file
    const filePath = path.join(STORAGE_DIR, 'datasets', dataset.dataset_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return { success: true, error: null };
  } catch (err) {
    console.error('Error deleting dataset:', err);
    return { success: false, error: 'Failed to delete dataset' };
  }
}

// ==================== STORAGE RELATED FUNCTIONS ====================

/**
 * Upload a file to storage
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  userId: string,
  file: Buffer,
  contentType: string
): Promise<{ objectId: string | null; error: string | null }> {
  try {
    // Ensure the bucket directory exists
    const bucketDir = path.join(STORAGE_DIR, bucket);
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }
    
    // Ensure the user directory exists if the path includes a user ID
    const dirPath = filePath.split('/').slice(0, -1).join('/');
    if (dirPath) {
      const fullDirPath = path.join(bucketDir, dirPath);
      if (!fs.existsSync(fullDirPath)) {
        fs.mkdirSync(fullDirPath, { recursive: true });
      }
    }
    
    // Write the file to disk
    const fullPath = path.join(bucketDir, filePath);
    fs.writeFileSync(fullPath, file);
    
    const db = await getDb();
    const objectId = crypto.randomUUID();
    
    // Create a storage object record
    await db.run(
      `INSERT INTO storage_objects (id, bucket, path, user_id, content_type, size, metadata) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [objectId, bucket, filePath, userId, contentType, file.length, '{}']
    );
    
    return { objectId, error: null };
  } catch (err) {
    console.error('Error uploading file:', err);
    return { objectId: null, error: 'Failed to upload file' };
  }
}

/**
 * Get a file from storage
 */
export async function getFile(bucket: string, filePath: string): Promise<{ data: Buffer | null; error: string | null }> {
  try {
    const fullPath = path.join(STORAGE_DIR, bucket, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return { data: null, error: 'File not found' };
    }
    
    const data = fs.readFileSync(fullPath);
    return { data, error: null };
  } catch (err) {
    console.error('Error getting file:', err);
    return { data: null, error: 'Failed to get file' };
  }
}

/**
 * Get URL for a file
 */
export function getFileUrl(bucket: string, filePath: string): string {
  // In a real app, you would generate a proper URL based on your server setup
  return `/api/storage/${bucket}/${filePath}`;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(bucket: string, filePath: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const fullPath = path.join(STORAGE_DIR, bucket, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'File not found' };
    }
    
    fs.unlinkSync(fullPath);
    
    const db = await getDb();
    
    // Delete the storage object record
    await db.run(
      `DELETE FROM storage_objects WHERE bucket = ? AND path = ?`,
      [bucket, filePath]
    );
    
    return { success: true, error: null };
  } catch (err) {
    console.error('Error deleting file:', err);
    return { success: false, error: 'Failed to delete file' };
  }
} 