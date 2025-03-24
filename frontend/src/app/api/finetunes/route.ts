import { NextResponse } from 'next/server';
import { 
  createModelRepo, 
  createModelCard, 
  getHFUsername,
  getUserModels,
  COLLECTION_NAME 
} from '@/lib/hf';
import { startGpuInstance } from '@/lib/runpod/startup';

export async function GET() {
  try {
    // Get user models from Hugging Face
    const userModels = await getUserModels();

    console.log("User models:", userModels);
    
    if (!userModels) {
      return NextResponse.json(
        { error: "Failed to fetch models" },
        { status: 500 }
      );
    }
    
    // Transform to the FineTune type format
    const formattedData = userModels.map(item => {
      const modelTag = item.tags.find(tag => tag.startsWith('base_model:'));
      const baseModel = modelTag?.replace('base_model:', '') || 'Unknown';
      
      return {
        id: item.id,
        name: item.name,
        baseModel: baseModel,
        status: getModelStatus(item),
        createdAt: new Date(),  // Use current date as fallback
        updatedAt: new Date(item.lastModified)
      };
    });
    
    // Return formatted data
    return NextResponse.json(formattedData);
    
  } catch (error) {
    console.error("Error fetching finetunes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to determine model status based on model tags
function getModelStatus(model: { tags: string[] }): string {
  if (model.tags.includes('status:failed')) return "failed";
  if (model.tags.includes('status:provisioning')) return "provisioning";
  if (model.tags.includes('status:loading_model')) return "loading_model";
  if (model.tags.includes('status:training')) return "training";
  if (model.tags.includes('status:queued')) return "queued";
  if (model.tags.includes('status:completed')) return "completed";
  return "completed"; // Default to completed if the model exists without status tags
}

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