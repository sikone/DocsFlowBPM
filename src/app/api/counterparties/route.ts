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
    const activeOnly = searchParams.get('active') !== 'false'

    const counterparties = await db.counterparty.findMany({
      where: {
        ...(activeOnly ? { active: true } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { shortName: { contains: q } },
                { inn: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ counterparties })
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
    const { name, shortName, inn, kpp, ogrn, legalAddress, actualAddress, postalAddress, postalCode, bankAccount, bank, bik, active } = body

    if (!name?.trim() || !inn?.trim()) {
      return NextResponse.json({ error: 'Название и ИНН обязательны' }, { status: 400 })
    }

    const counterparty = await db.counterparty.create({
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

    return NextResponse.json({ counterparty }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
