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
    const { title, description, type, status, priority, assignedToId, dueDate } = body

    const existingTask = await db.task.findUnique({ where: { id } })
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description

    const validTypes = ['APPROVAL', 'REVIEW', 'NOTIFICATION']
    if (type !== undefined) {
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: 'Invalid type. Must be APPROVAL, REVIEW, or NOTIFICATION' },
          { status: 400 }
        )
      }
      updateData.type = type
    }

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    if (status !== undefined) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be PENDING, IN_PROGRESS, COMPLETED, or CANCELLED' },
          { status: 400 }
        )
      }
      updateData.status = status
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date()
      }
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    if (priority !== undefined) {
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: 'Invalid priority. Must be LOW, MEDIUM, HIGH, or CRITICAL' },
          { status: 400 }
        )
      }
      updateData.priority = priority
    }

    if (assignedToId !== undefined) {
      const assignee = await db.user.findUnique({ where: { id: assignedToId } })
      if (!assignee) {
        return NextResponse.json({ error: 'Assignee not found' }, { status: 404 })
      }
      updateData.assignedToId = assignedToId
    }

    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null
    }

    const updatedTask = await db.task.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        document: {
          select: { id: true, title: true, status: true },
        },
      },
    })

    return NextResponse.json({ task: updatedTask })
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

    const existingTask = await db.task.findUnique({ where: { id } })
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await db.task.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
