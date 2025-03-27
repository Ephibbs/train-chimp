'use server'

import * as hub from '@huggingface/hub';
import { FineTuneHFModel, HFDataset } from '@/lib/types';


// Parameter interfaces for functions
interface GetHFUsernameParams {
  token?: string;
}

interface GetUserModelsParams {
  username?: string;
  token?: string;
}

interface GetUserDatasetsParams {
  username?: string;
  token?: string;
}

interface SearchDatasetsParams {
  query: string;
  limit?: number;
  token?: string;
}

interface CreateDatasetRepoParams {
  name: string;
  options: {
    description?: string;
    private?: boolean;
    tags?: string[];
  };
  token?: string;
}

interface CreateModelRepoParams {
  name: string;
  options: {
    description?: string;
    private?: boolean;
  };
  token?: string;
}

interface UploadFileToDatasetParams {
  repoId: string;
  filePath: string;
  fileContent: Blob | File;
  token?: string;
}

interface DeleteDatasetRepoParams {
  name: string;
  token?: string;
}

interface DeleteModelRepoParams {
  name: string;
  token?: string;
}

// New interfaces for card data
interface ModelCardData {
  language?: string;
  license?: string;
  library_name?: string;
  datasets?: string[];
  base_model?: string;
  tags: string[];
  model_description?: string;
  trainParams?: TrainParams;
  status?: string;
  queued_at?: string;
  started_at?: string;
  completed_at?: string;
  error_details?: string;
}

interface DatasetCardData {
  language?: string;
  license?: string;
  task_categories?: string[];
  tags: string[];
  pretty_name?: string;
  dataset_description?: string;
}

interface TrainParams {
  epochs: number;
  learning_rate: number;
  batch_size: number;
  max_length: number;
}

interface CreateModelCardParams {
  repoId: string;
  cardData: ModelCardData;
  token?: string;
}

interface CreateDatasetCardParams {
  repoId: string;
  cardData: DatasetCardData;
  token?: string;
}

interface GetModelCardParams {
  repoId: string;
  token?: string;
}

interface ListModelsParams {
  search?: string;
  author?: string;
  limit?: number;
  sort?: 'lastModified' | 'downloads' | 'likes';
  token?: string;
}

// Get the HF token from environment or storage
const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN;

if (!hfToken) {
    console.error("Hugging Face token not found");
}

// Get HF Username from token
export async function getHFUsername({
  token
}: GetHFUsernameParams = {}): Promise<string | null> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return null;
    }
    const userInfo = await hub.whoAmI({ accessToken });
    return userInfo.name || null;
  } catch (error) {
    console.error("Error fetching HF username:", error);
    return null;
  }
}

// Helper function to determine model status based on model tags
function getModelStatus(model: { tags: string[] }): FineTuneHFModel['status'] {
  if (model.tags.includes('status:failed')) return "failed";
  if (model.tags.includes('status:provisioning')) return "provisioning";
  if (model.tags.includes('status:loading_model')) return "loading model";
  if (model.tags.includes('status:training')) return "training";
  if (model.tags.includes('status:queued')) return "queued";
  if (model.tags.includes('status:completed')) return "completed";
  return "completed"; // Default to completed if the model exists without status tags
}

/**
 * Get models from a specific Hugging Face user
 * @param params Object containing username and optional token
 * @returns Array of user's models
 */
export async function getUserModels({
  username,
  token
}: GetUserModelsParams = {}): Promise<FineTuneHFModel[]> {
  try {
    const accessToken = token || hfToken;
    if (!username) {
      console.error("Username not found");
      return [];
    }
    const options = accessToken ? { accessToken } : undefined;
    const models: FineTuneHFModel[] = [];
    
    for await (const model of await listModels({ 
      author: username,
      ...options
    })) {
      const modelTag = model.tags.find((tag: string) => tag.startsWith('base_model:'));
      const baseModel = modelTag?.replace('base_model:', '') || 'Unknown';
      const dataset = model.tags.find((tag: string) => tag.startsWith('dataset:'));
      const datasetName = dataset?.replace('dataset:', '') || 'Unknown';
      models.push({
        id: model.id,
        name: model.name,
        author: username,
        status: getModelStatus(model),
        baseModel: baseModel,
        dataset: datasetName,
        tags: model.tags || [],
        downloads: model.downloads || 0,
        likes: model.likes || 0,
        updatedAt: new Date(model.lastModified)
      });
    }
    
    return models;
  } catch (error) {
    console.error(`Error fetching models for ${username}:`, error);
    return [];
  }
}

/**
 * Get datasets from a specific Hugging Face user
 * @param params Object containing username and optional token
 * @returns Array of user's datasets
 */
