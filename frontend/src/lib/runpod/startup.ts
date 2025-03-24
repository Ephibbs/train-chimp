import axios from 'axios';
import { updateModelCard, getModelCard } from '../hf';

/**
 * Starts a RunPod GPU instance based on base model and required GPU memory
 * @param baseModel The name of the base model to use
 * @param requiredGpuMemoryGB The amount of GPU memory required in GB
 * @param jobId Optional job ID to pass to the instance
 * @returns Information about the launched pod
 */
export async function startGpuInstance(
  model_id: string,
  requiredGpuMemoryGB: number,
  token?: string
): Promise<{
  podId: string;
  instanceType: string;
  publicIpAddress?: string;
  status: string;
}> {
  // Create RunPod API client
  const apiKey = process.env.NEXT_PUBLIC_RUNPOD_API_KEY || token || '';
  const apiClient = axios.create({
    baseURL: 'https://rest.runpod.io/v1',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log("Created RunPod API client");

  // Select GPU type based on required GPU memory
  const gpuType = selectGpuType(requiredGpuMemoryGB);

  console.log("Selected GPU type:", gpuType);

  // Environment variables to pass to the container
  const envVariables = { 
    'HF_TOKEN': process.env.NEXT_PUBLIC_HF_TOKEN,
    'WANDB_API_KEY': process.env.NEXT_PUBLIC_WANDB_API_KEY,
    'MODEL_NAME': model_id,
    'GITHUB_COMMIT': process.env.NEXT_PUBLIC_GITHUB_COMMIT || 'main' 
  };

  const startupCommands = generateStartupCommands(model_id);

  console.log("Generated startup commands");

  // Configure pod launch parameters according to RunPod API docs
  const params = {
    name: `TrainChimp-${model_id}-${Date.now()}`,
    imageName: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
    gpuCount: 1,
    gpuTypeIds: [gpuType], // Using gpuTypeId as per API docs
    volumeInGb: 100,
    containerDiskInGb: 50,
    supportPublicIp: true,
    env: envVariables,
    dockerArgs: '',
    dockerStartCmd: startupCommands,
    ports: ['22/tcp', '8888/tcp', '3000/tcp'],
    volumeMountPath: '/workspace',
    cloudType: 'SECURE', // Use COMMUNITY or SECURE
  };

  console.log("Launching pod with params:", params);

  try {
    // Launch the pod
    const response = await apiClient.post('/pods', params);
    const data = response.data;

    console.log("Launched pod", data);

    if (!data.id) {
      throw new Error(`Failed to launch RunPod instance: ${data.error || 'Unknown error'}`);
    }

    const podId = data.id;

    // Poll for pod status until it's ready
    let podStatus = 'PENDING';
    let publicIpAddress;
    let attempts = 0;
    const maxAttempts = 30;
    const pollingIntervalMs = 10000; // 10 seconds

    while (podStatus !== 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));
      
      const statusResponse = await apiClient.get(`/pods/${podId}`);
      const podData = statusResponse.data;

      console.log("Pod data:", podData);
      
      if (podData.success && podData.pod) {
        podStatus = podData.pod.status;
        publicIpAddress = podData.pod.publicIpAddress;
        
        // Log the current status
        console.log(`Pod ${podId} status: ${podStatus} (attempt ${attempts + 1}/${maxAttempts})`);
      }
      
      attempts++;
    }

    if (podStatus !== 'RUNNING') {
      throw new Error('Pod did not reach RUNNING state within the expected time');
    }

    console.log(`Pod ${podId} launched successfully`);

    // Get Model card from Hugging Face
    const modelCard = await getModelCard({ repoId: model_id });
    if (!modelCard) {
        throw new Error('Model card not found');
    }
    modelCard.tags = modelCard.tags.filter(tag => !tag.startsWith('status:'));
    modelCard.tags.push('status:provisioning');
    // Update the model card with the pod information
    await updateModelCard({ repoId: model_id, cardData: modelCard });
    
    console.log(`Updated job ${model_id} status in Supabase`);
    return {
      podId: podId,
      instanceType: gpuType,
      publicIpAddress: publicIpAddress,
      status: podStatus
    };
  } catch (error) {
    console.error("Error launching RunPod GPU instance:", error);
    throw new Error(`Failed to launch RunPod GPU instance: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Selects the appropriate RunPod GPU type based on required GPU memory
 * @param requiredGpuMemoryGB The amount of GPU memory required in GB
 * @returns The RunPod GPU type ID to use
 */
function selectGpuType(requiredGpuMemoryGB: number): string {
  // Map of available GPU types with their GPU memory (in GB) and IDs
  // According to RunPod API, we should use GPU type IDs
  const gpuTypes: Record<string, {memory: number, id: string}> = {
    'NVIDIA RTX A4000': {memory: 16, id: 'NVIDIA RTX A4000'},
    'NVIDIA RTX A4500': {memory: 20, id: 'NVIDIA RTX A4500'},
    'NVIDIA RTX A5000': {memory: 24, id: 'NVIDIA RTX A5000'},
    'NVIDIA RTX A6000': {memory: 48, id: 'NVIDIA RTX A6000'},
    'NVIDIA L4': {memory: 24, id: 'NVIDIA L4'},
    'NVIDIA L40': {memory: 48, id: 'NVIDIA L40'},
    'NVIDIA A100 80GB': {memory: 80, id: 'NVIDIA A100 80GB'},
    'NVIDIA A100 40GB': {memory: 40, id: 'NVIDIA A100 40GB'},
    'NVIDIA H100 80GB': {memory: 80, id: 'NVIDIA H100 80GB'},
  };

  // Find suitable GPU types that meet the memory requirement
  const suitableGpuTypes = Object.entries(gpuTypes)
    .filter(([, gpuInfo]) => gpuInfo.memory >= requiredGpuMemoryGB)
    .sort((a, b) => a[1].memory - b[1].memory); // Sort by memory (ascending)

  if (suitableGpuTypes.length === 0) {
    throw new Error(`No GPU type available for ${requiredGpuMemoryGB}GB GPU memory requirement`);
  }

  // Return the GPU type ID with the lowest suitable memory
  return suitableGpuTypes[0][1].id;
}

/**
 * Calculate the required GPU memory for a model
 * @param baseModel Name of the base model
 * @param parameters Number of parameters in billions
 * @returns Estimated GPU memory in GB
 */
export function calculateRequiredGpuMemory(baseModel: string, parameters: number): number {
  // Very rough estimation - actual requirements will vary
  // Model size in GB is approximately 2 bytes per parameter for FP16
  const modelSizeGB = (parameters * 1e9 * 2) / 1e9;
  
  // Add overhead for optimizer states, gradients, and other data
  const overhead = 1.5; // 50% overhead
  
  return Math.ceil(modelSizeGB * overhead);
}

/**
 * Generates startup commands to run on the pod
 * @param baseModel The base model to configure
 * @param jobId Optional job ID to process
 * @returns Array of startup commands
 */
function generateStartupCommands(baseModel: string): string[] {
  const commands = [
    "bash",
    "-c",
    `
    # Set error handling
    set -e

    # Cleanup function to terminate the pod
    cleanup() {
      echo "Cleaning up and terminating pod..." >> /workspace/setup.log
      runpodctl remove pod $RUNPOD_POD_ID
      exit $1
    }

    # Set trap to call cleanup on error
    trap 'cleanup 1' ERR
    
    echo "Setting up pod for ${baseModel}" > /workspace/setup.log
    cd /workspace
    
    # Create directory structure
    mkdir -p trainchimp/runpod
    cd trainchimp/runpod
    
    # Download required scripts directly without git clone
    echo "Downloading training scripts..." >> /workspace/setup.log
    curl -sLO https://raw.githubusercontent.com/ephibbs/trainchimp/main/runpod/finetuning_service.py
    curl -sLO https://raw.githubusercontent.com/ephibbs/trainchimp/main/runpod/requirements.txt
    
    # Create config file for this model
        echo '{
        "base_model": "${baseModel}",
        }' > config.json
    
    # Install dependencies
    pip install -r requirements.txt

    # Start the training process
    python finetuning_service.py
    
    echo "Setup complete!" >> /workspace/setup.log

    # Call cleanup when training is finished successfully
    cleanup 0
    `
  ];

  return commands;
}