import type { Step, Finding, Severity } from '@/db/schema'
import { PinnedScreenshot, type Pin } from './PinnedScreenshot'
import { SeverityBadge } from '@/components/workspace/SeverityBadge'
import { NNG_HEURISTICS } from '@/lib/reportUtils'

interface Props {
  step: Step
  findings: Finding[]       // only confirmed, for this step
  screenshotUrl: string | null
  pinOffset: number         // global pin numbering offset for this step
}

function heuristicLabel(f: Finding): string {
  if (f.framework === 'nng' && f.heuristicId) {
    return `H${f.heuristicId}: ${NNG_HEURISTICS[f.heuristicId] ?? ''}`
  }
  if (f.framework === 'wcag' && f.wcagCriterion) return `WCAG ${f.wcagCriterion}`
  if (f.framework === 'baymard' && f.baymardCategory) return f.baymardCategory
  return f.framework.toUpperCase()
}

function parseBbox(raw: string | null) {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    return typeof p.x === 'number' ? p : null
  } catch { return null }
}

// Group findings by their heuristic label
function groupByHeuristic(findings: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>()
  for (const f of findings) {
    const key = heuristicLabel(f)
    const arr = map.get(key) ?? []
    arr.push(f)
    map.set(key, arr)
  }
  return map
}

const SOURCE_LABEL: Record<string, string> = { codified: 'Codified rule', ai: 'AI', manual: 'Manual' }

export function StepSection({ step, findings, screenshotUrl, pinOffset }: Props) {
  // Build pins for findings that have bbox
  const pins: Pin[] = []
  findings.forEach((f, i) => {
    const bbox = parseBbox(f.evidenceBbox)
    if (bbox) {
      pins.push({ number: pinOffset + i + 1, bbox, severity: f.severity as Severity })
    }
  })

  const grouped = groupByHeuristic(findings)

  return (
    <section className="print:break-before-page">
      {/* Step header */}
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-lg font-bold text-slate-100">{step.name}</h2>
        <span className="font-mono text-xs text-slate-500 truncate">{step.url}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6 print:grid-cols-2">
        {/* Screenshot with pins */}
        <div>
          {screenshotUrl ? (
            <PinnedScreenshot screenshotUrl={screenshotUrl} pins={pins} />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-600">
              No screenshot
            </div>
          )}
        </div>

        {/* Findings grouped by heuristic */}
        <div className="space-y-4">
          {findings.length === 0 ? (
            <p className="text-sm text-slate-500">No confirmed findings on this step.</p>
          ) : (
            Array.from(grouped.entries()).map(([label, group]) => (
              <div key={label}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/50 pb-1">
                  {label}
                </h3>
                <div className="space-y-2">
                  {group.map((f, idx) => {
                    const pinNum = pinOffset + findings.indexOf(f) + 1
                    const hasBbox = !!parseBbox(f.evidenceBbox)

                    return (
                      <div
                        key={f.id}
                        className="rounded-lg border border-slate-700/40 bg-slate-800/40 px-3 py-2.5 print:break-inside-avoid"
                      >
                        <div className="flex items-start gap-2">
                          {hasBbox && (
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-slate-300">
                              {pinNum}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <SeverityBadge severity={f.severity as Severity} />
                              <span className="text-[9px] text-slate-500 uppercase">{SOURCE_LABEL[f.source]}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-200">{f.title}</p>
                            <p className="mt-1 text-xs text-slate-400 leading-relaxed">{f.description}</p>
                            {(f.remediation ?? f.recommendation) && (
                              <div className="mt-2 rounded bg-slate-900/60 px-2 py-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                                  Remediation
                                </p>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                  {f.remediation ?? f.recommendation}
                                </p>
                              </div>
                            )}
                            {f.evidenceSelector && (
                              <code className="mt-1.5 block font-mono text-[10px] text-green-400 truncate">
                                {f.evidenceSelector}
                              </code>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
