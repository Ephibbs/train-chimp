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
import requests
import boto3
from typing import Dict, Any, Optional
from datetime import datetime

# Hugging Face Hub imports
from huggingface_hub import (
    HfApi,
    Repository,
    create_repo,
    upload_file,
    upload_folder,
    login,
    model_info,
    metadata_update,
    hf_hub_download,
    ModelCard,
    ModelCardData,
    RepoCard
)


# ML imports
import torch
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from trl import SFTTrainer, SFTConfig
from peft import (
    get_peft_model,
    LoraConfig, 
    TaskType,
    prepare_model_for_kbit_training
)
from datasets import load_dataset
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FineTuningService:
    """Service to manage fine-tuning jobs"""
    
    def __init__(self, data_dir: str = "/tmp/trainchimp"):
        self.data_dir = data_dir
        
        # Create directories
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "datasets"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "models"), exist_ok=True)
        
        # Models and tokenizers will be loaded as needed
        self.model = None
        self.tokenizer = None
    
    def load_base_model(self, base_model_type):
        """Load a base model into memory"""
        logger.info(f"Loading base model: {base_model_type}")
        
        # Check for GPU
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        # Load tokenizer if not already loaded
        if self.tokenizer is None:
            logger.info(f"Loading tokenizer for {base_model_type}")
            self.tokenizer = AutoTokenizer.from_pretrained(base_model_type)
            self.tokenizer.add_special_tokens({'pad_token': '[PAD]'})
            
        # Load model in 4-bit to save memory
        model = AutoModelForCausalLM.from_pretrained(
            base_model_type,
            torch_dtype=torch.float16,
            load_in_4bit=True,
            device_map="auto"
        )
        
        # Prepare the model for training
        model = prepare_model_for_kbit_training(model)
        
        self.model = model
        logger.info(f"Base model loaded successfully")
    
    def reset_model(self, base_model_type):
        """Reset a specific model by clearing it from memory"""
        logger.info(f"Resetting model: {base_model_type}")
        if self.model is not None:
            del self.model
            torch.cuda.empty_cache()
    
    def process_dataset(self, dataset_path, base_model_type, instruction_template=None, max_length=512):
        """Process the dataset for training"""
        logger.info(f"Processing dataset: {dataset_path}")
        
        tokenizer = self.tokenizer
        
        # Load dataset
        dataset = load_dataset('json', data_files=dataset_path)
        
        print(f"Dataset: {dataset}")
        print(f"Dataset keys: {dataset.keys()}")
        print(f"Dataset first item: {dataset['train'][0]}")
        
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
            
            return tokenizer(
                texts, 
                truncation=True, 
                padding="max_length",
                max_length=max_length
            )
        
        # Tokenize the dataset
        tokenized_dataset = dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=dataset["train"].column_names
        )
        
        return tokenized_dataset["train"]
    
    def upload_model(self, model_id, progress=''):
        """Upload the model to Hugging Face Hub and save artifacts"""
        commit_message = f"Upload model for {model_id}" + (f" at {progress}" if progress else "")
        logger.info(f"Uploading model to Hugging Face Hub: {commit_message}")
        
        # Save model artifacts
        artifact_dir = os.path.join(self.data_dir, "models", model_id, "final")
        
        # Upload the complete model to HF Hub
        upload_folder(
            folder_path=artifact_dir,
            repo_id=model_id,
            commit_message=commit_message
        )
        
        logger.info(f"Model artifacts saved to {artifact_dir}")
        return True
    
    def run(self, model_id):
        """Fine-tune the model with LoRA based on job specifications"""
        logger.info(f"Starting fine-tuning for model: {model_id}")
        
        # Get model metadata from Hugging Face Hub
        try:
            print(f"Getting model info for {model_id}")
            card = ModelCard.load(model_id)
            print(f"Model info: {card.data}")
            model_metadata = card.data if hasattr(card, 'data') else {}
            
            if not model_metadata:
                logger.error(f"No metadata found for model {model_id}")
                return False
            
            # Extract training information from model metadata
            dataset_id = model_metadata.get("datasets")[0]
            base_model = model_metadata.get("base_model")
            training_params = model_metadata.get("trainParams", {})
            
            if not dataset_id or not base_model:
                logger.error(f"Missing required metadata for model {model_id}")
                return False
            
            print(f"Updating model status to running for {model_id}")
            # Update model status in HF Hub
            if card.data.tags:
                card.data.tags = [tag for tag in card.data.tags if not tag.startswith("status:")]
            else:
                card.data.tags = []
            card.data.tags.append("status:loading_model")
            card.data.tags.append("started_at:" + datetime.now().isoformat())
            card.push_to_hub(model_id)
            
            print(f"Downloading dataset for {dataset_id}")
            # Download dataset from HF Hub
            dataset_path = hf_hub_download(
                repo_id=dataset_id,
                filename="data.jsonl",
                repo_type="dataset"
            )
            
            print(f"Loading base model for {model_id}")
            # Load base model if not already loaded
            if self.model is None:
                self.load_base_model(base_model)
            
            model = self.model
            tokenizer = self.tokenizer
            
            print(f"Processing dataset for {model_id}")
            # Process dataset
            train_dataset = load_dataset('json', data_files=dataset_path)
            # train_dataset = self.process_dataset(dataset_path, base_model, max_length=training_params.get("max_length", 512))
            
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
            peft_model = get_peft_model(model, lora_config)
            
            # Setup training arguments
            output_dir = os.path.join(self.data_dir, "models", model_id)
            training_args = SFTConfig(
                output_dir=output_dir,
                num_train_epochs=training_params.get("epochs", 1),
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
            # data_collator = DataCollatorForLanguageModeling(
            #     tokenizer=tokenizer, 
            #     mlm=False
            # )
            
            if card.data.tags:
                card.data.tags = [tag for tag in card.data.tags if not tag.startswith("status:")]
            else:
                card.data.tags = []
            card.data.tags.append("status:training")
            card.data.tags.append("started_training_at:" + datetime.now().isoformat())
            card.push_to_hub(model_id)
            
            # Initialize trainer
            trainer = SFTTrainer(
                model=peft_model,
                train_dataset=train_dataset["train"],
                args=training_args,
                # data_collator=data_collator,
            )
            
            # Start training
            logger.info(f"Starting fine-tuning for model {model_id}")
            trainer.train()
            
            # Save the trained model
            final_dir = os.path.join(output_dir, "final")
            peft_model.save_pretrained(final_dir)
            
            # Remove the automatically generated README.md file if it exists
            readme_path = os.path.join(final_dir, "README.md")
            if os.path.exists(readme_path):
                logger.info(f"Removing auto-generated README.md from {final_dir}")
                try:
                    os.remove(readme_path)
                except Exception as e:
                    logger.warning(f"Failed to remove README.md: {e}")
            
            # Upload the model to Hugging Face Hub  
            upload_folder(
                folder_path=final_dir,
                repo_id=model_id,
                commit_message=f"Upload final model for {model_id}"
            )
            
            # Update model metadata
            # Remove any existing status tags
            if card.data.tags:
                card.data.tags = [tag for tag in card.data.tags if not tag.startswith("status:")]
            else:
                card.data.tags = []
            card.data.tags.append("status:completed")
            card.data.tags.append("completed_at:" + datetime.now().isoformat())
            card.push_to_hub(model_id)
            logger.info(f"Fine-tuning completed for model {model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error during fine-tuning: {e}", exc_info=True)
            
            # Update model status
            if card.data.tags:
                card.data.tags = [tag for tag in card.data.tags if not tag.startswith("status:")]
            else:
                card.data.tags = []
            card.data.tags.append("status:failed")
            card.data.tags.append("error_details:" + str(e))
            card.data.tags.append("completed_at:" + datetime.now().isoformat())
            card.push_to_hub(model_id)
            
            return False
        finally:
            # Reset the model to free up memory
            if base_model:
                self.reset_model(base_model)

def main():
    """Main entry point"""
    
    model_id = os.environ.get("MODEL_NAME")
    if not model_id:
        logger.error("MODEL_NAME environment variable is required")
        return 1
    
    # Get data directory from environment or use default
    data_dir = os.environ.get("DATA_DIR", "/tmp/trainchimp")
    
    # Initialize and run the service
    service = FineTuningService(data_dir)
    
    # Run the service with the specified model ID
    success = service.run(model_id)
    
    return 0 if success else 1


if __name__ == "__main__":
    main() 