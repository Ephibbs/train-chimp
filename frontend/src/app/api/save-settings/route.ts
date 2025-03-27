import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { hfToken, runpodToken, togetherAiToken } = await request.json();
    const envPath = path.join(process.cwd(), '.env.local');

    console.log('hfToken', hfToken);
    console.log('runpodToken', runpodToken);
    console.log('togetherAiToken', togetherAiToken);
    console.log('envPath', envPath);
    
    // Read existing .env.local file if it exists
    let envContent = '';
    try {
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
    } catch (error) {
      console.error('Error reading existing .env.local:', error);
    }
    
    // Parse existing content into key-value pairs
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        envVars[key.trim()] = value.trim();
      }
    });
    
    // Update the variables we're concerned with
    envVars['NEXT_PUBLIC_HF_TOKEN'] = hfToken;
    envVars['NEXT_PUBLIC_RUNPOD_API_KEY'] = runpodToken;
    envVars['NEXT_PUBLIC_TOGETHER_API_KEY'] = togetherAiToken;
    
    // Convert back to string format
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n';
    
    // Write back to file
    fs.writeFileSync(envPath, newEnvContent);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving environment variables:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
} 