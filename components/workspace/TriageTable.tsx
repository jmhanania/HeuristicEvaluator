'use client'

import { useState, useTransition, Fragment } from 'react'
import type { Finding, Severity, FindingStatus, FindingSource } from '@/db/schema'
import { SeverityBadge } from './SeverityBadge'
import type { ActiveHighlight } from './SitePreview'
import {
  confirmFinding,
  dismissFinding,
  rejectFinding,
  resetFinding,
} from '@/server/actions/findings'

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type SeverityFilter = Severity | 'all'
type StatusFilter = FindingStatus | 'all'
type SourceFilter = FindingSource | 'all'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function heuristicTag(f: Finding): string {
  if (f.framework === 'nng' && f.heuristicId != null) return `H${f.heuristicId}`
  if (f.framework === 'baymard' && f.baymardCategory) return f.baymardCategory.slice(0, 12)
  if (f.framework === 'wcag' && f.wcagCriterion) return f.wcagCriterion
  return f.framework.toUpperCase()
}

const FRAMEWORK_STYLE: Record<string, string> = {
  nng:     'bg-sky-500/20 text-sky-400',
  baymard: 'bg-amber-500/20 text-amber-400',
  wcag:    'bg-emerald-500/20 text-emerald-400',
}
const FRAMEWORK_LABEL: Record<string, string> = {
  nng:     'NNG',
  baymard: 'Baymard',
  wcag:    'WCAG',
}

function parseBbox(raw: string | null): { x: number; y: number; width: number; height: number } | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (typeof p.x === 'number') return p
    return null
  } catch {
    return null
  }
}

const STATUS_LABEL: Record<FindingStatus, string> = {
  confirmed:  'Confirmed',
  dismissed:  'Dismissed',
  pending:    'Pending',
  unverified: 'Unverified',
}

const STATUS_DOT: Record<FindingStatus, string> = {
  confirmed:  'bg-green-400',
  dismissed:  'bg-slate-500',
  pending:    'bg-yellow-400',
  unverified: 'bg-purple-400',
}

// ---------------------------------------------------------------------------
// Dismiss modal
// ---------------------------------------------------------------------------

interface DismissModalProps {
  findingId: string
  stepPath: string
  mode: 'dismiss' | 'reject'
  onClose: () => void
}

