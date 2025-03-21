#!/bin/bash

# 1. Welcome message
echo "🐵 Welcome to TrainChimp! 🐵"
echo ""

# Check if .env file exists and if RUNPOD_API_KEY is already set
if [ -f .env ] && grep -q "RUNPOD_API_KEY=" .env; then
  echo "Found existing RunPod API key in .env file."
  # Extract the existing API key
  EXISTING_KEY=$(grep "RUNPOD_API_KEY=" .env | cut -d '=' -f2)
  echo "Using existing RunPod API key: ${EXISTING_KEY:0:4}...${EXISTING_KEY: -4}"
  RUNPOD_API_KEY=$EXISTING_KEY
  echo ""
else
  # 2. Ask for RunPod API key
  echo "Please enter your RunPod API key (you can get this from https://runpod.io/console/user/settings):"
  read -p "> " RUNPOD_API_KEY

  # Validate that something was entered
    while [ -z "$RUNPOD_API_KEY" ]; do
    echo "API key cannot be empty. Please enter your RunPod API key:"
    read -p "> " RUNPOD_API_KEY
    done

    # Save the API key to .env file
    echo "Saving RunPod API key to environment..."
    if [ -f .env ]; then
    # If .env exists, check if RUNPOD_API_KEY is already set
    if grep -q "RUNPOD_API_KEY=" .env; then
        # Replace existing RUNPOD_API_KEY line
        sed -i "s/RUNPOD_API_KEY=.*/RUNPOD_API_KEY=$RUNPOD_API_KEY/" .env
    else
        # Append RUNPOD_API_KEY to existing .env
        echo "RUNPOD_API_KEY=$RUNPOD_API_KEY" >> .env
    fi
    else
    # Create new .env file with RUNPOD_API_KEY
    echo "RUNPOD_API_KEY=$RUNPOD_API_KEY" > .env
    fi

    echo "RunPod API key saved successfully!"
    echo ""
fi

# Check if .env file exists and if HF_TOKEN is already set
if [ -f .env ] && grep -q "HF_TOKEN=" .env; then
  echo "Found existing Hugging Face token in .env file."
  # Extract the existing token
  EXISTING_TOKEN=$(grep "HF_TOKEN=" .env | cut -d '=' -f2)
  echo "Using existing Hugging Face token: ${EXISTING_TOKEN:0:4}...${EXISTING_TOKEN: -4}"
  HF_TOKEN=$EXISTING_TOKEN
  echo ""
else
  # Ask for Hugging Face token
  echo "Please enter your Hugging Face token (you can get this from https://huggingface.co/settings/tokens):"
  read -p "> " HF_TOKEN

  # Validate that something was entered
  while [ -z "$HF_TOKEN" ]; do
    echo "Token cannot be empty. Please enter your Hugging Face token:"
    read -p "> " HF_TOKEN
  done

  # Save the token to .env file
  echo "Saving Hugging Face token to environment..."
  if [ -f .env ]; then
    # If .env exists, check if HF_TOKEN is already set
    if grep -q "HF_TOKEN=" .env; then
      # Replace existing HF_TOKEN line
      sed -i "s/HF_TOKEN=.*/HF_TOKEN=$HF_TOKEN/" .env
    else
      # Append HF_TOKEN to existing .env
      echo "HF_TOKEN=$HF_TOKEN" >> .env
    fi
  else
    # Create new .env file with HF_TOKEN
    echo "HF_TOKEN=$HF_TOKEN" > .env
  fi

  echo "Hugging Face token saved successfully!"
  echo ""
fi

cd frontend
npm install --quiet
# 3. Setup complete
echo "Setup finished! 🐵"
npm run dev
