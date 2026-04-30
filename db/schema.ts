import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// -------------------------------------------------------------------------
// sessions
// -------------------------------------------------------------------------

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetUrl: text('target_url').notNull(),
  description: text('description'),
  auditProfile: text('audit_profile', {
    enum: ['nng', 'ecommerce_baymard', 'wcag22_only'],
  })
    .notNull()
    .default('nng'),
  status: text('status', { enum: ['draft', 'complete'] })
    .notNull()
    .default('draft'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// -------------------------------------------------------------------------
// flows
// -------------------------------------------------------------------------

export const flows = sqliteTable('flows', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  order: integer('order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// -------------------------------------------------------------------------
// steps
// Storage layout: {STORAGE_ROOT}/{sessionId}/{stepId}/
//   raw_dom.html        - full DOM after JS execution, before scrubbing
//   scrubbed_dom.html   - structural DOM only, PII stripped, sent to Gemini
//   screenshot.jpg      - redacted JPEG, 1280px wide, 80% quality
//   axe_results.json    - raw axe-core output
//
// Storing raw_dom.html separately ensures future scrubbing logic changes
// can be re-applied without re-capturing the page.
// All paths are absolute, resolved under STORAGE_ROOT.
// -------------------------------------------------------------------------

export const steps = sqliteTable('steps', {
  id: text('id').primaryKey(),
  flowId: text('flow_id')
    .notNull()
    .references(() => flows.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  order: integer('order').notNull().default(0),

  captureMethod: text('capture_method', {
    enum: ['bookmarklet', 'manual_upload'],
  }),

  // Absolute file paths — null until a snapshot has been received
  screenshotPath: text('screenshot_path'),
  rawDomPath: text('raw_dom_path'),         // unprocessed post-JS DOM
  scrubbedDomPath: text('scrubbed_dom_path'), // lean structural DOM sent to AI
  axeResultsPath: text('axe_results_path'),

  hasRedactions: integer('has_redactions', { mode: 'boolean' })
    .notNull()
    .default(false),

  // Tracks which profile was active on the most recent scan.
  // Used to prompt the UI to offer a re-scan when the session profile changes.
  lastAnalyzedProfile: text('last_analyzed_profile'),
  analyzedAt: integer('analyzed_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// -------------------------------------------------------------------------
// scans
// One row per analysis run. Decouples analysis from capture:
// a stored snapshot can be re-analyzed under any profile at any time.
// Re-scans append new findings tagged with generated_by_profile;
// previously confirmed findings are never modified.
// -------------------------------------------------------------------------

export const scans = sqliteTable('scans', {
  id: text('id').primaryKey(),
  stepId: text('step_id')
    .notNull()
    .references(() => steps.id, { onDelete: 'cascade' }),
  profile: text('profile', {
    enum: ['nng', 'ecommerce_baymard', 'wcag22_only'],
  }).notNull(),
  triggeredBy: text('triggered_by', { enum: ['auto', 'manual_rescan'] })
    .notNull()
    .default('auto'),
  geminiModel: text('gemini_model').notNull(),
  findingsGenerated: integer('findings_generated').notNull().default(0),
  findingsDiscarded: integer('findings_discarded').notNull().default(0),
  completedAt: integer('completed_at', { mode: 'timestamp' }).notNull(),
})

// -------------------------------------------------------------------------
// findings
// -------------------------------------------------------------------------

export const findings = sqliteTable('findings', {
  id: text('id').primaryKey(),
  stepId: text('step_id')
    .notNull()
    .references(() => steps.id, { onDelete: 'cascade' }),
  scanId: text('scan_id').references(() => scans.id, { onDelete: 'set null' }),
  // null for codified and manual findings

  source: text('source', { enum: ['codified', 'ai', 'manual'] }).notNull(),

  // Status lifecycle:
  //   pending    - AI finding awaiting reviewer triage
  //   confirmed  - accepted by reviewer
  //   dismissed  - not relevant (dismiss_reason required)
  //   unverified - AI returned no evidence_selector and no evidence_dom_snippet;
  //                shown collapsed, cannot be confirmed without manual evidence
  status: text('status', {
    enum: ['confirmed', 'dismissed', 'pending', 'unverified'],
  })
    .notNull()
    .default('pending'),

  // Framework (fields are mutually exclusive by profile)
  framework: text('framework', { enum: ['nng', 'baymard', 'wcag'] }).notNull(),
  heuristicId: integer('heuristic_id'),           // 1-10, NNG profile only
  baymardCategory: text('baymard_category'),       // e.g. "Form Labels"
  wcagCriterion: text('wcag_criterion'),           // e.g. "2.5.8"
  wcagLevel: text('wcag_level', { enum: ['A', 'AA', 'AAA'] }),
  generatedByProfile: text('generated_by_profile'), // profile that produced this finding

  // Content
  title: text('title').notNull(),
  description: text('description').notNull(),
  recommendation: text('recommendation').notNull(),
  severity: text('severity', {
    enum: ['critical', 'major', 'minor', 'info'],
  }).notNull(),

  // Evidence
  // AI findings: at least one of evidenceSelector or evidenceDomSnippet is required.
  // Gemini findings missing both are stored as status = "unverified" rather than discarded,
  // so the reviewer can add evidence manually and confirm or reject.
  evidenceSelector: text('evidence_selector'),      // CSS selector for the violating element
  evidenceDomSnippet: text('evidence_dom_snippet'), // verbatim HTML from scrubbed DOM
  evidenceBbox: text('evidence_bbox'),              // JSON: {x, y, width, height} in screenshot px

  aiConfidence: text('ai_confidence', { enum: ['high', 'medium', 'low'] }),

  // Triage
  dismissReason: text('dismiss_reason'),    // "Not applicable" | "False positive" | etc.
  rejectionReason: text('rejection_reason'), // hallucination log: what the AI got factually wrong

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// -------------------------------------------------------------------------
// Type exports
// -------------------------------------------------------------------------

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Flow = typeof flows.$inferSelect
export type NewFlow = typeof flows.$inferInsert

export type Step = typeof steps.$inferSelect
export type NewStep = typeof steps.$inferInsert

export type Scan = typeof scans.$inferSelect
export type NewScan = typeof scans.$inferInsert

export type Finding = typeof findings.$inferSelect
export type NewFinding = typeof findings.$inferInsert

// Derived union types used across the app
export type AuditProfile = Session['auditProfile']
export type FindingSource = Finding['source']
export type FindingStatus = Finding['status']
export type Severity = Finding['severity']
