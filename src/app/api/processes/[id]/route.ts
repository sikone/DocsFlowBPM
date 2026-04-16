import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'

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
    const { name, description, systemName, status, version, steps } = body

    const existingProcess = await db.processDefinition.findUnique({
      where: { id },
    })
    if (!existingProcess) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 })
    }

    if (systemName && systemName !== existingProcess.systemName) {
      const duplicate = await db.processDefinition.findUnique({
        where: { systemName },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Process with this system name already exists' },
          { status: 409 }
        )
      }
    }

    const validStatuses = ['ACTIVE', 'DRAFT', 'ARCHIVED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be ACTIVE, DRAFT, or ARCHIVED' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (systemName !== undefined) updateData.systemName = systemName
    if (status !== undefined) updateData.status = status
    if (version !== undefined) updateData.version = version
    if (steps !== undefined) updateData.steps = JSON.stringify(steps)

    const updatedProcess = await db.processDefinition.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ process: updatedProcess })
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

    const existingProcess = await db.processDefinition.findUnique({
      where: { id },
    })
    if (!existingProcess) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 })
    }

    await db.processDefinition.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
