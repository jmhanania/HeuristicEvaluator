# HeuristicEvaluator: Product Specification

## What This Is

HeuristicEvaluator is a local-first, AI-augmented UX audit platform. It bridges the gap between raw code scanners (axe-core) and static clipboard tools (Heurix.io). The core idea: a senior researcher's reasoning layer, powered by Gemini 2.0 Flash, applied systematically to screenshots and DOM snapshots you capture yourself.

---

## Competitive Position

| Tool | Automated Scanning | AI Analysis | Authenticated Flows | Audit Profiles | Cost |
|---|---|---|---|---|---|
| axe-core | WCAG only | None | Yes | None | Free |
| Heurix.io | None | None | Manual only | NNG only | Free |
| Baymard UX-Ray | None | Ecommerce only, 95% acc. | Yes | Ecommerce only | Paid |
| **HeuristicEvaluator** | WCAG 2.2 + codified heuristics | Gemini (ruthless critic mode) | Yes, via bookmarklet | NNG, Ecommerce, WCAG-only | Free |

### Key Differentiators

- Works on authenticated pages without storing credentials or tokens.
- Captures happen in the user's own browser: no server-side browser management.
- Every AI finding requires evidence: a DOM snippet or bounding box. No hallucinations logged silently.
- Audit Profiles let you swap the evaluation framework per session.
- Privacy redaction happens before anything leaves the machine.

---

## Audit Profiles

A profile defines which heuristic framework the AI uses and which codified checks run. Each session selects exactly one profile.

### Profile: NNG Standard

Evaluates against Nielsen's 10 Usability Heuristics. Suitable for any web product.

| ID | Heuristic | Codified Checks |
|----|-----------|-----------------|
| H1 | Visibility of System Status | Loading states, progress indicators present in DOM |
| H2 | Match Between System and Real World | None (AI only) |
| H3 | User Control and Freedom | Back links, cancel buttons, undo paths in DOM |
| H4 | Consistency and Standards | Repeated CTA labels consistent, heading hierarchy valid |
| H5 | Error Prevention | All inputs have labels, required fields marked, ARIA roles present |
| H6 | Recognition Rather Than Recall | Navigation persistent, breadcrumbs on deep pages |
| H7 | Flexibility and Efficiency of Use | None (AI only) |
| H8 | Aesthetic and Minimalist Design | None (AI only) |
| H9 | Help Users Recognize and Recover from Errors | Error messages exist near failed inputs |
| H10 | Help and Documentation | None (AI only) |

Codified checks run deterministically on the DOM. They never call the AI. AI handles the remaining heuristics where judgment is required.

### Profile: Ecommerce (Baymard)

Replaces NNG's generic principles with Baymard Institute's research-backed ecommerce guidelines. Baymard has documented 769 ecommerce UX guidelines across 200,000+ hours of research. This profile covers the subset where deterministic or AI-assisted checks are reliable.

Codified checks specific to this profile:

- Every form field has a persistent label (not placeholder-only).
- Touch targets are at minimum 24x24px (WCAG 2.5.8) and ideally 44x44px (Baymard standard).
- Cart persists across sessions (checked via localStorage/cookie presence heuristic).
- Checkout form does not clear on validation error.
- Password fields have a show/hide toggle.
- Primary CTA is visually distinct from secondary actions.

AI prompt for this profile instructs Gemini to apply Baymard's opinionated stance: inline validation timing, field label positioning, trust signal placement, guest checkout availability, and form recovery after errors. The AI cites the relevant Baymard principle category rather than NNG heuristic IDs.

### Profile: WCAG 2.2 Only

Skips heuristic evaluation entirely. Runs axe-core plus the codified WCAG 2.2 checks below, with AI used only to identify violations axe-core misses.

WCAG 2.2 additions over 2.1 covered by this profile:

