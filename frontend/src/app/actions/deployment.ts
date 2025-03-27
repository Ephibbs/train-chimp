"use server";

interface DeployTogetherAIParams {
  model_id: string;
  hf_model_id: string;
  hf_model_url: string;
  base_model: string | undefined;
}

interface DeploymentResponse {
  job_id: string;
  model_name: string;
}

interface StatusResponse {
  status: string;
  error?: string;
}

interface TogetherAIModel {
  id: string;
  name: string;
  object: string;
  created: number;
  owned_by: string;
  permission: string[];
  pricing: any;
}

interface ProcessedTogetherAIModel extends TogetherAIModel {
  display_name: string;
}

/**
 * Initiates deployment of a model to Together AI
 * 
 * This server action replaces the /api/deploy/togetherai endpoint
 */
export async function deployToTogetherAI(params: DeployTogetherAIParams): Promise<DeploymentResponse> {
  try {
    // Get TogetherAI API key from environment
    const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
    if (!apiKey) {
      throw new Error("Together AI API key not configured");
    }

    // Make API call to Together AI to create a new fine-tuned model
    const response = await fetch("https://api.together.xyz/v0/models", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_type: "adapter",
        model_name: "trainchimp-" + params.hf_model_id.replace("/", "-"),
        model_source: params.hf_model_url,
        base_model: params.base_model,
        hf_token: process.env.NEXT_PUBLIC_HF_TOKEN
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to deploy to Together AI");
    }

    return {
      job_id: data.id,
      model_name: data.name
    };
  } catch (error) {
    console.error("Error deploying to Together AI:", error);
    throw new Error(error instanceof Error ? error.message : "Unknown error during deployment");
  }
}

/**
 * Checks the deployment status of a Together AI deployment job
 * 
 * This server action replaces the /api/deploy/togetherai/status/${job_id} endpoint
 */
export async function checkTogetherAIDeploymentStatus(jobId: string): Promise<StatusResponse> {
  try {
    // Get TogetherAI API key from environment
    const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
    if (!apiKey) {
      throw new Error("Together AI API key not configured");
    }

    // Make API call to Together AI to check job status
    const response = await fetch(`https://api.together.xyz/v1/fine-tunes/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to check deployment status");
    }

    // Map Together AI status to our status format
    let status = "Processing";
    if (data.status === "succeeded") {
      status = "Complete";
    } else if (data.status === "failed") {
      status = "Failed";
    }

    return {
      status,
      error: data.status === "failed" ? data.error || "Unknown error" : undefined
    };
  } catch (error) {
    console.error("Error checking deployment status:", error);
    return {
      status: "Failed",
      error: error instanceof Error ? error.message : "Unknown error checking status"
    };
  }
}

/**
 * Deploys a model to RunPod serverless
 */
export async function deployToRunPod(modelId: string, modelName: string): Promise<{ success: boolean, message: string }> {
  try {
    // Get RunPod API key from environment
    const apiKey = process.env.RUNPOD_API_KEY;
    if (!apiKey) {
      throw new Error("RunPod API key not configured");
    }
    
    // Configure the serverless deployment
    const endpoint_name = `${modelName.replace('/', '-').toLowerCase()}-endpoint`;
    
    // Define the docker image and hardware requirements
    const template = {
      name: endpoint_name,
      imageName: "runpod/serverless-llama-2:base",
      modelSettings: {
        model_path: `huggingface/${modelName}`,
        enable_lora: true
      },
      gpu: "NVIDIA RTX A5000", // Default GPU type
      minReplicas: 0,
      maxReplicas: 1,
      idleTimeout: 10 // Minutes before scaling down
    };
    
    // Create the RunPod serverless endpoint
    const response = await fetch("https://api.runpod.io/v2/endpoints", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(template)
    });
    
    const data = await response.json();
    
    if (!response.ok || data.error) {
      throw new Error(data.error || "Failed to create RunPod endpoint");
    }
    
    return {
      success: true,
      message: `Successfully deployed ${modelName} to RunPod Serverless as ${endpoint_name}`
    };
  } catch (error) {
    console.error("Error deploying to RunPod:", error);
    return {
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error during deployment"
    };
  }
}

/**
 * Retrieves all available models from Together AI
 * Processes models with trainchimp- prefix to have a user-friendly display name
 */
export async function getAllTogetherAIModels(): Promise<ProcessedTogetherAIModel[]> {
  try {
    // Get TogetherAI API key from environment
    const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
    if (!apiKey) {
      throw new Error("Together AI API key not configured");
    }

    // Make API call to Together AI to fetch all models
    const response = await fetch("https://api.together.xyz/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to fetch models from Together AI");
    }

    // Process model names for trainchimp models
    const processedModels = data.map((model: TogetherAIModel) => {
      const parts = model.id.split('/');
      
      // Check if it's a trainchimp model (second part starts with 'trainchimp-')
      if (parts.length > 1 && parts[1].startsWith('trainchimp-')) {
        // Extract the part after 'trainchimp-' and convert '-' to '/'
        const suffix = parts[1].substring('trainchimp-'.length);
        const display_name = suffix.replace(/-/g, '/');
        
        return {
          ...model,
          display_name
        };
      }
      
      // For other models, display name is the same as id
      return {
        ...model,
        display_name: model.id
      };
    });

    return processedModels;
  } catch (error) {
    console.error("Error fetching Together AI models:", error);
    throw new Error(error instanceof Error ? error.message : "Unknown error fetching models");
  }
} 

