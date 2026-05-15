import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import type { RuleCondition, RuleAction } from '@/lib/types'

function parseRule(rule: { conditions: string; actions: string; [k: string]: unknown }) {
  return {
    ...rule,
    conditions: JSON.parse(rule.conditions) as RuleCondition[],
    actions: JSON.parse(rule.actions) as RuleAction[],
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id } = await params
    const existing = await db.documentRule.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, conditionLogic, conditions, actions, stopOnMatch, active, order } = body

    const rule = await db.documentRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(conditionLogic !== undefined && { conditionLogic }),
        ...(conditions !== undefined && { conditions: JSON.stringify(conditions) }),
        ...(actions !== undefined && { actions: JSON.stringify(actions) }),
        ...(stopOnMatch !== undefined && { stopOnMatch }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order }),
      },
    })

    return NextResponse.json({ rule: parseRule(rule) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id } = await params
    const existing = await db.documentRule.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.documentRule.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
