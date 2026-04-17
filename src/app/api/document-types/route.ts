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

    const types = await db.documentType.findMany({
      where: { active: true },
      include: {
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ types })
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

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, systemName, description, icon, color, formSchema } = body

    if (!name || !systemName) {
      return NextResponse.json(
        { error: 'Name and systemName are required' },
        { status: 400 }
      )
    }

    // Check if systemName already exists
    const existingType = await db.documentType.findUnique({
      where: { systemName },
    })
    if (existingType) {
      return NextResponse.json(
        { error: 'Document type with this system name already exists' },
        { status: 409 }
      )
    }

    // Validate formSchema is valid JSON array if provided
    let schemaString = '[]'
    if (formSchema !== undefined) {
      try {
        const parsed = typeof formSchema === 'string' ? JSON.parse(formSchema) : formSchema
        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { error: 'formSchema must be a JSON array' },
            { status: 400 }
          )
        }
        schemaString = JSON.stringify(parsed)
      } catch {
        return NextResponse.json(
          { error: 'formSchema must be valid JSON' },
          { status: 400 }
        )
      }
    }

    const docType = await db.documentType.create({
      data: {
        name,
        systemName,
        description: description || null,
        icon: icon || 'file-text',
        color: color || '#6366f1',
        formSchema: schemaString,
      },
    })

    return NextResponse.json({ type: docType }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
