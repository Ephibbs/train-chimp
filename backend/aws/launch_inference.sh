#!/bin/bash
# TrainChimp Inference Service Launcher

set -e

# Default variables
MODEL_TYPE=${MODEL_TYPE:-"mistralai/Mistral-7B-v0.1"}
DATABASE_NAME=${DATABASE_NAME:-"trainchimp-db"}
BUCKET_NAME=${BUCKET_NAME:-"my-app-bucket"}
DATA_DIR=${DATA_DIR:-"/data/trainchimp"}
MAX_LORAS=${MAX_LORAS:-4}
MAX_LORA_RANK=${MAX_LORA_RANK:-32}
HOST=${HOST:-"0.0.0.0"}
PORT=${PORT:-8000}

# Check if Cloudflare credentials are set
if [[ -z "${CLOUDFLARE_API_TOKEN}" || -z "${CLOUDFLARE_ACCOUNT_ID}" ]]; then
    echo "Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in environment"
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/loras"

# Launch the service
python3 /app/inference_service.py \
    --host "$HOST" \
    --port "$PORT" 