import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from 'next/server'

// Handle auth requests - this is just a placeholder as we'll be using Supabase directly from the client
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return NextResponse.json({ user: data.session?.user || null })
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return NextResponse.json({ user: data.session?.user || null })
}

export { GET as POST }