import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { isPrivilegedRole } from '@/lib/doc-permissions'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId, permissionId } = await params
    const perm = await db.documentPermission.findUnique({ where: { id: permissionId } })
    if (!perm || perm.documentId !== documentId) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 })
    }

    // Only privileged roles, document creator, or EDIT-permission holders can revoke access
    if (!isPrivilegedRole(user.role)) {
      const doc = await db.document.findUnique({ where: { id: documentId }, select: { createdById: true } })
      if (doc?.createdById !== user.id) {
        const callerPerm = await db.documentPermission.findFirst({ where: { documentId, userId: user.id } })
        if (!callerPerm || callerPerm.permission !== 'EDIT') {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }
      }
    }

    await db.documentPermission.delete({ where: { id: permissionId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