| Criterion | Level | Description |
|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum) | AA | Focused component not fully hidden by sticky content |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Focused component fully visible |
| 2.4.13 Focus Appearance | AAA | Focus indicator meets size and contrast requirements |
| 2.5.7 Dragging Movements | AA | All drag actions have a single-pointer alternative |
| 2.5.8 Target Size (Minimum) | AA | Touch targets at least 24x24px |
| 3.2.6 Consistent Help | A | Help mechanisms in consistent location |
| 3.3.7 Redundant Entry | A | Previously entered info not re-requested |
| 3.3.8 Accessible Authentication (Minimum) | AA | No cognitive test required to authenticate |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | No exception to above |

---

## Architecture

### Simplified Snapshot Model

Server-side browser management (Playwright running inside Next.js) creates significant operational complexity: process lifecycle, port management, memory limits, and CDP connection handling. This tool avoids all of it.

Instead: the user's own browser captures the page. A bookmarklet (or uploaded file) sends a snapshot to the app's local API. The app never launches or manages a browser.

```
User's Browser                  HeuristicEvaluator (localhost:3000)
     |                                      |
  [Bookmarklet clicked]                     |
     | runs axe-core locally                |
     | captures screenshot                  |
     | shows redaction preview              |
     | user redacts, confirms               |
     |------- POST /api/snapshot ---------->|
     |        { html, screenshot,           |
     |          axeResults, stepId,         |
     |          url, captureMethod }        |
     |                                      |
     |                          stores snapshot
     |                          sends to Gemini
     |                          returns findings
     |<------ { findings } ----------------|
```

### Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Full-stack, server actions, streaming UI |
| Language | TypeScript | Type safety across domain models |
| Database | SQLite via Drizzle ORM | Local-first, zero infra, portable |
| Automated a11y | axe-core (runs in bookmarklet) | Client-side WCAG scanning, no server needed |
| AI analysis | Google Gemini 2.0 Flash | Vision-capable, free tier, 1500 req/day |
| UI components | Tailwind CSS + shadcn/ui | Accessible, consistent |
| PDF export | react-pdf | Styled report generation |

### Project Structure

```
/
├── app/
│   ├── page.tsx                          # Dashboard: session list
│   ├── sessions/
│   │   ├── new/page.tsx                  # Create session + first flow
│   │   └── [sessionId]/
│   │       ├── page.tsx                  # Session overview
│   │       └── flows/[flowId]/
│   │           ├── page.tsx              # Flow overview
│   │           └── steps/[stepId]/
│   │               └── page.tsx          # Evaluation workspace
│   ├── reports/[sessionId]/page.tsx      # Report view + PDF export
│   └── api/
│       └── snapshot/route.ts             # POST endpoint for bookmarklet
├── components/
│   ├── workspace/
│   │   ├── SitePreview.tsx               # Screenshot with annotation pins
│   │   ├── FindingsPanel.tsx             # Triage panel
│   │   ├── SuggestionCard.tsx            # AI finding with evidence
│   │   ├── RedactionCanvas.tsx           # Pre-send privacy redaction
│   │   └── FindingForm.tsx               # Manual finding entry
│   └── report/
│       ├── ReportSummary.tsx
│       └── FindingsList.tsx
├── server/
│   ├── ai/
│   │   ├── analyze.ts                    # Gemini API call
│   │   └── prompts.ts                    # Profile-specific prompts
│   ├── codified/
│   │   ├── nng.ts                        # Deterministic NNG checks
│   │   ├── baymard.ts                    # Deterministic Baymard checks
│   │   └── wcag22.ts                     # Deterministic WCAG 2.2 checks
│   └── export/pdf.ts
├── db/
│   ├── schema.ts
│   └── migrations/
└── lib/
    ├── heuristics.ts                     # NNG + Baymard definitions
    └── wcag.ts                           # WCAG 2.2 criterion definitions
```

---

## Capture Flows

### Flow A: Bookmarklet (Primary, Works on Authenticated Pages)

This is the main capture path. It works on any page the user can view in their browser, including pages behind login.

**Setup (once):**
1. User opens the app's Settings page.
2. They drag a "Capture Page" link to their bookmarks bar. The bookmarklet is a self-contained script served by the app.

