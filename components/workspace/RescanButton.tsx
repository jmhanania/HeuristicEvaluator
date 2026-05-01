'use client'

import { useState, useTransition } from 'react'
import { rescanStep } from '@/server/actions/rescan'
import type { AuditProfile } from '@/db/schema'

const PROFILE_LABELS: Record<AuditProfile, string> = {
  nng:               'NNG — 10 Usability Heuristics',
  ecommerce_baymard: 'Ecommerce — Baymard Guidelines',
  wcag22_only:       'WCAG 2.2 Accessibility',
}

interface Props {
  stepId: string
  stepPath: string
  currentProfile: AuditProfile | null
}

export function RescanButton({ stepId, stepPath, currentProfile }: Props) {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<AuditProfile>(currentProfile ?? 'nng')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run() {
    setError(null)
    startTransition(async () => {
      try {
        await rescanStep(stepId, profile, stepPath)
        setOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Re-scan failed')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Re-scan
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-96 rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-bold text-slate-100">Re-scan with profile</h3>
            <p className="mb-4 text-xs text-slate-500">
              Re-runs the AI analysis on the stored snapshot. New findings are appended — confirmed findings are never modified.
            </p>

            <div className="space-y-2 mb-4">
              {(Object.entries(PROFILE_LABELS) as [AuditProfile, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer rounded-lg border border-slate-700 px-3 py-2.5 hover:bg-slate-800 transition-colors">
                  <input
                    type="radio"
                    name="profile"
                    value={key}
                    checked={profile === key}
                    onChange={() => setProfile(key)}
                    className="accent-violet-500"
                  />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>

            {error && <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">
                Cancel
              </button>
              <button
                disabled={pending}
                onClick={run}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
              >
                {pending && (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {pending ? 'Scanning...' : 'Run Re-scan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
