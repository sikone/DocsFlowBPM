import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { isPrivilegedRole } from '@/lib/doc-permissions'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Base document visibility filter (mirrors GET /api/documents logic)
    const visibilityWhere: Prisma.DocumentWhereInput = isPrivilegedRole(user.role)
      ? {}
      : {
          OR: [
            { createdById: user.id },
            { permissions: { some: { userId: user.id } } },
          ],
        }

    // "Unread" means no DocumentRead record exists for this user
    const unreadWhere: Prisma.DocumentWhereInput = {
      ...visibilityWhere,
      reads: { none: { userId: user.id } },
    }

    // Get all of this user's folders so we can compute per-folder counts
    const userFolders = await db.folder.findMany({
      where: { createdById: user.id },
      select: { id: true, isSystem: true, order: true },
    })

    const inboxFolder = userFolders.find((f) => f.isSystem && f.order === 0)
    // Personal (non-inbox) folders: docs that are "organized" for the user
    const personalFolderIds = userFolders
      .filter((f) => !(f.isSystem && f.order === 0))
      .map((f) => f.id)

    // Count unread per folder (non-inbox) in one query
    const folderCounts: Record<string, number> = {}

    if (userFolders.length > 0) {
      const grouped = await db.document.groupBy({
        by: ['folderId'],
        where: {
          ...unreadWhere,
          folderId: { in: userFolders.map((f) => f.id) },
        },
        _count: { id: true },
      })
      for (const row of grouped) {
        if (row.folderId) folderCounts[row.folderId] = row._count.id
      }
    }

    // Inbox unread: accessible docs NOT in any of the user's personal folders
    let inboxUnread = 0
    if (inboxFolder) {
      const inboxFilter: Prisma.DocumentWhereInput =
        personalFolderIds.length > 0
          ? {
              AND: [
                unreadWhere,
                { OR: [{ folderId: null }, { folderId: { notIn: personalFolderIds } }] },
              ],
            }
          : unreadWhere

      inboxUnread = await db.document.count({ where: inboxFilter })
      // Don't double-count the inbox folder itself in folderCounts
      delete folderCounts[inboxFolder.id]
    }

    return NextResponse.json({ counts: folderCounts, inboxUnread })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