**Capture (per step):**
1. User navigates to the target page in their browser and logs in as needed.
2. User clicks the bookmarklet. A sidebar overlay appears on the page.
3. The bookmarklet runs axe-core against the live DOM and shows a result count.
4. A full-page screenshot renders in the sidebar as a canvas element.
5. The user selects which audit session and step this capture belongs to.
6. **Redaction step:** A toolbar appears above the screenshot. The user drags rectangles over any sensitive content (names, emails, financial data, PII). Redacted regions are filled black before the image is encoded.
7. User clicks "Send to HeuristicEvaluator."
8. The bookmarklet POSTs to `localhost:3000/api/snapshot`:

```json
{
  "stepId": "01J...",
  "url": "https://example.com/checkout",
  "captureMethod": "bookmarklet",
  "html": "<trimmed semantic HTML>",
  "screenshot": "<base64 JPEG, redacted>",
  "axeResults": { "violations": [...], "passes": [...] }
}
```

9. The app processes the snapshot, runs codified checks, calls Gemini, and returns findings.
10. The sidebar shows a summary: "12 findings. Open workspace to triage."

**DOM pre-processing (runs in bookmarklet before POST):**

The bookmarklet runs a scrubbing pass on `document.documentElement.cloneNode(true)` before serialising to HTML. This keeps the DOM lean for the LLM and removes noise and PII.

Stripped entirely:
- All `<script>` elements.
- All `<style>` elements and `style=""` attributes.
- All `<svg>` elements with more than 10 child nodes (decorative icons, charts).
- All `<img>` and `<source>` `src` attributes containing base64 data URIs.
- All `<input>`, `<textarea>`, and `<select>` `value` attributes.
- All `data-*` attributes.
- All `<meta>`, `<link rel="preload">`, and `<link rel="stylesheet">` elements.
- Query string parameters longer than 20 characters (likely tokens or tracking IDs).

Kept and normalised:
- Structural elements: `<main>`, `<nav>`, `<header>`, `<footer>`, `<section>`, `<article>`, `<aside>`, `<form>`, `<fieldset>`, `<legend>`.
- Interactive elements: `<a>`, `<button>`, `<input>` (type and name only), `<select>`, `<textarea>`, `<label>`.
- Content elements: `<h1>`-`<h6>`, `<p>`, `<li>`, `<td>`, `<th>`, `<caption>`.
- Key attributes only: `id`, `class`, `aria-*`, `role`, `type`, `name`, `for`, `href` (domain + path, no query), `alt`, `placeholder`, `required`, `disabled`.
- Text content preserved as-is.

The resulting DOM is typically 80-95% smaller than the raw page source, which keeps Gemini's context usage low and its attention on structure rather than noise.

**What the bookmarklet never captures:**
- Passwords or form field values (stripped before POST).
- `data-*` attributes (stripped).
- Cookie or localStorage contents.
- Query string parameters longer than 20 characters.

### Flow B: Manual Screenshot Upload (Fallback)

Use this when the bookmarklet isn't practical: mobile audits, remote desktop sessions, staging behind VPN, or any situation where you can't run a bookmarklet.

1. User navigates to the step in the workspace.
2. They click "Upload Screenshot" instead of "Capture with bookmarklet."
3. They drag a PNG or JPG onto the upload area.
4. **Redaction step:** Same canvas redaction tool as Flow A. User marks sensitive regions before analysis.
5. Optionally, they paste HTML into a text field. Without HTML, codified checks and axe-core don't run.
6. User clicks "Analyze."
7. App sends screenshot (and HTML if provided) to Gemini.
8. Step is flagged in the report as `capture_method: "manual_upload"` and noted as lacking automated scan data where applicable.

### What Leaves the Machine

Transparency is not optional. The app shows a persistent "Data sent to Gemini" indicator on every step that has been analyzed. Users can click it to see exactly what was transmitted.

