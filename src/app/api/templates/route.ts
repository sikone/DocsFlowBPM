import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractToken, getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await db.documentTemplate.findMany({
      include: {
        type: {
          select: {
            id: true,
            name: true,
            systemName: true,
            icon: true,
            color: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, typeId, data, icon, color } = body

    if (!name || !typeId) {
      return NextResponse.json(
        { error: 'Name and typeId are required' },
        { status: 400 }
      )
    }

    // Verify the document type exists
    const docType = await db.documentType.findUnique({
      where: { id: typeId },
    })
    if (!docType) {
      return NextResponse.json(
        { error: 'Document type not found' },
        { status: 404 }
      )
    }

    const template = await db.documentTemplate.create({
      data: {
        name,
        description: description || null,
        typeId,
        data: typeof data === 'string' ? data : JSON.stringify(data || {}),
        icon: icon || 'file-text',
        color: color || '#6b7280',
        createdById: user.id,
      },
      include: {
        type: {
          select: {
            id: true,
            name: true,
            systemName: true,
            icon: true,
            color: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
