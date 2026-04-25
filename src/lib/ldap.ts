import { Client } from 'ldapts'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import crypto from 'crypto'

export interface AdSettings {
  url: string
  baseDn: string
  bindDn: string
  bindPassword: string
  group: string
  enabled: boolean
}

export interface SyncResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export async function getAdSettings(): Promise<AdSettings | null> {
  const rows = await db.systemSettings.findMany({
    where: { key: { in: ['adUrl', 'adBaseDn', 'adBindDn', 'adBindPassword', 'adGroup', 'adEnabled'] } },
  })
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  if (!m.adUrl || !m.adBaseDn || !m.adBindDn || !m.adBindPassword) return null
  return {
    url: m.adUrl,
    baseDn: m.adBaseDn,
    bindDn: m.adBindDn,
    bindPassword: m.adBindPassword,
    group: m.adGroup || 'G_Test_DocsFlow',
    enabled: m.adEnabled === 'true',
  }
}

export async function testAdConnection(settings: AdSettings): Promise<{ success: boolean; message: string }> {
  const client = new Client({ url: settings.url, connectTimeout: 5000, timeout: 5000 })
  try {
    await client.bind(settings.bindDn, settings.bindPassword)
    // Try searching to verify base DN and group access
    const { searchEntries } = await client.search(settings.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=group)(cn=${escapeLdap(settings.group)}))`,
      attributes: ['cn', 'member'],
      sizeLimit: 1,
    })
    await client.unbind()
    if (searchEntries.length === 0) {
      return { success: false, message: `Группа «${settings.group}» не найдена в ${settings.baseDn}` }
    }
    const memberCount = Array.isArray(searchEntries[0].member)
      ? searchEntries[0].member.length
      : searchEntries[0].member ? 1 : 0
    return { success: true, message: `Подключение успешно. В группе ${memberCount} участников.` }
  } catch (err) {
    try { await client.unbind() } catch { /* ignore */ }
    return { success: false, message: err instanceof Error ? err.message : 'Неизвестная ошибка' }
  }
}

export async function syncAdUsers(settings: AdSettings): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] }
  const client = new Client({ url: settings.url, connectTimeout: 8000, timeout: 10000 })

  try {
    await client.bind(settings.bindDn, settings.bindPassword)

    // Get group members
    const { searchEntries: groups } = await client.search(settings.baseDn, {
      scope: 'sub',
      filter: `(&(objectClass=group)(cn=${escapeLdap(settings.group)}))`,
      attributes: ['member'],
    })

    if (groups.length === 0) {
      throw new Error(`Группа «${settings.group}» не найдена`)
    }

    const rawMembers = groups[0].member
    const memberDns: string[] = Array.isArray(rawMembers)
      ? rawMembers.map(String)
      : rawMembers ? [String(rawMembers)] : []

    if (memberDns.length === 0) {
      return result
    }

    // Fetch user attributes for each member
    for (const dn of memberDns) {
      try {
        const { searchEntries: users } = await client.search(dn, {
          scope: 'base',
          filter: '(objectClass=*)',
          attributes: ['mail', 'displayName', 'sAMAccountName', 'userPrincipalName'],
        })

        if (users.length === 0) {
          result.skipped++
          continue
        }

        const u = users[0]
        const email = str(u.mail) || str(u.userPrincipalName)
        const name = str(u.displayName) || str(u.sAMAccountName)

        if (!email) {
          result.skipped++
          result.errors.push(`Нет email: ${dn}`)
          continue
        }

        const existing = await db.user.findUnique({ where: { email } })
        if (existing) {
          await db.user.update({
            where: { id: existing.id },
            data: { name: name || existing.name, adDn: dn },
          })
          result.updated++
        } else {
          await db.user.create({
            data: {
              email,
              name: name || email,
              password: await hashPassword(crypto.randomUUID()),
              role: 'USER',
              active: true,
              adDn: dn,
            },
          })
          result.created++
        }
      } catch (err) {
        result.errors.push(`${dn}: ${err instanceof Error ? err.message : 'ошибка'}`)
      }
    }

    await client.unbind()
    return result
  } catch (err) {
    try { await client.unbind() } catch { /* ignore */ }
    throw err
  }
}

// Verify user credentials via LDAP bind
export async function ldapVerifyPassword(userDn: string, password: string, adUrl: string): Promise<boolean> {
  if (!password) return false
  const client = new Client({ url: adUrl, connectTimeout: 5000, timeout: 5000 })
  try {
    await client.bind(userDn, password)
    await client.unbind()
    return true
  } catch {
    try { await client.unbind() } catch { /* ignore */ }
    return false
  }
}

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return v[0] ? String(v[0]) : ''
  return String(v)
}

function escapeLdap(s: string): string {
  return s.replace(/[\\*()[\]/\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
}
