import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'
import { getAdSettings, syncAdUsers } from '@/lib/ldap'
import { logActivity } from '@/lib/activity-log'

export async function POST(request: NextRequest) {
  try {
    // Accept either an admin session token or the server-to-server sync secret
    const syncSecret = process.env.AD_SYNC_SECRET
    const incomingSecret = request.headers.get('x-sync-secret')
    const isSecretAuth = syncSecret && incomingSecret && incomingSecret === syncSecret

    let actorLabel = 'scheduler'
    let actorUserId: string | null = null

    if (!isSecretAuth) {
      const token = extractToken(request)
      if (!token) return NextResponse.json({ error: 'Token or sync secret required' }, { status: 401 })
      const user = await getAuthUser(token)
      if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
      if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      actorLabel = user.name
      actorUserId = user.id
    }

    const settings = await getAdSettings()
    if (!settings) {
      return NextResponse.json({ error: 'Настройки Active Directory не заданы' }, { status: 400 })
    }
    if (!settings.enabled) {
      return NextResponse.json({ error: 'Синхронизация с AD отключена' }, { status: 400 })
    }

    const result = await syncAdUsers(settings)

    if (actorUserId) {
      logActivity({
        userId: actorUserId,
        action: 'AD_SYNC',
        details: `Синхронизация AD (${actorLabel}): создано ${result.created}, обновлено ${result.updated}, пропущено ${result.skipped}${result.errors.length ? `, ошибок: ${result.errors.length}` : ''}`,
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка синхронизации' },
      { status: 500 }
    )
  }
}
