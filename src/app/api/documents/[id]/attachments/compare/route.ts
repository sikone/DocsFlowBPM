import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import crypto from 'crypto'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { getUploadDir } from '@/lib/uploads'

const execAsync = promisify(exec)

// ─── Office detection ─────────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function whereExe(name: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`where "${name}"`, { timeout: 3000 })
    const first = stdout.trim().split(/\r?\n/)[0].trim()
    return first || null
  } catch { return null }
}

const WORD_PATHS = [
  'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
  'C:\\Program Files\\Microsoft Office\\root\\Office15\\WINWORD.EXE',
  'C:\\Program Files\\Microsoft Office\\root\\Office14\\WINWORD.EXE',
  'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
  'C:\\Program Files (x86)\\Microsoft Office\\root\\Office15\\WINWORD.EXE',
  'C:\\Program Files\\Microsoft Office\\Office16\\WINWORD.EXE',
  'C:\\Program Files\\Microsoft Office\\Office15\\WINWORD.EXE',
  'C:\\Program Files\\Microsoft Office\\Office14\\WINWORD.EXE',
  'C:\\Program Files (x86)\\Microsoft Office\\Office16\\WINWORD.EXE',
  'C:\\Program Files (x86)\\Microsoft Office\\Office15\\WINWORD.EXE',
]

const LO_PATHS = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
  'C:\\Program Files\\LibreOffice 6\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice 7\\program\\soffice.exe',
]

const OO_PATHS = [
  'C:\\Program Files (x86)\\OpenOffice 4\\program\\soffice.exe',
  'C:\\Program Files\\OpenOffice 4\\program\\soffice.exe',
  'C:\\Program Files (x86)\\OpenOffice.org 3\\program\\soffice.exe',
  'C:\\Program Files\\OpenOffice.org 3\\program\\soffice.exe',
]

type OfficeApp =
  | { type: 'word'; exe: string }
  | { type: 'libreoffice' | 'openoffice'; exe: string }

async function detectOffice(): Promise<OfficeApp | null> {
  for (const p of WORD_PATHS) {
    if (await fileExists(p)) return { type: 'word', exe: p }
  }
  const wordInPath = await whereExe('WINWORD')
  if (wordInPath) return { type: 'word', exe: wordInPath }

  for (const p of LO_PATHS) {
    if (await fileExists(p)) return { type: 'libreoffice', exe: p }
  }
  const loInPath = await whereExe('soffice')
  if (loInPath) return { type: 'libreoffice', exe: loInPath }

  for (const p of OO_PATHS) {
    if (await fileExists(p)) return { type: 'openoffice', exe: p }
  }

  return null
}

// ─── Word via VBScript (COM, STA by default) ──────────────────────────────────

