# HeuristicEvaluator — Product Specification

## Overview

HeuristicEvaluator is a web-based tool for conducting structured UX audits of any website. It combines automated scanning, AI-assisted analysis, and guided manual review to evaluate a site against two industry-standard frameworks:

- **NNG's 10 Usability Heuristics** (Jakob Nielsen)
- **WCAG 2.1** accessibility guidelines (levels A, AA, AAA)

Audits are organized into **sessions** → **flows** → **steps**. At each step you review a page, triage AI suggestions, confirm automated violations, and add manual findings. At the end you export a structured report to PDF or JIRA.

---

## Core Concepts

### Session
A single audit engagement. Has a name, target base URL, and status (draft / complete).

### Flow
A user journey within a session — e.g., "Checkout", "Onboarding", "Search & Filter". A session can have multiple flows.

### Step
One page or UI state within a flow — e.g., "Cart page", "Payment form", "Order confirmation". Each step has a URL and a screenshot captured at review time.

### Finding
An identified issue at a step. Can be:
- **Automated** — detected by axe-core without AI or human involvement
- **AI-suggested** — flagged by Claude, pending triage
- **Manual** — added directly by the reviewer

Every finding is tagged to either a heuristic (H1–H10) or a WCAG success criterion, given a severity, and linked to an element on the page where applicable.

---

## Evaluation Frameworks

### NNG 10 Usability Heuristics

| ID | Name |
|----|------|
| H1 | Visibility of System Status |
| H2 | Match Between System and the Real World |
| H3 | User Control and Freedom |
| H4 | Consistency and Standards |
| H5 | Error Prevention |
| H6 | Recognition Rather Than Recall |
| H7 | Flexibility and Efficiency of Use |
| H8 | Aesthetic and Minimalist Design |
| H9 | Help Users Recognize, Diagnose, and Recover from Errors |
| H10 | Help and Documentation |

### WCAG 2.1 — POUR Principles

**Perceivable** — Information must be presentable to users in ways they can perceive.
Key criteria: text alternatives (1.1.1), captions (1.2.x), adaptable content (1.3.x), distinguishable content (1.4.x)

**Operable** — UI components and navigation must be operable.
Key criteria: keyboard accessible (2.1.x), enough time (2.2.x), seizures (2.3.x), navigable (2.4.x), input modalities (2.5.x)

**Understandable** — Information and operation must be understandable.
Key criteria: readable (3.1.x), predictable (3.2.x), input assistance (3.3.x)

**Robust** — Content must be robust enough for assistive technologies.
Key criteria: compatible (4.1.x)

Conformance levels: **A** (minimum), **AA** (recommended, legally required in many jurisdictions), **AAA** (enhanced)

### Severity Scale (shared across both frameworks)

| Level | Meaning |
|-------|---------|
| Critical | Blocks the user from completing a task |
| Major | Significantly impairs the experience |
| Minor | Friction or confusion but task is completable |
| Info | Observation or best-practice note |

---

## Application Architecture

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | Full-stack, server actions, streaming UI |
| Language | TypeScript | Type safety for complex domain models |
| Database | SQLite via Drizzle ORM | Local-first, zero infra, portable |
| Browser automation | Playwright | Full page screenshots, DOM access, JS execution |
| Automated a11y | axe-core | Industry-standard WCAG scanner, ~30-40% issue coverage |
| AI analysis | Claude API (claude-sonnet-4-6) | Vision + reasoning for heuristic and a11y review |
| UI components | Tailwind CSS + shadcn/ui | Fast, accessible, consistent |
| PDF export | Puppeteer / react-pdf | Render report as styled PDF |
| JIRA export | Atlassian REST API v3 | Create issues, set labels, link to epics |

### Project Structure

