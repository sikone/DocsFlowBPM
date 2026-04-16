import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

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

    const { id: documentId } = await params
    const body = await request.json()
    const { tagId } = body

    if (!tagId) {
      return NextResponse.json({ error: 'tagId is required' }, { status: 400 })
    }

    // Check document exists
    const document = await db.document.findUnique({ where: { id: documentId } })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check tag exists
    const tag = await db.documentTag.findUnique({ where: { id: tagId } })
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Check if already linked
    const existingLink = await db.documentTagLink.findUnique({
      where: {
        documentId_tagId: {
          documentId,
          tagId,
        },
      },
    })

    if (existingLink) {
      return NextResponse.json({ error: 'Document already has this tag' }, { status: 409 })
    }

    const link = await db.documentTagLink.create({
      data: {
        documentId,
        tagId,
      },
      include: {
        tag: true,
      },
    })

    return NextResponse.json({ link }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
