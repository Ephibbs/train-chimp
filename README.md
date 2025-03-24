# 🐵 TrainChimp: The No-Code AI Fine-Tuning Tool

TrainChimp is an open-source tool designed to streamline your entire generative AI lifecycle, from fine-tuning to scalable inference in a no-code way. This tool is built for private usage only.

## 📌 Overview of TrainChimp

TrainChimp provides a unified, user-friendly interface to:
- Launch no-code fine-tuning jobs for language models automatically using any available hardware accelerations (flash attention, fused kernels, etc) on remote GPUs
- Automatically start and stop GPUs when done training
- Handle private datasets as well as public huggingface datasets
- Efficiently utilize LoRA techniques for resource-efficient fine-tuning
- Manage analytics with Weights & Biases
- Deploy and track deployed models:
  - LoRA serverless inference on Together.ai
  - Full model serverless inference on RunPod
  - Dedicated inference on Together.ai, RunPod, or Huggingface

## Get Started

```bash
git clone https://github.com/ephibbs/trainchimp.git
cd trainchimp
./start.sh
```

## Fine-Tuning Options

Supported model types:
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
- Huggingface for dataset and model hosting + metadata, dedicated inference
- Weights & Biases for analytics
- RunPod for fine-tuning that automatically starts and stops when idle, serverless inference
- Together.ai for serverless lora inference

## Fun Design Detail

Absolutely no data is stored locally! I make use of huggingface's unlimited free public repo hosting to store all training artifacts and hack their model card tagging system to keep track of all metadata on fine-tuning runs. This means you can delete the TrainChimp folder or maintain multiple copies on separate machines without losing or interfering with any of your fine-tuning history or active jobs!

## Future plans
- Multi-GPU support
- Add fine-tuning analytics & real-time monitoring with Weights & Biases
- More GPU providers (AWS, Lambda, Azure, Google Cloud, others?)
- More model types (e.g. Diffusion, TTS, etc.)
- Automatic evaluations on popular benchmarks (MMLU, HumanEval, etc.), create your own custom benchmarks?

## ⚠️ Warning

Only run this tool locally! Deploying this tool on a public server will expose your API keys. This project is a work in progress.

## Help build TrainChimp!

I'm looking for contributors to help build TrainChimp! If you're interested in contributing, please reach out on [LinkedIn](https://www.linkedin.com/in/evan-phibbs/) or [X](https://x.com/builtbyevan) or just email me at evan.phibbs@gmail.com.