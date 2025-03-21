import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createJob, queueJob, JobParameters, JobQueueMessage } from '../../../lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get request data
    const body = await request.json();
    const { name, baseModel, datasetId, epochs } = body;
    
    if (!name || !baseModel || !datasetId || isNaN(epochs)) {
      return NextResponse.json(
        { error: "Please provide all required fields" },
        { status: 400 }
      );
    }
    
    const jobId = uuidv4();
    const userId = 'current-user-id'; // You would get this from auth
    
    // Create finetune record in the database
    try {
      const jobParameters: JobParameters = { epochs };
      await createJob(jobId, userId, name, datasetId, jobParameters);
    } catch (err) {
      console.error("Error creating job:", err);
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }
    
    // Add job to the queue
    try {
      const queueMessage: JobQueueMessage = {
        job_id: jobId,
        user_id: userId,
        dataset_id: datasetId,
        parameters: {
          base_model: baseModel,
          epochs
        }
      };
      
      await queueJob(jobId, uuidv4(), queueMessage);
    } catch (err) {
      console.error("Error submitting job to queue:", err);
      return NextResponse.json(
        { error: "Failed to queue job" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      jobId: jobId 
    });
    
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 