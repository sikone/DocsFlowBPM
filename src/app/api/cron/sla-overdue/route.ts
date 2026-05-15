import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyStepAssignees, notifyUsers } from '@/lib/notifications'
import { sendSlaOverdueEmail } from '@/lib/mailer'

// Called by Vercel Cron (vercel.json) or any external scheduler every ~5 min.
// Sends a one-time SLA_OVERDUE notification per step when dueAt < now.
// Dedup key: Notification(type='SLA_OVERDUE', entityType='APPROVAL_STEP', entityId=step.id).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided =
      request.headers.get('authorization')?.replace('Bearer ', '') ??
      new URL(request.url).searchParams.get('secret')
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const now = new Date()

    const steps = await db.documentApprovalStep.findMany({
      where: {
        status: 'PENDING',
        isActive: true,
        dueAt: { lt: now },
        approval: { status: 'IN_PROGRESS' },
      },
      select: {
        id: true,
        name: true,
        userId: true,
        departmentId: true,
        dueAt: true,
        approval: {
          select: {
            documentId: true,
            document: { select: { title: true } },
          },
        },
      },
    })

    if (steps.length === 0) {
      return NextResponse.json({ notified: 0 })
    }

    // Dedup: skip steps already notified with SLA_OVERDUE
    const stepIds = steps.map((s) => s.id)
    const alreadyNotified = await db.notification.findMany({
      where: { type: 'SLA_OVERDUE', entityType: 'APPROVAL_STEP', entityId: { in: stepIds } },
      select: { entityId: true },
      distinct: ['entityId'],
    })
    const alreadyNotifiedIds = new Set(
      alreadyNotified.map((n) => n.entityId).filter((id): id is string => id !== null),
    )

    const toNotify = steps.filter((s) => !alreadyNotifiedIds.has(s.id))

    let notifiedCount = 0
    for (const step of toNotify) {
      const docTitle = step.approval.document.title
      const overdueMs = step.dueAt ? Math.max(0, now.getTime() - step.dueAt.getTime()) : 0
      const h = Math.floor(overdueMs / 3600000)
      const m = Math.floor((overdueMs % 3600000) / 60000)
      const durationText = h > 0 ? `${h}ч ${m > 0 ? m + 'мин' : ''}`.trim() : `${m}мин`
      const notifTitle = `Заявка «${docTitle}» просрочена на ${durationText} (шаг: ${step.name})`

      // Notify assignees (user or department members)
      await notifyStepAssignees(
        { userId: step.userId, departmentId: step.departmentId },
        {
          type: 'SLA_OVERDUE',
          entityType: 'APPROVAL_STEP',
          entityId: step.id,
          title: notifTitle,
        },
      )

      // Also notify department head if different from assignee
      const headUserIds = await resolveHeadUserIds(step.userId, step.departmentId)
      if (headUserIds.length > 0) {
        await notifyUsers(headUserIds, {
          type: 'SLA_OVERDUE',
          entityType: 'APPROVAL_STEP',
          entityId: step.id,
          title: notifTitle,
        })
      }

      await sendSlaOverdueEmail({
        stepId: step.id,
        stepName: step.name,
        dueAt: step.dueAt,
        assigneeUserId: step.userId,
        assigneeDepId: step.departmentId,
        documentId: step.approval.documentId,
        documentTitle: docTitle,
      })

      notifiedCount++
    }

    return NextResponse.json({ notified: notifiedCount, total: steps.length })
  } catch (err) {
    console.error('SLA overdue check error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function resolveHeadUserIds(
  assigneeUserId?: string | null,
  assigneeDepId?: string | null,
): Promise<string[]> {
  let departmentId: string | null | undefined = assigneeDepId

  if (!departmentId && assigneeUserId) {
    const user = await db.user.findUnique({
      where: { id: assigneeUserId },
      select: { departmentId: true },
    })
    departmentId = user?.departmentId
  }

  if (!departmentId) return []

  const heads = await db.user.findMany({
    where: { departmentId, isDepartmentHead: true, active: true },
    select: { id: true },
  })

  // Exclude the assignee themselves (if they are also the head)
  return heads.map((h) => h.id).filter((id) => id !== assigneeUserId)
}
