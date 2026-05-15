import { db } from './db'
import type { RuleCondition, RuleAction } from './types'

export async function applyDocumentRulesForUser(documentId: string, userId: string): Promise<void> {
  try {
    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, typeId: true, status: true, urgency: true, createdById: true, data: true, folderId: true },
    })
    if (!doc) return

    const rules = await db.documentRule.findMany({
      where: { userId, active: true },
      orderBy: { order: 'asc' },
    })

    // No rules configured — only move to inbox if no folder was explicitly set
    if (rules.length === 0) {
      if (userId === doc.createdById && !doc.folderId) await moveToUserInbox(documentId, userId)
      return
    }

    const docData = (() => {
      try { return JSON.parse(doc.data) as Record<string, unknown> }
      catch { return {} as Record<string, unknown> }
    })()

    // Build a systemName→value map so rule conditions referencing data.{systemName}
    // resolve correctly. Document data is stored by field.id, not systemName.
    const resolvedData: Record<string, unknown> = { ...docData }
    try {
      const docType = await db.documentType.findUnique({
        where: { id: doc.typeId },
        select: { formSchema: true },
      })
      if (docType) {
        const fields = JSON.parse(docType.formSchema) as Array<{ id: string; systemName?: string }>
        for (const field of fields) {
          if (field.systemName && field.id in docData) {
            resolvedData[field.systemName] = docData[field.id]
          }
        }
      }
    } catch { /* keep resolvedData as-is */ }

    // If the doc already has a folder (user explicitly chose one), don't fall back to inbox
    let anyFolderMove = doc.folderId != null

    for (const rule of rules) {
      const conditions = JSON.parse(rule.conditions) as RuleCondition[]
      const actions = JSON.parse(rule.actions) as RuleAction[]
      if (conditions.length === 0 || actions.length === 0) continue

      const matches = evaluateConditions(conditions, rule.conditionLogic as 'AND' | 'OR', doc, resolvedData)
      if (matches) {
        for (const action of actions) {
          if (action.type === 'moveToFolder') anyFolderMove = true
          await applyAction(action, documentId)
        }
        if (rule.stopOnMatch) break
      }
    }

    // No rule moved the document → for creator, fall back to their inbox
    if (!anyFolderMove && userId === doc.createdById) {
      await moveToUserInbox(documentId, userId)
    }
  } catch (err) {
    console.error('[document-rules] error:', err)
  }
}

async function moveToUserInbox(documentId: string, userId: string): Promise<void> {
  const defaultFolder = await db.folder.findFirst({
    where: { createdById: userId, isSystem: true, order: 0 },
    select: { id: true },
  })
  if (defaultFolder) {
    await db.document.update({ where: { id: documentId }, data: { folderId: defaultFolder.id } })
  }
}

function evaluateConditions(
  conditions: RuleCondition[],
  logic: 'AND' | 'OR',
  doc: { typeId: string; status: string; urgency: string; createdById: string },
  docData: Record<string, unknown>,
): boolean {
  const results = conditions.map((c) => evaluateCondition(c, doc, docData))
  return logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

function evaluateCondition(
  cond: RuleCondition,
  doc: { typeId: string; status: string; urgency: string; createdById: string },
  docData: Record<string, unknown>,
): boolean {
  let actual: unknown
  if (cond.field === 'creatorId') actual = doc.createdById
  else if (cond.field === 'docTypeId') actual = doc.typeId
  else if (cond.field === 'urgency') actual = doc.urgency
  else if (cond.field === 'status') actual = doc.status
  else if (cond.field.startsWith('data.')) actual = docData[cond.field.slice(5)]
  else return false

  const expected = cond.value
  const actualStr = String(actual ?? '')

  switch (cond.operator) {
    case 'eq': return actualStr === expected
    case 'neq': return actualStr !== expected
    case 'gt': return Number(actual) > Number(expected)
    case 'lt': return Number(actual) < Number(expected)
    case 'gte': return Number(actual) >= Number(expected)
    case 'lte': return Number(actual) <= Number(expected)
    case 'contains': return actualStr.toLowerCase().includes(expected.toLowerCase())
    case 'startsWith': return actualStr.toLowerCase().startsWith(expected.toLowerCase())
    case 'isSet': return actual != null && actual !== ''
    case 'isEmpty': return actual == null || actual === ''
    default: return false
  }
}

async function applyAction(action: RuleAction, documentId: string): Promise<void> {
  if (action.type === 'moveToFolder' && action.folderId) {
    await db.document.update({ where: { id: documentId }, data: { folderId: action.folderId } })
  } else if (action.type === 'addTag' && action.tagId) {
    await db.documentTagLink
      .upsert({
        where: { documentId_tagId: { documentId, tagId: action.tagId } },
        create: { documentId, tagId: action.tagId },
        update: {},
      })
      .catch(() => {})
  }
}
