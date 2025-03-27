import { startGpuInstance } from "@/lib/runpod/startup";
import { calculateRequiredGpuMemory } from "@/lib/utils";
import { createModelCard, createModelRepo, updateModelCard } from "./hf";
import { getHFUsername } from "./hf";
import { COLLECTION_NAME } from "@/lib/types";

export async function startFinetune(name: string, baseModel: string, datasetId: string, epochs: number, advancedParams: any) {
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
    
    const card = {
        base_model: baseModel,
        datasets: [datasetId],
        tags: [
          COLLECTION_NAME,
          `status:queued`,
          `queued_at:${new Date().toISOString()}`
        ],
        model_description: `Fine-tuned model: ${name}`,
        trainParams: advancedParams
      };
    // Create model card with metadata
    await createModelCard({
      repoId: modelId,
      cardData: card
    });
    
    const gpuMemory = calculateRequiredGpuMemory(baseModel);

    // Start GPU instance for training
    const gpuInstance = await startGpuInstance(modelId, gpuMemory);
    card.tags.push(`costPerHr:${gpuInstance.costPerHr}`);
    card.tags.push(`gpu:${gpuInstance.instanceType}`);
    await updateModelCard({
      repoId: modelId,
      cardData: card
    });
    return {
        success: true,
        modelId: modelId,
        gpuInstance: gpuInstance
    }
}