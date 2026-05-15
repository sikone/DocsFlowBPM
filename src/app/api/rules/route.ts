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

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const rules = await db.documentRule.findMany({
      where: { userId: user.id },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ rules: rules.map(parseRule) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const body = await request.json()
    const { name, conditionLogic = 'AND', conditions = [], actions = [], stopOnMatch = false } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const maxOrderRow = await db.documentRule.findFirst({
      where: { userId: user.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    const order = (maxOrderRow?.order ?? -1) + 1

    const rule = await db.documentRule.create({
      data: {
        userId: user.id,
        name: name.trim(),
        conditionLogic,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify(actions),
        stopOnMatch,
        order,
      },
    })

    return NextResponse.json({ rule: parseRule(rule) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
