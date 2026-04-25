import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'

export async function PUT(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, status } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty array' },
        { status: 400 }
      )
    }

    const validStatuses = ['DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Cannot update more than 100 documents at once' },
        { status: 400 }
      )
    }

    // Fetch existing docs to log status changes
    const existingDocs = await db.document.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, status: true },
    })

    const updated = await db.document.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    // Log activity for documents whose status actually changed
    for (const doc of existingDocs) {
      if (doc.status !== status) {
        logActivity({
          userId: user.id,
          action: 'CHANGE_STATUS',
          entityType: 'DOCUMENT',
          entityId: doc.id,
          details: `Массовая смена статуса: ${doc.status} → ${status} (${doc.title})`,
        })
      }
    }

    return NextResponse.json({ updated: updated.count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
