'use client'

import { useState } from 'react'
import type { Finding, Severity } from '@/db/schema'
import { SeverityBadge } from '@/components/workspace/SeverityBadge'

interface Props {
  dismissed: Finding[]
  hallucinations: Finding[]
}

export function DismissedAppendix({ dismissed, hallucinations }: Props) {
  const [open, setOpen] = useState(false)
  const total = dismissed.length + hallucinations.length

  if (total === 0) return null

  return (
    <section className="print:break-before-page">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/30 px-5 py-3.5 text-left transition-colors hover:bg-slate-800/60 print:hidden"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-semibold text-slate-300">Appendix: Dismissed &amp; Hallucination Log</span>
        <span className="ml-auto text-sm text-slate-500">{total} entries</span>
      </button>

      {/* Always shown in print */}
      <div className={`mt-4 space-y-6 ${open ? '' : 'hidden'} print:block`}>
        <p className="text-xs text-slate-500 leading-relaxed">
          The following findings were filtered from the main report. Dismissed findings were
          judged not applicable by the auditor. Hallucinations were AI outputs that were factually
          incorrect or unsupported by evidence in the captured DOM.
        </p>

        {dismissed.length > 0 && (
          <div>
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-700/50 pb-1">
              Dismissed ({dismissed.length})
            </h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 px-3 text-left font-medium">Severity</th>
                  <th className="py-2 px-3 text-left font-medium">Finding</th>
                  <th className="py-2 px-3 text-left font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {dismissed.map(f => (
                  <tr key={f.id} className="border-b border-slate-800 opacity-60">
                    <td className="py-2 px-3"><SeverityBadge severity={f.severity as Severity} /></td>
                    <td className="py-2 px-3 text-slate-400">{f.title}</td>
                    <td className="py-2 px-3 text-slate-500 italic">{f.dismissReason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hallucinations.length > 0 && (
          <div>
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-red-500/70 border-b border-slate-700/50 pb-1">
              Rejected as Hallucinations ({hallucinations.length})
            </h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 px-3 text-left font-medium">Finding</th>
                  <th className="py-2 px-3 text-left font-medium">What the AI got wrong</th>
                </tr>
              </thead>
              <tbody>
                {hallucinations.map(f => (
                  <tr key={f.id} className="border-b border-slate-800 opacity-60">
                    <td className="py-2 px-3 text-slate-400">{f.title}</td>
                    <td className="py-2 px-3 text-red-400/70 italic">{f.rejectionReason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
