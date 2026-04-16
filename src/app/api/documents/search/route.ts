import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { Prisma } from '@prisma/client'

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
    const q = url.searchParams.get('q')
    const status = url.searchParams.get('status')
    const typeId = url.searchParams.get('typeId')

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query parameter "q" is required' },
        { status: 400 }
      )
    }

    const query = q.trim()
    const validStatuses = ['DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED']

    // Build where clause with search across multiple fields
    const where: Prisma.DocumentWhereInput = {
      AND: [
        // Search conditions: match in title, number, data, creator name, or type name
        {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { number: { contains: query, mode: 'insensitive' } },
            { data: { contains: query, mode: 'insensitive' } },
            { creator: { name: { contains: query, mode: 'insensitive' } } },
            { type: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        // Optional filters
        ...(status && validStatuses.includes(status)
          ? [{ status }]
          : []),
        ...(typeId
          ? [{ typeId }]
          : []),
      ],
    }

    const documents = await db.document.findMany({
      where,
      include: {
        type: true,
        folder: {
          select: { id: true, name: true, color: true, icon: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      documents,
      total: documents.length,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
