import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
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

    // ── Total documents ─────────────────────────────────────────────────
    const totalDocuments = await db.document.count()

    // ── By status ───────────────────────────────────────────────────────
    const statusRaw = await db.document.groupBy({
      by: ['status'],
      _count: { status: true },
    })
    const byStatus: Record<string, number> = {
      DRAFT: 0,
      IN_PROGRESS: 0,
      APPROVED: 0,
      REJECTED: 0,
      COMPLETED: 0,
    }
    for (const row of statusRaw) {
      if (row.status in byStatus) {
        byStatus[row.status] = row._count.status
      }
    }

    // ── By type ─────────────────────────────────────────────────────────
    const byTypeRaw = await db.document.groupBy({
      by: ['typeId'],
      _count: { typeId: true },
    })

    const typeIds = byTypeRaw.map((r) => r.typeId)
    const docTypes = typeIds.length > 0
      ? await db.documentType.findMany({
          where: { id: { in: typeIds } },
          select: { id: true, name: true },
        })
      : []

    const typeNameMap = new Map(docTypes.map((t) => [t.id, t.name]))
    const byType = byTypeRaw
      .map((r) => ({
        name: typeNameMap.get(r.typeId) || 'Неизвестный',
        count: r._count.typeId,
      }))
      .sort((a, b) => b.count - a.count)

    // ── Recent documents (created in last 24 hours) ────────────────────
    const oneDayAgo = new Date()
    oneDayAgo.setHours(oneDayAgo.getHours() - 24)
    const recentDocuments = await db.document.count({
      where: { createdAt: { gte: oneDayAgo } },
    })

    // ── Documents this week ─────────────────────────────────────────────
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const documentsThisWeek = await db.document.count({
      where: { createdAt: { gte: startOfWeek } },
    })

    // ── Documents this month ────────────────────────────────────────────
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const documentsThisMonth = await db.document.count({
      where: { createdAt: { gte: startOfMonth } },
    })

    // ── Top creators ────────────────────────────────────────────────────
    const topCreatorsRaw = await db.document.groupBy({
      by: ['createdById'],
      _count: { createdById: true },
      orderBy: { _count: { createdById: 'desc' } },
      take: 5,
    })

    const creatorIds = topCreatorsRaw.map((r) => r.createdById)
    const creatorUsers = creatorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true },
        })
      : []

    const creatorNameMap = new Map(creatorUsers.map((u) => [u.id, u.name]))
    const topCreators = topCreatorsRaw.map((r) => ({
      name: creatorNameMap.get(r.createdById) || 'Неизвестный',
      count: r._count.createdById,
    }))

    // ── Documents over time (last 7 days) ──────────────────────────────
    const docsOverTime = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(now.getDate() - i)
      day.setHours(0, 0, 0, 0)
      const nextDay = new Date(day)
      nextDay.setDate(day.getDate() + 1)

      const count = await db.document.count({
        where: {
          createdAt: { gte: day, lt: nextDay },
        },
      })

      const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
      docsOverTime.push({
        day: days[day.getDay()],
        date: `${day.getDate()}.${String(day.getMonth() + 1).padStart(2, '0')}`,
        count,
      })
    }

    // ── Most active folder ─────────────────────────────────────────────
    const folderDocCounts = await db.document.groupBy({
      by: ['folderId'],
      where: { folderId: { not: null } },
      _count: { folderId: true },
      orderBy: { _count: { folderId: 'desc' } },
      take: 1,
    })

    let mostActiveFolder: { id: string; name: string; count: number } | null = null
    if (folderDocCounts.length > 0 && folderDocCounts[0].folderId) {
      const folder = await db.folder.findUnique({
        where: { id: folderDocCounts[0].folderId },
        select: { id: true, name: true },
      })
      if (folder) {
        mostActiveFolder = {
          id: folder.id,
          name: folder.name,
          count: folderDocCounts[0]._count.folderId,
        }
      }
    }

    return NextResponse.json({
      totalDocuments,
      byStatus,
      byType,
      recentDocuments,
      documentsThisWeek,
      documentsThisMonth,
      topCreators,
      docsOverTime,
      mostActiveFolder,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
