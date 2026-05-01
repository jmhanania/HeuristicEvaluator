'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db/client'
import { sessions } from '@/db/schema'
import type { AuditProfile } from '@/db/schema'
import { ulid } from 'ulid'
import { eq } from 'drizzle-orm'

export async function createSession(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const targetUrl = (formData.get('targetUrl') as string)?.trim()
  const auditProfile = (formData.get('auditProfile') as AuditProfile) ?? 'nng'

  if (!name || !targetUrl) throw new Error('Name and URL are required')

  const id = ulid()
  const now = new Date()

  await db.insert(sessions).values({
    id,
    name,
    targetUrl,
    auditProfile,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath('/')
  redirect('/')
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
  revalidatePath('/')
}
