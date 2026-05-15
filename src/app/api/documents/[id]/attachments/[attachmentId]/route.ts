import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { deleteUploadedFile } from '@/lib/uploads'
import { logActivity } from '@/lib/activity-log'

export async function DELETE(
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

    const ADMIN_ROLES = ['ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT']
    if ((attachment as any).isSigned && !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Подписанные документы могут удалять только администраторы' }, { status: 403 })
    }

    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { status: true },
    })
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    if (document.status === 'DRAFT') {
      // Hard delete: remove file from disk and all versions in the same group
      const groupAttachments = await db.documentAttachment.findMany({
        where: { groupId: attachment.groupId, documentId },
      })
      for (const a of groupAttachments) {
        await deleteUploadedFile(documentId, a.fileName)
      }
      await db.documentAttachment.deleteMany({
        where: { groupId: attachment.groupId, documentId },
      })
      logActivity({
        userId: user.id,
        action: 'DELETE_ATTACHMENT',
        entityType: 'DOCUMENT',
        entityId: documentId,
        details: `Удалено вложение: ${attachment.originalName}`,
      })
      return NextResponse.json({ success: true, softDeleted: false })
    }

    // Soft delete: mark all versions in the group as deleted
    const now = new Date()
    await db.documentAttachment.updateMany({
      where: { groupId: attachment.groupId, documentId },
      data: { deletedAt: now },
    })
    logActivity({
      userId: user.id,
      action: 'DELETE_ATTACHMENT',
      entityType: 'DOCUMENT',
      entityId: documentId,
      details: `Удалено вложение: ${attachment.originalName}`,
    })

    return NextResponse.json({ success: true, softDeleted: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
