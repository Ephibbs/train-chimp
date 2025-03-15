provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  default     = "us-west-2"
}

variable "instance_type" {
  description = "EC2 instance type for the fine-tuning node"
  default     = "g4dn.xlarge"  # NVIDIA T4 GPU
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance"
  default     = "ami-0c55b159cbfafe1f0"  # Ubuntu 20.04 with NVIDIA drivers
}

variable "key_name" {
  description = "SSH key name for EC2 instance"
  type        = string
}

variable "model_type" {
  description = "Base model type to fine-tune"
  default     = "mistralai/Mistral-7B-v0.1"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "queue_name" {
  description = "Cloudflare queue name"
  default     = "my-app-queue"
}

variable "database_name" {
  description = "Cloudflare D1 database name"
  default     = "trainchimp-db"
}

variable "bucket_name" {
  description = "Cloudflare R2 bucket name"
  default     = "my-app-bucket"
}

# Security group for the fine-tuning node
resource "aws_security_group" "finetuning_sg" {
  name        = "trainchimp-finetuning-sg"
  description = "Security group for TrainChimp fine-tuning nodes"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "trainchimp-finetuning-sg"
  }
}

# IAM role for the fine-tuning node
resource "aws_iam_role" "finetuning_role" {
  name = "trainchimp-finetuning-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM instance profile
resource "aws_iam_instance_profile" "finetuning_profile" {
  name = "trainchimp-finetuning-profile"
  role = aws_iam_role.finetuning_role.name
}

# EC2 instance for the fine-tuning node
resource "aws_instance" "finetuning_node" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.finetuning_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.finetuning_profile.name

  root_block_device {
    volume_size = 100  # GB
    volume_type = "gp3"
  }

  tags = {
    Name = "trainchimp-finetuning-${var.model_type}"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Install Docker
    apt-get update
    apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io

    # Install NVIDIA Container Toolkit
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
    curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add -
    curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | tee /etc/apt/sources.list.d/nvidia-docker.list
    apt-get update && apt-get install -y nvidia-container-toolkit
    systemctl restart docker

    # Create data directory
    mkdir -p /data/trainchimp

    # Set environment variables
    cat > /etc/environment <<EOL
    CLOUDFLARE_API_TOKEN=${var.cloudflare_api_token}
    CLOUDFLARE_ACCOUNT_ID=${var.cloudflare_account_id}
    MODEL_TYPE=${var.model_type}
    QUEUE_NAME=${var.queue_name}
    DATABASE_NAME=${var.database_name}
    BUCKET_NAME=${var.bucket_name}
    DATA_DIR=/data/trainchimp
    EOL

    # Clone the repository and build the Docker image
    git clone https://github.com/yourusername/trainchimp.git /opt/trainchimp
    cd /opt/trainchimp/backend/aws
    docker build -t trainchimp-finetuning .

    # Create a systemd service to run the container
    cat > /etc/systemd/system/trainchimp-finetuning.service <<EOL
    [Unit]
    Description=TrainChimp Fine-Tuning Service
    After=docker.service
    Requires=docker.service

    [Service]
    Restart=always
    ExecStartPre=-/usr/bin/docker stop trainchimp-finetuning
    ExecStartPre=-/usr/bin/docker rm trainchimp-finetuning
    ExecStart=/usr/bin/docker run --name trainchimp-finetuning \
              --gpus all \
              -v /data/trainchimp:/data/trainchimp \
              --env-file /etc/environment \
              trainchimp-finetuning

    [Install]
    WantedBy=multi-user.target
    EOL

    # Enable and start the service
    systemctl enable trainchimp-finetuning
    systemctl start trainchimp-finetuning
  EOF
}

output "finetuning_node_ip" {
  value = aws_instance.finetuning_node.public_ip
}

output "finetuning_node_id" {
  value = aws_instance.finetuning_node.id
} 