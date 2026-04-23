import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.toLowerCase() ?? ''
    const departmentId = searchParams.get('departmentId')

    const users = await db.user.findMany({
      where: {
        active: true,
        id: { not: user.id },
        ...(departmentId ? { departmentId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, role: true, isDepartmentHead: true, departmentId: true },
      orderBy: { name: 'asc' },
      take: 50,
    })

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
