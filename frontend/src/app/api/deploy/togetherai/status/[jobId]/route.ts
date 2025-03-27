import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Check if Together API key is set
    const togetherApiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
    if (!togetherApiKey) {
      return NextResponse.json(
        { error: 'Together AI API key not configured' },
        { status: 500 }
      );
    }

    // Call Together AI API to check job status
    const response = await fetch(`https://api.together.xyz/v1/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${togetherApiKey}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Together AI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error checking job status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 