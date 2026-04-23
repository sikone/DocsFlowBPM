import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { getUploadDir } from '@/lib/uploads'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id } = await params
    const attachments = await db.documentAttachment.findMany({
      where: { documentId: id },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: [{ groupId: 'asc' }, { version: 'asc' }],
      // Include soft-deleted so the UI can show them struck through
    })

    return NextResponse.json({ attachments })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId } = await params

    const doc = await db.document.findUnique({ where: { id: documentId } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 100 MB)' }, { status: 413 })

    const incomingGroupId = (formData.get('groupId') as string | null) || null

    const ext = path.extname(file.name)
    const fileName = crypto.randomUUID() + ext
    const dir = await getUploadDir(documentId)
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(dir, fileName), buffer)

    let version = 1
    let resolvedGroupId = incomingGroupId ?? crypto.randomUUID()

    if (incomingGroupId) {
      // Get current max version for this group
      const agg = await db.documentAttachment.aggregate({
        where: { groupId: incomingGroupId, documentId },
        _max: { version: true },
      })
      version = (agg._max.version ?? 0) + 1

      // Mark all existing versions as not latest
      await db.documentAttachment.updateMany({
        where: { groupId: incomingGroupId, documentId },
        data: { isLatest: false },
      })
    }

    const attachment = await db.documentAttachment.create({
      data: {
        documentId,
        originalName: file.name,
        fileName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadedById: user.id,
        groupId: resolvedGroupId,
        version,
        isLatest: true,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ attachment }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
