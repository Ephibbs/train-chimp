#!/usr/bin/env python3
"""
TrainChimp Inference Service
----------------------------
A service that provides inference with dynamically loaded LoRA adapters using vLLM.
"""

import os
import json
import time
import logging
import argparse
import requests
import torch
from typing import Dict, Any, Optional, List, Union
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime

# vLLM imports
from vllm import LLM, SamplingParams
from vllm.lora.request import LoRARequest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CloudflareClient:
    """Client for interacting with Cloudflare services (D1, R2)"""
    
    def __init__(self, api_token: str, account_id: str):
        self.api_token = api_token
        self.account_id = account_id
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
    
    def download_lora_adapter(self, bucket_name: str, model_id: str, local_path: str) -> str:
        """Download LoRA adapter from R2 storage"""
        url = f"{self.base_url}/r2/buckets/{bucket_name}/objects/models/{model_id}/adapter.zip"
        local_file_path = os.path.join(local_path, f"{model_id}.zip")
        extract_path = os.path.join(local_path, model_id)
        
        try:
            os.makedirs(local_path, exist_ok=True)
            
            # Download the adapter zip file
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            with open(local_file_path, 'wb') as f:
                f.write(response.content)
            
            # Extract the zip file
            import zipfile
            with zipfile.ZipFile(local_file_path, 'r') as zip_ref:
                os.makedirs(extract_path, exist_ok=True)
                zip_ref.extractall(extract_path)
            
            # Clean up the zip file
            os.remove(local_file_path)
            
            logger.info(f"LoRA adapter downloaded and extracted to {extract_path}")
            return extract_path
        except Exception as e:
            logger.error(f"Error downloading LoRA adapter: {e}")
            raise
    
    def get_model_details(self, database_name: str, model_id: str) -> Dict[str, Any]:
        """Get model details from D1 database"""
        url = f"{self.base_url}/d1/database/{database_name}/query"
        
        try:
            payload = {
                "sql": "SELECT * FROM models WHERE id = ?",
                "params": [model_id]
            }
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            models = result.get("result", [])
            
            if not models or len(models) == 0:
                raise ValueError(f"Model {model_id} not found")
                
            return models[0]
        except Exception as e:
            logger.error(f"Error getting model details: {e}")
            raise

# API request/response models
class ProvisionLoRARequest(BaseModel):
    model_id: str = Field(..., description="The UUID of the LoRA model to provision")

class InferenceRequest(BaseModel):
    model_id: Optional[str] = Field(None, description="The UUID of the LoRA model to use (if None, uses base model)")
    prompt: str = Field(..., description="The prompt for inference")
    max_tokens: int = Field(256, description="Maximum number of tokens to generate")
    temperature: float = Field(0.7, description="Sampling temperature")
    top_p: float = Field(1.0, description="Top-p sampling parameter")
    top_k: int = Field(50, description="Top-k sampling parameter")
    stop: Optional[List[str]] = Field(None, description="Stop sequences")
    repetition_penalty: Optional[float] = Field(None, description="Repetition penalty")

class TokenResponse(BaseModel):
    text: str
    logprob: Optional[float] = None

class InferenceResponse(BaseModel):
    model_id: str
    generated_text: str
    tokens: Optional[List[TokenResponse]] = None
    finish_reason: str
    usage: Dict[str, int]

class InferenceService:
    """Service to handle inference requests with LoRA adapters"""
    
    def __init__(self,
                 cloudflare_client: CloudflareClient,
                 database_name: str,
                 bucket_name: str,
                 base_model_type: str,
                 data_dir: str = "/tmp/trainchimp",
                 max_loras: int = 4,
                 max_lora_rank: int = 32):
        
        self.cf_client = cloudflare_client
        self.database_name = database_name
        self.bucket_name = bucket_name
        self.base_model_type = base_model_type
        self.data_dir = data_dir
        self.max_loras = max_loras
        self.max_lora_rank = max_lora_rank
        
        # Create directories
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "loras"), exist_ok=True)
        
        # Track loaded LoRA adapters
        self.loaded_loras = {}
        self.lora_paths = {}
        
        # Load the LLM with LoRA support
        logger.info(f"Loading base model: {base_model_type}")
        self.llm = LLM(
            model=base_model_type,
            enable_lora=True,
            max_loras=max_loras,
            max_lora_rank=max_lora_rank,
            max_cpu_loras=20,  # Store more LoRAs in CPU memory
            trust_remote_code=True,
        )
        logger.info(f"Base model loaded successfully with LoRA support")
    
    def provision_lora(self, model_id: str) -> Dict[str, Any]:
        """Download and provision a LoRA adapter"""
        try:
            # Check if already loaded
            if model_id in self.loaded_loras:
                return {
                    "status": "already_loaded",
                    "model_id": model_id,
                    "base_model": self.base_model_type
                }
            
            # Get model details from database
            model_details = self.cf_client.get_model_details(self.database_name, model_id)
            
            # Verify base model matches
            if model_details.get("base_model") != self.base_model_type:
                raise ValueError(
                    f"Model {model_id} base model ({model_details.get('base_model')}) "
                    f"doesn't match this instance's base model ({self.base_model_type})"
                )
            
            # Download the LoRA adapter
            lora_path = self.cf_client.download_lora_adapter(
                self.bucket_name,
                model_id,
                os.path.join(self.data_dir, "loras")
            )
            
            # Store the path for future reference
            self.lora_paths[model_id] = lora_path
            
            # Mark as loaded - it will be loaded on demand during inference
            self.loaded_loras[model_id] = {
                "name": model_details.get("name", f"lora-{model_id}"),
                "path": lora_path,
                "base_model": model_details.get("base_model")
            }
            
            return {
                "status": "loaded",
                "model_id": model_id,
                "base_model": self.base_model_type,
                "name": model_details.get("name")
            }
            
        except Exception as e:
            logger.error(f"Error provisioning LoRA {model_id}: {e}")
            raise
    
    def run_inference(self, request: InferenceRequest) -> InferenceResponse:
        """Run inference with optional LoRA adapter"""
        try:
            # Prepare sampling parameters
            sampling_params = SamplingParams(
                temperature=request.temperature,
                top_p=request.top_p,
                top_k=request.top_k,
                max_tokens=request.max_tokens,
                stop=request.stop,
                repetition_penalty=request.repetition_penalty,
            )
            
            # Set up LoRA request if a model_id is provided
            lora_request = None
            model_id = request.model_id or self.base_model_type
            
            if request.model_id and request.model_id in self.loaded_loras:
                lora_info = self.loaded_loras[request.model_id]
                lora_request = LoRARequest(
                    lora_info["name"],  # Human-readable name
                    request.model_id,   # Unique ID
                    lora_info["path"]   # Path to the adapter
                )
            
            # Run the inference
            start_time = time.time()
            outputs = self.llm.generate(
                request.prompt,
                sampling_params,
                lora_request=lora_request
            )
            
            # Process the results
            output = outputs[0]
            generated_text = output.outputs[0].text
            prompt_tokens = len(output.prompt_token_ids)
            completion_tokens = len(output.outputs[0].token_ids)
            
            return InferenceResponse(
                model_id=model_id,
                generated_text=generated_text,
                finish_reason=output.outputs[0].finish_reason,
                usage={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": prompt_tokens + completion_tokens,
                    "time_seconds": round(time.time() - start_time, 2)
                }
            )
            
        except Exception as e:
            logger.error(f"Error during inference: {e}")
            raise

