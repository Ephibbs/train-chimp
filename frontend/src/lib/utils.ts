import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 

/**
 * Calculate the required GPU memory for a model given the name
 * @param baseModel Name of the base model
 * @param parameters Number of parameters in billions
 * @returns Estimated GPU memory in GB
 */
export function getGpuMemoryFromModelName(baseModel: string | null): number {
    if (!baseModel) return -1;
    
    // Extract parameter size from model name
    const paramRegex = /[-_\/](\d+\.?\d*)[bBmMkK](?:\b|-|_)/;
    const match = baseModel.match(paramRegex);
    
    if (!match) return -1;
    
    const value = parseFloat(match[1]);
    const unit = match[0].slice(-1).toLowerCase();
    
    // Convert to billions
    if (unit === 'b') return value;
    if (unit === 'm') return value / 1000;
    
    return -1;
}

/**
 * Calculate the required GPU memory for a model
 * @param baseModel Name of the base model
 * @param parameters Number of parameters in billions
 * @returns Estimated GPU memory in GB
 */
export function calculateRequiredGpuMemory(baseModel: string | null = null, parameters: number | null = null): number {
  // Very rough estimation - actual requirements will vary
  if (parameters === null) {
    parameters = getGpuMemoryFromModelName(baseModel);
    if (parameters === -1) {
      throw new Error('No parameters found in model name or specified');
    }
  }
  // Model size in GB is approximately 2 bytes per parameter for FP16
  const modelSizeGB = parameters * 2;
  
  // Add overhead for optimizer states, gradients, and other data
  const overhead = 1.5; // 50% overhead
  
  return Math.ceil(modelSizeGB * overhead);
}
