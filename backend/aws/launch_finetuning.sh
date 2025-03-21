#!/bin/bash
# TrainChimp Fine-Tuning Service Launcher

set -e

pip install -r requirements.txt

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Launch the service
python3 ./finetuning_service.py