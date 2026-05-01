import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { ulid } from 'ulid'
import { db } from '@/db/client'
import { steps, flows, scans, findings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { scrubHtml } from '@/lib/scrubber'
import { config, stepStorageDir, stepFilePath } from '@/lib/config'
import { runCodifiedChecks } from '@/server/codified'
import { analyze } from '@/server/ai/analyze'
import type { AuditProfile, NewFinding } from '@/db/schema'

// ── CORS (bookmarklet POSTs from external origins to localhost) ────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ── Payload ────────────────────────────────────────────────────────────────
// The bookmarklet sends this shape. Step and flow are created server-side
// when IDs are absent, so the bookmarklet needs zero DB knowledge.

interface SnapshotPayload {
  // Session (always required)
  sessionId: string
  sessionName: string

  // Flow resolution: provide flowId for an existing flow,
  // or newFlowName to create one on the fly.
  flowId: string | null
  newFlowName: string | null

  // Step resolution: stepId for re-capture; omit to create a new step.
  stepId?: string | null

  // Step metadata
  stepName: string
  url: string
  captureMethod: 'bookmarklet' | 'manual_upload'
  hasRedactions: boolean
  auditProfiles: AuditProfile[]

  // Captured data
  rawHtml: string
  screenshotBase64: string
  axeResults: {
    violations: AxeViolation[]
    passes: { id: string }[]
  }
}

interface AxeViolation {
  id: string
  description: string
  impact: string | null
  nodes: { target: string[] }[]
}

// ── POST /api/snapshot ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Parse body
  let payload: SnapshotPayload
  try {
    payload = (await req.json()) as SnapshotPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS })
  }

  if (!payload.sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400, headers: CORS })
  }

  // 2. Resolve (or create) the flow
  let flowId = payload.flowId
  if (!flowId) {
    const newFlow = {
      id: ulid(),
      sessionId: payload.sessionId,
      name: payload.newFlowName || 'Untitled Flow',
      description: null,
      order: 0,
      createdAt: new Date(),
    }
    await db.insert(flows).values(newFlow)
    flowId = newFlow.id
  }

  // 3. Resolve (or create) the step
  let stepId = payload.stepId ?? null
  if (!stepId) {
    const existingSteps = await db
      .select({ order: steps.order })
      .from(steps)
      .where(eq(steps.flowId, flowId))

    const nextOrder = existingSteps.length > 0
      ? Math.max(...existingSteps.map(s => s.order)) + 1
      : 0

    const newStep = {
      id: ulid(),
      flowId,
      name: payload.stepName,
      url: payload.url,
      order: nextOrder,
      captureMethod: payload.captureMethod,
      hasRedactions: payload.hasRedactions,
      createdAt: new Date(),
    }
    await db.insert(steps).values(newStep)
    stepId = newStep.id
  }

  // 4. Resolve storage paths and ensure directory exists.
  // STORAGE_ROOT is resolved once by lib/config on module load.
  const storageDir = stepStorageDir(payload.sessionId, stepId)
  await fs.mkdir(storageDir, { recursive: true })

  // 5. Write raw DOM (pre-scrub) — kept for future re-scrub passes
  const rawDomPath = stepFilePath(payload.sessionId, stepId, 'rawDom')
  await fs.writeFile(rawDomPath, payload.rawHtml, 'utf-8')

  // 6. Scrub and write clean DOM
  const { scrubbed, stats: scrubStats } = scrubHtml(payload.rawHtml)
  const scrubbedDomPath = stepFilePath(payload.sessionId, stepId, 'scrubbedDom')
  await fs.writeFile(scrubbedDomPath, scrubbed, 'utf-8')

  // 7. Write screenshot
  const screenshotPath = stepFilePath(payload.sessionId, stepId, 'screenshot')
  await fs.writeFile(screenshotPath, Buffer.from(payload.screenshotBase64, 'base64'))

  // 8. Write axe results
  const axeResultsPath = stepFilePath(payload.sessionId, stepId, 'axeResults')
  await fs.writeFile(axeResultsPath, JSON.stringify(payload.axeResults, null, 2), 'utf-8')

  // 9. Update step record with file paths
  await db
    .update(steps)
    .set({
      captureMethod:       payload.captureMethod,
      rawDomPath,
      scrubbedDomPath,
      screenshotPath,
      axeResultsPath,
      url:                 payload.url,
      hasRedactions:       payload.hasRedactions,
      lastAnalyzedProfile: (payload.auditProfiles ?? ['nng'])[0],
      analyzedAt:          new Date(),
    })
    .where(eq(steps.id, stepId))

  const profiles: AuditProfile[] = payload.auditProfiles?.length ? payload.auditProfiles : ['nng']

  // 10. Codified checks — run for each profile, deduplicate by title
  const seenTitles = new Set<string>()
  const codifiedFindings: NewFinding[] = []
  for (const profile of profiles) {
    for (const f of runCodifiedChecks(profile, scrubbed, stepId)) {
      if (!seenTitles.has(f.title)) {
        seenTitles.add(f.title)
        codifiedFindings.push(f)
      }
    }
  }

  // 11. Gemini analysis — one call per profile
  let aiFindings: NewFinding[] = []
  let scanStats = { findingsGenerated: 0, findingsDiscarded: 0 }

  if (!config.geminiApiKey) {
    console.warn('[snapshot] GEMINI_API_KEY not set — skipping AI analysis')
  } else {
    for (const profile of profiles) {
      try {
        const result = await analyze({
          stepId,
          profile,
          scrubbedHtml: scrubbed,
          screenshotBase64: payload.screenshotBase64,
          sessionName: payload.sessionName,
          flowName: payload.newFlowName || payload.flowId || 'Unknown Flow',
          stepName: payload.stepName,
          stepOrder: 1,
          totalSteps: 1,
          url: payload.url,
          captureMethod: payload.captureMethod,
          codifiedFindings,
          axeResults: payload.axeResults.violations,
        })

        const scanId = ulid()
        await db.insert(scans).values({
          id: scanId,
          stepId,
          ...result.scan,
        })

        aiFindings = aiFindings.concat(result.findings.map(f => ({ ...f, scanId })))
        scanStats.findingsGenerated += result.scan.findingsGenerated ?? 0
        scanStats.findingsDiscarded += result.scan.findingsDiscarded ?? 0
      } catch (err) {
        console.error(`[snapshot] Gemini analysis failed for profile ${profile}:`, err)
      }
    }
  }

  // 12. Persist all findings
  const allFindings = [...codifiedFindings, ...aiFindings]
  if (allFindings.length > 0) {
    await db.insert(findings).values(allFindings)
  }

  // 13. Return summary to bookmarklet overlay
  return NextResponse.json(
    {
      ok: true,
      stepId,
      flowId,
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
    { headers: CORS },
  )
}
