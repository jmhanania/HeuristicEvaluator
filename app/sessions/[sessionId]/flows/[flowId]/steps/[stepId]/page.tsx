import { notFound } from 'next/navigation'
import { db } from '@/db/client'
import { sessions, flows, steps, findings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { WorkspaceClient } from './WorkspaceClient'
import { config } from '@/lib/config'

interface PageProps {
  params: Promise<{ sessionId: string; flowId: string; stepId: string }>
}

export default async function StepWorkspacePage({ params }: PageProps) {
  const { sessionId, flowId, stepId } = await params

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session) notFound()

  const [flow] = await db.select().from(flows).where(eq(flows.id, flowId))
  if (!flow || flow.sessionId !== sessionId) notFound()

  const [step] = await db.select().from(steps).where(eq(steps.id, stepId))
  if (!step || step.flowId !== flowId) notFound()

  const stepFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.stepId, stepId))
    .orderBy(findings.createdAt)

  // Build screenshot URL served through /api/screenshots/
  let screenshotUrl: string | null = null
  if (step.screenshotPath) {
    // screenshotPath is absolute; strip STORAGE_ROOT prefix to get relative segments
    const rel = step.screenshotPath.startsWith(config.storageRoot)
      ? step.screenshotPath.slice(config.storageRoot.length).replace(/^\//, '')
      : null
    if (rel) screenshotUrl = `/api/screenshots/${rel}`
  }

  const stepPath = `/sessions/${sessionId}/flows/${flowId}/steps/${stepId}`

  return (
    <WorkspaceClient
      session={session}
      flow={flow}
      step={step}
      findings={stepFindings}
      screenshotUrl={screenshotUrl}
      stepPath={stepPath}
    />
  )
}
