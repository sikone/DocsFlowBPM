import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { isPrivilegedRole } from '@/lib/doc-permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { id } = await params

    const document = await db.document.findUnique({
      where: { id },
      include: {
        type: true,
        folder: {
          select: { id: true, name: true, color: true, icon: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        tagLinks: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!isPrivilegedRole(user.role) && document.creator.id !== user.id) {
      const perm = await db.documentPermission.findFirst({ where: { documentId: id, userId: user.id } })
      if (!perm) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ document })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, status, urgency, data, folderId } = body

    // Check document exists
    const existingDoc = await db.document.findUnique({ where: { id } })
    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses = ['DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate folder if provided
    if (folderId !== undefined && folderId !== null) {
      const folder = await db.folder.findUnique({ where: { id: folderId } })
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (status !== undefined) updateData.status = status
    if (urgency !== undefined) updateData.urgency = urgency
    if (folderId !== undefined) updateData.folderId = folderId

    // Validate and stringify data
    if (data !== undefined) {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        updateData.data = JSON.stringify(parsed)
      } catch {
        return NextResponse.json(
          { error: 'Data must be valid JSON' },
          { status: 400 }
        )
      }
    }

    const updatedDocument = await db.document.update({
      where: { id },
      data: updateData,
      include: {
        type: true,
        folder: {
          select: { id: true, name: true, color: true, icon: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        tagLinks: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    })

    // Log status change
    if (status !== undefined && status !== existingDoc.status) {
      logActivity({
        userId: user.id,
        action: 'CHANGE_STATUS',
        entityType: 'Document',
        entityId: id,
        details: `Статус изменён: ${existingDoc.status} → ${status}`,
      })
    }

    // Log document edit
    if (title !== undefined || data !== undefined) {
      logActivity({
        userId: user.id,
        action: 'EDIT_DOCUMENT',
        entityType: 'Document',
        entityId: id,
        details: `Изменён документ: ${updatedDocument.title}`,
      })
    }

    return NextResponse.json({ document: updatedDocument })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { id } = await params

    // Check document exists
    const existingDoc = await db.document.findUnique({ where: { id } })
    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    logActivity({
      userId: user.id,
      action: 'DELETE_DOCUMENT',
      entityType: 'Document',
      entityId: id,
      details: `Удалён документ: ${existingDoc.title}`,
    })

    await db.document.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
