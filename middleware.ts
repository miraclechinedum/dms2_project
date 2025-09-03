import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // Temporarily disable middleware to avoid redirect loops
  // The pages will handle their own auth checks

  return res
}

export const config = {
  matcher: []
}