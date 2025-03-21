import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get request data
    const body = await request.json();
    const { name, baseModel, datasetId, epochs } = body;
    
    if (!name || !baseModel || !datasetId || isNaN(epochs)) {
      return NextResponse.json(
        { error: "Please provide all required fields" },
        { status: 400 }
      );
    }
    
    // Create finetune record in the database
    const { data: finetune, error } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        name,
        dataset_id: datasetId,
        parameters: {
          epochs
        },
        status: 'queued'
      })
      .select('id')
      .single();
    
    if (error) {
      console.error("Error creating job:", error);
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }
    
    // Submit job to the Supabase queue using direct SQL for PGMQ
    const { error: queueError } = await supabase
      .schema('pgmq_public')
      .rpc('send', {
        queue_name: 'train-jobs',
        message: {
          job_id: finetune.id,
          user_id: user.id,
          dataset_id: datasetId,
          parameters: {
            base_model: baseModel,
            epochs
          }
        }
      });

    
    
    if (queueError) {
      console.error("Error submitting job to queue:", queueError);
      return NextResponse.json(
        { error: "Failed to queue job" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      jobId: finetune.id 
    });
    
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 