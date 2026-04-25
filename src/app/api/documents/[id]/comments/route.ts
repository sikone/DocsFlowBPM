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
    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      )
    }

    if (content.trim().length > 5000) {
      return NextResponse.json(
        { error: 'Comment content is too long (max 5000 characters)' },
        { status: 400 }
      )
    }

    // Check document exists
    const document = await db.document.findUnique({ where: { id } })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        documentId: id,
        userId: user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    logActivity({
      userId: user.id,
      action: 'COMMENT_DOCUMENT',
      entityType: 'DOCUMENT',
      entityId: id,
      details: `Комментарий к документу: ${document.title}`,
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    // Check document exists
    const document = await db.document.findUnique({ where: { id } })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const comments = await db.comment.findMany({
      where: { documentId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ comments })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