export async function getUserDatasets({
  username,
  token
}: GetUserDatasetsParams = {}): Promise<HFDataset[]> {
  try {
    if (!username) {
      console.error("Username not found");
      return [];
    }
    const options = token ? { accessToken: token } : undefined;
    const datasets: HFDataset[] = [];
    
    for await (const dataset of hub.listDatasets({
      search: { owner: username },
      ...options
    })) {
      datasets.push({
        id: dataset.id,
        author: username,
        name: dataset.name,
        tags: dataset.tags || [],
        downloads: dataset.downloads || 0,
        updatedAt: new Date(dataset.updatedAt),
      });
    }
    
    return datasets;
  } catch (error) {
    console.error(`Error fetching datasets for ${username}:`, error);
    return [];
  }
}

/**
 * Search for datasets on Hugging Face
 * @param params Object containing query, optional limit and token
 * @returns Array of matching datasets
 */
export async function searchDatasets({
  query,
  limit = 20,
  token
}: SearchDatasetsParams): Promise<HFDataset[]> {
  try {
    const options = token ? { accessToken: token } : undefined;
    const datasets: HFDataset[] = [];
    let count = 0;
    
    for await (const dataset of hub.listDatasets({
      search: { query },
      ...options
    })) {
      if (count >= limit) break;
      
      datasets.push({
        id: dataset.id,
        author: dataset.id.split('/')[0],
        tags: dataset.tags || [],
        downloads: dataset.downloads || 0,
        lastModified: dataset.lastModified || new Date().toISOString(),
      });
      
      count++;
    }
    
    return datasets;
  } catch (error) {
    console.error(`Error searching for datasets with query "${query}":`, error);
    return [];
  }
}

/**
 * Create a new dataset repository
 * @param params Object containing name, options and optional token
 * @returns Created dataset info or null if failed
 */
export async function createDatasetRepo({
  name,
  options,
  token
}: CreateDatasetRepoParams): Promise<{ id: string } | null> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return null;
    }
    
    const result = await hub.createRepo({
      repo: {
        type: "dataset",
        name
      },
      private: options.private ?? false,
      accessToken
    });
    
    return { id: result.repoUrl };
  } catch (error) {
    console.error(`Error creating dataset repository ${name}:`, error);
    return null;
  }
}

/**
 * Create a new model repository 
 * @param params Object containing name, options and optional token
 * @returns Created model info or null if failed
 */
export async function createModelRepo({
  name,
  options,
  token
}: CreateModelRepoParams): Promise<{ id: string } | null> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return null;
    }
    
    const result = await hub.createRepo({
      repo: {
        type: "model",
        name
      },
      private: options.private ?? false,
      accessToken
    });
    
    return { id: result.repoUrl };
  } catch (error) {
    console.error(`Error creating model repository ${name}:`, error);
    return null;
  }
}

/**
 * Upload a file to a dataset repository
 * @param params Object containing repoId, filePath, fileContent and optional token
 * @returns Success status
 */
export async function uploadFileToDataset({
  repoId,
  filePath,
  fileContent,
  token
}: UploadFileToDatasetParams): Promise<boolean> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return false;
    }
    
    await hub.uploadFiles({
      repo: {
        type: "dataset",
        name: repoId
      },
      files: [
        {
          path: filePath,
          content: fileContent
        }
      ],
      accessToken
    });
    
    return true;
  } catch (error) {
    console.error(`Error uploading file to ${repoId}:`, error);
    return false;
  }
}

/**
 * Delete a dataset repository
 * @param params Object containing repoId and optional token
 * @returns Success status
 */
export async function deleteDatasetRepo({
  name,
  token
}: DeleteDatasetRepoParams): Promise<boolean> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return false;
    }
    
    await hub.deleteRepo({
      repo: {
        type: "dataset",
        name: name
      },
      accessToken
    });
    
    return true;
  } catch (error) {
    console.error(`Error deleting dataset ${name}:`, error);
    return false;
  }
}

/**
 * Delete a model repository
 * @param params Object containing repoId and optional token
 * @returns Success status
 */
export async function deleteModelRepo({
  name,
  token
}: DeleteModelRepoParams): Promise<boolean> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return false;
    }
    
    await hub.deleteRepo({
      repo: {
        type: "model",
        name: name
      },
      accessToken
    });
    
    return true;
  } catch (error) {
    console.error(`Error deleting model ${name}:`, error);
    return false;
  }
}

/**
 * Create and push a model card with tags
 * @param params Object containing repoId, cardData and optional token
 * @returns Success status
 */
export async function createModelCard({
  repoId,
  cardData,
  token
}: CreateModelCardParams): Promise<boolean> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return false;
    }
    
    // Generate README.md content for model card
    const cardContent = generateModelCardContent(cardData);

    console.log("Card content:", cardContent);
    
    // Upload README.md to the repository
    await hub.uploadFiles({
      repo: {
        type: "model",
        name: repoId
      },
      files: [
        {
          path: "README.md",
          content: new Blob([cardContent], { type: "text/markdown" })
        }
      ],
      accessToken
    });
    
    return true;
  } catch (error) {
    console.error(`Error creating model card for ${repoId}:`, error);
    return false;
  }
}

