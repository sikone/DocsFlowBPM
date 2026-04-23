import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// Tree node type
interface FolderTreeNode {
  id: string
  name: string
  parentId: string | null
  color: string
  icon: string
  order: number
  isSystem: boolean
  createdById: string
  createdAt: Date
  updatedAt: Date
  children: FolderTreeNode[]
  _count?: { documents: number }
}

/**
 * Build a tree structure from flat folder list
 */
function buildFolderTree(folders: Array<{
  id: string
  name: string
  parentId: string | null
  color: string
  icon: string
  order: number
  isSystem: boolean
  createdById: string
  createdAt: Date
  updatedAt: Date
  _count: { documents: number }
}>): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>()
  const roots: FolderTreeNode[] = []

  // Create nodes
  for (const folder of folders) {
    map.set(folder.id, { ...folder, children: [] })
  }

  // Build tree
  for (const folder of folders) {
    const node = map.get(folder.id)!
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by order
  const sortChildren = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.order - b.order)
    for (const node of nodes) {
      sortChildren(node.children)
    }
  }
  sortChildren(roots)

  return roots
}

const DEFAULT_FOLDERS = [
  { name: 'Входящие документы', color: '#3b82f6', icon: 'inbox',  order: 0, isSystem: true },
  { name: 'Мои документы',      color: '#10b981', icon: 'folder', order: 1, isSystem: true },
  { name: 'Архив',              color: '#6b7280', icon: 'archive', order: 2, isSystem: true },
]

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const include = { _count: { select: { documents: true } } } as const
    const order = [{ order: 'asc' as const }, { createdAt: 'asc' as const }]

    let folders = await db.folder.findMany({
      where: { createdById: user.id },
      include,
      orderBy: order,
    })

    // Provision missing system folders (handles new users and migrations)
    const existingSystemNames = new Set(folders.filter((f) => f.isSystem).map((f) => f.name))
    const missing = DEFAULT_FOLDERS.filter((f) => !existingSystemNames.has(f.name))
    if (missing.length > 0) {
      await db.folder.createMany({
        data: missing.map((f) => ({ ...f, createdById: user.id })),
      })
      folders = await db.folder.findMany({
        where: { createdById: user.id },
        include,
        orderBy: order,
      })
    }

    return NextResponse.json({ folders: buildFolderTree(folders) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 })
    }

    const user = await getAuthUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = await request.json()
    const { name, parentId, color, icon } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Validate parentId if provided
    if (parentId) {
      const parentFolder = await db.folder.findUnique({ where: { id: parentId } })
      if (!parentFolder) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
      }
    }

    // Get the next order value
    const maxOrder = await db.folder.aggregate({
      _max: { order: true },
      where: parentId ? { parentId } : { parentId: null },
    })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const folder = await db.folder.create({
      data: {
        name,
        parentId: parentId || null,
        color: color || '#6b7280',
        icon: icon || 'folder',
        order: nextOrder,
        createdById: user.id,
      },
    })

    return NextResponse.json({ folder }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