| Data | Stays Local | Sent to Gemini | Notes |
|---|---|---|---|
| Screenshots | Yes, on disk | Yes, on analysis | User redacts before send |
| DOM snapshot | Yes, on disk | Yes, scrubbed | PII-stripped before send |
| axe-core results | Yes, in DB | Summary only | Violations list, no element values |
| Findings | Yes, in SQLite | No | Never leaves machine |
| Session cookies | Never stored | No | Bookmarklet uses browser's existing session |
| Credentials | Never touched | No | User logs in themselves |


---

## Data Model

```typescript
// Session: top-level audit engagement
sessions {
  id: text (ulid)
  name: text
  target_url: text
  description: text
  audit_profile: "nng" | "ecommerce_baymard" | "wcag22_only"
  status: "draft" | "complete"
  created_at: timestamp
  updated_at: timestamp
}

// Flow: a named user journey within a session
flows {
  id: text (ulid)
  session_id: text -> sessions.id
  name: text
  description: text
  order: integer
  created_at: timestamp
}

// Step: one page or UI state within a flow
steps {
  id: text (ulid)
  flow_id: text -> flows.id
  name: text
  url: text
  order: integer
  capture_method: "bookmarklet" | "manual_upload"
  screenshot_path: text        // absolute path under STORAGE_ROOT
  dom_snapshot_path: text      // absolute path under STORAGE_ROOT, pre-scrubbed HTML
  axe_results_path: text       // absolute path under STORAGE_ROOT, raw axe JSON
  has_redactions: boolean      // true if user applied redaction boxes before send
  last_analyzed_profile: text  // which profile was active on the last scan
  analyzed_at: timestamp
  created_at: timestamp
}

// Scan: one analysis run against a step (supports re-scanning with a different profile)
scans {
  id: text (ulid)
  step_id: text -> steps.id
  profile: "nng" | "ecommerce_baymard" | "wcag22_only"
  triggered_by: "auto" | "manual_rescan"
  gemini_model: text
  findings_generated: integer   // total returned by Gemini
  findings_discarded: integer   // dropped for missing evidence
  completed_at: timestamp
}

// Finding: one identified issue at a step
findings {
  id: text (ulid)
  step_id: text -> steps.id
  scan_id: text -> scans.id | null   // null for codified and manual findings
  source: "codified" | "ai" | "manual"
  status: "confirmed" | "dismissed" | "pending" | "unverified"
  // "unverified": AI returned a finding but provided no evidence_selector or evidence_dom_snippet.
  // Unverified findings are shown collapsed, cannot be confirmed without manual evidence entry.

  // Framework (mutually exclusive)
  framework: "nng" | "baymard" | "wcag"
  heuristic_id: integer | null         // H1-H10 for nng
  baymard_category: text | null        // e.g. "Form Labels", "Checkout Persistence"
  wcag_criterion: text | null          // e.g. "2.5.8"
  wcag_level: "A" | "AA" | "AAA" | null
  generated_by_profile: text | null    // profile that produced this finding

  // Content
  title: text
  description: text
  recommendation: text
  severity: "critical" | "major" | "minor" | "info"

  // Evidence: at least one of selector or snippet required for AI findings
  evidence_selector: text | null       // CSS selector pointing to the violating element
  evidence_dom_snippet: text | null    // exact HTML excerpt from the scrubbed DOM
  evidence_bbox: text | null           // JSON {x, y, width, height} in screenshot pixels
  ai_confidence: "high" | "medium" | "low" | null

  // Triage
  dismiss_reason: text | null          // why reviewer dismissed it
  rejection_reason: text | null        // why AI finding was factually wrong

  created_at: timestamp
}
```

`rejection_reason` is distinct from `dismiss_reason`. Dismiss means "not relevant to this audit." Rejection means "the AI was factually wrong." The `scans` table decouples analysis runs from capture events: a stored snapshot can be re-analyzed under any profile without re-capturing the page. Each re-scan appends new findings tagged with `generated_by_profile`, leaving prior confirmed findings untouched.

---

## Codified Checks vs. AI Analysis

These two layers never overlap. Codified checks run first, deterministically, on the DOM. Their results are auto-confirmed with no AI call. AI then analyzes only what codified checks can't reach.

