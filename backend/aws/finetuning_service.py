#!/usr/bin/env python3
"""
TrainChimp Fine-Tuning Service
------------------------------
A service that watches Cloudflare queue for fine-tuning tasks,
loads specified models, and performs LoRA fine-tuning.
"""

import os
import json
import time
import logging
import argparse
import requests
import boto3
from typing import Dict, Any, Optional
from datetime import datetime

# ML imports
import torch
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import (
    get_peft_model,
    LoraConfig, 
    TaskType,
    prepare_model_for_kbit_training
)
from datasets import load_dataset

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CloudflareClient:
    """Client for interacting with Cloudflare services (Queue, D1, R2)"""
    
    def __init__(self, api_token: str, account_id: str):
        self.api_token = api_token
        self.account_id = account_id
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
    
    def get_next_job(self, queue_name: str) -> Optional[Dict[str, Any]]:
        """Get the next job from the Cloudflare queue"""
        url = f"{self.base_url}/queues/{queue_name}/consumers"
        
        try:
            response = requests.post(url, headers=self.headers)
            response.raise_for_status()
            messages = response.json().get("result", {}).get("messages", [])
            
            if messages:
                # Return the first message
                message = messages[0]
                return {
                    "body": json.loads(message.get("body", "{}")),
                    "queue_message_id": message.get("id")
                }
            return None
        except Exception as e:
            logger.error(f"Error getting next job: {e}")
            return None
    
    def delete_job(self, queue_name: str, message_id: str) -> bool:
        """Delete a job from the queue after processing"""
        url = f"{self.base_url}/queues/{queue_name}/messages/{message_id}"
        
        try:
            response = requests.delete(url, headers=self.headers)
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Error deleting job: {e}")
            return False
    
    def download_dataset(self, bucket_name: str, dataset_id: str, local_path: str) -> str:
        """Download dataset from R2 storage"""
        url = f"{self.base_url}/r2/buckets/{bucket_name}/objects/datasets/{dataset_id}/data.jsonl"
        local_file_path = os.path.join(local_path, f"{dataset_id}.jsonl")
        
        try:
            os.makedirs(local_path, exist_ok=True)
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            with open(local_file_path, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"Dataset downloaded to {local_file_path}")
            return local_file_path
        except Exception as e:
            logger.error(f"Error downloading dataset: {e}")
            raise
    
    def upload_model(self, bucket_name: str, model_id: str, model_path: str) -> str:
        """Upload fine-tuned model to R2 storage"""
        # Zip the model files
        import shutil
        zip_path = f"/tmp/{model_id}.zip"
        shutil.make_archive(zip_path.replace('.zip', ''), 'zip', model_path)
        
        url = f"{self.base_url}/r2/buckets/{bucket_name}/objects/models/{model_id}/adapter.zip"
        
        try:
            with open(zip_path, 'rb') as f:
                files = {'file': f}
                response = requests.put(
                    url, 
                    headers={k: v for k, v in self.headers.items() if k != 'Content-Type'},
                    files=files
                )
                response.raise_for_status()
            
            # Clean up
            os.remove(zip_path)
            
            # Return the URL to the uploaded model
            return f"{self.base_url}/r2/buckets/{bucket_name}/objects/models/{model_id}/adapter.zip"
        except Exception as e:
            logger.error(f"Error uploading model: {e}")
            raise
    
    def update_job_status(self, database_name: str, job_id: str, status: str, 
                          logs_url: Optional[str] = None, 
                          started_at: Optional[str] = None,
                          completed_at: Optional[str] = None) -> bool:
        """Update job status in D1 database"""
        url = f"{self.base_url}/d1/database/{database_name}/query"
        
        # Build SQL update statement with only the fields that are provided
        set_clauses = [f"status = '{status}'"]
        if logs_url:
            set_clauses.append(f"logs_url = '{logs_url}'")
        if started_at:
            set_clauses.append(f"started_at = '{started_at}'")
        if completed_at:
            set_clauses.append(f"completed_at = '{completed_at}'")
        
        set_clause = ", ".join(set_clauses)
        sql = f"UPDATE jobs SET {set_clause} WHERE id = ?"
        
        try:
            payload = {
                "sql": sql,
                "params": [job_id]
            }
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Error updating job status: {e}")
            return False
    
    def update_model_status(self, database_name: str, model_id: str, status: str, 
                           lora_adapter_url: Optional[str] = None) -> bool:
        """Update model status in D1 database"""
        url = f"{self.base_url}/d1/database/{database_name}/query"
        
        # Build SQL update statement
        set_clauses = [f"status = '{status}'"]
        if lora_adapter_url:
            set_clauses.append(f"lora_adapter_url = '{lora_adapter_url}'")
        
        set_clause = ", ".join(set_clauses)
        sql = f"UPDATE models SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        
        try:
            payload = {
                "sql": sql,
                "params": [model_id]
            }
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Error updating model status: {e}")
            return False


