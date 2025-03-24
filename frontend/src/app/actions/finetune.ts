import { startGpuInstance } from "@/lib/runpod/startup";
import { calculateRequiredGpuMemory } from "@/lib/utils";
import { createModelCard, createModelRepo, getModelCard, updateModelCard } from "./hf";
import { getHFUsername } from "./hf";
import { COLLECTION_NAME } from "@/lib/types";

export async function startFinetune(name: string, baseModel: string, datasetId: string, epochs: number) {
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
      return {
        success: false,
        error: "Failed to create model repository"
      };
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
    
    const gpuMemory = calculateRequiredGpuMemory(baseModel);

    // Start GPU instance for training
    const gpuInstance = await startGpuInstance(modelId, gpuMemory);
    
    const card = await getModelCard({ repoId: modelId });
    const filteredTags = card?.tags.filter((tag: string) => !tag.startsWith("status:")) || [];
    await updateModelCard({
      repoId: modelId,
      cardData: {
        tags: [
          ...filteredTags,
          `status:provisioning gpus`,
          `costPerHr:${gpuInstance.costPerHr}`
        ]
      }
    });
    return {
        success: true,
        modelId: modelId,
        gpuInstance: gpuInstance
    }
}