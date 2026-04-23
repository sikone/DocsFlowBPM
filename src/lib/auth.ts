import { db } from '@/lib/db'
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
 * Returns null if token is invalid, expired, or user is inactive.
 */
export async function getAuthUser(token: string): Promise<AuthUser | null> {
  if (!token) return null

  try {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session) return null
    if (session.expiresAt < new Date()) return null
    if (!session.user.active) return null

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      avatar: session.user.avatar,
      active: session.user.active,
      isDepartmentHead: session.user.isDepartmentHead ?? false,
      departmentId: session.user.departmentId ?? null,
    }
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
