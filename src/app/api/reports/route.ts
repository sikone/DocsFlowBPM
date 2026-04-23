import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { isPrivilegedRole } from '@/lib/doc-permissions'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const url = new URL(request.url)
    const statuses = url.searchParams.getAll('status')
    const urgencies = url.searchParams.getAll('urgency')
    const typeId = url.searchParams.get('typeId')
    const approvalStatus = url.searchParams.get('approvalStatus') // none | in_progress | approved | rejected
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const createdById = url.searchParams.get('createdById')

    const where: Record<string, any> = {}

    if (!isPrivilegedRole(user.role)) {
      where.OR = [
        { createdById: user.id },
        { permissions: { some: { userId: user.id } } },
      ]
    }

    if (statuses.length > 0) {
      where.status = { in: statuses as any }
    }

    if (urgencies.length > 0) {
      where.urgency = { in: urgencies as any }
    }

    if (typeId) where.typeId = typeId
    if (createdById) where.createdById = createdById

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59.999Z') } : {}),
      }
    }

    if (approvalStatus === 'none') {
      where.approvals = { none: {} }
    } else if (approvalStatus === 'in_progress') {
      where.approvals = { some: { status: 'IN_PROGRESS' } }
    } else if (approvalStatus === 'approved') {
      where.approvals = { some: { status: 'APPROVED' } }
    } else if (approvalStatus === 'rejected') {
      where.approvals = { some: { status: 'REJECTED' } }
    }

    const documents = await db.document.findMany({
      where,
      include: {
        type: { select: { id: true, name: true, systemName: true, icon: true, color: true } },
        creator: { select: { id: true, name: true } },
        approvals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ documents })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
