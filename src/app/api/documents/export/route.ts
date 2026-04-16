import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { Prisma } from '@prisma/client'

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
    const { ids, format } = body

    if (!format || !['json', 'csv'].includes(format)) {
      return NextResponse.json({ error: 'Format must be "json" or "csv"' }, { status: 400 })
    }

    // Build where clause
    const where: Prisma.DocumentWhereInput = {}
    if (ids && Array.isArray(ids) && ids.length > 0) {
      where.id = { in: ids }
    }

    const documents = await db.document.findMany({
      where,
      include: {
        type: { select: { id: true, name: true, systemName: true } },
        folder: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (format === 'csv') {
      // Generate CSV
      const statusLabels: Record<string, string> = {
        DRAFT: 'Черновик',
        IN_PROGRESS: 'В работе',
        APPROVED: 'Утверждён',
        REJECTED: 'Отклонён',
        COMPLETED: 'Завершён',
      }

      const headers = [
        'Название',
        'Номер',
        'Тип документа',
        'Статус',
        'Автор',
        'Папка',
        'Дата создания',
        'Дата обновления',
      ]

      const rows = documents.map((doc) => [
        `"${(doc.title || '').replace(/"/g, '""')}"`,
        doc.number || '',
        doc.type?.name || '',
        statusLabels[doc.status] || doc.status,
        doc.creator?.name || '',
        doc.folder?.name || '',
        doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('ru-RU') : '',
        doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('ru-RU') : '',
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n')

      // Return with BOM for Excel compatibility
      return new NextResponse('\uFEFF' + csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="documents_export_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    // JSON format
    const exportData = documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      number: doc.number,
      type: doc.type?.name || null,
      typeName: doc.type?.systemName || null,
      status: doc.status,
      folderId: doc.folderId || null,
      folderName: doc.folder?.name || null,
      creatorId: doc.createdById,
      creatorName: doc.creator?.name || null,
      creatorEmail: doc.creator?.email || null,
      data: doc.data,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }))

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="documents_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
