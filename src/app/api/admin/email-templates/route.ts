import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, extractToken, isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { DEFAULT_EMAIL_TEMPLATES } from '@/lib/email-template-defaults'

async function ensureSystemTemplates() {
  for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({
      where: { slug: tpl.slug },
      create: tpl,
      update: {},
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    await ensureSystemTemplates()

    const templates = await db.emailTemplate.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ templates })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const body = await request.json()
    const { name, description, subject, bodyHtml, includeAttachments } = body

    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!subject?.trim()) return NextResponse.json({ error: 'subject is required' }, { status: 400 })
    if (!bodyHtml?.trim()) return NextResponse.json({ error: 'bodyHtml is required' }, { status: 400 })

    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `tpl_${Date.now()}`
    const existing = await db.emailTemplate.findUnique({ where: { slug: baseSlug } })
    const finalSlug = existing ? `${baseSlug}_${Date.now()}` : baseSlug

    const template = await db.emailTemplate.create({
      data: {
        slug: finalSlug,
        name: name.trim(),
        description: description?.trim() ?? '',
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        isSystem: false,
        includeAttachments: !!includeAttachments,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
