# Create the inference EC2 instance
resource "aws_instance" "inference_node" {
  ami                    = var.inference_ami_id
  instance_type          = var.inference_instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.inference_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.inference_profile.name

  root_block_device {
    volume_size = 150  # GB
    volume_type = "gp3"
  }

  tags = {
    Name = "trainchimp-inference-${var.inference_model_type}"
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
    mkdir -p /data/trainchimp/loras

    # Set environment variables
    cat > /etc/environment <<EOL
    CLOUDFLARE_API_TOKEN=${var.cloudflare_api_token}
    CLOUDFLARE_ACCOUNT_ID=${var.cloudflare_account_id}
    MODEL_TYPE=${var.inference_model_type}
    DATABASE_NAME=${var.database_name}
    BUCKET_NAME=${var.bucket_name}
    DATA_DIR=/data/trainchimp
    MAX_LORAS=${var.max_loras}
    MAX_LORA_RANK=${var.max_lora_rank}
    HOST=0.0.0.0
    PORT=8000
    EOL

    # Clone the repository and build the Docker image
    git clone https://github.com/yourusername/trainchimp.git /opt/trainchimp
    cd /opt/trainchimp/backend/aws
    docker build -t trainchimp-inference -f Dockerfile.inference .

    # Create a systemd service to run the container
    cat > /etc/systemd/system/trainchimp-inference.service <<EOL
    [Unit]
    Description=TrainChimp Inference Service
    After=docker.service
    Requires=docker.service

    [Service]
    Restart=always
    ExecStartPre=-/usr/bin/docker stop trainchimp-inference
    ExecStartPre=-/usr/bin/docker rm trainchimp-inference
    ExecStart=/usr/bin/docker run --name trainchimp-inference \
              --gpus all \
              -p 8000:8000 \
              -v /data/trainchimp:/data/trainchimp \
              --env-file /etc/environment \
              trainchimp-inference

    [Install]
    WantedBy=multi-user.target
    EOL

    # Enable and start the service
    systemctl enable trainchimp-inference
    systemctl start trainchimp-inference
  EOF
}

# Security group for the inference node
resource "aws_security_group" "inference_sg" {
  name        = "trainchimp-inference-sg"
  description = "Security group for TrainChimp inference nodes"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8000
    to_port     = 8000
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
    Name = "trainchimp-inference-sg"
  }
}

# IAM role for the inference node
resource "aws_iam_role" "inference_role" {
  name = "trainchimp-inference-role"

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
resource "aws_iam_instance_profile" "inference_profile" {
  name = "trainchimp-inference-profile"
  role = aws_iam_role.inference_role.name
}

output "inference_node_ip" {
  value = aws_instance.inference_node.public_ip
}

output "inference_node_id" {
  value = aws_instance.inference_node.id
} 