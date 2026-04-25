import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'

export async function POST(
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

    // Find the original document
    const originalDoc = await db.document.findUnique({
      where: { id },
      include: {
        type: true,
      },
    })

    if (!originalDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Generate a new document number
    const year = new Date().getFullYear()
    const prefix = originalDoc.type.systemName.toUpperCase()
    const numberPattern = `${prefix}-${year}-`

    const lastDoc = await db.document.findFirst({
      where: {
        number: { startsWith: numberPattern },
      },
      orderBy: { number: 'desc' },
    })

    let nextNum = 1
    if (lastDoc?.number) {
      const parts = lastDoc.number.split('-')
      const lastNum = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1
      }
    }

    const docNumber = `${numberPattern}${String(nextNum).padStart(3, '0')}`

    // Create the duplicate document
    const newDocument = await db.document.create({
      data: {
        title: `Копия — ${originalDoc.title}`,
        number: docNumber,
        typeId: originalDoc.typeId,
        folderId: originalDoc.folderId,
        status: 'DRAFT',
        data: originalDoc.data,
        createdById: user.id,
      },
      include: {
        type: true,
        folder: {
          select: { id: true, name: true, color: true, icon: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Log the duplication
    logActivity({
      userId: user.id,
      action: 'CREATE_DOCUMENT',
      entityType: 'DOCUMENT',
      entityId: newDocument.id,
      details: `Документ скопирован из «${originalDoc.title}»: ${newDocument.title} (${docNumber})`,
    })

    return NextResponse.json({ document: newDocument }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
