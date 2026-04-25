import { db } from '@/lib/db'
import { createNotification } from '@/lib/activity-log'

export async function notifyUsers(
  userIds: string[],
  params: {
    type: string
    title: string
    body?: string
    entityType?: string
    entityId?: string
  },
): Promise<void> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return
  await Promise.all(unique.map((userId) => createNotification({ userId, ...params })))
}

/**
 * Notify all users assigned to an approval step.
 * If departmentId is set, notifies every active member of that department.
 */
export async function notifyStepAssignees(
  step: { userId?: string | null; departmentId?: string | null },
  params: {
    type: string
    title: string
    body?: string
    entityType?: string
    entityId?: string
  },
): Promise<void> {
  const userIds: string[] = []
  if (step.userId) {
    userIds.push(step.userId)
  } else if (step.departmentId) {
    const users = await db.user.findMany({
      where: { departmentId: step.departmentId, active: true },
      select: { id: true },
    })
    userIds.push(...users.map((u) => u.id))
  }
  await notifyUsers(userIds, params)
}
