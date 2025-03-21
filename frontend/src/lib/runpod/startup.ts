import axios from 'axios';

/**
 * Starts a RunPod GPU instance based on base model and required GPU memory
 * @param baseModel The name of the base model to use
 * @param requiredGpuMemoryGB The amount of GPU memory required in GB
 * @param jobId Optional job ID to pass to the instance
 * @returns Information about the launched pod
 */
export async function startGpuInstance(
  baseModel: string,
  requiredGpuMemoryGB: number,
  jobId?: string
): Promise<{
  podId: string;
  instanceType: string;
  publicIpAddress?: string;
  status: string;
}> {
  // Create RunPod API client
  const apiKey = process.env.RUNPOD_API_KEY || '';
  const apiClient = axios.create({
    baseURL: 'https://api.runpod.io/v1',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  // Select GPU type based on required GPU memory
  const gpuType = selectGpuType(requiredGpuMemoryGB);

  // Environment variables to pass to the container
  const envVariables = [
    { key: 'BASE_MODEL', value: baseModel },
    { key: 'HF_TOKEN', value: process.env.HF_TOKEN },
    { key: 'WANDB_API_KEY', value: process.env.WANDB_API_KEY },
  ];

  // Add job ID if provided
  if (jobId) {
    envVariables.push({ key: 'JOB_ID', value: jobId });
  }

  const startupCommands = generateStartupCommands(baseModel, jobId);

  // Configure pod launch parameters according to RunPod API docs
  const params = {
    name: `TrainChimp-${baseModel}-${Date.now()}`,
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
    cloudType: 'COMMUNITY', // Use COMMUNITY or SECURE
  };

  try {
    // Launch the pod
    const response = await apiClient.post('/pods', params);
    const data = response.data;

    if (!data.success || !data.id) {
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
    // Update job status in Supabase if a job ID was provided
    if (jobId) {
      try {
        // Create Supabase client
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Update the job with pod information
        await supabase
          .from('jobs')
          .update({
            status: 'provisioning'
          })
          .eq('job_id', jobId);
        
        console.log(`Updated job ${jobId} status in Supabase`);
      } catch (supabaseError) {
        // Log but don't fail the whole operation if Supabase update fails
        console.error(`Failed to update job status in Supabase: ${supabaseError instanceof Error ? supabaseError.message : String(supabaseError)}`);
      }
    }
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
function generateStartupCommands(baseModel: string, jobId?: string): string[] {
  const commands = [
    "bash",
    "-c",
    `
    # Set error handling
    set -e
    
    echo "Setting up pod for ${baseModel}" > /workspace/setup.log
    cd /workspace
    
    # Clone the TrainChimp repository
    git clone https://github.com/ephibbs/trainchimp.git
    cd trainchimp
    
    # Create config file for this model
    echo '{
      "base_model": "${baseModel}",
      "timestamp": "'$(date +%s)'"${jobId ? ',\n      "job_id": "' + jobId + '"' : ''}
    }' > config.json
    
    # Start the training process
    ${jobId ? `./backend/runpod/launch_job.sh "${jobId}"` : './backend/runpod/launch_finetuning.sh'}
    
    echo "Setup complete!" >> /workspace/setup.log
    `
  ];

  return commands;
}