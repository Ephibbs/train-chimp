import { NextResponse } from 'next/server';
import { getUserDatasets } from '@/lib/hf';

export async function GET() {
  try {
    // Get user datasets from Hugging Face
    const userDatasets = await getUserDatasets();
    
    if (!userDatasets) {
      return NextResponse.json(
        { error: "Failed to fetch datasets" },
        { status: 500 }
      );
    }
    
    // Return the datasets directly
    return NextResponse.json(userDatasets);
    
  } catch (error) {
    console.error("Error fetching datasets:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 