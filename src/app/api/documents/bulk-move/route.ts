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
    const { ids, folderId } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty array' },
        { status: 400 }
      )
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Cannot move more than 100 documents at once' },
        { status: 400 }
      )
    }

    // Validate folder if provided
    if (folderId !== null && folderId !== undefined) {
      const folder = await db.folder.findUnique({ where: { id: folderId } })
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    // Fetch existing docs for logging
    const existingDocs = await db.document.findMany({
      where: { id: { in: ids } },
      include: { folder: { select: { name: true } } },
    })

    const targetFolderName = folderId
      ? (await db.folder.findUnique({ where: { id: folderId } }))?.name || 'Неизвестная папка'
      : 'Без папки'

    const updated = await db.document.updateMany({
      where: { id: { in: ids } },
      data: { folderId: folderId || null },
    })

    // Log activity for each moved document
    for (const doc of existingDocs) {
      const oldFolder = doc.folder?.name || 'Без папки'
      if (oldFolder !== targetFolderName) {
        logActivity({
          userId: user.id,
          action: 'EDIT_DOCUMENT',
          entityType: 'DOCUMENT',
          entityId: doc.id,
          details: `Перемещён документ из «${oldFolder}» в «${targetFolderName}»`,
        })
      }
    }

    return NextResponse.json({ updated: updated.count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
