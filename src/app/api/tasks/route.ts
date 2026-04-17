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

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const assignedToId = url.searchParams.get('assignedToId')
    const documentId = url.searchParams.get('documentId')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (assignedToId) where.assignedToId = assignedToId
    if (documentId) where.documentId = documentId

    const tasks = await db.task.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ tasks })
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
    const { title, description, type, priority, documentId, assignedToId, dueDate } = body

    if (!title || !assignedToId) {
      return NextResponse.json(
        { error: 'Title and assignee are required' },
        { status: 400 }
      )
    }

    const validTypes = ['APPROVAL', 'REVIEW', 'NOTIFICATION']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be APPROVAL, REVIEW, or NOTIFICATION' },
        { status: 400 }
      )
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be LOW, MEDIUM, HIGH, or CRITICAL' },
        { status: 400 }
      )
    }

    // Verify assignee exists
    const assignee = await db.user.findUnique({ where: { id: assignedToId } })
    if (!assignee) {
      return NextResponse.json({ error: 'Assignee not found' }, { status: 404 })
    }

    const newTask = await db.task.create({
      data: {
        title,
        description: description || null,
        type: type || 'APPROVAL',
        priority: priority || 'MEDIUM',
        documentId: documentId || null,
        assignedToId,
        createdById: user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
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

    return NextResponse.json({ task: newTask }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
