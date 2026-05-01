import type { Severity } from '@/db/schema'

const STYLES: Record<Severity, string> = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/40',
  serious:  'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  moderate: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
  minor:    'bg-blue-500/20 text-blue-400 border border-blue-500/40',
}

// Highlight colours for the screenshot bbox overlay (RGBA)
export const SEVERITY_RGBA: Record<Severity, string> = {
  critical: 'rgba(239,68,68,0.35)',
  serious:  'rgba(249,115,22,0.35)',
  moderate: 'rgba(234,179,8,0.35)',
  minor:    'rgba(59,130,246,0.35)',
}

export const SEVERITY_BORDER: Record<Severity, string> = {
  critical: 'rgba(239,68,68,0.9)',
  serious:  'rgba(249,115,22,0.9)',
  moderate: 'rgba(234,179,8,0.9)',
  minor:    'rgba(59,130,246,0.9)',
}

interface Props {
  severity: Severity
  className?: string
}

export function SeverityBadge({ severity, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STYLES[severity]} ${className}`}
    >
      {severity}
    </span>
  )
}
