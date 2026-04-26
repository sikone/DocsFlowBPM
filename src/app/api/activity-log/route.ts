import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

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

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const entityType = url.searchParams.get('entityType')
    const entityId = url.searchParams.get('entityId')
    const userId = url.searchParams.get('userId')
    const action = url.searchParams.get('action')
    const excludeAction = url.searchParams.get('excludeAction')
    const search = url.searchParams.get('search')?.trim()
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    const conditions: Record<string, unknown>[] = []

    if (entityType) {
      conditions.push({ entityType: { equals: entityType, mode: 'insensitive' } })
    }
    if (entityId) {
      conditions.push({ entityId })
    }
    if (userId) {
      conditions.push({ userId })
    }
    if (action) {
      const actions = action.split(',').map((a) => a.trim()).filter(Boolean)
      conditions.push({ action: actions.length === 1 ? actions[0] : { in: actions } })
    }
    if (excludeAction) {
      const excluded = excludeAction.split(',').map((a) => a.trim()).filter(Boolean)
      conditions.push({ action: { notIn: excluded } })
    }
    if (search) {
      conditions.push({
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { details: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        dateFilter.lte = to
      }
      conditions.push({ createdAt: dateFilter })
    }

    const where = conditions.length > 0 ? { AND: conditions } : {}

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.activityLog.count({ where }),
    ])

    return NextResponse.json({ logs, total })
  } catch (err) {
    console.error('Activity log API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
