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

    const processes = await db.processDefinition.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ processes })
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
    const { name, description, systemName, status, steps } = body

    if (!name || !systemName) {
      return NextResponse.json(
        { error: 'Name and system name are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['ACTIVE', 'DRAFT', 'ARCHIVED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be ACTIVE, DRAFT, or ARCHIVED' },
        { status: 400 }
      )
    }

    const existingProcess = await db.processDefinition.findUnique({
      where: { systemName },
    })
    if (existingProcess) {
      return NextResponse.json(
        { error: 'Process with this system name already exists' },
        { status: 409 }
      )
    }

    const newProcess = await db.processDefinition.create({
      data: {
        name,
        description: description || null,
        systemName,
        status: status || 'ACTIVE',
        steps: steps ? JSON.stringify(steps) : '[]',
      },
    })

    return NextResponse.json({ process: newProcess }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
