#!/usr/bin/env python3
"""
TrainChimp Error Handler
------------------------
A script that logs errors and updates model status when training fails.
Called by the cleanup function to report errors.
"""

import os
import sys
import logging
import traceback
from datetime import datetime, timezone
from huggingface_hub import HfApi, ModelCard

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/workspace/error.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def get_utc_time():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def update_model_status(model_id, status, error_message=None):
    """Update the model's status in HuggingFace Hub"""
    try:
        logger.info(f"Updating model status to {status} for {model_id}")
        hf_token = os.environ.get("HF_TOKEN")
        
        if not hf_token:
            logger.error("HF_TOKEN environment variable not set")
            return False
            
        api = HfApi(token=hf_token)
        
        try:
            card = ModelCard.load(model_id)
            # Remove existing status tags
            if card.data.tags:
                card.data.tags = [tag for tag in card.data.tags if not tag.startswith("status:") and not tag.startswith("error_details:")]
            else:
                card.data.tags = []
                
            # Add new status tag
            card.data.tags.append(f"status:{status}")
            
            # Add error details if provided
            if error_message:
                card.data.tags.append(f"error_details:{error_message[:100]}")  # Limit length
                
            # Add timestamp
            if status == "failed":
                card.data.tags.append(f"completed_at:{get_utc_time()}")
            
            card.push_to_hub(model_id)
            logger.info(f"Successfully updated model status to {status}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update model status: {str(e)}")
            return False
            
    except Exception as e:
        logger.error(f"Error in update_model_status: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        model_id = os.environ.get("MODEL_NAME")
        if not model_id:
            logger.error("MODEL_NAME environment variable is required")
            sys.exit(1)
        
        # Get error message from command line arguments if provided
        error_message = "Training failed"
        if len(sys.argv) > 1:
            error_message = sys.argv[1]
        
        logger.info(f"Error handler called for model: {model_id}")
        logger.error(f"Error details: {error_message}")
        
        # Update model status to failed with error message
        update_model_status(model_id, "failed", error_message)
        
    except Exception as e:
        logger.critical(f"Error handler itself failed: {str(e)}\n{traceback.format_exc()}")
        try:
            # Last ditch effort to update model status
            if model_id:
                update_model_status(model_id, "failed", f"Error handler failed: {str(e)}")
        except:
            pass
        sys.exit(1) 