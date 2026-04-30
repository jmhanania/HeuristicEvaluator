import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'
import { config } from '@/lib/config'

function createDb() {
  const dbDir = path.dirname(config.dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const sqlite = new Database(config.dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  migrate(db, {
    migrationsFolder: path.join(process.cwd(), 'db', 'migrations'),
  })

  return db
}

// Singleton — reuse the connection across the Next.js process.
// In dev, hot-reload can create multiple instances; the global guard prevents that.
const globalForDb = globalThis as unknown as { db: ReturnType<typeof createDb> }

export const db = globalForDb.db ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db
}
