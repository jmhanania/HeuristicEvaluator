# HeuristicEvaluator

An AI-augmented UX audit platform that evaluates websites against Nielsen's 10 Usability Heuristics, Baymard Institute ecommerce guidelines, and WCAG 2.2 accessibility standards. Uses Google Gemini (free tier) for AI analysis and a browser bookmarklet for capture — no headless browser, no paid APIs required.

---

## How it works

1. You create an audit session in the app and choose which frameworks to evaluate against (NNG, Baymard, WCAG, or any combination).
2. You install a bookmarklet in your browser.
3. You navigate to any website — including pages behind a login — and click the bookmarklet.
4. The bookmarklet captures a screenshot, flattens the DOM (including Shadow DOM), runs axe-core for automated accessibility checks, and sends everything to your local server.
5. The server runs deterministic codified checks and an AI analysis via Gemini.
6. You triage the findings in a split-panel workspace: screenshot with evidence pins on the left, findings table on the right.
7. You export a PDF report or copy a Markdown table for Jira/GitHub.

---

## Prerequisites

- **Node.js 18+** — download from [nodejs.org](https://nodejs.org) (choose the LTS version)
- **Git** — download from [git-scm.com](https://git-scm.com)
- **A free Gemini API key** — get one at [aistudio.google.com](https://aistudio.google.com) (no credit card required)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/jmhanania/HeuristicEvaluator.git
cd HeuristicEvaluator
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` in a text editor and fill in your Gemini API key:

```
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX
```

The other variables are optional:

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required.** Free key from aistudio.google.com |
| `STORAGE_ROOT` | `./storage` | Absolute path where screenshots and DOM snapshots are saved |
| `PORT` | `3000` | Port the dev server runs on |

### 4. Start the app

```bash
npm run dev
```

When you see `▲ Next.js ready on http://localhost:3000`, the app is running.

---

## Running an audit

### Step 1 — Create a session

Open [http://localhost:3000](http://localhost:3000) and click **New Session**. Give it a name, the URL of the site you want to audit, and choose one or more audit profiles:

- **NNG** — Nielsen's 10 Usability Heuristics
- **Baymard** — Baymard Institute ecommerce guidelines
- **WCAG 2.2** — Accessibility criteria not caught by automated tools

### Step 2 — Install the bookmarklet

Go to [http://localhost:3000/api/bookmarklet](http://localhost:3000/api/bookmarklet) and drag the button to your browser's bookmarks bar.

> The bookmarklet must be reinstalled any time you change the `PORT` in `.env.local`, because the server URL is baked in at generation time.

### Step 3 — Capture a page

Navigate to the website you want to audit and click the bookmarklet. A panel will appear in the corner of the page:

1. Select your session and flow (or create a new flow).
2. Give the screen a name (e.g. "Checkout — Shipping Address").
3. Optionally click **Redact Sensitive Content** and draw black boxes over any PII before it leaves your browser.
4. Drag the panel out of the way if it's covering something you need to see.
5. Click **Capture & Analyze**.

The capture takes 10–30 seconds. When it finishes, click **Open workspace to triage**.

### Step 4 — Triage findings

The workspace shows the screenshot on the left and a findings table on the right.

- **Numbered pins** on the screenshot correspond to AI findings that have bounding box coordinates. Hover a row to highlight the specific element.
- Use the **severity / status / framework** filters to focus on what matters.
- Click a row to expand the full description, remediation instructions, and CSS selector evidence.
- **Confirm** findings you agree with, **Dismiss** ones that aren't applicable, or mark AI findings as **Hallucination** if the evidence is fabricated.

Only confirmed findings appear in the report.

### Step 5 — View the report

Click **View Report** in the workspace toolbar, or navigate to `/reports/[flowId]`.

The report includes:
- A **UX Health Score** (0–100) weighted by the severity of confirmed findings
- An **Executive Heatmap** showing confirmed findings by heuristic and severity
- A **step-by-step breakdown** with annotated screenshots and grouped findings
- A **Download PDF** button (generated client-side, no server round-trip)
- A **Copy Markdown** button that produces a Jira/GitHub-ready table of critical and serious findings
- A collapsed **Appendix** showing dismissed and rejected findings for transparency

### Re-scanning with a different profile

In the workspace toolbar, click **Re-scan** to re-run the AI analysis on the stored snapshot using any profile. New findings are appended — previously confirmed findings are never modified.

---

## Project structure

```
app/
  api/
    bookmarklet/          Serves the bookmarklet installer page
    bookmarklet-script/   Serves the live capture script
    sessions/             Returns sessions + flows for the bookmarklet dropdown
    snapshot/             Receives captures from the bookmarklet, runs analysis
    screenshots/          Serves screenshot files from STORAGE_ROOT
  reports/[flowId]/       Printable report page
  sessions/.../steps/     Split-panel triage workspace
components/
  report/                 Report page components (heatmap, PDF, markdown export)
  workspace/              Triage table, screenshot preview, severity badges
db/
  schema.ts               Drizzle ORM schema (sessions, flows, steps, scans, findings)
  migrations/             Auto-generated SQL migrations
lib/
  config.ts               STORAGE_ROOT and file path helpers
  reportUtils.ts          Health score, heatmap, markdown generation
  scrubber.ts             8-pass HTML scrubber + CSS selector validator
server/
  ai/                     Gemini integration (prompts + analysis)
  codified/               Deterministic NNG heuristic checks
  bookmarklet/            Bookmarklet script generator
  actions/                Server actions (confirm, dismiss, reject, re-scan)
storage/                  Created automatically — screenshots and DOM snapshots
```

---

## Technology

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | SQLite via Drizzle ORM + better-sqlite3 |
| AI | Google Gemini 2.0 Flash (`@google/generative-ai`) |
| Accessibility scanning | axe-core (loaded from CDN in bookmarklet) |
| Screenshot capture | html2canvas (loaded from CDN in bookmarklet) |
| PDF export | @react-pdf/renderer |
| Styling | Tailwind CSS v4 |

---

## Notes

- **Screenshots and cross-origin images** — html2canvas cannot capture images served from other domains without CORS headers. These will appear blank in the screenshot. Layout, text, and same-origin images capture correctly.
- **Authenticated pages** — the bookmarklet runs in your already-logged-in browser, so authenticated flows are captured automatically. No credentials ever touch the app.
- **Privacy** — form field values are stripped before the DOM leaves your browser. The redaction tool lets you black out any remaining sensitive content before capture. Raw DOM snapshots are stored locally only.
- **Rate limits** — the Gemini free tier allows 15 requests per minute and 1,500 per day. Each capture uses one request per selected audit profile.
- **Storage** — all screenshots and DOM snapshots are stored in `STORAGE_ROOT` (default: `./storage`). This folder is gitignored and should not be committed.
