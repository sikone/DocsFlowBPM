import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'

const processSelect = {
  id: true,
  name: true,
  description: true,
  systemName: true,
  version: true,
  status: true,
  steps: true,
  createdAt: true,
  updatedAt: true,
  documentTypes: {
    select: {
      documentType: { select: { id: true, name: true, systemName: true } },
    },
  },
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const { name, description, systemName, status, version, steps, documentTypeIds } = body

    const existing = await db.processDefinition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Process not found' }, { status: 404 })

    if (systemName && systemName !== existing.systemName) {
      const duplicate = await db.processDefinition.findUnique({ where: { systemName } })
      if (duplicate)
        return NextResponse.json({ error: 'Process with this system name already exists' }, { status: 409 })
    }

    const validStatuses = ['ACTIVE', 'DRAFT', 'ARCHIVED']
    if (status && !validStatuses.includes(status))
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (systemName !== undefined) updateData.systemName = systemName
    if (status !== undefined) updateData.status = status
    if (version !== undefined) updateData.version = version
    if (steps !== undefined) updateData.steps = JSON.stringify(steps)

    // Sync document types if provided
    if (Array.isArray(documentTypeIds)) {
      await db.processDocumentType.deleteMany({ where: { processId: id } })
      if (documentTypeIds.length > 0) {
        await db.processDocumentType.createMany({
          data: documentTypeIds.map((typeId: string) => ({ processId: id, documentTypeId: typeId })),
        })
      }
    }

    const updated = await db.processDefinition.update({
      where: { id },
      data: updateData,
      select: processSelect,
    })

    return NextResponse.json({
      process: { ...updated, documentTypes: updated.documentTypes.map((pdt) => pdt.documentType) },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const { id } = await params

    const existing = await db.processDefinition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Process not found' }, { status: 404 })

    await db.processDefinition.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
