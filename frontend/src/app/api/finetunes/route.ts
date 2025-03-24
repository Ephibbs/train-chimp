import { NextResponse } from 'next/server';
import { 
  createModelRepo, 
  createModelCard, 
  getHFUsername,
  COLLECTION_NAME 
} from '@/lib/hf';
import { startGpuInstance } from '@/lib/runpod/startup';

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { name, baseModel, datasetId, epochs } = body;
    
    // Validate required fields
    if (!name || !baseModel || !datasetId || isNaN(epochs)) {
      return NextResponse.json(
        { error: "Please provide all required fields" },
        { status: 400 }
      );
    }
    
    // Create repository name for the fine-tuned model
    const repoName = name
      .trim()
      .toLowerCase()
      .replace(/[^\w-]/g, '-')
      .replace(/-+/g, '-');

    const username = await getHFUsername() as string;
    const modelId = `${username}/${repoName}`;
    
    // Create model repository on Hugging Face
    const createResult = await createModelRepo({
      name: modelId,
      options: {
        description: `Fine-tuned model: ${name}`,
        private: false,
      }
    });

    if (!createResult) {
      return NextResponse.json(
        { error: "Failed to create model repository" },
        { status: 500 }
      );
    }
    
    // Create model card with metadata
    await createModelCard({
      repoId: modelId,
      cardData: {
        base_model: baseModel,
        datasets: [datasetId],
        tags: [
          COLLECTION_NAME,
          `status:queued`,
          `queued_at:${new Date().toISOString()}`
        ],
        model_description: `Fine-tuned model: ${name}`,
        trainParams: {
          epochs: epochs,
          learning_rate: 0.0001,
          batch_size: 16,
          max_length: 1024
        }
      }
    });
    
    // Start GPU instance for training
    const gpuInstance = await startGpuInstance(modelId, 16);
    
    // Return success response with model ID and instance information
    return NextResponse.json({
      success: true,
      modelId: modelId,
      gpuInstance: gpuInstance
    });

  } catch (error) {
    console.error("Error creating fine-tune:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 