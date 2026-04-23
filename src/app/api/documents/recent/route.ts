import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractToken, getAuthUser } from '@/lib/auth'
import { isPrivilegedRole } from '@/lib/doc-permissions'

/**
 * POST /api/documents/recent — Record a document view
 * Creates an ActivityLog entry with action 'VIEW_DOCUMENT'
 */
export async function POST(request: Request) {
  const token = extractToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
  }

  const user = await getAuthUser(token)
  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json({ error: 'Не указан ID документа' }, { status: 400 })
    }

    // Verify the document exists
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    // Create activity log entry for the view
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: 'VIEW_DOCUMENT',
        entityType: 'Document',
        entityId: documentId,
        details: document.title,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to record document view:', error)
    return NextResponse.json({ error: 'Ошибка записи просмотра' }, { status: 500 })
  }
}

/**
 * GET /api/documents/recent — Fetch recently viewed documents
 * Returns last 10 unique documents the user has viewed, ordered by most recent
 */
export async function GET(request: Request) {
  const token = extractToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
  }

  const user = await getAuthUser(token)
  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
  }

  try {
    // Find all VIEW_DOCUMENT activity logs for the user,
    // ordered by most recent first
    const viewLogs = await db.activityLog.findMany({
      where: {
        userId: user.id,
        action: 'VIEW_DOCUMENT',
        entityType: 'Document',
        entityId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // Fetch more to allow for deduplication
    })

    // Deduplicate by entityId, keeping the most recent (first) entry
    const seen = new Set<string>()
    const uniqueLogs: typeof viewLogs = []
    for (const log of viewLogs) {
      if (log.entityId && !seen.has(log.entityId)) {
        seen.add(log.entityId)
        uniqueLogs.push(log)
      }
      if (uniqueLogs.length >= 10) break
    }

    if (uniqueLogs.length === 0) {
      return NextResponse.json([])
    }

    // Fetch the actual documents with type info (filter by permission for non-admins)
    const permissionFilter = !isPrivilegedRole(user.role)
      ? {
          OR: [
            { createdById: user.id },
            { permissions: { some: { userId: user.id } } },
          ],
        }
      : {}
    const documents = await db.document.findMany({
      where: {
        id: { in: uniqueLogs.map((log) => log.entityId!) },
        ...permissionFilter,
      },
      include: {
        type: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
    })

    // Build a map for quick lookup and merge with view timestamps
    const docMap = new Map(documents.map((doc) => [doc.id, doc]))

    const result = uniqueLogs
      .filter((log) => log.entityId && docMap.has(log.entityId))
      .map((log) => ({
        id: docMap.get(log.entityId!)!.id,
        title: docMap.get(log.entityId!)!.title,
        status: docMap.get(log.entityId!)!.status,
        typeId: docMap.get(log.entityId!)!.typeId,
        type: docMap.get(log.entityId!)!.type,
        viewedAt: log.createdAt.toISOString(),
      }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch recent documents:', error)
    return NextResponse.json({ error: 'Ошибка загрузки недавних документов' }, { status: 500 })
  }
}
