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

    const url = new URL(request.url)
    const folderId = url.searchParams.get('folderId')
    const typeId = url.searchParams.get('typeId')
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')

    // Build where clause
    const where: Prisma.DocumentWhereInput = {}

    if (folderId) {
      where.folderId = folderId
    }

    if (typeId) {
      where.typeId = typeId
    }

    if (status) {
      const validStatuses = ['DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED']
      if (validStatuses.includes(status)) {
        where.status = status
      }
    }

    if (search) {
      where.title = { contains: search }
    }

    const documents = await db.document.findMany({
      where,
      include: {
        type: true,
        folder: {
          select: { id: true, name: true, color: true, icon: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ documents })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const { title, typeId, folderId, data } = body

    if (!title || !typeId) {
      return NextResponse.json(
        { error: 'Title and typeId are required' },
        { status: 400 }
      )
    }

    // Validate document type exists
    const docType = await db.documentType.findUnique({ where: { id: typeId } })
    if (!docType) {
      return NextResponse.json(
        { error: 'Document type not found' },
        { status: 404 }
      )
    }

    // Validate folder if provided
    if (folderId) {
      const folder = await db.folder.findUnique({ where: { id: folderId } })
      if (!folder) {
        return NextResponse.json(
          { error: 'Folder not found' },
          { status: 404 }
        )
      }
    }

    // Generate document number: TYPE-YYYY-NNN
    const year = new Date().getFullYear()
    const prefix = docType.systemName.toUpperCase()
    const numberPattern = `${prefix}-${year}-`

    // Find the next number
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

    // Validate and stringify data
    let dataString = '{}'
    if (data !== undefined) {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        dataString = JSON.stringify(parsed)
      } catch {
        return NextResponse.json(
          { error: 'Data must be valid JSON' },
          { status: 400 }
        )
      }
    }

    const document = await db.document.create({
      data: {
        title,
        number: docNumber,
        typeId,
        folderId: folderId || null,
        status: 'DRAFT',
        data: dataString,
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

    return NextResponse.json({ document }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
