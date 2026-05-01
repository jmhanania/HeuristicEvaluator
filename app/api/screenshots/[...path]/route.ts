import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { config } from '@/lib/config'

// Serves screenshot files from STORAGE_ROOT.
// URL pattern: /api/screenshots/[sessionId]/[stepId]/screenshot.jpg
// The path segments map directly to the STORAGE_ROOT directory layout.
// This route must exist because screenshots live outside the Next.js public/
// folder and cannot be served statically.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path
  if (!segments || segments.length < 2) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Resolve against STORAGE_ROOT. path.resolve rejects traversal attempts
  // because any `..` would escape the root, and we validate below.
  const filePath = path.resolve(config.storageRoot, ...segments)

  // Prevent path traversal: resolved path must stay inside STORAGE_ROOT
  if (!filePath.startsWith(config.storageRoot + path.sep)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const data = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : 'application/octet-stream'

    return new NextResponse(data, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
