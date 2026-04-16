import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'

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

    // Validate current password (plain text comparison as per existing auth pattern)
    if (dbUser.password !== currentPassword) {
      return NextResponse.json(
        { error: 'Неверный текущий пароль' },
        { status: 400 }
      )
    }

    // Update password
    await db.user.update({
      where: { id: user.id },
      data: { password: newPassword },
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
