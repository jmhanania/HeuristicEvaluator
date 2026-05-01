'use client'

import { useState } from 'react'
import type { Session, Flow, Step, Finding } from '@/db/schema'
import { SitePreview, type ActiveHighlight } from '@/components/workspace/SitePreview'
import { TriageTable } from '@/components/workspace/TriageTable'

interface Props {
  session: Session
  flow: Flow
  step: Step
  findings: Finding[]
  screenshotUrl: string | null
  stepPath: string
}

export function WorkspaceClient({ session, flow, step, findings, screenshotUrl, stepPath }: Props) {
  const [highlight, setHighlight] = useState<ActiveHighlight | null>(null)

  const confirmedCount = findings.filter(f => f.status === 'confirmed').length
  const pendingCount = findings.filter(f => f.status === 'pending' || f.status === 'unverified').length
  const criticalCount = findings.filter(f => f.severity === 'critical' && f.status !== 'dismissed').length

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      {/* Top nav */}
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-700/50 bg-slate-900 px-4 py-2.5">
        <a href="/" className="text-[11px] text-slate-500 hover:text-slate-300">Home</a>
        <span className="text-slate-700">/</span>
        <span className="text-[11px] text-slate-400">{session.name}</span>
        <span className="text-slate-700">/</span>
        <span className="text-[11px] text-slate-400">{flow.name}</span>
        <span className="text-slate-700">/</span>
        <span className="text-[11px] font-semibold text-slate-200">{step.name}</span>

        <div className="ml-auto flex items-center gap-3 text-[11px]">
          {criticalCount > 0 && (
            <span className="rounded bg-red-500/20 px-2 py-0.5 font-bold text-red-400">
              {criticalCount} critical
            </span>
          )}
          <span className="text-slate-500">
            {confirmedCount} confirmed &middot; {pendingCount} pending &middot; {findings.length} total
          </span>
          {step.lastAnalyzedProfile && (
            <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-500 uppercase text-[9px] tracking-wider">
              {step.lastAnalyzedProfile}
            </span>
          )}
          <a
            href={`/reports/${flow.id}`}
            className="rounded bg-violet-600/20 px-3 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-600/30"
          >
            View Report
          </a>
        </div>
      </header>

      {/* Main split */}
      <div className="flex min-h-0 flex-1">
        {/* Left: screenshot preview */}
        <div className="w-[52%] shrink-0 border-r border-slate-700/50">
          <SitePreview
            screenshotUrl={screenshotUrl}
            highlight={highlight}
            stepUrl={step.url}
            captureMethod={step.captureMethod ?? 'manual_upload'}
          />
        </div>

        {/* Right: triage table */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TriageTable
            findings={findings}
            stepPath={stepPath}
            onHover={setHighlight}
          />
        </div>
      </div>
    </div>
  )
}
