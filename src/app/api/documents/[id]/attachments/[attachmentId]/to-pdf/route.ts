import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'
import JSZip from 'jszip'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { getUploadDir } from '@/lib/uploads'

const SOFFICE_CANDIDATES = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  '/usr/local/bin/soffice',
  '/usr/local/bin/libreoffice',
  '/opt/libreoffice/program/soffice',
]

async function findSoffice(): Promise<string | null> {
  for (const p of SOFFICE_CANDIDATES) {
    try { await fs.access(p); return p } catch { /* not found */ }
  }
  return null
}

// Accept all tracked changes directly in DOCX XML.
// <w:ins> → keep inner content, remove wrapper
// <w:del> → remove entirely
// <w:*PrChange> → remove (keep current/new properties that sit outside)
function acceptTrackedChanges(xml: string): string {
  let r = xml
  // Unwrap insertions — lazy match handles single-level nesting
  r = r.replace(/<w:ins\b[^>]*>([\s\S]*?)<\/w:ins>/g, '$1')
  // Drop deletions entirely
  r = r.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '')
  // Drop "old property" snapshots from property-change revisions
  for (const tag of ['pPrChange', 'rPrChange', 'tblPrChange', 'trPrChange', 'tcPrChange', 'sectPrChange']) {
    r = r.replace(new RegExp(`<w:${tag}\\b[^>]*>[\\s\\S]*?<\\/w:${tag}>`, 'g'), '')
  }
  return r
}

async function docxToPdf(docxBuffer: Buffer, ext: string): Promise<Buffer> {
  const soffice = await findSoffice()
  if (!soffice) {
    throw new Error(
      'LibreOffice не установлен. Скачайте с https://www.libreoffice.org/download/download/ и установите.'
    )
  }

  // Accept tracked changes only for DOCX (ZIP-based); .doc is a binary OLE format
  let inputBuf = docxBuffer
  if (ext === '.docx') {
    const zip = await JSZip.loadAsync(docxBuffer)
    const docXmlFile = zip.file('word/document.xml')
    if (docXmlFile) {
      const xml = await docXmlFile.async('string')
      zip.file('word/document.xml', acceptTrackedChanges(xml))
    }
    inputBuf = Buffer.from(await zip.generateAsync({ type: 'uint8array' }))
  }

  const id = randomBytes(8).toString('hex')
  const tmpIn = path.join(tmpdir(), `${id}${ext}`)
  // LibreOffice names the output file by replacing the input extension
  const tmpOut = path.join(tmpdir(), `${id}.pdf`)

  await fs.writeFile(tmpIn, inputBuf)
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(soffice, [
        '--headless',
        '--norestore',
        '--convert-to', 'pdf',
        '--outdir', tmpdir(),
        tmpIn,
      ], {
        cwd: path.dirname(soffice),
      })
      let stderr = ''
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('error', reject)
      proc.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error(`LibreOffice завершился с кодом ${code}: ${stderr}`))
      })
    })
    return await fs.readFile(tmpOut)
  } finally {
    await fs.unlink(tmpIn).catch(() => {})
    await fs.unlink(tmpOut).catch(() => {})
  }
}

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

    const ext = path.extname(attachment.originalName).toLowerCase()
    if (!['.doc', '.docx'].includes(ext)) {
      return NextResponse.json({ error: 'Поддерживаются только .doc и .docx файлы' }, { status: 400 })
    }

    const dir = await getUploadDir(documentId)
    const fileBuffer = await fs.readFile(path.join(dir, attachment.fileName))
    const pdfBuffer = await docxToPdf(fileBuffer, ext)

    const pdfName = path.basename(attachment.originalName, ext) + '.pdf'
    return new NextResponse(pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(pdfName)}`,
        'X-Original-Name': encodeURIComponent(pdfName),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
