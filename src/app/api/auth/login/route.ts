import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { comparePassword, isHashed } from '@/lib/password'
import { getAdSettings, ldapVerifyPassword } from '@/lib/ldap'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (!user.active) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 401 }
      )
    }

    let isValid = false
    if (user.adDn) {
      // AD user — verify via LDAP bind; fall back to local password if AD unreachable
      const adSettings = await getAdSettings()
      if (adSettings?.enabled && adSettings.url) {
        isValid = await ldapVerifyPassword(user.adDn, password, adSettings.url)
      } else {
        // AD disabled or not configured — allow local password fallback
        const hashed = await isHashed(user.password)
        isValid = hashed
          ? await comparePassword(password, user.password)
          : user.password === password
      }
    } else {
      // Local user
      const hashed = await isHashed(user.password)
      isValid = hashed
        ? await comparePassword(password, user.password)
        : user.password === password
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await db.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    // Log login activity (fire and forget)
    logActivity({ userId: user.id, action: 'LOGIN', details: `Вход в систему: ${user.name}` })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        isDepartmentHead: user.isDepartmentHead ?? false,
        departmentId: user.departmentId ?? null,
      },
      token,
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
