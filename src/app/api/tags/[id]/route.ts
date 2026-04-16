import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'

export async function GET(
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

    const tag = await db.documentTag.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        documents: {
          include: {
            document: {
              include: {
                type: true,
                creator: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    return NextResponse.json({ tag })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    if (!isAdmin(user) && user.role !== 'ADVANCED') {
      return NextResponse.json({ error: 'Admin or Advanced access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, color } = body

    // Check tag exists
    const existingTag = await db.documentTag.findUnique({ where: { id } })
    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // If renaming, check uniqueness
    if (name && name !== existingTag.name) {
      const duplicate = await db.documentTag.findFirst({ where: { name } })
      if (duplicate) {
        return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (color !== undefined) updateData.color = color

    const updatedTag = await db.documentTag.update({
      where: { id },
      data: updateData,
      include: {
        creator: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ tag: updatedTag })
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

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    // Check tag exists
    const existingTag = await db.documentTag.findUnique({ where: { id } })
    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    await db.documentTag.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
