import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { sessions, flows } from '@/db/schema'
import { eq } from 'drizzle-orm'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// GET /api/sessions
// Returns all sessions with their flows for the bookmarklet dropdown.
export async function GET() {
  const allSessions = await db.select().from(sessions).orderBy(sessions.createdAt)

  const sessionList = await Promise.all(
    allSessions.map(async session => {
      const sessionFlows = await db
        .select({ id: flows.id, name: flows.name })
        .from(flows)
        .where(eq(flows.sessionId, session.id))
        .orderBy(flows.order)

      return {
        id: session.id,
        name: session.name,
        auditProfile: session.auditProfile,
        status: session.status,
        flows: sessionFlows,
      }
    }),
  )

  return NextResponse.json(
    { sessions: sessionList },
    { headers: CORS },
  )
}
