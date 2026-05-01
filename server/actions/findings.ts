'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { findings } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function confirmFinding(findingId: string, stepPath: string) {
  await db
    .update(findings)
    .set({ status: 'confirmed', dismissReason: null, rejectionReason: null })
    .where(eq(findings.id, findingId))
  revalidatePath(stepPath)
}

export async function dismissFinding(
  findingId: string,
  reason: string,
  stepPath: string,
) {
  await db
    .update(findings)
    .set({ status: 'dismissed', dismissReason: reason })
    .where(eq(findings.id, findingId))
  revalidatePath(stepPath)
}

export async function rejectFinding(
  findingId: string,
  reason: string,
  stepPath: string,
) {
  await db
    .update(findings)
    .set({ status: 'dismissed', rejectionReason: reason })
    .where(eq(findings.id, findingId))
  revalidatePath(stepPath)
}

export async function resetFinding(findingId: string, stepPath: string) {
  await db
    .update(findings)
    .set({ status: 'pending', dismissReason: null, rejectionReason: null })
    .where(eq(findings.id, findingId))
  revalidatePath(stepPath)
}
