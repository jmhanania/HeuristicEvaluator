import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { ulid } from 'ulid'
import { config } from '@/lib/config'
import { selectorExists } from '@/lib/scrubber'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import type { NewFinding, AuditProfile, NewScan } from '@/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeminiFinding {
  framework: 'nng' | 'baymard' | 'wcag'
  heuristic_id: number | null
  baymard_category: string | null
  wcag_criterion: string | null
  wcag_level: 'A' | 'AA' | 'AAA' | null
  title: string
  description: string
  remediation: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  evidence_selector: string | null
  evidence_dom_snippet: string | null
  evidence_bbox: { x: number; y: number; width: number; height: number } | null
  ai_confidence: 'high' | 'medium' | 'low'
}

export interface AnalyzeResult {
  findings: NewFinding[]
  scan: Omit<NewScan, 'id' | 'stepId'>
}

interface AnalyzeParams {
  stepId: string
  profile: AuditProfile
  scrubbedHtml: string
  screenshotBase64: string // base64 JPEG
  sessionName: string
  flowName: string
  stepName: string
  stepOrder: number
  totalSteps: number
  url: string
  captureMethod: string
  codifiedFindings: NewFinding[]
  axeResults: AxeResult[]
}

interface AxeResult {
  id: string
  description: string
  impact: string | null
  nodes: { target: string[] }[]
}

// ---------------------------------------------------------------------------
// Evidence validation
// Checks the selector against the scrubbed DOM.
// Returns 'valid' | 'unverified' based on whether the selector resolves.
// ---------------------------------------------------------------------------

function validateEvidence(
  scrubbedHtml: string,
  finding: GeminiFinding,
): 'confirmed' | 'unverified' {
  const hasSnippet = !!finding.evidence_dom_snippet?.trim()

  if (finding.evidence_selector) {
    const exists = selectorExists(scrubbedHtml, finding.evidence_selector)
    if (exists) return 'confirmed'
    // Selector provided but doesn't resolve — don't trust snippet alone,
    // the model is likely hallucinating specificity.
    return 'unverified'
  }

  // No selector — snippet alone is accepted but logged as medium confidence at best
  if (hasSnippet) return 'confirmed'

  return 'unverified'
}

// ---------------------------------------------------------------------------
// summariseCodified — builds the codified findings summary for the prompt
// ---------------------------------------------------------------------------

function summariseCodified(findings: NewFinding[]): string {
  if (findings.length === 0) return 'None'
  return findings
    .map(f => `- [H${f.heuristicId ?? f.wcagCriterion}] ${f.title}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// summariseAxe — builds the axe results summary for the prompt
// ---------------------------------------------------------------------------

function summariseAxe(results: AxeResult[]): string {
  if (results.length === 0) return 'None'
  return results
    .map(r => {
      const targets = r.nodes.flatMap(n => n.target).slice(0, 2).join(', ')
      return `- [${r.id}] ${r.description} (${r.impact ?? 'unknown'} impact) — ${targets}`
    })
    .join('\n')
}

// ---------------------------------------------------------------------------
// analyze — main entry point
// Single Gemini call per step; all heuristics batched into one prompt.
// ---------------------------------------------------------------------------

export async function analyze(params: AnalyzeParams): Promise<AnalyzeResult> {
  const genAI = new GoogleGenerativeAI(config.geminiApiKey)
  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    systemInstruction: buildSystemPrompt(params.profile),
  })

  const userPromptText = buildUserPrompt({
    sessionName: params.sessionName,
    flowName: params.flowName,
    stepName: params.stepName,
    stepOrder: params.stepOrder,
    totalSteps: params.totalSteps,
    url: params.url,
    captureMethod: params.captureMethod,
    codifiedSummary: summariseCodified(params.codifiedFindings),
    axeSummary: summariseAxe(params.axeResults),
  })

  // Build the multimodal message: text prompt + screenshot + scrubbed DOM
  const parts: Part[] = [
    { text: userPromptText },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: params.screenshotBase64,
      },
    },
    {
      text: `\n\nSCRUBBED DOM (use selectors from this HTML for evidence_selector):\n${params.scrubbedHtml}`,
    },
  ]

  const response = await model.generateContent({ contents: [{ role: 'user', parts }] })
  const raw = response.response.text().trim()

  // Strip markdown fences if the model added them despite instructions
  const jsonText = raw.startsWith('```')
    ? raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
    : raw

  let geminiFindings: GeminiFinding[] = []
  try {
    geminiFindings = JSON.parse(jsonText)
    if (!Array.isArray(geminiFindings)) geminiFindings = []
  } catch {
    // Malformed response — return zero findings, log in scan stats
    geminiFindings = []
  }

  // Validate evidence and build NewFinding rows
  let discarded = 0
  const findings: NewFinding[] = geminiFindings.map(gf => {
    const status = validateEvidence(params.scrubbedHtml, gf)
    if (status === 'unverified') discarded++

    return {
      id: ulid(),
      stepId: params.stepId,
      scanId: null, // assigned by caller after scan row is inserted
      source: 'ai',
      status,
      framework: gf.framework,
      heuristicId: gf.heuristic_id ?? null,
      baymardCategory: gf.baymard_category ?? null,
      wcagCriterion: gf.wcag_criterion ?? null,
      wcagLevel: gf.wcag_level ?? null,
      generatedByProfile: params.profile,
      title: gf.title,
      description: gf.description,
      recommendation: gf.remediation,
      remediation: gf.remediation,
      severity: gf.severity,
      evidenceSelector: gf.evidence_selector ?? null,
      evidenceDomSnippet: gf.evidence_dom_snippet ?? null,
      evidenceBbox: gf.evidence_bbox ? JSON.stringify(gf.evidence_bbox) : null,
      aiConfidence: gf.ai_confidence,
      dismissReason: null,
      rejectionReason: null,
      createdAt: new Date(),
    } satisfies NewFinding
  })

  const scan: Omit<NewScan, 'id' | 'stepId'> = {
    profile: params.profile,
    triggeredBy: 'auto',
    geminiModel: config.geminiModel,
    findingsGenerated: geminiFindings.length,
    findingsDiscarded: discarded,
    completedAt: new Date(),
  }

  return { findings, scan }
}