# FastAPI application
app = FastAPI(
    title="TrainChimp Inference API",
    description="API for inference with LoRA adapters using vLLM",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get the inference service
def get_inference_service():
    """Get or create the inference service singleton"""
    if not hasattr(app, "inference_service"):
        # Get environment variables
        api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
        account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        database_name = os.environ.get("DATABASE_NAME", "trainchimp-db")
        bucket_name = os.environ.get("BUCKET_NAME", "my-app-bucket")
        base_model_type = os.environ.get("MODEL_TYPE", "mistralai/Mistral-7B-v0.1")
        data_dir = os.environ.get("DATA_DIR", "/tmp/trainchimp")
        max_loras = int(os.environ.get("MAX_LORAS", "4"))
        max_lora_rank = int(os.environ.get("MAX_LORA_RANK", "32"))
        
        # Create CloudflareClient
        cf_client = CloudflareClient(api_token, account_id)
        
        # Create InferenceService
        app.inference_service = InferenceService(
            cf_client,
            database_name,
            bucket_name,
            base_model_type,
            data_dir,
            max_loras,
            max_lora_rank
        )
    
    return app.inference_service

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    gpu_available = torch.cuda.is_available()
    gpu_info = {
        "available": gpu_available,
        "count": torch.cuda.device_count() if gpu_available else 0,
        "device": torch.cuda.get_device_name(0) if gpu_available else None
    }
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "base_model": os.environ.get("MODEL_TYPE", "mistralai/Mistral-7B-v0.1"),
        "gpu": gpu_info,
        "loaded_loras": len(getattr(app, "inference_service", {}).loaded_loras or {})
    }

@app.post("/provision_lora", status_code=200)
async def provision_lora_endpoint(
    request: ProvisionLoRARequest,
    background_tasks: BackgroundTasks,
    inference_service: InferenceService = Depends(get_inference_service)
):
    """Provision a LoRA adapter"""
    try:
        result = inference_service.provision_lora(request.model_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error provisioning LoRA: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/inference", response_model=InferenceResponse)
async def inference_endpoint(
    request: InferenceRequest,
    inference_service: InferenceService = Depends(get_inference_service)
):
    """Run inference with optional LoRA adapter"""
    try:
        # If a model_id is provided, ensure it's provisioned
        if request.model_id and request.model_id not in inference_service.loaded_loras:
            raise HTTPException(
                status_code=400,
                detail=f"Model {request.model_id} not provisioned. Call /provision_lora first."
            )
        
        result = inference_service.run_inference(request)
        return result
    except Exception as e:
        logger.error(f"Error during inference: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/loras")
async def list_loras(
    inference_service: InferenceService = Depends(get_inference_service)
):
    """List provisioned LoRA adapters"""
    return {
        "base_model": inference_service.base_model_type,
        "loras": inference_service.loaded_loras
    }

def main():
    """Main function for running the service directly (not via uvicorn)"""
    parser = argparse.ArgumentParser(description="TrainChimp Inference Service")
    parser.add_argument("--host", type=str, default="0.0.0.0",
                        help="Host to bind the server to")
    parser.add_argument("--port", type=int, default=8000,
                        help="Port to bind the server to")
    
    args = parser.parse_args()
    
    # Get Cloudflare credentials from environment
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    
    if not api_token or not account_id:
        logger.error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in environment")
        return 1
    
    # Run the FastAPI app with uvicorn
    import uvicorn
    uvicorn.run("inference_service:app", host=args.host, port=args.port, reload=False)

if __name__ == "__main__":
    main() 