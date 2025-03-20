# 🐵 TrainChimp: The Open-Source Serverless AI Fine-Tuning & Inference Cloud

TrainChimp is a comprehensive, open-source platform designed to streamline your entire AI lifecycle, from fine-tuning to scalable inference, leveraging powerful Cloudflare infrastructure and Rust APIs for maximum performance, security, and scalability.

## 📌 Overview of TrainChimp

TrainChimp provides a unified, user-friendly interface to:
- Effortlessly no-code supervised fine-tune AI models using hardware optimization (flash attention, etc.) techniques
- Efficiently utilize LoRA (Low-Rank Adaptation) techniques for resource-effective fine-tuning
- Manage data pipelines and analytics with Weights & Biases (wandb)
- Deploy to Together.ai for inference

## Core Tech Stack
- Supabase for authentication, database, object storage, and queues
- Next.js for the frontend
- Weights & Biases for analytics
- AWS instances for fine-tuning
- Together.ai for inference

Future plans:
- Deploy highly scalable inference endpoints using vLLM
- Switch to an edge-based infrastructure as much as possible for optimal performance


## 🌐 Future Core Tech Stack Options

| Component             | Technology                               |
|-----------------------|------------------------------------------|
| **Frontend**          | Next.js                                  |
| **Authentication**    | NextAuth.js                              |
| **API Backend**       | Rust (Actix, Axum, Rocket) via Cloudflare Workers |
| **Database**          | PlanetScale                            |
| **Object Storage**    | Cloudflare R2, notifications via Cloudflare Queues |
| **Worker Queue**      | Cloudflare Queues                        |
| **Fine-tuning Infra** | Hugging Face Transformers, GPUs (AWS)    |
| **Inference Infra**   | vLLM, GPUs (AWS)                         |
| **Analytics**         | Weights & Biases (wandb) |

## 🚀 TrainChimp Features

### Unified AI Workflow
- **Fine-Tuning**: Seamlessly train custom models with Hugging Face Transformers and Axolotl on GPU infrastructure.
- **Inference**: Optimized inference at scale using vLLM with dynamic batching capabilities.
- **Monitoring & Analytics**: Real-time monitoring and insightful analytics with Weights & Biases integration.

### High-Performance Rust APIs
- Powered by Cloudflare Workers, Rust APIs deliver fast, secure, and scalable endpoints.

### Cloudflare Edge Integration
- Utilize Cloudflare D1 database, R2 storage, and Queues directly at the edge, providing low latency and high availability globally.

## 🚀 Fine-Tuning with TrainChimp API

TrainChimp provides a powerful fine-tuning API endpoint to kickstart your AI model training:

```rust
// Example POST request to /fine-tune
{
  "user_id": "user-uuid-here",
  "model_name": "My Custom GPT Model",
  "description": "A fine-tuned model for customer support",
  "base_model": "mistralai/Mistral-7B-v0.1",
  "dataset_id": "dataset-uuid-here",
  "training_params": {
    "epochs": 3,
    "batch_size": 8,
    "learning_rate": 2e-5,
    "lora_rank": 8,
    "lora_alpha": 16
  }
}
```

The API validates your dataset, creates necessary database records, and queues the job for processing on our optimized GPU infrastructure. You'll receive a job ID to track your fine-tuning progress through our dashboard or API.

## ⚙️ Quickstart with Rust API

Deploy your Rust-based APIs rapidly using Cloudflare Workers:

```rust
use worker::*;

#[event(fetch)]
pub async fn main(req: Request, env: Env) -> Result<Response> {
    Router::new()
        .get("/", |_, _| Response::ok("Hello from TrainChimp Rust Worker!"))
        .get("/health", |_, _| Response::ok("Status: Healthy"))
        .run(req, env)
        .await
}
```

## ⚙️ Infrastructure Management via Terraform
Efficiently manage your infrastructure through Terraform:

```bash
terraform init
terraform plan
terraform apply
```

## 📈 Comprehensive Analytics
- **Weights & Biases**: Detailed model experiment tracking
- **Prometheus & Grafana**: Infrastructure monitoring
- **Cloudflare Analytics**: Built-in edge performance insights

## 📦 Admin Dashboard

The TrainChimp admin dashboard provides a comprehensive overview of your infrastructure, including:

- **Users**: Track users and set permissions.
- **Servers**: Track all running servers and their usage metrics and costs.
- **Fine-tuning**: Track all fine-tuning jobs, durations, and errors.
- **Models**: Track all fine-tuned adaptors, latency, errors, and where they are deployed.
- **Storage**: Monitor storage usage and costs.


## ✅ Seamless Deployment Workflow

### Step-by-Step Deployment Guide

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/trainchimp.git
   cd trainchimp
   ```

2. **Deploy the Rust API**
   ```bash
   wrangler login
   wrangler publish
   ```

3. **Deploy the Frontend**
   - Connect your GitHub repository to Cloudflare Pages.
   - Set the build command as:
     ```
     npm install && npm run build
     ```
   - Deploy the build output to Cloudflare Pages.

4. **Provision Infrastructure via Terraform**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

5. **Set Up Fine-tuning and Inference Infrastructure**
   - Configure GPUs on your preferred provider (e.g., CoreWeave, Lambda Labs).
   - Deploy your fine-tuning workflows using Hugging Face Transformers and Axolotl.
   - Set up vLLM for inference workloads.

1. **Rust API** deployment via Wrangler or Terraform
2. **Next.js Frontend** deployment through Cloudflare Pages
3. **Fine-tuning & Inference** automated CI/CD with GitHub Actions

## 🚨 Built-In Security
- Secure environment variable handling through Cloudflare Workers
- Robust authentication and rate limiting at Cloudflare's global edge network

## 📚 Next Steps
- Integrate Rust APIs with Cloudflare infrastructure
- Automate deployments and infrastructure management
- Enhance analytics and monitoring capabilities

TrainChimp is your all-in-one, scalable, and open-source solution for advanced AI fine-tuning and inference, making enterprise-level AI accessible to everyone.

