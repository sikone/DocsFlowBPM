import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId } = await params
    const permissions = await db.documentPermission.findMany({
      where: { documentId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        grantedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ permissions })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId } = await params
    const { userId, permission } = await request.json()

    if (!userId || !permission || !['VIEW', 'EDIT'].includes(permission)) {
      return NextResponse.json({ error: 'userId and permission (VIEW|EDIT) are required' }, { status: 400 })
    }

    const doc = await db.document.findUnique({ where: { id: documentId } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const result = await db.documentPermission.upsert({
      where: { documentId_userId: { documentId, userId } },
      update: { permission, grantedById: user.id },
      create: { documentId, userId, permission, grantedById: user.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        grantedBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ permission: result }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