/**
 * Update an existing model card with new data
 * @param params Object containing repoId, cardData and optional token
 * @returns Success status
 */
export async function updateModelCard({
  repoId,
  cardData,
  token
}: CreateModelCardParams): Promise<boolean> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return false;
    }
    
    // Merge the existing card data with the new data
    const updatedCardData: ModelCardData = cardData

    console.log("Updated card data:", updatedCardData);
    
    // Generate updated README.md content for model card
    const cardContent = generateModelCardContent(updatedCardData);
    
    console.log("Card content:", cardContent);
    
    // Upload updated README.md to the repository
    const result = await hub.uploadFiles({
      repo: {
        type: "model",
        name: repoId
      },
      files: [
        {
          path: "README.md",
          content: new Blob([cardContent], { type: "text/markdown" })
        }
      ],
      accessToken
    });
    
    console.log("UploadModelCard result:", result);
    
    return true;
  } catch (error) {
    console.error(`Error updating model card for ${repoId}:`, error);
    return false;
  }
}

/**
 * Create and push a dataset card with tags
 * @param params Object containing repoId, cardData and optional token
 * @returns Success status
 */
export async function createDatasetCard({
  repoId,
  cardData,
  token
}: CreateDatasetCardParams): Promise<boolean> {
  try {
    const accessToken = token || hfToken;
    if (!accessToken) {
      console.error("No Hugging Face token provided");
      return false;
    }
    console.log("Creating dataset card for", repoId);
    // Generate README.md content for dataset card
    const cardContent = generateDatasetCardContent(cardData);
    
    console.log("Card content:", cardContent);
    console.log("Uploading to", repoId);
    // Upload README.md to the repository
    await hub.uploadFiles({
      repo: {
        type: "dataset",
        name: repoId
      },
      files: [
        {
          path: "README.md",
          content: new Blob([cardContent], { type: "text/markdown" })
        }
      ],
      accessToken
    });
    
    console.log("Uploaded to", repoId);
    return true;
  } catch (error) {
    console.error(`Error creating dataset card for ${repoId}:`, error);
    return false;
  }
}

/**
 * Get the model card (README.md) from an existing Hugging Face model
 * @param params Object containing repoId and optional token
 * @returns Model card content or null if failed
 */
