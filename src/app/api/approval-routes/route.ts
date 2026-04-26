import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'

const stepSelect = {
  id: true,
  routeId: true,
  order: true,
  name: true,
  userId: true,
  user: { select: { id: true, name: true } },
  departmentId: true,
  department: { select: { id: true, name: true } },
  slaConfig: true,
  sendEmail: true,
}

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const routes = await db.approvalRoute.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        steps: { select: stepSelect, orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json({ routes })
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
    const { name, description, steps } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!Array.isArray(steps) || steps.length === 0)
      return NextResponse.json({ error: 'At least one step is required' }, { status: 400 })

    const route = await db.approvalRoute.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        steps: {
          create: steps.map((s: any, i: number) => ({
            order: i,
            name: s.name?.trim() || `Шаг ${i + 1}`,
            userId: s.userId || null,
            departmentId: s.departmentId || null,
            slaConfig: s.slaConfig || null,
            sendEmail: s.sendEmail ?? true,
          })),
        },
      },
      include: {
        steps: { select: stepSelect, orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json({ route }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
