'use client'

import { useState } from 'react'
import { createSession } from '@/server/actions/sessions'

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
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Audit Profile</label>
            <select
              name="auditProfile"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
            >
              <option value="nng">NNG — Nielsen's 10 Usability Heuristics</option>
              <option value="ecommerce_baymard">Ecommerce — Baymard Institute Guidelines</option>
              <option value="wcag22_only">WCAG 2.2 Accessibility Only</option>
            </select>
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
