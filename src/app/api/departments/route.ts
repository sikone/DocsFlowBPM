import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'

const DEFAULT_DEPARTMENTS = [
  { name: 'Sales', order: 0 },
  { name: 'Бухгалтерия', order: 1 },
  { name: 'Юридический', order: 2 },
  { name: 'Backoffice', order: 3 },
  { name: 'ИТ', order: 4 },
  { name: 'HR', order: 5 },
]

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

    const usersSelect = {
      select: { id: true, name: true, email: true, role: true, isDepartmentHead: true, avatar: true },
      orderBy: [{ isDepartmentHead: 'desc' as const }, { name: 'asc' as const }],
    }

    let departments = await db.department.findMany({
      include: { users: usersSelect },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })

    // Seed default departments if none exist
    if (departments.length === 0) {
      await db.department.createMany({ data: DEFAULT_DEPARTMENTS })
      departments = await db.department.findMany({
        include: { users: usersSelect },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      })
    }

    return NextResponse.json({ departments })
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
    const { name } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const maxOrder = await db.department.aggregate({ _max: { order: true } })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const department = await db.department.create({
      data: { name: name.trim(), order: nextOrder },
    })

    return NextResponse.json({ department }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
