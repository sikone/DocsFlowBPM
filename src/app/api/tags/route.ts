import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'

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

    const tags = await db.documentTag.findMany({
      include: {
        _count: { select: { documents: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Tags GET error:', error)
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

    if (!isAdmin(user) && user.role !== 'ADVANCED') {
      return NextResponse.json({ error: 'Admin or Advanced access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Check if tag with this name already exists
    const existingTag = await db.documentTag.findFirst({
      where: { name },
    })

    if (existingTag) {
      return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 })
    }

    const tag = await db.documentTag.create({
      data: {
        name,
        color: color || '#6b7280',
        createdById: user.id,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ tag }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
