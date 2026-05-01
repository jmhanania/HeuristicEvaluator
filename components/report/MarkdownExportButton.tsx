'use client'

import { useState } from 'react'
import type { Finding } from '@/db/schema'
import { buildMarkdown } from '@/lib/reportUtils'

interface Props {
  findings: Finding[]
  flowName: string
  stepNames: Record<string, string>
}

export function MarkdownExportButton({ findings, flowName, stepNames }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const md = buildMarkdown(findings, flowName, stepNames)
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const actionableCount = findings.filter(
    f => f.status === 'confirmed' && (f.severity === 'critical' || f.severity === 'serious'),
  ).length

  return (
    <button
      onClick={handleCopy}
      disabled={actionableCount === 0}
      className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
    >
      {copied ? (
        <>
          <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Markdown for Jira / GitHub
          {actionableCount > 0 && (
            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
              {actionableCount}
            </span>
          )}
        </>
      )}
    </button>
  )
}