class FineTuningService:
    """Service to manage fine-tuning jobs for a specific model type"""
    
    def __init__(self, 
                 cloudflare_client: CloudflareClient,
                 queue_name: str,
                 database_name: str,
                 bucket_name: str,
                 base_model_type: str,
                 data_dir: str = "/tmp/trainchimp"):
        
        self.cf_client = cloudflare_client
        self.queue_name = queue_name
        self.database_name = database_name
        self.bucket_name = bucket_name
        self.base_model_type = base_model_type
        self.data_dir = data_dir
        
        # Create directories
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "datasets"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "models"), exist_ok=True)
        
        # Pre-load the tokenizer for the base model
        logger.info(f"Loading tokenizer for {base_model_type}")
        self.tokenizer = AutoTokenizer.from_pretrained(base_model_type)
        
        # The model will be loaded when needed
        self.model = None
    
    def load_base_model(self):
        """Load the base model into memory"""
        logger.info(f"Loading base model: {self.base_model_type}")
        
        # Check for GPU
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        # Load in 4-bit to save memory
        self.model = AutoModelForCausalLM.from_pretrained(
            self.base_model_type,
            torch_dtype=torch.float16,
            load_in_4bit=True,
            device_map="auto"
        )
        
        # Prepare the model for training
        self.model = prepare_model_for_kbit_training(self.model)
        
        logger.info(f"Base model loaded successfully")
    
    def reset_model(self):
        """Reset the model by clearing it from memory"""
        logger.info("Resetting model")
        if self.model:
            del self.model
            torch.cuda.empty_cache()
            self.model = None
    
    def process_dataset(self, dataset_path, instruction_template=None):
        """Process the dataset for training"""
        logger.info(f"Processing dataset: {dataset_path}")
        
        # Load dataset
        dataset = load_dataset('json', data_files=dataset_path)
        
        # Apply tokenization
        def tokenize_function(examples):
            # Format based on instruction template or default to raw text
            if instruction_template:
                texts = [instruction_template.format(**item) for item in zip(
                    examples.get('instruction', ['']),
                    examples.get('input', ['']),
                    examples.get('output', [''])
                )]
            else:
                # Fallback to using 'text' field if available
                texts = examples.get('text', examples.get('content', []))
            
            return self.tokenizer(
                texts, 
                truncation=True, 
                padding="max_length",
                max_length=512
            )
        
        # Tokenize the dataset
        tokenized_dataset = dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=dataset["train"].column_names
        )
        
        return tokenized_dataset["train"]
    
    def fine_tune(self, job_data):
        """Fine-tune the model with LoRA based on job specifications"""
        job_id = job_data["job_id"]
        model_id = job_data["model_id"]
        dataset_id = job_data["dataset_id"]
        base_model = job_data["base_model"]
        training_params = job_data["training_params"]
        
        # Verify that this job is for our model type
        if base_model != self.base_model_type:
            logger.error(f"Job base model '{base_model}' doesn't match this worker's type '{self.base_model_type}'")
            return False
        
        # Update job status
        started_at = datetime.now().isoformat()
        self.cf_client.update_job_status(
            self.database_name, 
            job_id, 
            "running",
            started_at=started_at
        )
        self.cf_client.update_model_status(self.database_name, model_id, "training")
        
        try:
            # Download dataset
            dataset_path = self.cf_client.download_dataset(
                self.bucket_name,
                dataset_id,
                os.path.join(self.data_dir, "datasets")
            )
            
            # Load base model if not already loaded
            if self.model is None:
                self.load_base_model()
            
            # Process dataset
            train_dataset = self.process_dataset(dataset_path)
            
            # Configure LoRA
            lora_config = LoraConfig(
                r=training_params.get("lora_rank", 8),
                lora_alpha=training_params.get("lora_alpha", 16),
                task_type=TaskType.CAUSAL_LM,
                lora_dropout=0.05,
                bias="none",
                target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
            )
            
            # Apply LoRA config to the model
            peft_model = get_peft_model(self.model, lora_config)
            
            # Setup training arguments
            output_dir = os.path.join(self.data_dir, "models", model_id)
            training_args = TrainingArguments(
                output_dir=output_dir,
                num_train_epochs=training_params.get("epochs", 3),
                per_device_train_batch_size=training_params.get("batch_size", 8),
                gradient_accumulation_steps=4,
                learning_rate=training_params.get("learning_rate", 2e-5),
                bf16=True if torch.cuda.is_available() else False,
                save_strategy="epoch",
                logging_steps=10,
                save_total_limit=1,
                save_safetensors=True,
            )
            
            # Setup data collator
            data_collator = DataCollatorForLanguageModeling(
                tokenizer=self.tokenizer, 
                mlm=False
            )
            
            # Initialize trainer
            trainer = Trainer(
                model=peft_model,
                args=training_args,
                train_dataset=train_dataset,
                data_collator=data_collator,
            )
            
            # Start training
            logger.info(f"Starting fine-tuning for model {model_id}")
            trainer.train()
            
            # Save the trained model
            peft_model.save_pretrained(output_dir)
            
            # Upload the model to R2
            adapter_url = self.cf_client.upload_model(
                self.bucket_name,
                model_id,
                output_dir
            )
            
            # Update job and model status
            completed_at = datetime.now().isoformat()
            self.cf_client.update_job_status(
                self.database_name, 
                job_id, 
                "completed",
                completed_at=completed_at
            )
            self.cf_client.update_model_status(
                self.database_name, 
                model_id, 
                "ready",
                lora_adapter_url=adapter_url
            )
            
            logger.info(f"Fine-tuning completed for model {model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error during fine-tuning: {e}", exc_info=True)
            
            # Update job and model status
            self.cf_client.update_job_status(self.database_name, job_id, "failed")
            self.cf_client.update_model_status(self.database_name, model_id, "failed")
            
            return False
    
    def run(self, poll_interval=30):
        """Run the service, continuously polling for jobs"""
        logger.info(f"Starting fine-tuning service for model type: {self.base_model_type}")
        
        while True:
            try:
                # Get the next job
                job = self.cf_client.get_next_job(self.queue_name)
                
                if job:
                    job_data = job["body"]
                    message_id = job["queue_message_id"]
                    
                    logger.info(f"Processing job: {job_data['job_id']}")
                    
                    # Process the job
                    success = self.fine_tune(job_data)
                    
                    # Delete the job from the queue
                    if success:
                        self.cf_client.delete_job(self.queue_name, message_id)
                    
                    # Reset the model to free up memory
                    self.reset_model()
                else:
                    logger.info(f"No jobs available, waiting {poll_interval} seconds...")
            
            except Exception as e:
                logger.error(f"Error in service loop: {e}", exc_info=True)
            
            # Wait before polling again
            time.sleep(poll_interval)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="TrainChimp Fine-Tuning Service")
    parser.add_argument("--model-type", type=str, required=True, 
                        help="Base model type to fine-tune (e.g., mistralai/Mistral-7B-v0.1)")
    parser.add_argument("--queue-name", type=str, default="my-app-queue",
                        help="Cloudflare queue name to watch")
    parser.add_argument("--database-name", type=str, default="trainchimp-db",
                        help="Cloudflare D1 database name")
    parser.add_argument("--bucket-name", type=str, default="my-app-bucket",
                        help="Cloudflare R2 bucket name")
    parser.add_argument("--data-dir", type=str, default="/tmp/trainchimp",
                        help="Directory to store datasets and models")
    parser.add_argument("--poll-interval", type=int, default=30,
                        help="Interval in seconds to poll for new jobs")
    
    args = parser.parse_args()
    
    # Get Cloudflare credentials from environment
    cloudflare_api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
    cloudflare_account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    
    if not cloudflare_api_token or not cloudflare_account_id:
        logger.error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in environment")
        return 1
    
    # Initialize Cloudflare client
    cf_client = CloudflareClient(cloudflare_api_token, cloudflare_account_id)
    
    # Initialize and run the service
    service = FineTuningService(
        cf_client,
        args.queue_name,
        args.database_name,
        args.bucket_name,
        args.model_type,
        args.data_dir
    )
    
    # Run the service
    service.run(args.poll_interval)


if __name__ == "__main__":
    main() 