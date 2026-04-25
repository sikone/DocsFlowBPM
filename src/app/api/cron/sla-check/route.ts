import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyStepAssignees } from '@/lib/notifications'

// Called by Vercel Cron (vercel.json) or any external scheduler every ~5 min.
// Sends a one-time SLA_WARNING notification per step when dueAt <= now + 1 hour.
// Dedup key: Notification(type='SLA_WARNING', entityType='APPROVAL_STEP', entityId=step.id).
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
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

    const steps = await db.documentApprovalStep.findMany({
      where: {
        status: 'PENDING',
        isActive: true,
        dueAt: { lte: oneHourLater },
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

    // Find which steps already have a SLA_WARNING notification (dedup per step)
    const stepIds = steps.map((s) => s.id)
    const alreadyNotified = await db.notification.findMany({
      where: { type: 'SLA_WARNING', entityType: 'APPROVAL_STEP', entityId: { in: stepIds } },
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
      const isOverdue = step.dueAt !== null && step.dueAt < now
      const title = isOverdue
        ? `Срок SLA истёк по документу «${docTitle}» (шаг: ${step.name})`
        : `Менее часа до истечения SLA по документу «${docTitle}» (шаг: ${step.name})`

      await notifyStepAssignees(
        { userId: step.userId, departmentId: step.departmentId },
        {
          type: 'SLA_WARNING',
          // entityType/entityId used as dedup key — not for navigation
          entityType: 'APPROVAL_STEP',
          entityId: step.id,
          title,
        },
      )
      notifiedCount++
    }

    return NextResponse.json({ notified: notifiedCount, total: steps.length })
  } catch (err) {
    console.error('SLA check error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
