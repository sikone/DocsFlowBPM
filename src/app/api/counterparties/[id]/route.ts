import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id } = await params
    const counterparty = await db.counterparty.findUnique({ where: { id } })
    if (!counterparty) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ counterparty })
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
    const { name, shortName, inn, kpp, ogrn, legalAddress, actualAddress, postalAddress, postalCode, bankAccount, bank, bik, active } = body

    if (!name?.trim() || !inn?.trim()) {
      return NextResponse.json({ error: 'Название и ИНН обязательны' }, { status: 400 })
    }

    const counterparty = await db.counterparty.update({
      where: { id },
      data: {
        name: name.trim(),
        shortName: shortName?.trim() || null,
        inn: inn.trim(),
        kpp: kpp?.trim() || null,
        ogrn: ogrn?.trim() || null,
        legalAddress: legalAddress?.trim() || null,
        actualAddress: actualAddress?.trim() || null,
        postalAddress: postalAddress?.trim() || null,
        postalCode: postalCode?.trim() || null,
        bankAccount: bankAccount?.trim() || null,
        bank: bank?.trim() || null,
        bik: bik?.trim() || null,
        active: active !== false,
      },
    })

    return NextResponse.json({ counterparty })
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
    await db.counterparty.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
