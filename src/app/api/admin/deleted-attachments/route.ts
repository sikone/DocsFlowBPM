import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { isPrivilegedRole } from '@/lib/doc-permissions'
import { deleteUploadedFile } from '@/lib/uploads'
import { logActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    if (!isPrivilegedRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const latest = await db.documentAttachment.findMany({
      where: { deletedAt: { not: null }, isLatest: true },
      include: {
        document: { select: { id: true, title: true, number: true } },
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { deletedAt: 'desc' },
    })

    const groupIds = latest.map((a) => a.groupId)
    const counts = await db.documentAttachment.groupBy({
      by: ['groupId'],
      where: { groupId: { in: groupIds } },
      _count: { id: true },
    })
    const countMap = new Map(counts.map((c) => [c.groupId, c._count.id]))

    const attachments = latest.map((a) => ({
      groupId: a.groupId,
      attachmentId: a.id,
      originalName: a.originalName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      deletedAt: a.deletedAt,
      versionCount: countMap.get(a.groupId) ?? 1,
      document: a.document,
      uploadedBy: a.uploadedBy,
    }))

    return NextResponse.json({ attachments })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    if (!isPrivilegedRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const groupIds: string[] = Array.isArray(body.groupIds) ? body.groupIds : []
    if (groupIds.length === 0) return NextResponse.json({ error: 'No groupIds provided' }, { status: 400 })

    const toRestore = await db.documentAttachment.findMany({
      where: { groupId: { in: groupIds }, isLatest: true },
      select: { groupId: true, originalName: true, documentId: true },
    })

    await db.documentAttachment.updateMany({
      where: { groupId: { in: groupIds } },
      data: { deletedAt: null },
    })

    for (const att of toRestore) {
      logActivity({
        userId: user.id,
        action: 'RESTORE_ATTACHMENT',
        entityType: 'DOCUMENT',
        entityId: att.documentId,
        details: `Восстановлено вложение: ${att.originalName}`,
      })
    }

    return NextResponse.json({ success: true, restored: groupIds.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    if (!isPrivilegedRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const groupIds: string[] = Array.isArray(body.groupIds) ? body.groupIds : []
    if (groupIds.length === 0) return NextResponse.json({ error: 'No groupIds provided' }, { status: 400 })

    const allVersions = await db.documentAttachment.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true, groupId: true, documentId: true, fileName: true, originalName: true, isLatest: true },
    })

    for (const att of allVersions) {
      await deleteUploadedFile(att.documentId, att.fileName)
    }

    const latestVersions = allVersions.filter((a) => a.isLatest)
    for (const att of latestVersions) {
      logActivity({
        userId: user.id,
        action: 'PERMANENT_DELETE_ATTACHMENT',
        entityType: 'DOCUMENT',
        entityId: att.documentId,
        details: `Окончательно удалено вложение: ${att.originalName}`,
      })
    }

    await db.documentAttachment.deleteMany({
      where: { groupId: { in: groupIds } },
    })

    return NextResponse.json({ success: true, deleted: groupIds.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
