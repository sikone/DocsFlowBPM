import path from 'path'
import fs from 'fs/promises'
import { db } from '@/lib/db'

const DEFAULT_UPLOAD_PATH = './storage/uploads'

export async function getUploadDir(documentId: string): Promise<string> {
  let basePath = DEFAULT_UPLOAD_PATH
  try {
    const setting = await db.systemSettings.findUnique({ where: { key: 'uploadPath' } })
    if (setting?.value) basePath = setting.value
  } catch {
    // fallback to default
  }

  const absBase = path.isAbsolute(basePath)
    ? basePath
    : path.join(process.cwd(), basePath)

  const dir = path.join(absBase, documentId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function deleteUploadedFile(documentId: string, fileName: string): Promise<void> {
  try {
    const dir = await getUploadDir(documentId)
    await fs.unlink(path.join(dir, fileName))
  } catch {
    // file may already be gone
  }
}
