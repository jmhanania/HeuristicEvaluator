import type { HeatmapRow } from '@/lib/reportUtils'
import { SEVERITY_ORDER } from '@/lib/reportUtils'

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  serious:  'Serious',
  moderate: 'Moderate',
  minor:    'Minor',
}

const CELL_BG: Record<number, string> = {
  0: 'bg-slate-900 text-slate-700',
  1: 'bg-yellow-500/20 text-yellow-300',
  2: 'bg-orange-500/30 text-orange-300',
  3: 'bg-red-500/40 text-red-300',
}

function cellClass(count: number, severity: string): string {
  if (count === 0) return 'bg-slate-900 text-slate-700'
  if (severity === 'critical') return 'bg-red-500/40 text-red-200 font-bold'
  if (severity === 'serious') return 'bg-orange-500/30 text-orange-200 font-semibold'
  const key = Math.min(count, 3) as keyof typeof CELL_BG
  return CELL_BG[key]
}

interface Props {
  rows: HeatmapRow[]
}

export function HeuristicHeatmap({ rows }: Props) {
  const activeRows = rows.filter(r => r.total > 0)
  if (activeRows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-6 py-8 text-center text-sm text-slate-500">
        No confirmed findings yet — confirm findings in the triage view to populate this heatmap.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-800/60">
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Heuristic
            </th>
            {SEVERITY_ORDER.map(s => (
              <th key={s} className="w-20 px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {SEVERITY_LABEL[s]}
              </th>
            ))}
            <th className="w-16 px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.heuristicId}
              className={`border-b border-slate-700/30 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/20'} ${row.total === 0 ? 'opacity-30' : ''}`}
            >
              <td className="px-4 py-2">
                <span className="mr-2 font-mono text-[10px] font-bold text-slate-500">H{row.heuristicId}</span>
                <span className="text-slate-300">{row.label}</span>
              </td>
              {SEVERITY_ORDER.map(s => (
                <td key={s} className="px-3 py-2 text-center">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[11px] ${cellClass(row.cells[s], s)}`}>
                    {row.cells[s] > 0 ? row.cells[s] : ''}
                  </span>
                </td>
              ))}
              <td className="px-3 py-2 text-center font-bold text-slate-400">
                {row.total > 0 ? row.total : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
