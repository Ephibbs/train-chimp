# 🐵 TrainChimp: The No-Code AI Fine-Tuning Tool

TrainChimp is an open-source local tool designed to streamline your entire generative AI lifecycle, from fine-tuning to scalable inference in a no-code way.

## 📌 Overview of TrainChimp

TrainChimp provides a unified, user-friendly interface to:
- Launch no-code fine-tuning jobs for language models automatically using any available hardware accelerations (flash attention, fused kernels, etc) on RunPod GPUs
- Handle private datasets as well as huggingface datasets (define a template)
- Efficiently utilize LoRA (Low-Rank Adaptation) techniques for resource-effective fine-tuning
- Manage data pipelines and analytics with Weights & Biases (wandb)
- Deploy LoRA-tuned models to Together.ai for serverless inference
- Deploy any model to RunPod for serverless inference

## Get Started

```bash
git clone https://github.com/ephibbs/trainchimp.git
cd trainchimp
./start.sh
```

## Fine-Tuning Options

Supported training options:
- Full Fine-tuning ✅
- LORA Fine-tuning ✅

Supported methods:
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
- Next.js for the frontend
- Huggingface for dataset and model hosting + metadata
- Weights & Biases for analytics
- RunPod for fine-tuning that automatically starts and stops when idle, serverless inference
- Together.ai for serverless lora inference

## Fun Implementation Detail

Absolutely nothing is stored locally! I make use of huggingface's unlimited free public repo hosting to store all training artifacts and hack their model card tagging system to keep track of metadata on all fine-tuning runs. This means you can delete the TrainChimp folder and start fresh or maintain multiple copies on separate machines without losing any of your fine-tuning history.

## Future plans
- Multi-GPU support
- More GPU providers (AWS, Lambda, Azure, etc.)
- Add fine-tuning analytics & real-time monitoring
- Automatic evaluations on popular benchmarks (MMLU, HumanEval, etc.)
- More model types (e.g. Diffusion, TTS, etc.)

## ⚠️ Warning

Only run this tool locally! Deploying this tool on a public server will expose your API keys. This is a work in progress.

## Help build TrainChimp!

I'm looking for contributors to help build TrainChimp! If you're interested in contributing, please reach out on [LinkedIn](https://www.linkedin.com/in/evan-phibbs/) or [X](https://x.com/builtbyevan).