### What Codified Checks Cover

Codified checks are implemented in `server/codified/`. Each check returns a structured finding or null.

**NNG profile checks:**
- H1: `<progress>`, loading spinners, skeleton screens present during async states
- H3: Cancel buttons, "Back" links, and undo affordances present in multi-step flows
- H4: Repeated interactive elements (buttons, links) use consistent labels across steps
- H5: Every `<input>` and `<textarea>` has an associated `<label>` or `aria-label`
- H5: Required fields marked with `required` attribute or visible asterisk
- H6: `<nav>` present on all non-landing pages, breadcrumbs on pages 3+ levels deep
- H9: Error containers exist adjacent to form inputs, not only at page level

**Baymard profile adds:**
- No input uses placeholder as its only label
- Touch targets meet 44x44px (measured via computed styles in DOM)
- Password inputs have an adjacent show/hide toggle button
- Primary CTA has higher visual weight than secondary actions (class/style heuristic)
- Checkout form fields are not cleared on validation failure (checked via form attribute patterns)

**WCAG 2.2 profile adds (beyond axe-core):**
- 2.5.8: Target size check on all interactive elements (24x24px minimum)
- 3.2.6: Help link in consistent DOM position across steps
- 3.3.7: Fields pre-filled with previously entered data where applicable
- 3.3.8: No CAPTCHA or puzzle present on authentication forms

### What AI Covers

Gemini handles judgment calls that can't be reduced to DOM queries:

- H2: Language matches users' mental models, not system terminology
- H7: Shortcuts or power-user affordances present for expert users
- H8: Page is visually cluttered or contains redundant content
- Baymard: Trust signal placement, inline validation timing, error message tone
- WCAG: Violations axe-core misses due to dynamic content or insufficient context

---

## AI Integration

### Provider

Google Gemini 2.0 Flash via Google AI Studio free tier. Free API key at aistudio.google.com. No credit card required. Rate limits: 15 requests/minute, 1,500 requests/day. Both are sufficient for audit sessions.

BYOK: other users enter their own Gemini API key in the app's settings screen on first run. The key writes to `.env.local` and never leaves the local machine.

### System Prompt: Ruthless Critic Mode

The system prompt instructs Gemini to behave as a skeptical senior researcher, not a helpful assistant. It must not generate findings it can't support with evidence from the screenshot or DOM.

```
You are a senior UX researcher conducting a formal heuristic evaluation.
Your job is to find real problems, not to generate observations.

Rules you must follow without exception:

1. Every finding must include evidence. For visual issues, provide a bounding box
   {x, y, width, height} in screenshot pixels. For structural issues, provide the
   exact DOM snippet (element tag, key attributes, text content) that proves the
   problem exists.

2. If you cannot point to specific evidence, do not include the finding.

3. Do not generate findings already covered by the automated scan results provided.

4. Do not pad the response. Five precise findings beat ten vague ones.

5. Confidence must reflect evidence quality:
   - high: the evidence is unambiguous and directly visible
   - medium: the evidence is present but requires inference
   - low: the evidence is indirect or relies on assumptions about user behavior

6. Recommendations must be specific and actionable. "Improve clarity" is not a
   recommendation. "Replace the placeholder-only label on the email input with a
   persistent label above the field" is.

Evaluation profile: {profile}

{profile === "nng"}: Evaluate against Nielsen's 10 Usability Heuristics.
Tag each finding with heuristic_id (1-10).

{profile === "ecommerce_baymard"}: Evaluate against Baymard Institute ecommerce
guidelines. Focus on: form label positioning, inline validation timing, checkout
persistence, trust signal placement, guest checkout availability, error recovery,
and touch target sizing. Tag each finding with the Baymard category name.

{profile === "wcag22_only"}: Evaluate for WCAG 2.2 violations not caught by the
automated scan. Tag each finding with the criterion number and level.

Return ONLY a JSON array. Each item must match this shape exactly:
{
  "framework": "nng" | "baymard" | "wcag",
  "heuristic_id": number | null,
  "baymard_category": string | null,
  "wcag_criterion": string | null,
  "wcag_level": "A" | "AA" | "AAA" | null,
  "title": string,
  "description": string,
  "recommendation": string,
  "severity": "critical" | "major" | "minor" | "info",
  "evidence_selector": string | null,
  "evidence_dom_snippet": string | null,
  "evidence_bbox": { "x": number, "y": number, "width": number, "height": number } | null,
  "ai_confidence": "high" | "medium" | "low"
}

evidence_selector: a CSS selector for the violating element (e.g. "form#checkout input[name='email']").
evidence_dom_snippet: the raw HTML of the element or its immediate parent, copied verbatim from the DOM provided.
At least one of evidence_selector or evidence_dom_snippet is required per finding.
If you cannot supply either, do not include the finding.
```

