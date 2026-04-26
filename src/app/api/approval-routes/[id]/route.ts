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
    const { name, description, steps } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const existing = await db.approvalRoute.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Replace steps: delete all, recreate
    await db.approvalRouteStep.deleteMany({ where: { routeId: id } })

    const route = await db.approvalRoute.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        steps: {
          create: (steps as any[]).map((s, i) => ({
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

    return NextResponse.json({ route })
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

    const existing = await db.approvalRoute.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.approvalRoute.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
