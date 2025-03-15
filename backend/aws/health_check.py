#!/usr/bin/env python3
"""
Health check script for TrainChimp Fine-Tuning Service
"""

import os
import json
import argparse
import subprocess
import requests
import time
from datetime import datetime

def check_gpu_status():
    """Check if GPU is available and working"""
    try:
        result = subprocess.run(
            ["nvidia-smi"], 
            capture_output=True, 
            text=True
        )
        return result.returncode == 0, result.stdout
    except Exception as e:
        return False, str(e)

def check_cloudflare_connectivity(api_token, account_id):
    """Check if we can connect to Cloudflare API"""
    try:
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"https://api.cloudflare.com/client/v4/accounts/{account_id}",
            headers=headers
        )
        return response.status_code == 200, response.text
    except Exception as e:
        return False, str(e)

def check_docker_service():
    """Check if Docker service is running and container is up"""
    try:
        # Check Docker service
        service_result = subprocess.run(
            ["systemctl", "is-active", "docker"],
            capture_output=True,
            text=True
        )
        
        # Check container
        container_result = subprocess.run(
            ["docker", "ps", "--filter", "name=trainchimp-finetuning", "--format", "{{.Status}}"],
            capture_output=True,
            text=True
        )
        
        return (
            service_result.returncode == 0,
            "Docker Service: " + service_result.stdout.strip() + 
            "\nContainer: " + container_result.stdout.strip()
        )
    except Exception as e:
        return False, str(e)

def main():
    parser = argparse.ArgumentParser(description="TrainChimp Fine-Tuning Service Health Check")
    parser.add_argument("--output-file", type=str, default="/var/log/trainchimp/health.json",
                        help="File to write health check results")
    
    args = parser.parse_args()
    
    # Get Cloudflare credentials from environment
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    
    # Run checks
    gpu_ok, gpu_details = check_gpu_status()
    cf_ok, cf_details = check_cloudflare_connectivity(api_token, account_id) if api_token and account_id else (False, "Missing credentials")
    docker_ok, docker_details = check_docker_service()
    
    # Prepare results
    results = {
        "timestamp": datetime.now().isoformat(),
        "overall_health": "healthy" if (gpu_ok and cf_ok and docker_ok) else "unhealthy",
        "checks": {
            "gpu": {
                "status": "ok" if gpu_ok else "fail",
                "details": gpu_details
            },
            "cloudflare": {
                "status": "ok" if cf_ok else "fail",
                "details": cf_details
            },
            "docker": {
                "status": "ok" if docker_ok else "fail",
                "details": docker_details
            }
        }
    }
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(args.output_file), exist_ok=True)
    
    # Write to file
    with open(args.output_file, "w") as f:
        json.dump(results, f, indent=2)
    
    # Print summary
    print(f"Health check completed: {results['overall_health']}")
    print(f"Details written to {args.output_file}")
    
    # Return non-zero exit code if unhealthy
    return 0 if results["overall_health"] == "healthy" else 1

if __name__ == "__main__":
    main() 