export async function getModelCard({
  repoId,
  token
}: GetModelCardParams): Promise<ModelCardData | null> {
  try {
    const accessToken = token || hfToken;
    const options = accessToken ? { accessToken } : undefined;
    
    const cardContent = await hub.downloadFile({
      repo: {
        type: "model",
        name: repoId
      },
      path: "README.md",
      ...options
    });
    
    if (cardContent instanceof Blob) {
      return parseModelCard(await cardContent.text());
    } else if (typeof cardContent === 'string') {
      return parseModelCard(cardContent);
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching model card for ${repoId}:`, error);
    return null;
  }
}

/**
 * Generate markdown content for a model card
 * @param cardData Model card data
 * @returns Markdown string
 */
function generateModelCardContent(cardData: ModelCardData): string {
  const { model_description, language, license, library_name, tags, datasets, base_model, trainParams } = cardData;
  
  const content = `---
${language ? `language: ${language}` : ''}
${license ? `license: ${license}` : ''}
${library_name ? `library_name: ${library_name}` : ''}
${datasets && datasets.length > 0 ? `datasets:\n${datasets.map(dataset => `- ${dataset}`).join('\n')}` : ''}
${base_model ? `base_model: ${base_model}` : ''}
${tags && tags.length > 0 ? `tags:\n${tags.map(tag => `- ${tag}`).join('\n')}` : ''}
${trainParams ? `train_params:\n${Object.entries(trainParams).map(([key, value]) => `  ${key}: ${value}`).join('\n')}` : ''}
---

# Model Card
${model_description || ""}

This model was fine-tuned using [TrainChimp](https://trainchimp.com).
`;

  return content;
}

/**
 * Generate markdown content for a dataset card
 * @param cardData Dataset card data
 * @returns Markdown string
 */
function generateDatasetCardContent(cardData: DatasetCardData): string {
  const { pretty_name, language, license, task_categories, tags } = cardData;
  
  const content = `---
language: ${language || "en"}
license: ${license || "mit"}
${task_categories && task_categories.length > 0 ? `task_categories:\n${task_categories.map(cat => `- ${cat}`).join('\n')}` : ''}
${tags && tags.length > 0 ? `tags:\n${tags.map(tag => `- ${tag}`).join('\n')}` : ''}
---

# Dataset Card: ${pretty_name || ""}

This dataset was uploaded to Hugging Face using [TrainChimp](https://trainchimp.com).
`;

  return content;
}

/**
 * Parse raw model card text into a structured ModelCardData object
 * @param cardText Raw README.md content from model card
 * @returns Structured ModelCardData object
 */
export async function parseModelCard(cardText: string): Promise<ModelCardData> {
  try {
    const modelData: ModelCardData = {
      tags: []
    };
    
    // Check if the card has YAML frontmatter (between --- markers)
    if (cardText.startsWith('---')) {
      const secondMarkerIndex = cardText.indexOf('---', 3);
      if (secondMarkerIndex !== -1) {
        // Extract the frontmatter section
        const frontmatter = cardText.substring(3, secondMarkerIndex).trim();
        const lines = frontmatter.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Skip empty lines
          if (!line) continue;
          
          // Handle different frontmatter fields
          if (line.startsWith('language:')) {
            modelData.language = line.substring('language:'.length).trim();
          } else if (line.startsWith('license:')) {
            modelData.license = line.substring('license:'.length).trim();
          } else if (line.startsWith('library_name:')) {
            modelData.library_name = line.substring('library_name:'.length).trim();
          } else if (line.startsWith('base_model:')) {
            modelData.base_model = line.substring('base_model:'.length).trim();
          } else if (line.startsWith('datasets:')) {
            // For array values, collect all subsequent indented lines
            modelData.datasets = [];
            while (i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
              i++;
              const dataset = lines[i].trim().substring(1).trim();
              modelData.datasets.push(dataset);
            }
          } else if (line.startsWith('tags:')) {
            // Extract tags
            modelData.tags = [];
            while (i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
              i++;
              const tag = lines[i].trim().substring(1).trim();
              modelData.tags.push(tag);
            }
          } else if (line.startsWith('status:')) {
            modelData.status = line.substring('status:'.length).trim();
          } else if (line.startsWith('train_params:')) {
            // Extract training parameters
            const trainParams: TrainParams = {
              epochs: 0,
              learning_rate: 0,
              batch_size: 0,
              max_length: 0
            };
            
            while (i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
              i++;
              const paramLine = lines[i].trim().substring(1).trim();
              const [key, value] = paramLine.split(':').map(s => s.trim());
              
              if (key && value) {
                if (key === 'epochs') trainParams.epochs = Number(value);
                if (key === 'learning_rate') trainParams.learning_rate = Number(value);
                if (key === 'batch_size') trainParams.batch_size = Number(value);
                if (key === 'max_length') trainParams.max_length = Number(value);
              }
            }
            
            modelData.trainParams = trainParams;
          }
        }
        
        // Extract model description from the content after frontmatter
        const contentStart = secondMarkerIndex + 3;
        const content = cardText.substring(contentStart).trim();
        
        // Try to extract the model description (text after "# Model Card" heading)
        const modelCardHeadingIndex = content.indexOf('# Model Card');
        if (modelCardHeadingIndex !== -1) {
          const descriptionStart = modelCardHeadingIndex + '# Model Card'.length;
          let descriptionEnd = content.indexOf('#', descriptionStart);
          if (descriptionEnd === -1) descriptionEnd = content.length;
          
          modelData.model_description = content.substring(descriptionStart, descriptionEnd).trim();
        } else {
          // If no specific heading, use the whole content
          modelData.model_description = content;
        }
      }
    } else {
      // If there's no frontmatter, treat the whole text as model description
      modelData.model_description = cardText.trim();
    }
    
    return modelData;
  } catch (error) {
    console.error('Error parsing model card:', error);
    // Return at least an empty tags array if parsing fails
    return { tags: [] };
  }
}

/**
 * List models directly using the Hugging Face API
 * @param params Object containing search parameters and optional token
 * @returns Array of models matching the search criteria
 */
export async function listModels({
  search = '',
  author = '',
  limit = 20,
  sort = 'lastModified',
  token
}: ListModelsParams): Promise<FineTuneHFModel[]> {
  try {
    const accessToken = token || hfToken;
    
    // Build the query parameters
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (author) params.append('author', author);
    params.append('limit', limit.toString());
    params.append('sort', sort);
    
    // Make the API request
    const response = await fetch(`https://huggingface.co/api/models?${params.toString()}`, {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`
      } : {}
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Format the response to match our HFModel interface
    return data.map((model: HFModel) => ({
      id: model.id,
      name: model.modelId,
      author: model.author || model.id.split('/')[0],
      tags: model.tags || [],
      downloads: model.downloads || 0,
      likes: model.likes || 0,
      lastModified: model.lastModified || '',
    }));
  } catch (error) {
    console.error(`Error listing models:`, error);
    return [];
  }
}
