'use client'

import { useState } from 'react'
import { createSession } from '@/server/actions/sessions'

const PROFILES = [
  { id: 'nng',               label: 'NNG',     desc: "Nielsen's 10 Usability Heuristics" },
  { id: 'ecommerce_baymard', label: 'Baymard',  desc: 'Ecommerce UX Guidelines' },
  { id: 'wcag22_only',       label: 'WCAG 2.2', desc: 'Accessibility Only' },
]

export function NewSessionForm() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New Session
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
      <form
        action={createSession}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
      >
        <h2 className="mb-5 text-base font-bold text-slate-100">New Audit Session</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Session Name</label>
            <input
              name="name"
              required
              autoFocus
              placeholder="e.g. Checkout Flow Audit"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Target URL</label>
            <input
              name="targetUrl"
              required
              type="url"
              placeholder="https://example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-400">
              Audit Profiles <span className="text-slate-600 font-normal">(select one or more)</span>
            </label>
            <div className="space-y-2">
              {PROFILES.map(p => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 hover:border-violet-500/50 hover:bg-slate-800/80 transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-500/10"
                >
                  <input
                    type="checkbox"
                    name={p.id}
                    defaultChecked={p.id === 'nng'}
                    className="mt-0.5 accent-violet-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{p.label}</p>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Create Session
          </button>
        </div>
      </form>
    </div>
  )
}
