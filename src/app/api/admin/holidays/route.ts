import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseIsDayOffData } from '@/lib/holidays'

/** GET /api/admin/holidays?year=YYYY — return stored holiday dates for the year */
export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const yearParam = request.nextUrl.searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
    if (isNaN(year) || year < 2020 || year > 2035) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }

    const setting = await db.systemSettings.findUnique({ where: { key: `holidays_${year}` } })
    const dates: string[] = setting ? (JSON.parse(setting.value) as string[]) : []

    return NextResponse.json({ year, dates, synced: !!setting })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/holidays — fetch holidays from isdayoff.ru for the given year
 * and persist them to SystemSettings as `holidays_YYYY`.
 * Body: { year: number }
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const body = await request.json()
    const year = parseInt(body.year ?? new Date().getFullYear(), 10)
    if (isNaN(year) || year < 2020 || year > 2035) {
      return NextResponse.json({ error: 'Invalid year (2020–2035 allowed)' }, { status: 400 })
    }

    // Fetch from isdayoff.ru (Russian production calendar)
    const apiUrl = `https://isdayoff.ru/api/getdata?year=${year}&cc=ru&pre=0&sd=0`
    const resp = await fetch(apiUrl, {
      headers: { 'User-Agent': 'DocsFlowBPM/1.0' },
      // Disable Next.js cache — we always want fresh official data
      cache: 'no-store',
    })

    if (!resp.ok) {
      return NextResponse.json(
        { error: `isdayoff.ru responded with HTTP ${resp.status}` },
        { status: 502 },
      )
    }

    const raw = (await resp.text()).trim()
    if (!/^[012]+$/.test(raw)) {
      return NextResponse.json({ error: 'Unexpected response format from isdayoff.ru' }, { status: 502 })
    }

    const dates = parseIsDayOffData(raw, year)

    await db.systemSettings.upsert({
      where: { key: `holidays_${year}` },
      create: { key: `holidays_${year}`, value: JSON.stringify(dates) },
      update: { value: JSON.stringify(dates) },
    })

    return NextResponse.json({ year, dates, count: dates.length })
  } catch (err) {
    console.error('[holidays] sync error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
