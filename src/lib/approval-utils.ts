import { db } from '@/lib/db'

/**
 * Walks the substitute chain for a user and returns the first non-absent user's ID.
 * Stops when the user is not absent, has no substitute, or a cycle is detected.
 */
export async function resolveEffectiveUserId(
  userId: string | null,
  maxDepth = 5,
): Promise<string | null> {
  if (!userId) return null
  let currentId = userId
  const visited = new Set<string>()
  for (let i = 0; i < maxDepth; i++) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const u = await db.user.findUnique({
      where: { id: currentId },
      select: { isAbsent: true, substituteId: true, active: true },
    })
    if (!u || !u.isAbsent || !u.substituteId) return currentId
    currentId = u.substituteId
  }
  return currentId
}