```
/
├── app/
│   ├── (dashboard)/
│   │   └── page.tsx              # Session list / landing
│   ├── sessions/
│   │   ├── new/page.tsx          # Create session + first flow
│   │   └── [sessionId]/
│   │       ├── page.tsx          # Session overview
│   │       └── flows/
│   │           └── [flowId]/
│   │               ├── page.tsx           # Flow overview
│   │               └── steps/
│   │                   └── [stepId]/
│   │                       └── page.tsx   # Evaluation workspace
│   └── reports/
│       └── [sessionId]/page.tsx  # Report view + export
├── components/
│   ├── workspace/
│   │   ├── SitePreview.tsx       # Screenshot panel with annotations
│   │   ├── FindingsPanel.tsx     # Right-side triage panel
│   │   ├── SuggestionCard.tsx    # AI suggestion with confirm/edit/dismiss
│   │   ├── FindingForm.tsx       # Manual finding form
│   │   └── CoverageBar.tsx       # H1-H10 + WCAG coverage indicators
│   ├── report/
│   │   ├── ReportSummary.tsx
│   │   ├── FindingsList.tsx
│   │   └── ExportControls.tsx
│   └── shared/
├── server/
│   ├── actions/
│   │   ├── sessions.ts
│   │   ├── flows.ts
│   │   ├── steps.ts
│   │   └── findings.ts
│   ├── ai/
│   │   ├── analyze.ts            # Claude API integration
│   │   └── prompts.ts            # System + user prompt templates
│   ├── automation/
│   │   ├── screenshot.ts         # Playwright page capture
│   │   └── axe.ts                # axe-core DOM scan
│   └── export/
│       ├── pdf.ts
│       └── jira.ts
├── db/
│   ├── schema.ts                 # Drizzle schema
│   └── migrations/
└── lib/
    ├── heuristics.ts             # NNG heuristic definitions
    └── wcag.ts                   # WCAG criterion definitions
```

---

## Data Model

```typescript
// Session — top-level audit
sessions {
  id: text (ulid)
  name: text
  target_url: text
  description: text
  status: "draft" | "complete"
  created_at: timestamp
  updated_at: timestamp
}

// Flow — a user journey
flows {
  id: text (ulid)
  session_id: text → sessions.id
  name: text
  description: text
  order: integer
  created_at: timestamp
}

// Step — a page within a flow
steps {
  id: text (ulid)
  flow_id: text → flows.id
  name: text
  url: text
  order: integer
  screenshot_path: text       // stored locally
  dom_snapshot_path: text     // trimmed HTML for AI context
  axe_results_path: text      // raw axe JSON
  analyzed_at: timestamp      // when Claude last ran
  created_at: timestamp
}

// Finding — a single issue
findings {
  id: text (ulid)
  step_id: text → steps.id
  source: "automated" | "ai" | "manual"
  status: "confirmed" | "dismissed" | "pending"

  // Framework
  framework: "nng" | "wcag"
  heuristic_id: integer         // 1-10, if framework = nng
  wcag_criterion: text          // e.g. "1.1.1", if framework = wcag
  wcag_level: "A" | "AA" | "AAA"

  // Content
  title: text
  description: text
  recommendation: text
  severity: "critical" | "major" | "minor" | "info"

  // Location
  element_selector: text
  element_screenshot_path: text

  // AI metadata
  ai_confidence: "high" | "medium" | "low"
  dismiss_reason: text

  created_at: timestamp
}
```

---

## Evaluation Workspace — Detailed Flow

### Step Entry

When a reviewer navigates to a step, the following fires automatically:

1. **Playwright** loads the step URL in a headless browser
   - Captures full-page screenshot
   - Captures trimmed DOM (semantic HTML, no scripts/styles)
   - Captures interactive element map (buttons, inputs, links, images)

2. **axe-core** runs against the live DOM
   - Returns violations keyed to WCAG criteria
   - Each violation includes: element selector, impact level, help URL
   - These are immediately saved as `source: "automated"` findings with `status: "confirmed"`

3. **Claude analysis** fires with a structured prompt (see AI section below)
   - Returns JSON array of suggested findings
   - Saved as `source: "ai"`, `status: "pending"`
   - Displayed in the AI Suggestions tray, sorted by confidence desc

### Workspace Layout

```
┌───────────────────────────────┬──────────────────────────────────┐
│  SITE PREVIEW                 │  FINDINGS PANEL                  │
│                               │                                  │
│  [Full-page screenshot]       │  ▸ Automated (axe) — 3          │
│                               │    All auto-confirmed            │
│  Confirmed findings shown     │    WCAG 1.1.1 · WCAG 4.1.2 ...  │
│  as numbered pins overlaid    │                                  │
│  on screenshot elements.      │  ▸ AI Suggestions — 5 pending   │
│                               │    sorted: high → medium → low   │
│  AI pending suggestions       │    [Confirm] [Edit] [Dismiss ▾] │
│  shown as dashed outlines.    │                                  │
│                               │  ▸ My Findings — 1              │
│                               │    [+ Add finding]              │
│                               │                                  │
│                               │  ─────────────────────────────  │
│                               │  Coverage                        │
│  Step 3 / 5                   │  NNG: H1 H2 H3 H5 H9 (5/10)   │
│  "Payment Form"               │  WCAG: A ✓  AA partial  AAA —  │
│                               │                                  │
│  [← Cart]      [Confirm →]    │  [Reanalyze]   [Checklist mode] │
└───────────────────────────────┴──────────────────────────────────┘
```