### User Prompt (per step)

```
Session: {sessionName}
Flow: {flowName}
Step: {stepName} ({stepOrder} of {totalSteps})
URL: {url}
Capture method: {captureMethod}

CODIFIED CHECK RESULTS (do not repeat these):
{codifiedSummary}

AUTOMATED WCAG SCAN RESULTS (do not repeat these):
{axeSummary}

Analyze the screenshot and DOM snapshot. Return findings not covered above.
```

### Focused Checklist Re-analysis

When the reviewer clicks "Focus analyze" on a specific heuristic or criterion, an additional instruction appends to the user prompt:

```
Focus only on {heuristicName or wcagCriterion}.
Definition: {criterionDescription}
What specific evidence in the screenshot or DOM confirms or rules out a violation?
If you find no evidence of a violation, return an empty array.
```

---

## Evaluation Workspace

```
+---------------------------------+------------------------------------+
|  SITE PREVIEW                   |  FINDINGS PANEL                    |
|                                 |                                    |
|  [Screenshot with overlays]     |  Codified Checks: 4 issues         |
|                                 |  (auto-confirmed, no triage)       |
|  Confirmed findings: numbered   |  H5: Missing label on #email       |
|  pins on screenshot elements.   |  H5: Required field unmarked       |
|                                 |  H6: No breadcrumb on depth-3 page |
|  AI pending: dashed outlines    |  H9: Page-level error only         |
|  with bounding box overlays.    |                                    |
|                                 |  AI Suggestions: 6 pending         |
|                                 |  sorted by confidence (high first) |
|                                 |  [Confirm] [Edit] [Dismiss v]      |
|                                 |  [Reject as hallucination]         |
|                                 |                                    |
|                                 |  My Findings: 1                    |
|                                 |  [+ Add finding]                   |
|                                 |                                    |
|                                 |  Coverage                          |
|  Step 3 / 5: "Payment Form"     |  NNG: H1 H4 H5 H6 H9 (5/10)      |
|  [← Back]       [Next ->]       |  WCAG: A pass  AA partial          |
|                                 |  [Checklist mode] [Re-analyze]     |
+---------------------------------+------------------------------------+
```

### Triage Actions

**Codified findings:** Auto-confirmed. No triage required. Reviewer can add notes.

**AI suggestion actions:**
- Confirm: saves as `status: "confirmed"`, pins bounding box to screenshot.
- Edit then Confirm: opens inline form pre-filled with AI content. Reviewer adjusts and confirms.
- Dismiss: requires a reason: "Not applicable", "False positive", "Duplicate", "Out of scope".
- Reject as hallucination: requires a `rejection_reason` describing what the AI got wrong. Logged for reliability tracking.

**Manual finding:** Reviewer selects framework and criterion, fills title, description, severity, optional element selector or screenshot click to place a pin.

### Checklist Mode

Switches the right panel to a full list of all applicable heuristics or criteria for the active profile. For each item:
- Count of existing findings at this step.
- "Focus analyze" button: re-runs Gemini with a targeted prompt for that item.
- "No issues found" button: marks the criterion as reviewed with no findings.

---

## Report

### Structure

