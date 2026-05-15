import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const { id } = await params
    const template = await db.emailTemplate.findUnique({ where: { id } })
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ template })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const { id } = await params
    const existing = await db.emailTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const { name, description, subject, bodyHtml, includeAttachments } = body

    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!subject?.trim()) return NextResponse.json({ error: 'subject is required' }, { status: 400 })
    if (!bodyHtml?.trim()) return NextResponse.json({ error: 'bodyHtml is required' }, { status: 400 })

    const template = await db.emailTemplate.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() ?? '',
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        includeAttachments: !!includeAttachments,
      },
    })

    return NextResponse.json({ template })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const { id } = await params
    const existing = await db.emailTemplate.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.isSystem) return NextResponse.json({ error: 'System templates cannot be deleted' }, { status: 400 })

    await db.emailTemplate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
