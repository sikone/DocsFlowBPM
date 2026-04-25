import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'
import { testAdConnection } from '@/lib/ldap'

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const body = await request.json()
    const { url, baseDn, bindDn, bindPassword, group } = body

    if (!url || !baseDn || !bindDn || !bindPassword) {
      return NextResponse.json({ error: 'Все поля подключения обязательны' }, { status: 400 })
    }

    const result = await testAdConnection({ url, baseDn, bindDn, bindPassword, group: group || 'G_Test_DocsFlow', enabled: true })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}