```
AUDIT REPORT
  Session name, target URL, date, audit profile
  Capture methods used (bookmarklet / manual upload)
  Total findings by severity and source (codified / AI / manual)

EXECUTIVE SUMMARY
  Top critical issues (max 5)
  NNG or Baymard coverage heatmap
  WCAG 2.2 conformance: A / AA / AAA pass or fail per criterion

PER-FLOW FINDINGS
  For each flow, then each step:
    Step name, URL, capture method, screenshot thumbnail
    Findings grouped by framework then severity
    Each finding: title, description, recommendation, evidence snippet or bbox crop

APPENDIX A: DISMISSED FINDINGS
  All findings the reviewer dismissed, with dismiss reasons.
  Included so stakeholders can see what was considered and ruled out.

APPENDIX B: REJECTED AI FINDINGS
  All findings rejected as hallucinations, with rejection reasons.
  Included to track AI reliability across sessions.

APPENDIX C: METHODOLOGY
  Audit profile definition, heuristic and WCAG criterion reference.
```

### PDF Export

Rendered via react-pdf. Screenshots inline at full width. Each finding occupies its own block: title, severity badge, description, recommendation, DOM snippet or element crop. Color-coded by severity: red (critical), orange (major), yellow (minor), blue (info). Dismissed and rejected findings appear in the appendix sections at reduced opacity.

---

## Configuration

`.env.local` (copy from `.env.example` and fill in values):

```bash
# Required. Free key at aistudio.google.com. No credit card needed.
GEMINI_API_KEY=

# Absolute path for screenshot and DOM snapshot storage.
# Defaults to <project_root>/storage if not set.
# Use an absolute path so files remain accessible if the project directory moves.
STORAGE_ROOT=/absolute/path/to/storage

# Port the dev server runs on. The bookmarklet generator reads this at
# generation time and injects it into the script, so the bookmarklet always
# points to the correct origin. Change this if 3000 is in use.
PORT=3000
```

On first run, if `GEMINI_API_KEY` is missing, the app renders a setup screen. The user pastes their key and it writes to `.env.local`. The key never leaves the local machine.

`STORAGE_ROOT` defaults to `{projectRoot}/storage` at runtime if absent. All `screenshot_path` and `dom_snapshot_path` values in the DB are absolute paths resolved against this root. Moving the project only requires updating `STORAGE_ROOT`, not the DB.

---

## Backlog (Out of Scope for v1)

- JIRA export
- Multi-user collaboration
- Cloud storage or sync
- Authentication for the app itself
- Browser extension (vs. bookmarklet)
- WCAG 2.2 AAA full coverage
- Custom audit profiles
- AI reliability dashboard (aggregate rejection_reason analysis across sessions)
- Learning from corrections: fine-tuning or few-shot injection based on past rejections

---

## Resolved Architecture Decisions

| Question | Decision | Rationale |
|---|---|---|
| Confidence threshold default | Collapse medium and low by default. Show facts (codified) and high-confidence AI first. | The tool is a ruthless critic, not a brainstorming partner. Noise reduces trust. |
| Screenshot storage | Absolute paths in DB, resolved from configurable `STORAGE_ROOT` env var. | Relative paths break silently when the project moves. Absolute paths make the failure explicit and fixing it a one-line env change. |
| Bookmarklet port | Dynamic. The bookmarklet generator reads `PORT` (or `window.location.origin`) at generation time and injects it into the script. | Hardcoding 3000 breaks multi-project setups. The generated script is static thereafter, so no runtime dependency on the server port. |
| AI evidence mandate | AI findings with no `evidence_selector` and no `evidence_dom_snippet` are stored as `status: "unverified"` rather than discarded. | Discarding silently loses signal. Unverified findings are shown collapsed with a warning; the reviewer can supply evidence manually and confirm, or reject them. |
| Re-scanning | The `scans` table tracks each analysis run independently. Re-scanning a step under a new profile appends findings tagged with `generated_by_profile` without touching prior confirmed findings. | Stored HTML and screenshots are assets. Re-processing them against new profiles costs only an API call, not a page re-capture. |
