#!/usr/bin/env python3
"""
Error handling script for AWS EC2 instances.
This script logs errors that occur during startup and performs cleanup before terminating.
"""

import sys
import os
import json
import time
import logging
import boto3
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.ERROR,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/ec2-user/error.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger('error_handler')

def get_instance_id():
    """Get the current EC2 instance ID"""
    try:
        response = requests.get('http://169.254.169.254/latest/meta-data/instance-id', timeout=2)
        return response.text
    except Exception as e:
        logger.error(f"Failed to get instance ID: {e}")
        return None

def log_error_and_quit():
    """Log the error and terminate the instance if running in EC2"""
    # Get error info from command line arguments
    error_message = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Unknown error"
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.error(f"Error: {error_message}")
    
    # Log to Supabase or other external storage if environment variables are available
    try:
        # Save error details to file for debugging
        with open('/home/ec2-user/error_details.json', 'w') as f:
            error_data = {
                "timestamp": timestamp,
                "error": error_message,
                "script": "startup script",
                "path": os.getcwd()
            }
            json.dump(error_data, f, indent=2)
        
        logger.info("Error details saved to /home/ec2-user/error_details.json")
    except Exception as e:
        logger.error(f"Failed to write error details: {e}")
    
    # Optionally terminate the instance
    try:
        instance_id = get_instance_id()
        if instance_id and os.environ.get('AUTO_TERMINATE_ON_ERROR', 'true').lower() == 'true':
            logger.info(f"Terminating instance {instance_id} due to startup error")
            
            # Create EC2 client
            ec2 = boto3.client('ec2', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
            
            # Terminate the instance
            ec2.terminate_instances(InstanceIds=[instance_id])
            logger.info("Termination request sent. Instance will shut down shortly.")
        else:
            logger.info("Not terminating instance. Set AUTO_TERMINATE_ON_ERROR=true to enable auto-termination.")
    except Exception as e:
        logger.error(f"Failed to terminate instance: {e}")

    # Exit with error code
    sys.exit(1)

if __name__ == "__main__":
    # Additional imports that aren't at the top for startup performance
    import requests
    
    # Execute main function
    log_error_and_quit() 