import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { ulid } from 'ulid'
import { db } from '@/db/client'
import { steps, scans, findings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { scrubHtml } from '@/lib/scrubber'
import { config, stepStorageDir, stepFilePath } from '@/lib/config'
import { runCodifiedChecks } from '@/server/codified'
import { analyze } from '@/server/ai/analyze'

// ---------------------------------------------------------------------------
// CORS — permissive for local development.
// The bookmarklet POSTs from an arbitrary external origin to localhost.
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ---------------------------------------------------------------------------
// Request body shape (sent by bookmarklet)
// ---------------------------------------------------------------------------

interface SnapshotPayload {
  stepId: string
  sessionId: string
  url: string
  captureMethod: 'bookmarklet' | 'manual_upload'
  rawHtml: string         // post-JS DOM before any scrubbing, sent from bookmarklet
  screenshotBase64: string // base64 JPEG, already redacted by user
  axeResults: {
    violations: AxeViolation[]
    passes: { id: string }[]
  }
  // Context for AI prompt
  sessionName: string
  flowName: string
  stepName: string
  stepOrder: number
  totalSteps: number
  auditProfile: 'nng' | 'ecommerce_baymard' | 'wcag22_only'
}

interface AxeViolation {
  id: string
  description: string
  impact: string | null
  nodes: { target: string[] }[]
}

// ---------------------------------------------------------------------------
// POST /api/snapshot
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Parse and validate body
  let payload: SnapshotPayload
  try {
    payload = (await req.json()) as SnapshotPayload
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const { stepId, sessionId } = payload
  if (!stepId || !sessionId) {
    return NextResponse.json(
      { error: 'stepId and sessionId are required' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  // 2. Resolve storage paths and ensure directories exist.
  // STORAGE_ROOT is resolved by lib/config at module load — no ambiguity.
  const storageDir = stepStorageDir(sessionId, stepId)
  await fs.mkdir(storageDir, { recursive: true })

  // 3. Write raw DOM (pre-scrub) — stored for future re-scrub passes
  const rawDomPath = stepFilePath(sessionId, stepId, 'rawDom')
  await fs.writeFile(rawDomPath, payload.rawHtml, 'utf-8')

  // 4. Scrub the DOM and write the clean version
  const { scrubbed, stats: scrubStats } = scrubHtml(payload.rawHtml)
  const scrubbedDomPath = stepFilePath(sessionId, stepId, 'scrubbedDom')
  await fs.writeFile(scrubbedDomPath, scrubbed, 'utf-8')

  // 5. Decode and write screenshot
  const screenshotPath = stepFilePath(sessionId, stepId, 'screenshot')
  const screenshotBuffer = Buffer.from(payload.screenshotBase64, 'base64')
  await fs.writeFile(screenshotPath, screenshotBuffer)

  // 6. Write axe results
  const axeResultsPath = stepFilePath(sessionId, stepId, 'axeResults')
  await fs.writeFile(axeResultsPath, JSON.stringify(payload.axeResults, null, 2), 'utf-8')

  // 7. Update the step row with file paths and capture metadata
  await db
    .update(steps)
    .set({
      captureMethod: payload.captureMethod,
      rawDomPath,
      scrubbedDomPath,
      screenshotPath,
      axeResultsPath,
      url: payload.url,
      lastAnalyzedProfile: payload.auditProfile,
      analyzedAt: new Date(),
    })
    .where(eq(steps.id, stepId))

  // 8. Run deterministic codified checks (no API call, no cost)
  const codifiedFindings = runCodifiedChecks(payload.auditProfile, scrubbed, stepId)

  // 9. Run Gemini analysis (single batched call for all heuristics)
  let aiFindings: (typeof findings.$inferInsert)[] = []
  let scanStats: { findingsGenerated: number; findingsDiscarded: number } = {
    findingsGenerated: 0,
    findingsDiscarded: 0,
  }

  if (!config.geminiApiKey) {
    console.warn('[snapshot] GEMINI_API_KEY not set — skipping AI analysis')
  } else {
    const result = await analyze({
      stepId,
      profile: payload.auditProfile,
      scrubbedHtml: scrubbed,
      screenshotBase64: payload.screenshotBase64,
      sessionName: payload.sessionName,
      flowName: payload.flowName,
      stepName: payload.stepName,
      stepOrder: payload.stepOrder,
      totalSteps: payload.totalSteps,
      url: payload.url,
      captureMethod: payload.captureMethod,
      codifiedFindings,
      axeResults: payload.axeResults.violations,
    })

    // 10. Insert scan record
    const scanId = ulid()
    await db.insert(scans).values({
      id: scanId,
      stepId,
      ...result.scan,
    })

    // Attach scan ID to AI findings before inserting
    aiFindings = result.findings.map(f => ({ ...f, scanId }))
    scanStats = {
      findingsGenerated: result.scan.findingsGenerated ?? 0,
      findingsDiscarded: result.scan.findingsDiscarded ?? 0,
    }
  }

  // 11. Insert all findings
  const allFindings = [...codifiedFindings, ...aiFindings]
  if (allFindings.length > 0) {
    await db.insert(findings).values(allFindings)
  }

  // 12. Respond with summary for the bookmarklet overlay
  return NextResponse.json(
    {
      ok: true,
      stepId,
      scrubStats,
      findings: {
        codified: codifiedFindings.length,
        ai: {
          generated: scanStats.findingsGenerated,
          discarded: scanStats.findingsDiscarded,
          confirmed: aiFindings.filter(f => f.status === 'confirmed').length,
          unverified: aiFindings.filter(f => f.status === 'unverified').length,
        },
        total: allFindings.length,
      },
    },
    { headers: CORS_HEADERS },
  )
}