function DismissModal({ findingId, stepPath, mode, onClose }: DismissModalProps) {
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!reason.trim()) return
    startTransition(async () => {
      if (mode === 'dismiss') {
        await dismissFinding(findingId, reason.trim(), stepPath)
      } else {
        await rejectFinding(findingId, reason.trim(), stepPath)
      }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-96 rounded-lg border border-slate-700 bg-slate-800 p-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-semibold text-slate-200">
          {mode === 'dismiss' ? 'Dismiss finding' : 'Reject as hallucination'}
        </h3>
        <textarea
          autoFocus
          className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          rows={3}
          placeholder={mode === 'dismiss' ? 'Why is this not applicable?' : 'What did the AI get factually wrong?'}
          value={reason}
          onChange={e => setReason(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={!reason.trim() || pending}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40"
            onClick={submit}
          >
            {pending ? 'Saving...' : mode === 'dismiss' ? 'Dismiss' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

interface RowActionsProps {
  finding: Finding
  stepPath: string
}

function RowActions({ finding, stepPath }: RowActionsProps) {
  const [modal, setModal] = useState<'dismiss' | 'reject' | null>(null)
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(() => confirmFinding(finding.id, stepPath))
  }

  function reset() {
    startTransition(() => resetFinding(finding.id, stepPath))
  }

  return (
    <>
      {modal && (
        <DismissModal
          findingId={finding.id}
          stepPath={stepPath}
          mode={modal}
          onClose={() => setModal(null)}
        />
      )}
      <div className="flex items-center gap-1">
        {finding.status === 'confirmed' || finding.status === 'dismissed' ? (
          <button
            disabled={pending}
            onClick={reset}
            className="rounded px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-700 hover:text-slate-300 disabled:opacity-40"
          >
            Reset
          </button>
        ) : (
          <>
            <button
              disabled={pending || finding.status === 'unverified'}
              onClick={confirm}
              title={finding.status === 'unverified' ? 'Add evidence before confirming' : undefined}
              className="rounded bg-green-600/20 px-2 py-0.5 text-[10px] font-medium text-green-400 hover:bg-green-600/30 disabled:opacity-30"
            >
              Confirm
            </button>
            <button
              disabled={pending}
              onClick={() => setModal('dismiss')}
              className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-600 disabled:opacity-40"
            >
              Dismiss
            </button>
            {finding.source === 'ai' && (
              <button
                disabled={pending}
                onClick={() => setModal('reject')}
                title="Reject as AI hallucination"
                className="rounded px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-700 hover:text-red-400 disabled:opacity-40"
              >
                Hallucination
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  severityFilter: SeverityFilter
  statusFilter: StatusFilter
  sourceFilter: SourceFilter
  onSeverity: (v: SeverityFilter) => void
  onStatus: (v: StatusFilter) => void
  onSource: (v: SourceFilter) => void
  totalShown: number
  totalAll: number
}

function FilterBar({
  severityFilter, statusFilter, sourceFilter,
  onSeverity, onStatus, onSource,
  totalShown, totalAll,
}: FilterBarProps) {
  const severities: SeverityFilter[] = ['all', 'critical', 'serious', 'moderate', 'minor']
  const statuses: StatusFilter[] = ['all', 'pending', 'confirmed', 'unverified', 'dismissed']
  const sources: SourceFilter[] = ['all', 'codified', 'ai', 'manual']

  const pillBase = 'rounded px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors'
  const active = 'bg-slate-200 text-slate-900'
  const inactive = 'bg-slate-800 text-slate-400 hover:bg-slate-700'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-700/50 bg-slate-800/40 px-3 py-2">
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Severity</span>
        {severities.map(s => (
          <button key={s} className={`${pillBase} ${severityFilter === s ? active : inactive}`} onClick={() => onSeverity(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Status</span>
        {statuses.map(s => (
          <button key={s} className={`${pillBase} ${statusFilter === s ? active : inactive}`} onClick={() => onStatus(s)}>
            {s === 'all' ? 'All' : STATUS_LABEL[s as FindingStatus]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Source</span>
        {sources.map(s => (
          <button key={s} className={`${pillBase} ${sourceFilter === s ? active : inactive}`} onClick={() => onSource(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>
      <span className="ml-auto text-[10px] text-slate-500">
        {totalShown === totalAll ? `${totalAll} findings` : `${totalShown} / ${totalAll}`}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  findings: Finding[]
  stepPath: string
  onHover: (highlight: ActiveHighlight | null) => void
}

export function TriageTable({ findings: allFindings, stepPath, onHover }: Props) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = allFindings.filter(f => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false
    if (statusFilter !== 'all' && f.status !== statusFilter) return false
    if (sourceFilter !== 'all' && f.source !== sourceFilter) return false
    return true
  })

  function handleRowEnter(f: Finding) {
    const bbox = parseBbox(f.evidenceBbox)
    if (!bbox) return
    onHover({ bbox, severity: f.severity as Severity, label: f.title })
  }

  function handleRowLeave() {
    onHover(null)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <FilterBar
        severityFilter={severityFilter}
        statusFilter={statusFilter}
        sourceFilter={sourceFilter}
        onSeverity={setSeverityFilter}
        onStatus={setStatusFilter}
        onSource={setSourceFilter}
        totalShown={filtered.length}
        totalAll={allFindings.length}
      />

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No findings match the current filters.
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900">
              <tr className="border-b border-slate-700/60 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-2 py-2 font-medium">Src</th>
                <th className="px-2 py-2 font-medium">Framework</th>
                <th className="px-3 py-2 font-medium">Finding</th>
                <th className="px-3 py-2 font-medium">Evidence</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const isExpanded = expanded === f.id
                const hasBbox = !!parseBbox(f.evidenceBbox)
                const rowBg = i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/40'
                const dimmed = f.status === 'dismissed' ? 'opacity-40' : ''

                return (
                  <Fragment key={f.id}>
                    <tr
                      className={`group border-b border-slate-700/30 ${rowBg} ${dimmed} cursor-pointer transition-colors hover:bg-slate-700/40`}
                      onMouseEnter={() => handleRowEnter(f)}
                      onMouseLeave={handleRowLeave}
                      onClick={() => setExpanded(isExpanded ? null : f.id)}
                    >
                      {/* Status */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[f.status]}`} />
                          <span className="text-slate-400">{STATUS_LABEL[f.status]}</span>
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="px-3 py-2">
                        <SeverityBadge severity={f.severity as Severity} />
                      </td>

                      {/* Source */}
                      <td className="px-2 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          f.source === 'codified'
                            ? 'bg-teal-500/20 text-teal-400'
                            : f.source === 'ai'
                              ? 'bg-violet-500/20 text-violet-400'
                              : 'bg-slate-600/40 text-slate-400'
                        }`}>
                          {f.source === 'codified' ? 'CODE' : f.source === 'ai' ? 'AI' : 'MAN'}
                        </span>
                      </td>

                      {/* Framework + heuristic */}
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${FRAMEWORK_STYLE[f.framework] ?? 'bg-slate-700 text-slate-400'}`}>
                            {FRAMEWORK_LABEL[f.framework] ?? f.framework}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">{heuristicTag(f)}</span>
                        </div>
                      </td>

                      {/* Title */}
                      <td className="max-w-[220px] px-3 py-2">
                        <p className="truncate font-medium text-slate-200">{f.title}</p>
                        {f.aiConfidence && (
                          <span className={`text-[9px] ${
                            f.aiConfidence === 'high' ? 'text-green-500'
                            : f.aiConfidence === 'medium' ? 'text-yellow-500'
                            : 'text-red-500'
                          }`}>
                            {f.aiConfidence} confidence
                          </span>
                        )}
                      </td>

                      {/* Evidence indicator */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {f.evidenceSelector && (
                            <span title={f.evidenceSelector} className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                              CSS
                            </span>
                          )}
                          {hasBbox && (
                            <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-blue-400">
                              bbox
                            </span>
                          )}
                          {f.evidenceDomSnippet && (
                            <span className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                              DOM
                            </span>
                          )}
                          {!f.evidenceSelector && !hasBbox && !f.evidenceDomSnippet && (
                            <span className="text-[9px] text-slate-600">none</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <RowActions finding={f} stepPath={stepPath} />
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className={`${rowBg} border-b border-slate-700/30`}>
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-4 text-[11px]">
                            <div>
                              <p className="mb-1 font-semibold text-slate-300">Description</p>
                              <p className="text-slate-400 leading-relaxed">{f.description}</p>
                            </div>
                            <div>
                              <p className="mb-1 font-semibold text-slate-300">
                                {f.remediation ? 'Remediation' : 'Recommendation'}
                              </p>
                              <p className="text-slate-400 leading-relaxed">
                                {f.remediation ?? f.recommendation}
                              </p>
                            </div>
                            {f.evidenceSelector && (
                              <div className="col-span-2">
                                <p className="mb-1 font-semibold text-slate-300">CSS Selector</p>
                                <code className="block rounded bg-slate-900 px-3 py-1.5 font-mono text-[10px] text-green-400">
                                  {f.evidenceSelector}
                                </code>
                              </div>
                            )}
                            {f.evidenceDomSnippet && (
                              <div className="col-span-2">
                                <p className="mb-1 font-semibold text-slate-300">DOM Snippet</p>
                                <pre className="overflow-x-auto rounded bg-slate-900 px-3 py-1.5 font-mono text-[10px] text-slate-400 whitespace-pre-wrap">
                                  {f.evidenceDomSnippet}
                                </pre>
                              </div>
                            )}
                            {f.dismissReason && (
                              <div className="col-span-2">
                                <p className="mb-1 font-semibold text-slate-300">Dismiss Reason</p>
                                <p className="text-slate-500">{f.dismissReason}</p>
                              </div>
                            )}
                            {f.rejectionReason && (
                              <div className="col-span-2">
                                <p className="mb-1 font-semibold text-slate-300">Rejection Reason</p>
                                <p className="text-red-400">{f.rejectionReason}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