### Triage Actions

**AI Suggestion card actions:**
- **Confirm** — saves as `status: "confirmed"`, pins to screenshot
- **Edit then Confirm** — opens inline form pre-filled with AI content, reviewer adjusts, then confirms
- **Dismiss** — requires a reason (dropdown: "Not applicable", "False positive", "Duplicate", "Out of scope")

**Manual finding:**
- Click "+ Add finding"
- Select framework (NNG / WCAG)
- Select heuristic or criterion from searchable dropdown
- Fill title, description, severity, optional element selector
- Optionally click on screenshot to place an element pin

### Checklist Mode

Toggling "Checklist mode" switches the right panel to a full list of all 10 heuristics + all WCAG criteria. For each item the reviewer can see:
- How many findings already exist for it at this step
- A "Focus analyze" button — re-runs Claude with a targeted prompt specifically for that heuristic/criterion
- Quick "No issues found" dismissal to mark it as reviewed

This ensures systematic coverage so nothing is skipped.

---

## AI Integration

### Claude Prompt Design

**System prompt** (sent once, cached):

```
You are a senior UX researcher and accessibility specialist conducting a formal heuristic evaluation.

You are evaluating against:

NNG 10 USABILITY HEURISTICS:
H1: Visibility of System Status — keep users informed about system state with timely feedback
H2: Match Between System and Real World — speak users' language, follow real-world conventions
H3: User Control and Freedom — provide clear exits and undo paths
H4: Consistency and Standards — consistent words, actions, and UI patterns
H5: Error Prevention — design to prevent problems before they occur
H6: Recognition Rather Than Recall — minimize memory load, make options visible
H7: Flexibility and Efficiency of Use — support both novice and expert users
H8: Aesthetic and Minimalist Design — remove irrelevant or redundant content
H9: Help Users Recognize, Diagnose, and Recover from Errors — plain-language error messages with solutions
H10: Help and Documentation — easy to find, task-focused help when needed

WCAG 2.1 POUR PRINCIPLES:
Perceivable: text alternatives, captions, adaptable, distinguishable
Operable: keyboard accessible, enough time, no seizures, navigable
Understandable: readable, predictable, input assistance
Robust: compatible with assistive technologies

SEVERITY SCALE:
Critical: blocks task completion
Major: significantly impairs experience
Minor: friction but task is completable
Info: best-practice observation

Return ONLY a JSON array. Each item must conform to this shape:
{
  "framework": "nng" | "wcag",
  "heuristic_id": number | null,       // 1-10 for nng
  "wcag_criterion": string | null,     // e.g. "1.4.3" for wcag
  "wcag_level": "A" | "AA" | "AAA" | null,
  "title": string,                     // short, specific issue title
  "description": string,               // what is wrong and why it's a problem
  "recommendation": string,            // concrete fix
  "severity": "critical" | "major" | "minor" | "info",
  "element_hint": string | null,       // CSS selector or plain description of element
  "confidence": "high" | "medium" | "low"
}

Rules:
- Do not repeat findings already covered by the automated scan results provided
- Focus on observable issues in the screenshot and DOM
- high confidence = clearly visible violation; low confidence = speculative
- Be specific: reference actual elements, labels, or content visible in the screenshot
- Aim for 5-12 findings. Do not pad with obvious or generic observations.
```

**User prompt** (per step):

```
Flow: {flowName}
Step: {stepName} ({stepOrder} of {totalSteps})
URL: {url}

AUTOMATED SCAN RESULTS (already captured — do not repeat these):
{axeSummary}

Analyze the screenshot and DOM snapshot for usability heuristic violations and accessibility issues not covered by the automated scan above.
```

### Focused Checklist Analysis

When a reviewer clicks "Focus analyze" on a specific heuristic or WCAG criterion, an additional targeted prompt is appended:

```
Focus specifically on {heuristicName / wcagCriterion}. 
Consider: {criterionDescription}
What specific evidence do you see in this page that either confirms or rules out a violation of this criterion?
```

### Token + Cost Management

