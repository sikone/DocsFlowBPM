import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import crypto from 'crypto'
import { spawn } from 'child_process'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { getUploadDir } from '@/lib/uploads'
import { registerWatcher, stopWatcher, getWatcherEntry } from '@/lib/file-watchers'

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

    // Read source file
    const uploadDir = await getUploadDir(documentId)
    const srcPath = path.join(uploadDir, attachment.fileName)
    let content: Buffer
    try {
      content = await fs.readFile(srcPath)
    } catch {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }

    // Copy to per-document temp dir with unique name to avoid conflicts
    const tmpDir = path.join(os.tmpdir(), 'docsflow', documentId)
    await fs.mkdir(tmpDir, { recursive: true })
    const ext = path.extname(attachment.originalName)
    const tmpPath = path.join(tmpDir, crypto.randomUUID() + ext)
    await fs.writeFile(tmpPath, content)

    // Stop any existing watcher for this group
    const watcherKey = `${documentId}:${attachment.groupId}`
    const existing = getWatcherEntry(watcherKey)
    if (existing) {
      stopWatcher(watcherKey)
      try { await fs.unlink(existing.tmpPath) } catch { /* already gone */ }
    }

    // Open with OS default app
    try {
      if (process.platform === 'win32') {
        spawn('cmd.exe', ['/c', 'start', '', tmpPath], { detached: true, stdio: 'ignore' }).unref()
      } else if (process.platform === 'darwin') {
        spawn('open', [tmpPath], { detached: true, stdio: 'ignore' }).unref()
      } else {
        spawn('xdg-open', [tmpPath], { detached: true, stdio: 'ignore' }).unref()
      }
    } catch { /* non-fatal */ }

    // Start file watcher (server-side polling every 1.5s)
    const { groupId, mimeType, originalName } = attachment
    const userId = user.id
    let isUploading = false

    fsSync.watchFile(tmpPath, { interval: 1500, persistent: false }, async (curr, prev) => {
      if (!curr.nlink || curr.size === 0) return // deleted or empty during save
      if (curr.mtimeMs === prev.mtimeMs) return
      if (isUploading) return
      isUploading = true
      try {
        const fileContent = await fs.readFile(tmpPath)
        const newFileName = crypto.randomUUID() + ext
        await fs.writeFile(path.join(uploadDir, newFileName), fileContent)

        const agg = await db.documentAttachment.aggregate({
          where: { groupId, documentId },
          _max: { version: true },
        })
        const newVersion = (agg._max.version ?? 0) + 1

        await db.documentAttachment.updateMany({
          where: { groupId, documentId },
          data: { isLatest: false },
        })

        await db.documentAttachment.create({
          data: {
            documentId,
            originalName,
            fileName: newFileName,
            fileSize: fileContent.length,
            mimeType,
            uploadedById: userId,
            groupId,
            version: newVersion,
            isLatest: true,
          },
        })
      } catch (err) {
        console.error('[open-local] upload error:', err)
      } finally {
        isUploading = false
      }
    })

    registerWatcher(watcherKey, { tmpPath, documentId })

    return NextResponse.json({ groupId })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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
    if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const watcherKey = `${documentId}:${attachment.groupId}`
    const entry = getWatcherEntry(watcherKey)
    stopWatcher(watcherKey)
    if (entry?.tmpPath) {
      try { await fs.unlink(entry.tmpPath) } catch { /* already gone */ }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
