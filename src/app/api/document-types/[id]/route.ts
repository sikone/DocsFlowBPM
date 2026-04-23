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
    const docType = await db.documentType.findUnique({ where: { id } })

    if (!docType) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 })
    }

    return NextResponse.json({ type: docType })
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

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, systemName, description, icon, color, active, formSchema } = body

    // Check type exists
    const existingType = await db.documentType.findUnique({ where: { id } })
    if (!existingType) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 })
    }

    // Check systemName uniqueness if being updated
    if (systemName && systemName !== existingType.systemName) {
      const duplicateType = await db.documentType.findUnique({
        where: { systemName },
      })
      if (duplicateType) {
        return NextResponse.json(
          { error: 'Document type with this system name already exists' },
          { status: 409 }
        )
      }
    }

    // Validate formSchema if provided
    let schemaString: string | undefined
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

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (systemName !== undefined) updateData.systemName = systemName
    if (description !== undefined) updateData.description = description
    if (icon !== undefined) updateData.icon = icon
    if (color !== undefined) updateData.color = color
    if (active !== undefined) updateData.active = active
    if (schemaString !== undefined) updateData.formSchema = schemaString

    const updatedType = await db.documentType.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ type: updatedType })
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

    // Check type exists
    const existingType = await db.documentType.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    })

    if (!existingType) {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 })
    }

    // Check if any documents use this type
    if (existingType._count.documents > 0) {
      return NextResponse.json(
        { error: `Cannot delete document type: ${existingType._count.documents} document(s) use this type` },
        { status: 400 }
      )
    }

    await db.documentType.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
