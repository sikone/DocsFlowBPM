import { db } from '@/lib/db'

/**
 * Log an activity event to the audit trail.
 * This is a fire-and-forget operation — errors are silently ignored.
 */
export async function logActivity(params: {
  userId: string
  action: string
  entityType?: string
  entityId?: string
  details?: string
}): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        details: params.details || null,
      },
    })
  } catch {
    // Silent fail — activity logging should not break main operations
  }
}
