import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { comparePassword, isHashed, hashPassword } from '@/lib/password'

export async function PUT(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Текущий и новый пароль обязательны' },
        { status: 400 }
      )
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: 'Пароль должен содержать минимум 4 символа' },
        { status: 400 }
      )
    }

    // Fetch user with password from DB
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Validate current password (support both plain text and hashed during migration)
    const isValid = await (await isHashed(dbUser.password))
      ? comparePassword(currentPassword, dbUser.password)
      : Promise.resolve(dbUser.password === currentPassword)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Неверный текущий пароль' },
        { status: 400 }
      )
    }

    // Update password (always hash the new password)
    const hashedNewPassword = await hashPassword(newPassword)
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    })

    // Log activity
    await logActivity({
      userId: user.id,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: user.id,
      details: 'Пользователь сменил пароль',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
