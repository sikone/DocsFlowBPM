import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractToken, getAuthUser } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, typeId, data, icon, color } = body

    const existing = await db.documentTemplate.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // If typeId is being changed, verify the new document type exists
    if (typeId && typeId !== existing.typeId) {
      const docType = await db.documentType.findUnique({
        where: { id: typeId },
      })
      if (!docType) {
        return NextResponse.json(
          { error: 'Document type not found' },
          { status: 404 }
        )
      }
    }

    const template = await db.documentTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(typeId !== undefined && { typeId }),
        ...(data !== undefined && {
          data: typeof data === 'string' ? data : JSON.stringify(data),
        }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
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

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await db.documentTemplate.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    await db.documentTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
