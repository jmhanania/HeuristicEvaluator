// react-pdf/renderer document — must only be imported dynamically (no SSR)
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { Flow, Step, Finding, Severity } from '@/db/schema'
import type { HealthScore, HeatmapRow } from '@/lib/reportUtils'
import { NNG_HEURISTICS, SEVERITY_ORDER } from '@/lib/reportUtils'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#ef4444',
  serious:  '#f97316',
  moderate: '#eab308',
  minor:    '#3b82f6',
}

const SEVERITY_BG: Record<Severity, string> = {
  critical: '#fef2f2',
  serious:  '#fff7ed',
  moderate: '#fefce8',
  minor:    '#eff6ff',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    backgroundColor: '#ffffff',
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },
  // Header
  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flowName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  metaText: { fontSize: 8, color: '#94a3b8', marginTop: 3 },
  scoreBadge: { alignItems: 'center' },
  scoreGrade: { fontSize: 28, fontFamily: 'Helvetica-Bold' },
  scoreLabel: { fontSize: 8, color: '#94a3b8', textAlign: 'center' },
  scoreNum: { fontSize: 11, color: '#475569', textAlign: 'center' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 6, padding: 8 },
  statNum: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  statLabel: { fontSize: 7, color: '#94a3b8', marginTop: 1 },

  // Section title
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#334155', marginBottom: 8, marginTop: 18, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Heatmap
  heatmapTable: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  heatmapHeaderRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  heatmapRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  heatmapLabelCell: { flex: 1, padding: 4 },
  heatmapCell: { width: 48, padding: 4, alignItems: 'center', justifyContent: 'center' },
  heatmapHeaderText: { fontSize: 7, color: '#94a3b8', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  heatmapRowLabel: { fontSize: 8, color: '#334155' },
  heatmapHNum: { fontSize: 7, color: '#94a3b8', fontFamily: 'Helvetica-Bold', marginRight: 3 },
  heatmapCount: { fontSize: 9, fontFamily: 'Helvetica-Bold', borderRadius: 3, width: 18, height: 16, alignItems: 'center', justifyContent: 'center' },

  // Step section
  stepHeader: { marginTop: 20, marginBottom: 10, borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingBottom: 6 },
  stepName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  stepUrl: { fontSize: 7, color: '#94a3b8', marginTop: 2 },
  stepLayout: { flexDirection: 'row', gap: 14 },
  screenshotCol: { width: '45%' },
  findingsCol: { flex: 1 },
  screenshot: { borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },

  // Finding card
  findingCard: { marginBottom: 6, padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', breakInside: 'avoid' },
  findingHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  severityPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  severityText: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  pinBadge: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#475569' },
  pinText: { fontSize: 7, color: '#ffffff', fontFamily: 'Helvetica-Bold' },
  findingTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a', flex: 1 },
  findingDesc: { fontSize: 8, color: '#475569', lineHeight: 1.4, marginBottom: 4 },
  remediationBox: { backgroundColor: '#f8fafc', borderRadius: 3, padding: 5, marginTop: 3 },
  remediationLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  remediationText: { fontSize: 8, color: '#334155', lineHeight: 1.4 },
  selectorText: { fontSize: 7, color: '#16a34a', fontFamily: 'Helvetica', marginTop: 2 },

  // Heuristic group label
  hGroupLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 2 },

  // Appendix
  appendixTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#334155', marginTop: 24, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 6 },
  appendixNote: { fontSize: 8, color: '#94a3b8', marginBottom: 10, lineHeight: 1.4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f8fafc', paddingVertical: 4, paddingHorizontal: 4 },
  tableColSev: { width: 56 },
  tableColTitle: { flex: 1 },
  tableColReason: { flex: 1.2 },
  tableHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase' },
  tableText: { fontSize: 8, color: '#334155' },
  tableSubText: { fontSize: 8, color: '#94a3b8', fontStyle: 'italic' },

  // Footer
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#cbd5e1' },
  pageNum: { fontSize: 7, color: '#cbd5e1' },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBbox(raw: string | null) {
  if (!raw) return null
  try { const p = JSON.parse(raw); return typeof p.x === 'number' ? p : null } catch { return null }
}

function groupByHeuristic(findings: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>()
  for (const f of findings) {
    let key = f.framework.toUpperCase()
    if (f.framework === 'nng' && f.heuristicId) key = `H${f.heuristicId}: ${NNG_HEURISTICS[f.heuristicId] ?? ''}`
    else if (f.framework === 'wcag' && f.wcagCriterion) key = `WCAG ${f.wcagCriterion}`
    else if (f.framework === 'baymard' && f.baymardCategory) key = f.baymardCategory
    const arr = map.get(key) ?? []
    arr.push(f)
    map.set(key, arr)
  }
  return map
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SevPill({ severity }: { severity: Severity }) {
  return (
    <View style={[s.severityPill, { backgroundColor: SEVERITY_BG[severity] }]}>
      <Text style={[s.severityText, { color: SEVERITY_COLOR[severity] }]}>{severity}</Text>
    </View>
  )
}

function FindingCard({ f, pinNum }: { f: Finding; pinNum: number | null }) {
  const sev = f.severity as Severity
  return (
    <View style={[s.findingCard, { borderLeftWidth: 3, borderLeftColor: SEVERITY_COLOR[sev] }]}>
      <View style={s.findingHeader}>
        {pinNum !== null && (
          <View style={[s.pinBadge, { backgroundColor: SEVERITY_COLOR[sev] }]}>
            <Text style={s.pinText}>{pinNum}</Text>
          </View>
        )}
        <SevPill severity={sev} />
        <Text style={s.findingTitle}>{f.title}</Text>
      </View>
      <Text style={s.findingDesc}>{f.description}</Text>
      {(f.remediation ?? f.recommendation) && (
        <View style={s.remediationBox}>
          <Text style={s.remediationLabel}>Remediation</Text>
          <Text style={s.remediationText}>{f.remediation ?? f.recommendation}</Text>
        </View>
      )}
      {f.evidenceSelector && (
        <Text style={s.selectorText}>{f.evidenceSelector}</Text>
      )}
    </View>
  )
}

function HeatmapSection({ rows }: { rows: HeatmapRow[] }) {
  const activeRows = rows.filter(r => r.total > 0)
  if (activeRows.length === 0) return null

  return (
    <View>
      <Text style={s.sectionTitle}>Executive Heatmap</Text>
      <View style={s.heatmapTable}>
        <View style={s.heatmapHeaderRow}>
          <View style={s.heatmapLabelCell}><Text style={s.heatmapHeaderText}>Heuristic</Text></View>
          {SEVERITY_ORDER.map(sv => (
            <View key={sv} style={s.heatmapCell}>
              <Text style={[s.heatmapHeaderText, { color: SEVERITY_COLOR[sv] }]}>{sv}</Text>
            </View>
          ))}
          <View style={s.heatmapCell}><Text style={s.heatmapHeaderText}>Total</Text></View>
        </View>
        {rows.map((row, i) => (
          <View key={row.heuristicId} style={[s.heatmapRow, { backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', opacity: row.total === 0 ? 0.3 : 1 }]}>
            <View style={s.heatmapLabelCell}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={s.heatmapHNum}>H{row.heuristicId}</Text>
                <Text style={s.heatmapRowLabel}>{row.label}</Text>
              </View>
            </View>
            {SEVERITY_ORDER.map(sv => {
              const count = row.cells[sv]
              return (
                <View key={sv} style={s.heatmapCell}>
                  {count > 0 && (
                    <View style={[s.heatmapCount, { backgroundColor: SEVERITY_BG[sv] }]}>
                      <Text style={[{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: SEVERITY_COLOR[sv] }]}>{count}</Text>
                    </View>
                  )}
                </View>
              )
            })}
            <View style={s.heatmapCell}>
              {row.total > 0 && <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#475569' }}>{row.total}</Text>}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Main document
// ---------------------------------------------------------------------------

export interface PDFDocumentProps {
  flow: Flow
  steps: Step[]
  allFindings: Finding[]
  heatmapRows: HeatmapRow[]
  health: HealthScore
  screenshotUrls: Record<string, string | null>  // stepId -> url (absolute for PDF)
  date: string
}

export function AuditPDFDocument({
  flow,
  steps,
  allFindings,
  heatmapRows,
  health,
  screenshotUrls,
  date,
}: PDFDocumentProps) {
  const confirmedFindings = allFindings.filter(f => f.status === 'confirmed')
  const dismissedFindings = allFindings.filter(f => f.status === 'dismissed' && !f.rejectionReason)
  const hallucinations = allFindings.filter(f => f.rejectionReason)

  // Global pin numbering across all steps
  let pinCounter = 0

  return (
    <Document
      title={`UX Audit: ${flow.name}`}
      author="HeuristicEvaluator"
      creator="HeuristicEvaluator"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Cover / Summary page                                                */}
      {/* ------------------------------------------------------------------ */}
      <Page size="A4" orientation="portrait" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.flowName}>{flow.name}</Text>
              <Text style={s.metaText}>UX Audit Report  |  {date}</Text>
            </View>
            <View style={s.scoreBadge}>
              <Text style={[s.scoreGrade, { color: health.grade === 'A' ? '#22c55e' : health.grade === 'B' ? '#14b8a6' : health.grade === 'C' ? '#eab308' : health.grade === 'D' ? '#f97316' : '#ef4444' }]}>
                {health.grade}
              </Text>
              <Text style={s.scoreNum}>{health.score}/100</Text>
              <Text style={s.scoreLabel}>{health.label}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            {([
              { n: confirmedFindings.filter(f => f.severity === 'critical').length, l: 'Critical', c: '#ef4444' },
              { n: confirmedFindings.filter(f => f.severity === 'serious').length, l: 'Serious', c: '#f97316' },
              { n: confirmedFindings.filter(f => f.severity === 'moderate').length, l: 'Moderate', c: '#eab308' },
              { n: confirmedFindings.filter(f => f.severity === 'minor').length, l: 'Minor', c: '#3b82f6' },
              { n: confirmedFindings.length, l: 'Confirmed', c: '#22c55e' },
              { n: allFindings.length, l: 'Total findings', c: '#94a3b8' },
            ] as const).map(item => (
              <View key={item.l} style={s.statBox}>
                <Text style={[s.statNum, { color: item.c }]}>{item.n}</Text>
                <Text style={s.statLabel}>{item.l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Heatmap */}
        <HeatmapSection rows={heatmapRows} />

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>HeuristicEvaluator  |  {flow.name}</Text>
          <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ------------------------------------------------------------------ */}
      {/* One page (or more) per step                                         */}
      {/* ------------------------------------------------------------------ */}
      {steps.map(step => {
        const stepFindings = confirmedFindings.filter(f => f.stepId === step.id)
        const grouped = groupByHeuristic(stepFindings)
        const screenshotUrl = screenshotUrls[step.id] ?? null

        // Assign pin numbers before rendering
        const pinMap = new Map<string, number>()
        stepFindings.forEach(f => {
          if (parseBbox(f.evidenceBbox)) {
            pinCounter++
            pinMap.set(f.id, pinCounter)
          }
        })

        return (
          <Page key={step.id} size="A4" orientation="landscape" style={s.page} break>
            <View style={s.stepHeader}>
              <Text style={s.stepName}>{step.name}</Text>
              <Text style={s.stepUrl}>{step.url}</Text>
            </View>

            <View style={s.stepLayout}>
              {/* Screenshot col */}
              <View style={s.screenshotCol}>
                {screenshotUrl ? (
                  <Image src={screenshotUrl} style={s.screenshot} />
                ) : (
                  <View style={[s.screenshot, { height: 200, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 8, color: '#94a3b8' }}>No screenshot</Text>
                  </View>
                )}
              </View>

              {/* Findings col */}
              <View style={s.findingsCol}>
                {stepFindings.length === 0 ? (
                  <Text style={{ fontSize: 9, color: '#94a3b8' }}>No confirmed findings on this step.</Text>
                ) : (
                  Array.from(grouped.entries()).map(([label, group]) => (
                    <View key={label}>
                      <Text style={s.hGroupLabel}>{label}</Text>
                      {group.map(f => (
                        <FindingCard key={f.id} f={f} pinNum={pinMap.get(f.id) ?? null} />
                      ))}
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={s.footer} fixed>
              <Text style={s.footerText}>HeuristicEvaluator  |  {flow.name}</Text>
              <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            </View>
          </Page>
        )
      })}

      {/* ------------------------------------------------------------------ */}
      {/* Appendix page                                                        */}
      {/* ------------------------------------------------------------------ */}
      {(dismissedFindings.length > 0 || hallucinations.length > 0) && (
        <Page size="A4" orientation="portrait" style={s.page} break>
          <Text style={s.appendixTitle}>Appendix: Dismissed &amp; Hallucination Log</Text>
          <Text style={s.appendixNote}>
            The following findings were filtered from the main report. Dismissed findings were
            judged not applicable by the auditor. Hallucinations were AI outputs that were
            factually incorrect or unsupported by evidence in the captured DOM.
          </Text>

          {dismissedFindings.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[s.sectionTitle, { marginTop: 0 }]}>Dismissed ({dismissedFindings.length})</Text>
              <View style={s.heatmapTable}>
                <View style={s.tableHeaderRow}>
                  <View style={s.tableColSev}><Text style={s.tableHeaderText}>Severity</Text></View>
                  <View style={s.tableColTitle}><Text style={s.tableHeaderText}>Finding</Text></View>
                  <View style={s.tableColReason}><Text style={s.tableHeaderText}>Dismiss Reason</Text></View>
                </View>
                {dismissedFindings.map((f, i) => (
                  <View key={f.id} style={[s.tableRow, { backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }]}>
                    <View style={s.tableColSev}><SevPill severity={f.severity as Severity} /></View>
                    <View style={s.tableColTitle}><Text style={s.tableText}>{f.title}</Text></View>
                    <View style={s.tableColReason}><Text style={s.tableSubText}>{f.dismissReason ?? '—'}</Text></View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {hallucinations.length > 0 && (
            <View>
              <Text style={[s.sectionTitle, { color: '#ef4444' }]}>Rejected as Hallucinations ({hallucinations.length})</Text>
              <View style={s.heatmapTable}>
                <View style={s.tableHeaderRow}>
                  <View style={{ flex: 1 }}><Text style={s.tableHeaderText}>Finding</Text></View>
                  <View style={{ flex: 1.5 }}><Text style={s.tableHeaderText}>What the AI got wrong</Text></View>
                </View>
                {hallucinations.map((f, i) => (
                  <View key={f.id} style={[s.tableRow, { backgroundColor: i % 2 === 0 ? '#fff' : '#fef2f2' }]}>
                    <View style={{ flex: 1 }}><Text style={s.tableText}>{f.title}</Text></View>
                    <View style={{ flex: 1.5 }}><Text style={[s.tableSubText, { color: '#ef4444' }]}>{f.rejectionReason ?? '—'}</Text></View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={s.footer} fixed>
            <Text style={s.footerText}>HeuristicEvaluator  |  {flow.name}</Text>
            <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      )}
    </Document>
  )
}
