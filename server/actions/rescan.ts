'use server'

import { revalidatePath } from 'next/cache'
import fs from 'fs/promises'
import { ulid } from 'ulid'
import { db } from '@/db/client'
import { steps, scans, findings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { runCodifiedChecks } from '@/server/codified'
import { analyze } from '@/server/ai/analyze'
import type { AuditProfile, NewFinding } from '@/db/schema'

export async function rescanStep(stepId: string, profile: AuditProfile, stepPath: string) {
  const [step] = await db.select().from(steps).where(eq(steps.id, stepId))
  if (!step) throw new Error('Step not found')
  if (!step.scrubbedDomPath || !step.screenshotPath) throw new Error('Step has no captured data to re-scan')

  const scrubbedHtml = await fs.readFile(step.scrubbedDomPath, 'utf-8')
  const screenshotBase64 = (await fs.readFile(step.screenshotPath)).toString('base64')

  // Load axe results if present
  let axeResults: { id: string; description: string; impact: string | null; nodes: { target: string[] }[] }[] = []
  if (step.axeResultsPath) {
    try {
      const raw = await fs.readFile(step.axeResultsPath, 'utf-8')
      const parsed = JSON.parse(raw)
      axeResults = parsed.violations ?? []
    } catch { /* ignore */ }
  }

  // Get previously confirmed findings to avoid duplication in prompt
  const existingFindings = await db.select().from(findings).where(eq(findings.stepId, stepId))
  const confirmedFindings = existingFindings.filter(f => f.status === 'confirmed') as NewFinding[]

  // Run codified checks
  const codifiedFindings: NewFinding[] = runCodifiedChecks(profile, scrubbedHtml, stepId)
    .filter(cf => !existingFindings.some(ef => ef.source === 'codified' && ef.title === cf.title))

  // Run AI analysis
  const { findings: aiFindings, scan: scanData } = await analyze({
    stepId,
    profile,
    scrubbedHtml,
    screenshotBase64,
    sessionName: '',
    flowName: '',
    stepName: step.name,
    stepOrder: step.order,
    totalSteps: 1,
    url: step.url,
    captureMethod: step.captureMethod ?? 'manual_upload',
    codifiedFindings: confirmedFindings,
    axeResults,
  })

  // Insert new scan row
  const scanId = ulid()
  await db.insert(scans).values({
    id: scanId,
    stepId,
    profile,
    triggeredBy: 'manual_rescan',
    geminiModel: scanData.geminiModel,
    findingsGenerated: scanData.findingsGenerated,
    findingsDiscarded: scanData.findingsDiscarded,
    completedAt: scanData.completedAt,
  })

  // Assign scanId and insert all new findings
  const allNew: NewFinding[] = [
    ...codifiedFindings.map(f => ({ ...f, scanId })),
    ...aiFindings.map(f => ({ ...f, scanId })),
  ]

  if (allNew.length > 0) {
    await db.insert(findings).values(allNew)
  }

  // Update step's last analyzed profile
  await db.update(steps)
    .set({ lastAnalyzedProfile: profile, analyzedAt: new Date() })
    .where(eq(steps.id, stepId))

  revalidatePath(stepPath)
}
