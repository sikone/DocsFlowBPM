import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { isPrivilegedRole } from '@/lib/doc-permissions'
import { logActivity } from '@/lib/activity-log'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId, attachmentId } = await params

    const attachment = await db.documentAttachment.findUnique({ where: { id: attachmentId } })
    if (!attachment || attachment.documentId !== documentId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (!isPrivilegedRole(user.role)) {
      const doc = await db.document.findUnique({ where: { id: documentId }, select: { createdById: true } })
      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      if (doc.createdById !== user.id) {
        const perm = await db.documentPermission.findFirst({ where: { documentId, userId: user.id } })
        if (!perm) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    await db.documentAttachment.updateMany({
      where: { groupId: attachment.groupId, documentId },
      data: { deletedAt: null },
    })

    logActivity({
      userId: user.id,
      action: 'RESTORE_ATTACHMENT',
      entityType: 'DOCUMENT',
      entityId: documentId,
      details: `Восстановлено вложение: ${attachment.originalName}`,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
