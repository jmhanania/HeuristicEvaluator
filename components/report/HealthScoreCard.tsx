import type { HealthScore } from '@/lib/reportUtils'

interface Props {
  score: HealthScore
  confirmedCount: number
  totalCount: number
  flowName: string
  date: string
}

export function HealthScoreCard({ score, confirmedCount, totalCount, flowName, date }: Props) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference * (1 - score.score / 100)

  return (
    <div className="flex items-center gap-8 rounded-xl border border-slate-700/50 bg-slate-800/50 px-8 py-6">
      {/* Circular gauge */}
      <div className="relative shrink-0">
        <svg width="100" height="100" className="-rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-700 ${
              score.grade === 'A' ? 'stroke-green-400'
              : score.grade === 'B' ? 'stroke-teal-400'
              : score.grade === 'C' ? 'stroke-yellow-400'
              : score.grade === 'D' ? 'stroke-orange-400'
              : 'stroke-red-400'
            }`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-black ${score.color}`}>{score.grade}</span>
          <span className="text-[10px] font-semibold text-slate-500">{score.score}</span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex-1">
        <p className="text-xl font-bold text-slate-100">{flowName}</p>
        <p className="mt-0.5 text-sm text-slate-400">{date}</p>
        <div className="mt-3 flex gap-6 text-sm">
          <div>
            <p className="text-2xl font-black text-slate-100">{score.score}<span className="text-base text-slate-500">/100</span></p>
            <p className="text-[11px] text-slate-500">UX Health Score</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-100">{confirmedCount}</p>
            <p className="text-[11px] text-slate-500">Confirmed issues</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-100">{totalCount}</p>
            <p className="text-[11px] text-slate-500">Total findings</p>
          </div>
        </div>
      </div>

      {/* Grade callout */}
      <div className={`shrink-0 text-right`}>
        <p className={`text-5xl font-black ${score.color}`}>{score.label}</p>
        <p className="mt-1 text-xs text-slate-500">Overall rating</p>
      </div>
    </div>
  )
}
