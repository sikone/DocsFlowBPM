import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { isPrivilegedRole } from '@/lib/doc-permissions'
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

    // Find directory entries (counterparties, contacts) matching the query.
    // Documents store only the ID of directory entries in their data JSON,
    // so we resolve names → IDs here and add them to the document search.
    const [matchingCounterparties, matchingContacts] = await Promise.all([
      db.counterparty.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { shortName: { contains: query, mode: 'insensitive' } },
            { inn: { contains: query } },
          ],
        },
        select: { id: true },
        take: 30,
      }),
      db.contact.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        select: { id: true },
        take: 30,
      }),
    ])

    const directoryIdClauses: Prisma.DocumentWhereInput[] = [
      ...matchingCounterparties.map((c) => ({ data: { contains: c.id } })),
      ...matchingContacts.map((c) => ({ data: { contains: c.id } })),
    ]

    // Build where clause
    const andClauses: Prisma.DocumentWhereInput[] = []

    if (!isPrivilegedRole(user.role)) {
      andClauses.push({ OR: [{ createdById: user.id }, { permissions: { some: { userId: user.id } } }] })
    }

    andClauses.push({
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { number: { contains: query, mode: 'insensitive' } },
        { data: { contains: query, mode: 'insensitive' } },
        { creator: { name: { contains: query, mode: 'insensitive' } } },
        { type: { name: { contains: query, mode: 'insensitive' } } },
        ...directoryIdClauses,
      ],
    })

    if (status && validStatuses.includes(status)) andClauses.push({ status })
    if (typeId) andClauses.push({ typeId })

    const where: Prisma.DocumentWhereInput = { AND: andClauses }

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
