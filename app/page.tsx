import { db } from '@/db/client'
import { sessions, flows, steps, findings } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { NewSessionForm } from '@/components/NewSessionForm'

async function getSessions() {
  try {
    return await db.select().from(sessions).orderBy(desc(sessions.createdAt))
  } catch {
    return []
  }
}

async function getFlowsForSession(sessionId: string) {
  return db.select().from(flows).where(eq(flows.sessionId, sessionId)).orderBy(flows.order)
}

async function getStepsForFlow(flowId: string) {
  return db.select().from(steps).where(eq(steps.flowId, flowId)).orderBy(steps.order)
}

async function getFindingCountForStep(stepId: string) {
  const rows = await db.select().from(findings).where(eq(findings.stepId, stepId))
  return {
    total: rows.length,
    confirmed: rows.filter(f => f.status === 'confirmed').length,
    critical: rows.filter(f => f.severity === 'critical' && f.status === 'confirmed').length,
  }
}

export default async function HomePage() {
  const allSessions = await getSessions()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900 px-8 py-5">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">HeuristicEvaluator</h1>
            <p className="text-xs text-slate-500 mt-0.5">AI-augmented UX audit platform</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/bookmarklet"
              target="_blank"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700"
            >
              Get Bookmarklet
            </a>
            <NewSessionForm />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-8 py-10">
        {allSessions.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-10 py-16 text-center">
            <p className="text-4xl mb-4">🔍</p>
            <h2 className="text-lg font-semibold text-slate-200 mb-2">No audits yet</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Create a session first, then install the bookmarklet and click it on any website to start capturing.
            </p>
            <div className="flex items-center justify-center gap-3">
              <NewSessionForm />
              <a
                href="/api/bookmarklet"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700"
              >
                Get Bookmarklet
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Audit Sessions
            </h2>
            {await Promise.all(allSessions.map(async session => {
              const sessionFlows = await getFlowsForSession(session.id)
              return (
                <div key={session.id} className="rounded-xl border border-slate-700/50 bg-slate-900/60">
                  {/* Session header */}
                  <div className="flex items-center gap-3 border-b border-slate-700/40 px-5 py-3.5">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100">{session.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{session.targetUrl}</p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      session.status === 'complete'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {session.status}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                      {session.auditProfile}
                    </span>
                  </div>

                  {/* Flows */}
                  {sessionFlows.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-600">No flows captured yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-800/60">
                      {await Promise.all(sessionFlows.map(async flow => {
                        const flowSteps = await getStepsForFlow(flow.id)
                        return (
                          <div key={flow.id} className="px-5 py-3">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="text-sm font-medium text-slate-300">{flow.name}</p>
                              <a
                                href={`/reports/${flow.id}`}
                                className="rounded bg-violet-600/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300 hover:bg-violet-600/30"
                              >
                                View Report
                              </a>
                            </div>
                            {/* Steps */}
                            <div className="space-y-1">
                              {await Promise.all(flowSteps.map(async step => {
                                const counts = await getFindingCountForStep(step.id)
                                return (
                                  <a
                                    key={step.id}
                                    href={`/sessions/${session.id}/flows/${flow.id}/steps/${step.id}`}
                                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800/60 transition-colors"
                                  >
                                    <span className="text-slate-500 text-[10px] font-mono w-4">{step.order + 1}</span>
                                    <span className="text-sm text-slate-300 flex-1">{step.name}</span>
                                    <span className="font-mono text-[10px] text-slate-600 truncate max-w-[200px]">{step.url}</span>
                                    {counts.critical > 0 && (
                                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                                        {counts.critical} critical
                                      </span>
                                    )}
                                    {counts.total > 0 && (
                                      <span className="text-[10px] text-slate-500">
                                        {counts.confirmed}/{counts.total} confirmed
                                      </span>
                                    )}
                                    <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                  </a>
                                )
                              }))}
                            </div>
                          </div>
                        )
                      }))}
                    </div>
                  )}
                </div>
              )
            }))}
          </div>
        )}
      </main>
    </div>
  )
}
