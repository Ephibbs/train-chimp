import { getUser } from './supabase/server'

export async function auth() {
  const user = await getUser()
  
  if (!user) {
    return null
  }
  
  return {
    user: {
      id: user.id,
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      email: user.email,
      image: user.user_metadata?.avatar_url,
    }
  }
}

// Export a dummy handlers object for compatibility with route.ts
export const handlers = {
  GET: async () => new Response('Auth handler', { status: 200 }),
  POST: async () => new Response('Auth handler', { status: 200 })
}