# 🐵 TrainChimp: The Open-Source No-Code AI Fine-Tuning Tool

TrainChimp is an open-source tool designed to streamline your entire generative AI lifecycle, from fine-tuning to scalable inference in a no-code way.

## 📌 Overview of TrainChimp

TrainChimp provides a unified, user-friendly interface to:
- Launch no-code fine-tuning jobs for language models automatically using any available hardware accelerations (flash attention, fused kernels, etc) on RunPod GPUs
- Handle private datasets as well as huggingface datasets (define a template)
- Efficiently utilize LoRA (Low-Rank Adaptation) techniques for resource-effective fine-tuning
- Manage data pipelines and analytics with Weights & Biases (wandb)
- Deploy LoRA-tuned models to Together.ai for serverless inference

## Fine-Tuning Options

Supported fine-tuning options:
- Full Fine-tuning ✅
- LORA Fine-tuning ✅

Supported fine-tuning methods:
- SFT ✅
- DPO ✅
- PPO ✅
- GRPO ✅

Supported models:
- Llama 3.x Series ✅
- Qwen ✅
- DeepSeek ✅
- Others (?)

## Core Tech Stack
- SQLite for database
- Next.js for the frontend
- Weights & Biases for analytics
- RunPod for fine-tuning that automatically starts and stops when idle
- Together.ai for serverless inference

## Get Started

```bash
git clone https://github.com/ephibbs/trainchimp.git
cd trainchimp
./start.sh
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
