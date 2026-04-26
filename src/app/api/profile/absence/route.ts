import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

const select = {
  id: true,
  isAbsent: true,
  substituteId: true,
  substitute: { select: { id: true, name: true } },
  absentUntil: true,
} as const

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const auth = await getAuthUser(token)
    if (!auth) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const user = await db.user.findUnique({ where: { id: auth.id }, select })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ absence: user })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const auth = await getAuthUser(token)
    if (!auth) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const body = await request.json()
    const { isAbsent, substituteId, absentUntil } = body

    const data: Record<string, unknown> = {}
    if (isAbsent !== undefined) data.isAbsent = isAbsent
    if (substituteId !== undefined) data.substituteId = substituteId || null
    if (absentUntil !== undefined) data.absentUntil = absentUntil ? new Date(absentUntil) : null

    // When turning absence off, clear the expiry date too
    if (isAbsent === false) data.absentUntil = null

    const updated = await db.user.update({
      where: { id: auth.id },
      data,
      select,
    })

    return NextResponse.json({ absence: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
