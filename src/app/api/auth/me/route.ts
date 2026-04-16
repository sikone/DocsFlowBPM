import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, extractToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 401 }
      )
    }

    const user = await getAuthUser(token)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