async function compareWithWord(file1: string, file2: string, tmpDir: string): Promise<void> {
  // VBScript strings: backslash is NOT an escape char; only " needs escaping (→ "")
  const q = (s: string) => s.replace(/"/g, '""')

  // Key fixes vs previous version:
  // 1. ReadOnly=False — Word refuses Compare on a read-only document
  // 2. No oWord.Activate — fails before any window exists, corrupts Err.Number
  // 3. Err.Clear before Compare so we get a clean error code
  // 4. Only close oDoc when Compare SUCCEEDED (nErr=0);
  //    if it failed, oDoc stays visible — Word is not left empty
  const vbs = [
    'On Error Resume Next',
    '',
    'Dim oWord',
    'Set oWord = CreateObject("Word.Application")',
    'If Err.Number <> 0 Then WScript.Quit 1',
    '',
    'oWord.DisplayAlerts = 0',
    'oWord.Visible = True',
    '',
    'Dim oDoc',
    // ConfirmConversions=False, ReadOnly=False, AddToRecentFiles=False
    `Set oDoc = oWord.Documents.Open("${q(file1)}", False, False, False)`,
    'If Err.Number <> 0 Then',
    '  oWord.Quit',
    '  WScript.Quit 2',
    'End If',
    '',
    'Err.Clear',
    // CompareTarget 2 = wdCompareTargetNew → diff opens as a new document
    `oDoc.Compare "${q(file2)}", "DocsFlow", 2, True, False, False, False, False`,
    'Dim nCompareErr : nCompareErr = Err.Number',
    '',
    'If nCompareErr = 0 Then',
    '  oDoc.Close False',  // close original; comparison result doc stays open
    'End If',
    // If Compare failed oDoc remains open so Word is not left blank
    '',
    'WScript.Quit 0',
  ].join('\r\n')

  const vbsPath = path.join(tmpDir, 'compare.vbs')
  await fs.writeFile(vbsPath, vbs, 'utf8')

  spawn('wscript.exe', [vbsPath], { detached: true, stdio: 'ignore' }).unref()
}

// ─── LibreOffice / OpenOffice via injected Basic macro ────────────────────────

async function findLoUserScriptsDir(appType: 'libreoffice' | 'openoffice'): Promise<string | null> {
  const appData = process.env.APPDATA
  if (!appData) return null

  const appFolder = appType === 'libreoffice' ? 'LibreOffice' : 'OpenOffice'
  const baseDir = path.join(appData, appFolder)

  try {
    const entries = await fs.readdir(baseDir)
    // Sort version folders descending (4, 3, 2 …)
    const versions = entries
      .filter((e) => /^\d/.test(e))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

    for (const ver of versions) {
      const dir = path.join(baseDir, ver, 'user', 'Scripts', 'basic')
      if (await fileExists(dir)) return dir
    }
    // Fallback: without version subfolder
    const direct = path.join(baseDir, 'user', 'Scripts', 'basic')
    if (await fileExists(direct)) return direct
  } catch { /* not installed or non-standard layout */ }

  return null
}

async function injectLoMacro(scriptsDir: string, file1: string, file2: string): Promise<void> {
  // In Basic double-quoted strings: only " needs escaping (as "")
  const q = (s: string) => s.replace(/"/g, '""')

  const moduleXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd">
<script:module xmlns:script="http://openoffice.org/2000/script" script:name="CompareModule" script:language="StarBasic">
Sub RunCompare
  Dim sOriginal As String
  Dim sRevised As String
  sOriginal = "${q(file1)}"
  sRevised = "${q(file2)}"

  Dim aLoadProps(0) As New com.sun.star.beans.PropertyValue
  aLoadProps(0).Name = "Hidden"
  aLoadProps(0).Value = False

  Dim oDoc As Object
  oDoc = StarDesktop.loadComponentFromURL(ConvertToURL(sOriginal), "_blank", 0, aLoadProps())
  If IsNull(oDoc) Or IsEmpty(oDoc) Then Exit Sub

  Dim oFrame As Object
  oFrame = oDoc.getCurrentController().getFrame()

  Dim oDispatcher As Object
  oDispatcher = createUnoService("com.sun.star.frame.DispatchHelper")

  Dim aCompareArgs(0) As New com.sun.star.beans.PropertyValue
  aCompareArgs(0).Name = "URL"
  aCompareArgs(0).Value = ConvertToURL(sRevised)

  ' .uno:CompareDocuments opens the diff as a new tracked-changes document
  oDispatcher.executeDispatch(oFrame, ".uno:CompareDocuments", "", 0, aCompareArgs())
End Sub
</script:module>`

  const libXlb = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE library:library PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "library.dtd">
<library:library xmlns:library="http://openoffice.org/2000/library" library:name="DocsFlowCompare" library:readonly="false" library:passwordprotected="false">
  <library:element library:name="CompareModule"/>
</library:library>`

  const moduleDir = path.join(scriptsDir, 'DocsFlowCompare')
  await fs.mkdir(moduleDir, { recursive: true })
  await fs.writeFile(path.join(moduleDir, 'CompareModule.xba'), moduleXml, 'utf8')
  await fs.writeFile(path.join(moduleDir, 'script.xlb'), libXlb, 'utf8')

  // Register our library in the top-level script.xlb
  const topXlbPath = path.join(scriptsDir, 'script.xlb')
  let topXlb: string
  try {
    topXlb = await fs.readFile(topXlbPath, 'utf8')
  } catch {
    topXlb = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE library:libraries PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "libraries.dtd">',
      '<library:libraries xmlns:library="http://openoffice.org/2000/library">',
      '</library:libraries>',
    ].join('\n')
  }

  if (!topXlb.includes('DocsFlowCompare')) {
    topXlb = topXlb.replace(
      '</library:libraries>',
      `  <library:library library:name="DocsFlowCompare" library:link="false"/>\n</library:libraries>`
    )
    await fs.writeFile(topXlbPath, topXlb, 'utf8')
  }
}

type LoResult = 'compare' | 'open-both'

async function compareWithLibreOffice(
  exe: string,
  appType: 'libreoffice' | 'openoffice',
  file1: string,
  file2: string,
): Promise<LoResult> {
  const scriptsDir = await findLoUserScriptsDir(appType)

  if (scriptsDir) {
    try {
      await injectLoMacro(scriptsDir, file1, file2)
      // macro:///LIBRARY.MODULE.SUB — "///" means user location
      spawn(exe, ['macro:///DocsFlowCompare.CompareModule.RunCompare'], {
        detached: true,
        stdio: 'ignore',
      }).unref()
      return 'compare'
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: open both files so the user can compare manually
  spawn(exe, ['--writer', file1, file2], { detached: true, stdio: 'ignore' }).unref()
  return 'open-both'
}

// ─── Route ────────────────────────────────────────────────────────────────────

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
    const { attachmentId1, attachmentId2 } = (await request.json()) as {
      attachmentId1: string
      attachmentId2: string
    }

    if (!attachmentId1 || !attachmentId2 || attachmentId1 === attachmentId2) {
      return NextResponse.json({ error: 'Требуется два разных вложения' }, { status: 400 })
    }

    const [att1, att2] = await Promise.all([
      db.documentAttachment.findUnique({ where: { id: attachmentId1 } }),
      db.documentAttachment.findUnique({ where: { id: attachmentId2 } }),
    ])

    if (!att1 || att1.documentId !== documentId)
      return NextResponse.json({ error: 'Вложение 1 не найдено' }, { status: 404 })
    if (!att2 || att2.documentId !== documentId)
      return NextResponse.json({ error: 'Вложение 2 не найдено' }, { status: 404 })

    if (process.platform !== 'win32') {
      return NextResponse.json(
        { error: 'Сравнение документов поддерживается только на Windows' },
        { status: 501 }
      )
    }

    const office = await detectOffice()
    if (!office) {
      return NextResponse.json(
        {
          error:
            'Не найдено приложение для сравнения. Установите Microsoft Word, LibreOffice или OpenOffice.',
        },
        { status: 422 }
      )
    }

    // Copy both files to a temp dir with human-readable names
    const uploadDir = await getUploadDir(documentId)
    const [buf1, buf2] = await Promise.all([
      fs.readFile(path.join(uploadDir, att1.fileName)),
      fs.readFile(path.join(uploadDir, att2.fileName)),
    ])

    const tmpDir = path.join(os.tmpdir(), 'docsflow', 'compare', crypto.randomUUID())
    await fs.mkdir(tmpDir, { recursive: true })

    const ext1 = path.extname(att1.originalName)
    const ext2 = path.extname(att2.originalName)
    const tmpFile1 = path.join(tmpDir, `v${att1.version}_original${ext1}`)
    const tmpFile2 = path.join(tmpDir, `v${att2.version}_revised${ext2}`)

    await Promise.all([fs.writeFile(tmpFile1, buf1), fs.writeFile(tmpFile2, buf2)])

    let method: string

    if (office.type === 'word') {
      await compareWithWord(tmpFile1, tmpFile2, tmpDir)
      method = 'word'
    } else {
      const result = await compareWithLibreOffice(office.exe, office.type, tmpFile1, tmpFile2)
      method = result === 'compare' ? office.type : `${office.type}-open`
    }

    return NextResponse.json({ success: true, method })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
