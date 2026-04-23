import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const url = new URL(request.url)
    const requestedUserId = url.searchParams.get('userId')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const stepStatusParam = url.searchParams.get('stepStatus')

    const canPickAny = user.role === 'ADMIN' || user.role === 'DIRECTOR'
    const isDeptHead = user.isDepartmentHead && !!user.departmentId

    let targetUserId = user.id
    if (requestedUserId && requestedUserId !== user.id) {
      if (!canPickAny && !isDeptHead) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
      if (isDeptHead && !canPickAny) {
        const target = await db.user.findUnique({
          where: { id: requestedUserId },
          select: { departmentId: true },
        })
        if (!target || target.departmentId !== user.departmentId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }
      }
      targetUserId = requestedUserId
    } else if (canPickAny || isDeptHead) {
      targetUserId = requestedUserId || user.id
    }

    const decidedAtFilter: Record<string, any> = { not: null }
    if (dateFrom) decidedAtFilter.gte = new Date(dateFrom)
    if (dateTo) decidedAtFilter.lte = new Date(dateTo + 'T23:59:59.999Z')

    const VALID_STEP_STATUSES = ['APPROVED', 'APPROVED_WITH_CHANGES', 'REJECTED']
    const statusIn = stepStatusParam && VALID_STEP_STATUSES.includes(stepStatusParam)
      ? [stepStatusParam]
      : VALID_STEP_STATUSES

    const steps = await db.documentApprovalStep.findMany({
      where: {
        userId: targetUserId,
        stepType: 'APPROVAL',
        status: { in: statusIn } as any,
        decidedAt: decidedAtFilter,
      },
      select: {
        id: true,
        name: true,
        status: true,
        dueAt: true,
        decidedAt: true,
        createdAt: true,
        approval: {
          select: {
            document: { select: { id: true, title: true, number: true } },
          },
        },
      },
      orderBy: { decidedAt: 'desc' },
    })

    let onTime = 0
    let late = 0
    let noSla = 0
    let totalMs = 0

    for (const step of steps) {
      if (!step.dueAt) {
        noSla++
      } else if (step.decidedAt && new Date(step.decidedAt) <= new Date(step.dueAt)) {
        onTime++
      } else {
        late++
      }
      if (step.decidedAt) {
        totalMs += new Date(step.decidedAt).getTime() - new Date(step.createdAt).getTime()
      }
    }

    const total = steps.length
    const avgMs = total > 0 ? Math.round(totalMs / total) : 0

    return NextResponse.json({ total, onTime, late, noSla, avgMs, steps })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
