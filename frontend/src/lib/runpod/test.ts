import { getHFUsername, createModelRepo, createModelCard } from '../hf';
import { startGpuInstance, calculateRequiredGpuMemory } from './startup';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../../.env.local' });

/**
 * Test function to start a RunPod instance for model training
 */
async function testRunpodStartup() {
  try {
    console.log('Starting RunPod startup test...');

    const name = 'test-model';
    const datasetId = 'evanphibbs/aaa';

    // Test parameters - using a small model for testing
    const baseModel = 'meta-llama/Llama-3.2-1B-Instruct'; // Small model for testing
    const modelParametersBillions = 1.23; // 1B parameters = 1.0B
    
    // Create repository name for the fine-tuned model
      const repoName = name
        .trim()
        .toLowerCase()
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-');

      const username = await getHFUsername({token: process.env.NEXT_PUBLIC_HF_TOKEN}) as string;
      const modelId = `${username}/${repoName}`;
      
      // Create model repository on Hugging Face
      const createResult = await createModelRepo({
        name: modelId,
        options: {
          description: `Fine-tuned model: ${name}`,
          private: false,
        },
        token: process.env.NEXT_PUBLIC_HF_TOKEN
      });

      await createModelCard({
        repoId: modelId,
        cardData: {
          base_model: baseModel,
          datasets: [datasetId],
          tags: [
            'trainchimp',
            `status:queued`,
            `queued_at:${new Date().toISOString()}`
          ],
          model_description: `Fine-tuned model: ${name}`,
          trainParams: {
            epochs: 1,
            learning_rate: 0.0001,
            batch_size: 16,
            max_length: 1024
          }
        },
        token: process.env.NEXT_PUBLIC_HF_TOKEN
      });
      
      if (!createResult) {
        throw new Error("Failed to create model repository");
      }

    // Calculate required GPU memory based on model size
    const requiredGpuMemoryGB = calculateRequiredGpuMemory(baseModel, modelParametersBillions);
    console.log(`Estimated required GPU memory: ${requiredGpuMemoryGB}GB`);
    
    // Start the GPU instance
    console.log(`Starting GPU instance for model: ${modelId}`);
    const podInfo = await startGpuInstance(modelId, requiredGpuMemoryGB, process.env.NEXT_PUBLIC_RUNPOD_API_KEY);
    
    // Log the successful result
    console.log('Pod successfully started:');
    console.log(`Pod ID: ${podInfo.podId}`);
    console.log(`Instance Type: ${podInfo.instanceType}`);
    console.log(`Public IP: ${podInfo.publicIpAddress || 'Not available yet'}`);
    console.log(`Status: ${podInfo.status}`);
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Execute the test
testRunpodStartup();

// // For direct script execution with: ts-node test.ts
// if (require.main === module) {
//   testRunpodStartup();
// }

export { testRunpodStartup };
