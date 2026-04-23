import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

const include = {
  counterparties: {
    include: { counterparty: { select: { id: true, name: true, shortName: true } } },
  },
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id } = await params
    const contact = await db.contact.findUnique({ where: { id }, include })
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ contact })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, email, phone, telegramId, note, counterpartyIds } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'ФИО обязательно' }, { status: 400 })
    }

    // Replace counterparty links
    await db.counterpartyContact.deleteMany({ where: { contactId: id } })

    const contact = await db.contact.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        telegramId: telegramId?.trim() || null,
        note: note?.trim() || null,
        counterparties: counterpartyIds?.length
          ? { create: counterpartyIds.map((cid: string) => ({ counterpartyId: cid })) }
          : undefined,
      },
      include,
    })

    return NextResponse.json({ contact })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    await db.contact.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
