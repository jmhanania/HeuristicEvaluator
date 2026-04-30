import path from 'path'

const projectRoot = process.cwd()

function resolveStorageRoot(): string {
  if (process.env.STORAGE_ROOT) {
    return path.resolve(process.env.STORAGE_ROOT)
  }
  return path.join(projectRoot, 'storage')
}

function resolveDbPath(): string {
  if (process.env.DATABASE_URL) {
    return path.resolve(process.env.DATABASE_URL)
  }
  return path.join(projectRoot, 'db', 'audit.db')
}

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: 'gemini-2.0-flash',
  storageRoot: resolveStorageRoot(),
  dbPath: resolveDbPath(),
  port: parseInt(process.env.PORT ?? '3000', 10),
  isDev: process.env.NODE_ENV !== 'production',
} as const

// ---------------------------------------------------------------------------
// Storage path helpers
// All paths are absolute, resolved under STORAGE_ROOT.
// Layout: {STORAGE_ROOT}/{sessionId}/{stepId}/{filename}
// ---------------------------------------------------------------------------

export function stepStorageDir(sessionId: string, stepId: string): string {
  return path.join(config.storageRoot, sessionId, stepId)
}

// Fixed filenames within each step directory.
// ULIDs handle chronological sortability at the directory level;
// filenames are fixed so code can locate them without a DB query.
export const STORAGE_FILES = {
  screenshot: 'screenshot.jpg',
  rawDom: 'raw_dom.html',
  scrubbedDom: 'scrubbed_dom.html',
  axeResults: 'axe_results.json',
} as const

export function stepFilePath(
  sessionId: string,
  stepId: string,
  file: keyof typeof STORAGE_FILES,
): string {
  return path.join(stepStorageDir(sessionId, stepId), STORAGE_FILES[file])
}
