import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { getWatcherEntry } from '@/lib/file-watchers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId, attachmentId } = await params

    const attachment = await db.documentAttachment.findUnique({
      where: { id: attachmentId },
      select: { groupId: true, documentId: true },
    })
    if (!attachment || attachment.documentId !== documentId) {
      return NextResponse.json({ active: false })
    }

    const watcherKey = `${documentId}:${attachment.groupId}`
    const active = getWatcherEntry(watcherKey) !== undefined

    return NextResponse.json({ active })
  } catch {
    return NextResponse.json({ active: false })
  }
}
