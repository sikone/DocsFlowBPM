import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const rows = await db.systemSettings.findMany()
    const settings: Record<string, string> = {}
    for (const row of rows) settings[row.key] = row.value

    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const body: Record<string, string> = await request.json()

    for (const [key, value] of Object.entries(body)) {
      await db.systemSettings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    const rows = await db.systemSettings.findMany()
    const settings: Record<string, string> = {}
    for (const row of rows) settings[row.key] = row.value

    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
