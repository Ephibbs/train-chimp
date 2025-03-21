# 🐵 TrainChimp: The Open-Source Serverless AI Fine-Tuning & Inference Cloud

TrainChimp is an open-source platform designed to streamline your entire generative AI lifecycle, from fine-tuning to scalable inference in a no-code way.

## 📌 Overview of TrainChimp

TrainChimp provides a unified, user-friendly interface to:
- Launch no-code supervised fine-tuning jobs for language models using all available hardware accelerations (flash attention, fused kernels, etc) on AWS GPUs
- Efficiently utilize LoRA (Low-Rank Adaptation) techniques for resource-effective fine-tuning
- Manage data pipelines and analytics with Weights & Biases (wandb)
- Deploy to Together.ai for serverless inference

## Core Tech Stack
- Supabase for authentication, database, object storage, and queues
- Next.js for the frontend
- Weights & Biases for analytics
- AWS instances for fine-tuning that automatically start and stop when idle
- Together.ai for inference

## Get Started

```bash
git clone https://github.com/trainchimp/trainchimp.git
cd trainchimp
```

then fill in your environment variables
```bash
cp .env.example .env
```

then run the setup script
```bash
./setup.sh
```
then run the frontend
```bash
cd frontend
npm install
npm run dev
```

## ⚠️ Warning

This is a work in progress. New versions may be created quickly and are not guaranteed to be stable or backwards compatible.

## Future plans
- Deploy highly scalable inference endpoints using vLLM
- Switch to an edge-based infrastructure as much as possible for optimal performance
- More LLM base models
- Support for other model types (e.g. Diffusion, TTS, etc.)
- Add more fine-tuning techniques
- Add analytics
- Add real-time experiment monitoring
