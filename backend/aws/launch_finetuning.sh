#!/bin/bash
# TrainChimp Fine-Tuning Service Launcher

set -e

# Default variables
MODEL_TYPE=${MODEL_TYPE:-"mistralai/Mistral-7B-v0.1"}
QUEUE_NAME=${QUEUE_NAME:-"my-app-queue"}
DATABASE_NAME=${DATABASE_NAME:-"trainchimp-db"}
BUCKET_NAME=${BUCKET_NAME:-"my-app-bucket"}
DATA_DIR=${DATA_DIR:-"/data/trainchimp"}
POLL_INTERVAL=${POLL_INTERVAL:-30}

# Check if Cloudflare credentials are set
if [[ -z "${CLOUDFLARE_API_TOKEN}" || -z "${CLOUDFLARE_ACCOUNT_ID}" ]]; then
    echo "Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in environment"
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Launch the service
python3 /app/finetuning_service.py \
    --model-type "$MODEL_TYPE" \
    --queue-name "$QUEUE_NAME" \
    --database-name "$DATABASE_NAME" \
    --bucket-name "$BUCKET_NAME" \
    --data-dir "$DATA_DIR" \
    --poll-interval "$POLL_INTERVAL" 