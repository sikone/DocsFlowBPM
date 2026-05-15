import { db } from '@/lib/db'
import { cacheGet, cacheSet, SESSION_CACHE_PREFIX } from '@/lib/redis'
import { Prisma } from '@prisma/client'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: string
  avatar: string | null
  active: boolean
  isDepartmentHead: boolean
  departmentId: string | null
}

/**
 * Validate a session token and return the authenticated user.
 * Checks Redis cache first (TTL = min(session remaining time, 5 min)).
 * Falls back to DB on cache miss, timeout, or Redis unavailability.
 */
export async function getAuthUser(token: string): Promise<AuthUser | null> {
  if (!token) return null

  const cacheKey = `${SESSION_CACHE_PREFIX}${token}`

  const cached = await cacheGet(cacheKey)
  if (cached !== null) {
    try {
      return JSON.parse(cached) as AuthUser
    } catch {
      // corrupt entry — fall through to DB
    }
  }

  try {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session) return null
    if (session.expiresAt < new Date()) return null
    if (!session.user.active) return null

    const authUser: AuthUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      avatar: session.user.avatar,
      active: session.user.active,
      isDepartmentHead: session.user.isDepartmentHead ?? false,
      departmentId: session.user.departmentId ?? null,
    }

    const ttl = Math.max(
      1,
      Math.min(Math.floor((session.expiresAt.getTime() - Date.now()) / 1000), 300)
    )
    cacheSet(cacheKey, JSON.stringify(authUser), ttl)

    return authUser
  } catch {
    return null
  }
}

/**
 * Extract token from request (supports query param and Authorization header).
 */
export function extractToken(request: Request): string | null {
  const url = new URL(request.url)
  const queryToken = url.searchParams.get('token')
  if (queryToken) return queryToken

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

/**
 * Check if the user has admin role.
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === 'ADMIN'
}

export type { Prisma }
