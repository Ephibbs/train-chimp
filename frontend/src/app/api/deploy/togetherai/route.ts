import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {

    // Parse request body
    const body = await request.json();
    const { model_id, hf_model_id, hf_model_url, base_model } = body;

    if (!model_id || !hf_model_id || !hf_model_url || !base_model) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate base model - ensure it's one of the supported models
    const supportedBaseModels = [
      "meta-llama/Llama-3.2-1B-Instruct",
      "meta-llama/Llama-3.2-3B-Instruct",
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "Qwen/Qwen2.5-14B-Instruct",
      "Qwen/Qwen2.5-72B-Instruct"
    ];

    if (!supportedBaseModels.includes(base_model)) {
      return NextResponse.json(
        { error: 'Unsupported base model. Please select one of the supported base models.' },
        { status: 400 }
      );
    }

    // Make sure the Hugging Face token is set
    const hfToken = process.env.NEXT_PUBLIC_HF_TOKEN;
    if (!hfToken) {
      console.error('Hugging Face token not configured');
      return NextResponse.json(
        { error: 'Hugging Face token not configured' },
        { status: 500 }
      );
    }

    // Check if Together API key is set
    const togetherApiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
    if (!togetherApiKey) {
      console.error('Together AI API key not configured');
      return NextResponse.json(
        { error: 'Together AI API key not configured' },
        { status: 500 }
      );
    }

    // Call Together AI API to upload adapter
    const response = await fetch('https://api.together.xyz/v0/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${togetherApiKey}`
      },
      body: JSON.stringify({
        model_name: hf_model_id.replace('/', '-'),
        model_source: hf_model_url,
        model_type: "adapter",
        base_model: base_model,
        description: `LoRA adapter for ${hf_model_id}`,
        hf_token: hfToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Together AI API error:', errorData);
      throw new Error(`Together AI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Check if the response contains job_id
    if (!data.data?.job_id) {
      console.error('No job ID returned from Together AI API');
      throw new Error('No job ID returned from Together AI API');
    }

    return NextResponse.json({
      job_id: data.data.job_id,
      model_name: data.data.model_name
    });

  } catch (error) {
    console.error('Error deploying to Together AI:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 