import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import crypto from 'crypto'
import { spawn } from 'child_process'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { getUploadDir } from '@/lib/uploads'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId, attachmentId } = await params

    const attachment = await db.documentAttachment.findUnique({ where: { id: attachmentId } })
    if (!attachment || attachment.documentId !== documentId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    const uploadDir = await getUploadDir(documentId)
    const srcPath = path.join(uploadDir, attachment.fileName)
    let content: Buffer
    try {
      content = await fs.readFile(srcPath)
    } catch {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }

    const tmpDir = path.join(os.tmpdir(), 'docsflow', documentId)
    await fs.mkdir(tmpDir, { recursive: true })
    const ext = path.extname(attachment.originalName)
    const tmpPath = path.join(tmpDir, crypto.randomUUID() + ext)
    await fs.writeFile(tmpPath, content)

    try {
      if (process.platform === 'win32') {
        spawn('cmd.exe', ['/c', 'start', '', tmpPath], { detached: true, stdio: 'ignore' }).unref()
      } else if (process.platform === 'darwin') {
        spawn('open', [tmpPath], { detached: true, stdio: 'ignore' }).unref()
      } else {
        spawn('xdg-open', [tmpPath], { detached: true, stdio: 'ignore' }).unref()
      }
    } catch { /* non-fatal */ }

    // Clean up temp file after 5 minutes (viewer should have loaded it by then)
    setTimeout(async () => {
      try { await fs.unlink(tmpPath) } catch { /* already gone */ }
    }, 5 * 60 * 1000)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