- System prompt is cached (using `cache_control: ephemeral`) — charged once per session, not per step
- DOM snapshot is trimmed to semantic HTML only — `<nav>`, `<main>`, `<header>`, `<footer>`, headings, buttons, inputs, links, images (with alt text). Scripts, styles, and SVG paths stripped.
- Screenshot is sent as base64 at medium quality (1280px wide, 80% JPEG) — sufficient for visual analysis
- Estimated cost per step: ~$0.01-0.03 depending on page complexity

---

## Report

### Structure

```
AUDIT REPORT
  Session: {name}
  Target: {url}
  Date: {date}
  Reviewer: {name}
  Flows evaluated: {n}
  Total findings: {n} (Critical: n, Major: n, Minor: n, Info: n)

EXECUTIVE SUMMARY
  Top 3 critical issues
  NNG coverage heatmap (H1–H10, findings per heuristic)
  WCAG conformance summary (A/AA/AAA pass/fail/partial)

PER-FLOW FINDINGS
  For each flow → for each step:
    Step name + URL + screenshot thumbnail
    Findings, grouped by framework then severity
    Each finding: title, description, recommendation, element screenshot if available

APPENDIX
  Full NNG heuristic definitions
  Full WCAG criteria checked
  Methodology notes
```

### PDF Export

- Rendered via `react-pdf` as a styled document
- Includes screenshots inline
- One finding per section with element screenshot crop if available
- Color-coded by severity (red/orange/yellow/blue)

### JIRA Export

Each confirmed finding creates one JIRA issue:

```
Summary:    [Severity] Title  (e.g. "[Critical] No confirmation before account deletion")
Issue type: Bug (a11y findings) or Improvement (heuristic findings)
Labels:     heuristic-evaluation, wcag-AA, severity-critical, flow-checkout, h5-error-prevention
Description:
  *What:* {description}
  *Why it matters:* {heuristic or WCAG criterion description}
  *Recommendation:* {recommendation}
  *Found at:* {url} — {stepName}
  *Flow:* {flowName}
  Attachment: element screenshot
Epic link:  {session name} — auto-created if not exists
Priority:   Critical→P1, Major→P2, Minor→P3, Info→P4
```

JIRA connection is configured per-session (base URL, project key, API token stored in env / local config).

---

## User Flows

### 1. Creating a Session

1. Click "New Audit" on dashboard
2. Enter: session name, target URL, optional description
3. Define first flow: name + ordered list of steps (URL + step name for each)
4. Save — session created, first step loads automatically

### 2. Evaluating a Step

1. Workspace loads: screenshot captured, axe scan runs, Claude analyzes
2. Automated findings appear immediately in the Automated section (confirmed)
3. AI suggestions appear sorted by confidence
4. Reviewer triages AI suggestions: confirm / edit+confirm / dismiss
5. Reviewer optionally adds manual findings
6. Reviewer clicks "Next step" — repeats for each step in the flow

### 3. Adding a Flow

From the session overview, click "Add flow", name it, add steps. Multiple flows can be evaluated in any order.

### 4. Generating a Report

From the session overview, click "Generate Report". Choose:
- Which flows to include
- Which finding sources to include (automated / AI / manual)
- Minimum severity to include
- Export format: PDF / JIRA / both

---

## Configuration

Stored in `.env.local`:

```
ANTHROPIC_API_KEY=
JIRA_BASE_URL=
JIRA_PROJECT_KEY=
JIRA_API_TOKEN=
JIRA_USER_EMAIL=
```

---

## Out of Scope (v1)

- Multi-user / team collaboration (single reviewer only)
- Authentication
- Cloud storage (all data local)
- Browser extension
- Real-time live site interaction (screenshot-based only)
- WCAG 2.2 or WCAG 3.0 criteria (WCAG 2.1 only)
- Custom heuristic frameworks

---

## Open Questions

1. **Screenshot navigation** — When a step URL requires login or prior navigation state, the reviewer needs a way to provide cookies / session tokens to Playwright. Do we support a "manual screenshot upload" fallback for authenticated flows?

2. **Re-analysis on edit** — If a reviewer edits a finding's element selector to point to a different element, should Claude re-analyze with that context?

3. **Confidence threshold default** — Should the UI default to showing only `high` confidence AI suggestions, with `medium` and `low` collapsed? Or show all and let the reviewer set their threshold per session?

4. **JIRA epic strategy** — One epic per session, or one epic per flow?

5. **Screenshot storage** — Local filesystem for v1 is fine, but paths will break if the project is moved. Use a `/screenshots/{sessionId}/` folder relative to the project root and store relative paths in the DB?
