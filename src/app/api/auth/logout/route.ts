import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cacheDel, SESSION_CACHE_PREFIX } from '@/lib/redis'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    await db.session.deleteMany({ where: { token } })
    cacheDel(`${SESSION_CACHE_PREFIX}${token}`)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
