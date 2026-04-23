import { db } from './db'

// Roles that have default access to all documents
export const PRIVILEGED_ROLES = ['ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT'] as const
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number]
export const isPrivilegedRole = (role: string): boolean =>
  PRIVILEGED_ROLES.includes(role as PrivilegedRole)

export async function grantDocumentPermission(
  documentId: string,
  userId: string,
  permission: 'VIEW' | 'EDIT',
  grantedById: string,
) {
  await db.documentPermission.upsert({
    where: { documentId_userId: { documentId, userId } },
    update: {},
    create: { documentId, userId, permission, grantedById },
  })
}

export async function grantStepPermissions(
  documentId: string,
  grantedById: string,
  step: { userId: string | null; departmentId: string | null },
) {
  if (step.userId) {
    await grantDocumentPermission(documentId, step.userId, 'VIEW', grantedById)
  } else if (step.departmentId) {
    const users = await db.user.findMany({
      where: { departmentId: step.departmentId, active: true },
      select: { id: true },
    })
    await Promise.all(
      users.map((u) => grantDocumentPermission(documentId, u.id, 'VIEW', grantedById)),
    )
  }
}
