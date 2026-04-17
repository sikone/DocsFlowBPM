import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

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
    const { name, color, icon, parentId, order } = body

    // Check folder exists
    const existingFolder = await db.folder.findUnique({ where: { id } })
    if (!existingFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Prevent circular reference - can't set parent to self
    if (parentId && parentId === id) {
      return NextResponse.json(
        { error: 'Cannot set folder as its own parent' },
        { status: 400 }
      )
    }

    // Validate parentId if provided
    if (parentId) {
      const parentFolder = await db.folder.findUnique({ where: { id: parentId } })
      if (!parentFolder) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (parentId !== undefined) updateData.parentId = parentId
    if (order !== undefined) updateData.order = order

    const updatedFolder = await db.folder.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ folder: updatedFolder })
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

    // Check folder exists
    const existingFolder = await db.folder.findUnique({
      where: { id },
      include: {
        children: true,
        documents: true,
      },
    })

    if (!existingFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Check if folder has children
    if (existingFolder.children.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete folder with subfolders. Move or delete subfolders first.' },
        { status: 400 }
      )
    }

    // Check if folder has documents
    if (existingFolder.documents.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete folder with documents. Move or delete documents first.' },
        { status: 400 }
      )
    }

    await db.folder.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
