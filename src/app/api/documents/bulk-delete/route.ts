import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'

export async function POST(request: NextRequest) {
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
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty array' },
        { status: 400 }
      )
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Cannot delete more than 100 documents at once' },
        { status: 400 }
      )
    }

    // Fetch documents for activity logging before deletion
    const docsToDelete = await db.document.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    })

    const deleted = await db.document.deleteMany({
      where: { id: { in: ids } },
    })

    // Log activity for each deleted document
    for (const doc of docsToDelete) {
      logActivity({
        userId: user.id,
        action: 'DELETE_DOCUMENT',
        entityType: 'DOCUMENT',
        entityId: doc.id,
        details: `Массовое удаление: ${doc.title}`,
      })
    }

    return NextResponse.json({ deleted: deleted.count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
