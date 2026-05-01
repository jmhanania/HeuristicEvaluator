import { notFound } from 'next/navigation'
import { db } from '@/db/client'
import { sessions, flows, steps, findings } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { config } from '@/lib/config'
import { computeHealthScore, buildHeatmap } from '@/lib/reportUtils'
import { HealthScoreCard } from '@/components/report/HealthScoreCard'
import { HeuristicHeatmap } from '@/components/report/HeuristicHeatmap'
import { StepSection } from '@/components/report/StepSection'
import { DismissedAppendix } from '@/components/report/DismissedAppendix'
import { MarkdownExportButton } from '@/components/report/MarkdownExportButton'
import { PDFDownloadButton } from '@/components/report/PDFDownloadButton'
import { PrintButton } from '@/components/report/PrintButton'
import type { PDFDocumentProps } from '@/components/report/PDFDocument'

interface PageProps {
  params: Promise<{ flowId: string }>
}

function screenshotUrlForStep(screenshotPath: string | null): string | null {
  if (!screenshotPath) return null
  const rel = screenshotPath.startsWith(config.storageRoot)
    ? screenshotPath.slice(config.storageRoot.length).replace(/^\//, '')
    : null
  return rel ? `/api/screenshots/${rel}` : null
}

export default async function ReportPage({ params }: PageProps) {
  const { flowId } = await params

  const [flow] = await db.select().from(flows).where(eq(flows.id, flowId))
  if (!flow) notFound()

  const [session] = await db.select().from(sessions).where(eq(sessions.id, flow.sessionId))
  if (!session) notFound()

  const flowSteps = await db
    .select()
    .from(steps)
    .where(eq(steps.flowId, flowId))
    .orderBy(steps.order)

  const stepIds = flowSteps.map(s => s.id)

  const allFindings = stepIds.length > 0
    ? await db.select().from(findings).where(inArray(findings.stepId, stepIds))
    : []

  const confirmedFindings = allFindings.filter(f => f.status === 'confirmed')
  const dismissedFindings = allFindings.filter(f => f.status === 'dismissed' && !f.rejectionReason)
  const hallucinations = allFindings.filter(f => !!f.rejectionReason)

  const health = computeHealthScore(allFindings)
  const heatmapRows = buildHeatmap(allFindings)

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Screenshot URLs by stepId
  const screenshotUrls: Record<string, string | null> = {}
  for (const step of flowSteps) {
    screenshotUrls[step.id] = screenshotUrlForStep(step.screenshotPath)
  }

  // Step name map for markdown
  const stepNames: Record<string, string> = {}
  for (const step of flowSteps) stepNames[step.id] = step.name

  // Build PDF props — screenshots need to be absolute URLs for react-pdf
  // We pass relative paths; PDFDownloadButton runs in browser where window.location is available
  const pdfProps: PDFDocumentProps = {
    flow,
    steps: flowSteps,
    allFindings,
    heatmapRows,
    health,
    screenshotUrls,
    date,
  }

  // Global pin counter per step
  let pinOffset = 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-700/50 bg-slate-900/90 px-6 py-3 backdrop-blur print:hidden">
        <a href="/" className="text-[11px] text-slate-500 hover:text-slate-300">Home</a>
        <span className="text-slate-700">/</span>
        <span className="text-[11px] text-slate-400">{session.name}</span>
        <span className="text-slate-700">/</span>
        <span className="text-[11px] font-semibold text-slate-200">{flow.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <MarkdownExportButton
            findings={allFindings}
            flowName={flow.name}
            stepNames={stepNames}
          />
          <PDFDownloadButton
            {...pdfProps}
            filename={`ux-audit-${flow.name.toLowerCase().replace(/\s+/g, '-')}.pdf`}
          />
          <PrintButton />
        </div>
      </div>

      {/* Report body */}
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-10 print:max-w-none print:px-8 print:py-6">
        {/* Health score */}
        <HealthScoreCard
          score={health}
          confirmedCount={confirmedFindings.length}
          totalCount={allFindings.length}
          flowName={flow.name}
          date={date}
        />

        {/* Executive heatmap */}
        <section>
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Executive Heatmap — Confirmed Findings by Heuristic
          </h2>
          <HeuristicHeatmap rows={heatmapRows} />
        </section>

        {/* Divider */}
        <hr className="border-slate-700/50" />

        {/* Step-by-step breakdown */}
        <section>
          <h2 className="mb-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Step-by-Step Breakdown
          </h2>
          <div className="space-y-14">
            {flowSteps.map(step => {
              const stepConfirmed = confirmedFindings.filter(f => f.stepId === step.id)
              const currentOffset = pinOffset
              pinOffset += stepConfirmed.length
              return (
                <StepSection
                  key={step.id}
                  step={step}
                  findings={stepConfirmed}
                  screenshotUrl={screenshotUrls[step.id]}
                  pinOffset={currentOffset}
                />
              )
            })}
          </div>
        </section>

        {/* Dismissed / hallucination appendix */}
        <hr className="border-slate-700/50" />
        <DismissedAppendix dismissed={dismissedFindings} hallucinations={hallucinations} />
      </div>
    </div>
  )
}
