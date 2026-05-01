'use client'

import { useState, useTransition } from 'react'
import { deleteSession } from '@/server/actions/sessions'

export function DeleteSessionButton({ sessionId, sessionName }: { sessionId: string; sessionName: string }) {
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="rounded px-2 py-1 text-[10px] text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        title="Delete session"
      >
        Delete
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400">Delete &ldquo;{sessionName}&rdquo;?</span>
      <button
        disabled={pending}
        onClick={() => startTransition(() => deleteSession(sessionId))}
        className="rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500 disabled:opacity-40"
      >
        {pending ? 'Deleting...' : 'Confirm'}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="rounded px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300"
      >
        Cancel
      </button>
    </div>
  )
}
