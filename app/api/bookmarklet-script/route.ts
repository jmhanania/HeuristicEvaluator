import { NextRequest, NextResponse } from 'next/server'
import { generateBookmarkletScript } from '@/server/bookmarklet/script'

// CORS — bookmarklet is fetched from external origins
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  // Derive origin from request so the script works regardless of which port
  // the dev server is bound to. `PORT` env is a fallback for edge cases.
  const origin = req.nextUrl.origin

  const script = generateBookmarkletScript(origin)

  return new NextResponse(script, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'application/javascript; charset=utf-8',
      // No caching — origin can change between dev sessions
      'Cache-Control': 'no-store',
    },
  })
}
