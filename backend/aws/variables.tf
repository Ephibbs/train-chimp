# Existing variables
# ... 

# New inference variables
variable "inference_instance_type" {
  description = "EC2 instance type for the inference node"
  default     = "g5.xlarge"
}

variable "inference_ami_id" {
  description = "AMI ID for the inference EC2 instance"
  default     = "ami-0c55b159cbfafe1f0"
}

variable "inference_model_type" {
  description = "Base model type for inference"
  default     = "mistralai/Mistral-7B-v0.1"
}

variable "max_loras" {
  description = "Maximum number of LoRAs to load simultaneously"
  default     = 4
}

variable "max_lora_rank" {
  description = "Maximum rank for LoRA adapters"
  default     = 32
} 