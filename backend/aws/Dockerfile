FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy service code
COPY finetuning_service.py .

# Make script executable
RUN chmod +x finetuning_service.py

# Default command
ENTRYPOINT ["python3", "finetuning_service.py"]
CMD ["--model-type", "mistralai/Mistral-7B-v0.1"] 