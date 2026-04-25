import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, extractToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const inn = request.nextUrl.searchParams.get('inn')?.trim()
    if (!inn || !/^\d{10}(\d{2})?$/.test(inn)) {
      return NextResponse.json({ error: 'INN must be 10 or 12 digits' }, { status: 400 })
    }

    const apiKey = process.env.DADATA_API_KEY
    const secret = process.env.DADATA_SECRET
    if (!apiKey || !secret) {
      return NextResponse.json({ error: 'DaData credentials not configured' }, { status: 500 })
    }

    const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${apiKey}`,
        'X-Secret': secret,
      },
      body: JSON.stringify({ query: inn }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'DaData request failed' }, { status: 502 })
    }

    const json = await res.json()
    const suggestion = json?.suggestions?.[0]
    if (!suggestion) {
      return NextResponse.json({ error: 'Организация с таким ИНН не найдена' }, { status: 404 })
    }

    const d = suggestion.data
    return NextResponse.json({
      name: d.name?.full_with_opf ?? '',
      shortName: d.name?.short_with_opf ?? '',
      inn: d.inn ?? inn,
      kpp: d.kpp ?? '',
      ogrn: d.ogrn ?? '',
      legalAddress: d.address?.value ?? '',
      postalCode: d.address?.data?.postal_code ?? '',
      type: d.type ?? 'LEGAL',
      status: d.state?.status ?? '',
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
