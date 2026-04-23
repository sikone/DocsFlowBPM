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

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const processes = await db.processDefinition.findMany({
      orderBy: { createdAt: 'desc' },
      select: processSelect,
    })

    // Flatten documentTypes for convenience
    const result = processes.map((p) => ({
      ...p,
      documentTypes: p.documentTypes.map((pdt) => pdt.documentType),
    }))

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const body = await request.json()
    const { name, description, systemName, status, steps, documentTypeIds } = body

    if (!name || !systemName)
      return NextResponse.json({ error: 'Name and system name are required' }, { status: 400 })

    const validStatuses = ['ACTIVE', 'DRAFT', 'ARCHIVED']
    if (status && !validStatuses.includes(status))
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    const existing = await db.processDefinition.findUnique({ where: { systemName } })
    if (existing)
      return NextResponse.json({ error: 'Process with this system name already exists' }, { status: 409 })

    const typeIds: string[] = Array.isArray(documentTypeIds) ? documentTypeIds : []

    const newProcess = await db.processDefinition.create({
      data: {
        name,
        description: description || null,
        systemName,
        status: status || 'ACTIVE',
        steps: steps ? JSON.stringify(steps) : '[]',
        documentTypes: typeIds.length
          ? { create: typeIds.map((id) => ({ documentTypeId: id })) }
          : undefined,
      },
      select: processSelect,
    })

    return NextResponse.json({
      process: { ...newProcess, documentTypes: newProcess.documentTypes.map((pdt) => pdt.documentType) },
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
