import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'
import { hashPassword } from '@/lib/password'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, email, password, role, active, departmentId, isDepartmentHead, isAbsent, substituteId, absentUntil } = body

    // Check user exists
    const existingUser = await db.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (password !== undefined) updateData.password = await hashPassword(password)
    if (role !== undefined) {
      const validRoles = ['ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT', 'ADVANCED', 'USER']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role' },
          { status: 400 }
        )
      }
      updateData.role = role
    }
    if (active !== undefined) updateData.active = active
    if (isDepartmentHead !== undefined) updateData.isDepartmentHead = isDepartmentHead
    if (departmentId !== undefined) updateData.departmentId = departmentId || null
    if (isAbsent !== undefined) updateData.isAbsent = isAbsent
    if (substituteId !== undefined) updateData.substituteId = substituteId || null
    if (absentUntil !== undefined) updateData.absentUntil = absentUntil ? new Date(absentUntil) : null
    if (isAbsent === false) updateData.absentUntil = null

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        active: true,
        isDepartmentHead: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        isAbsent: true,
        substituteId: true,
        substitute: { select: { id: true, name: true } },
        absentUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    // Don't allow self-delete
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check user exists
    const existingUser = await db.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete user sessions
    await db.session.deleteMany({ where: { userId: id } })

    // Delete user
    await db.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
