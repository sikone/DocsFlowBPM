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

    const contacts = await db.contact.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : {},
      include: {
        counterparties: {
          include: { counterparty: { select: { id: true, name: true, shortName: true } } },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ contacts })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, telegramId, note, counterpartyIds } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'ФИО обязательно' }, { status: 400 })
    }

    const contact = await db.contact.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        telegramId: telegramId?.trim() || null,
        note: note?.trim() || null,
        counterparties: counterpartyIds?.length
          ? { create: counterpartyIds.map((id: string) => ({ counterpartyId: id })) }
          : undefined,
      },
      include: {
        counterparties: {
          include: { counterparty: { select: { id: true, name: true, shortName: true } } },
        },
      },
    })

    return NextResponse.json({ contact }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
