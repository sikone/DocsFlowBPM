import nodemailer from 'nodemailer'
import path from 'path'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getUploadDir } from '@/lib/uploads'
import type { FormField } from '@/lib/types'
import { DEFAULT_EMAIL_TEMPLATES } from '@/lib/email-template-defaults'

export interface ApprovalEmailPayload {
  documentId: string
  documentTitle: string
  documentNumber?: string | null
  documentData: string        // JSON field values
  documentTypeId: string
  stepId?: string | null
  stepName: string
  dueAt?: Date | null
  assigneeUserId?: string | null
  assigneeDepId?: string | null
  prevDeciderName?: string | null
  prevComment?: string | null
}

export function generateQuickApproveToken(stepId: string, userId: string): string {
  const secret = process.env.QUICK_APPROVE_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'docsflow-qat'
  return crypto.createHmac('sha256', secret).update(`${stepId}:${userId}`).digest('hex')
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function resolveDirectoryNames(fields: FormField[], values: Record<string, unknown>): Promise<Map<string, string>> {
  const counterpartyIds: string[] = []
  const contactIds: string[] = []

  for (const f of fields) {
    const raw = values[f.id] ?? (f.systemName ? values[f.systemName] : undefined)
    if (typeof raw !== 'string' || !raw) continue
    if (f.type === 'counterparty') {
      counterpartyIds.push(raw)
    } else if (f.type === 'select' && f.source === 'directory') {
      const src = f.directorySource || 'counterparties'
      if (src === 'counterparties') counterpartyIds.push(raw)
      else if (src === 'contacts') contactIds.push(raw)
    }
  }

  const nameMap = new Map<string, string>()
  if (counterpartyIds.length > 0) {
    const items = await db.counterparty.findMany({
      where: { id: { in: counterpartyIds } },
      select: { id: true, name: true, shortName: true },
    })
    for (const item of items) nameMap.set(item.id, item.shortName || item.name)
  }
  if (contactIds.length > 0) {
    const items = await db.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, name: true },
    })
    for (const item of items) nameMap.set(item.id, item.name)
  }
  return nameMap
}

function formatFieldValue(field: FormField, raw: unknown, nameMap?: Map<string, string>): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  // legacy: some records may store {id, name} objects directly
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    const name = obj.name ?? obj.label ?? obj.title
    if (name) return String(name)
    return null
  }
  const v = String(raw)
  // directory/counterparty fields store a CUID — resolve to human name
  if (nameMap && (field.type === 'counterparty' || (field.type === 'select' && field.source === 'directory'))) {
    return nameMap.get(v) ?? v
  }
  switch (field.type) {
    case 'checkbox':
    case 'switch':
      return raw === true || v === 'true' ? 'Да' : 'Нет'
    case 'date':
      try { return formatDate(v) } catch { return v }
    case 'money':
      try {
        const n = parseFloat(v)
        return isNaN(n) ? v : n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 })
      } catch { return v }
    case 'heading':
    case 'separator':
    case 'computed':
      return null
    default:
      return v
  }
}

async function buildFieldsHtml(formSchema: string, data: string): Promise<string> {
  let fields: FormField[] = []
  let values: Record<string, unknown> = {}
  try { fields = JSON.parse(formSchema) } catch { return '' }
  try { values = JSON.parse(data) } catch { return '' }

  const nameMap = await resolveDirectoryNames(fields, values)

  const rows: { label: string; value: string }[] = []
  const sorted = [...fields].sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.column ?? 0) - (b.column ?? 0))

  for (const f of sorted) {
    if (['heading', 'separator', 'computed'].includes(f.type)) continue
    // data is stored with field.id as key; fall back to systemName for older records
    const raw = values[f.id] ?? (f.systemName ? values[f.systemName] : undefined)
    const val = formatFieldValue(f, raw, nameMap)
    if (val !== null) rows.push({ label: f.label || f.systemName || f.id, value: val })
  }

  if (rows.length === 0) return ''

  const tableRows = rows.map((r, i) =>
    `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top;width:40%;border-bottom:1px solid #f1f5f9">${esc(r.label)}</td>
      <td style="padding:8px 14px;color:#1e293b;font-size:13px;vertical-align:top;border-bottom:1px solid #f1f5f9">${esc(r.value)}</td>
    </tr>`
  ).join('')

  return `
    <div style="margin-bottom:24px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;font-weight:600;margin-bottom:8px">Поля документа</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        ${tableRows}
      </table>
    </div>`
}

type CommentEntry = { deciderName?: string | null; comment: string; date?: Date | null }

function buildCommentsHtml(comments: CommentEntry[]): string {
  const valid = comments.filter((c) => c.comment?.trim())
  if (valid.length === 0) return ''
  const items = valid.map((c) => {
    const meta = [c.deciderName ? esc(c.deciderName) : null, c.date ? formatDate(c.date) : null].filter(Boolean).join(', ')
    return `
      <div style="border-bottom:1px solid #fde68a;padding:10px 0;last-child:border-none">
        ${meta ? `<div style="font-size:12px;color:#92400e;font-weight:600;margin-bottom:4px">${meta}</div>` : ''}
        <div style="font-size:14px;color:#78350f;line-height:1.5">${esc(c.comment.trim())}</div>
      </div>`
  }).join('')
  return `
    <div style="margin-bottom:24px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px 16px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#92400e;font-weight:600;margin-bottom:8px">Комментарии</div>
      ${items}
    </div>`
}

async function loadEmailTemplate(slugOrId: string): Promise<{ subject: string; bodyHtml: string; includeAttachments: boolean }> {
  try {
    const bySlug = await db.emailTemplate.findUnique({ where: { slug: slugOrId } })
    if (bySlug) return { subject: bySlug.subject, bodyHtml: bySlug.bodyHtml, includeAttachments: bySlug.includeAttachments }
    const byId = await db.emailTemplate.findUnique({ where: { id: slugOrId } })
    if (byId) return { subject: byId.subject, bodyHtml: byId.bodyHtml, includeAttachments: byId.includeAttachments }
  } catch { /* fallthrough to default */ }
  const def = DEFAULT_EMAIL_TEMPLATES.find((t) => t.slug === slugOrId)
  if (def) return { subject: def.subject, bodyHtml: def.bodyHtml, includeAttachments: false }
  return { ...DEFAULT_EMAIL_TEMPLATES[0], includeAttachments: false }
}

function applyTemplate(bodyHtml: string, vars: Record<string, string>): string {
  return bodyHtml.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

function applySubject(subject: string, vars: Record<string, string>): string {
  return subject.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

function buildTemplateVars(opts: {
  title: string
  number?: string | null
  stepName: string
  dueAt?: Date | null
  fieldsHtml: string
  commentHtml: string
  docUrl: string
  assigneeName?: string
  quickApproveUrl?: string
  overdueMs?: number
}): Record<string, string> {
  const { title, number, stepName, dueAt, fieldsHtml, commentHtml, docUrl, assigneeName, quickApproveUrl, overdueMs } = opts

  const deadlineHtml = dueAt
    ? `<div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:5px 10px;font-size:12px;color:#dc2626;font-weight:500"><span>⏰</span> Срок: ${formatDateTime(dueAt)}</div>`
    : ''

  const documentNumberBlock = number
    ? `<p style="margin:0 0 20px;font-size:13px;color:#64748b">Номер документа: <strong style="color:#334155">${esc(number)}</strong></p>`
    : '<div style="margin-bottom:20px"></div>'

  const assigneeBlock = assigneeName
    ? `<div style="margin-top:4px;font-size:13px;color:#64748b">Ответственный: <strong style="color:#334155">${esc(assigneeName)}</strong></div>`
    : ''

  const ctaButtonHtml = `<a href="${docUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.02em;box-shadow:0 4px 14px rgba(16,185,129,0.35)">Перейти к документу &rarr;</a>`

  const quickApproveHtml = quickApproveUrl
    ? `<div style="margin-top:12px"><a href="${quickApproveUrl}" style="display:inline-block;background:#fff;color:#059669;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;border:2px solid #10b981">&#10003; Согласовать без изменений</a></div>`
    : ''

  let overdueDurationHtml = ''
  if (overdueMs !== undefined && overdueMs > 0) {
    const h = Math.floor(overdueMs / 3600000)
    const m = Math.floor((overdueMs % 3600000) / 60000)
    const durationText = h > 0 ? `${h} ч ${m > 0 ? m + ' мин' : ''}`.trim() : `${m} мин`
    overdueDurationHtml = `<div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:6px 12px;font-size:13px;color:#b91c1c;font-weight:600"><span>🚨</span> Просрочено на ${durationText}</div>`
  }

  return {
    DOCUMENT_TITLE: esc(title),
    DOCUMENT_NUMBER_BLOCK: documentNumberBlock,
    STEP_NAME: esc(stepName),
    ASSIGNEE_BLOCK: assigneeBlock,
    DEADLINE_HTML: deadlineHtml,
    FIELDS_HTML: fieldsHtml,
    COMMENTS_HTML: commentHtml,
    DOC_URL: docUrl,
    CTA_BUTTON_HTML: ctaButtonHtml,
    QUICK_APPROVE_HTML: quickApproveHtml,
    OVERDUE_DURATION_HTML: overdueDurationHtml,
  }
}

// ─── shared SMTP bootstrap ────────────────────────────────────────────────────

async function loadSmtpConfig(): Promise<Record<string, string> | null> {
  const rows = await db.systemSettings.findMany({
    where: { key: { in: ['emailEnabled', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPassword', 'smtpFrom', 'smtpFromName', 'appUrl'] } },
  })
  const cfg: Record<string, string> = {}
  for (const r of rows) cfg[r.key] = r.value
  if (cfg.emailEnabled !== 'true' || !cfg.smtpHost || !cfg.smtpFrom) return null
  return cfg
}

async function resolveEmails(assigneeUserId?: string | null, assigneeDepId?: string | null): Promise<string[]> {
  const emails: string[] = []
  if (assigneeUserId) {
    const u = await db.user.findUnique({ where: { id: assigneeUserId }, select: { email: true } })
    if (u?.email) emails.push(u.email)
  } else if (assigneeDepId) {
    const users = await db.user.findMany({ where: { departmentId: assigneeDepId, active: true }, select: { email: true } })
    emails.push(...users.map((u) => u.email))
  }
  return emails
}

async function buildAllComments(documentId: string): Promise<CommentEntry[]> {
  const allComments: CommentEntry[] = []
  const activeApproval = await db.documentApproval.findFirst({
    where: { documentId, status: 'IN_PROGRESS' },
    select: {
      steps: {
        orderBy: { order: 'asc' },
        select: {
          decisions: {
            orderBy: { createdAt: 'asc' },
            select: { comment: true, decidedBy: { select: { name: true } }, createdAt: true },
          },
        },
      },
    },
  })
  if (activeApproval) {
    for (const step of activeApproval.steps) {
      for (const d of step.decisions) {
        if (d.comment?.trim()) allComments.push({ deciderName: d.decidedBy?.name ?? null, comment: d.comment, date: d.createdAt })
      }
    }
  }
  return allComments
}

async function dispatchEmail(
  cfg: Record<string, string>,
  to: string[],
  subject: string,
  html: string,
  text: string,
  attachments: { filename: string; path: string; contentType: string }[],
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: parseInt(cfg.smtpPort ?? '587', 10),
    secure: cfg.smtpSecure === 'true',
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPassword ?? '' } : undefined,
    tls: { rejectUnauthorized: false },
  })
  const fromAddress = cfg.smtpFromName ? `"${cfg.smtpFromName}" <${cfg.smtpFrom}>` : cfg.smtpFrom
  await transporter.sendMail({ from: fromAddress, to: to.join(', '), subject, text, html, attachments })
}

/**
 * Resolve the email of the department head for the given user or department.
 * Returns empty array if no head is found or head is already in `excludeEmails`.
 */
async function resolveDepartmentHeadEmails(
  assigneeUserId?: string | null,
  assigneeDepId?: string | null,
  excludeEmails: string[] = [],
): Promise<string[]> {
  let departmentId: string | null | undefined = assigneeDepId

  if (!departmentId && assigneeUserId) {
    const user = await db.user.findUnique({
      where: { id: assigneeUserId },
      select: { departmentId: true },
    })
    departmentId = user?.departmentId
  }

  if (!departmentId) return []

  const head = await db.user.findFirst({
    where: { departmentId, isDepartmentHead: true, active: true },
    select: { email: true },
  })

  if (!head?.email) return []
  if (excludeEmails.includes(head.email)) return []
  return [head.email]
}

// ─── SLA warning email ────────────────────────────────────────────────────────

export async function sendSlaOverdueEmail(params: {
  stepId: string
  stepName: string
  dueAt: Date | null
  assigneeUserId?: string | null
  assigneeDepId?: string | null
  documentId: string
  documentTitle: string
}): Promise<void> {
  const cfg = await loadSmtpConfig()
  if (!cfg) return

  const assigneeEmails = await resolveEmails(params.assigneeUserId, params.assigneeDepId)
  const headEmails = await resolveDepartmentHeadEmails(params.assigneeUserId, params.assigneeDepId, assigneeEmails)
  const allEmails = [...new Set([...assigneeEmails, ...headEmails])]
  if (allEmails.length === 0) return

  let assigneeName: string | undefined
  if (params.assigneeUserId) {
    const u = await db.user.findUnique({ where: { id: params.assigneeUserId }, select: { name: true } })
    assigneeName = u?.name ?? undefined
  }

  const doc = await db.document.findUnique({
    where: { id: params.documentId },
    select: { number: true, data: true, typeId: true },
  })
  const docType = doc?.typeId
    ? await db.documentType.findUnique({ where: { id: doc.typeId }, select: { formSchema: true } })
    : null
  const fieldsHtml = await buildFieldsHtml(docType?.formSchema ?? '[]', doc?.data ?? '{}')

  const allComments = await buildAllComments(params.documentId)
  const commentHtml = buildCommentsHtml(allComments)

  const appUrl = (cfg.appUrl || process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const docUrl = `${appUrl}/?doc=${params.documentId}`

  const overdueMs = params.dueAt ? Math.max(0, Date.now() - params.dueAt.getTime()) : 0

  const tpl = await loadEmailTemplate('sla_overdue')
  const vars = buildTemplateVars({
    title: params.documentTitle,
    number: doc?.number ?? null,
    stepName: params.stepName,
    dueAt: params.dueAt,
    fieldsHtml,
    commentHtml,
    docUrl,
    assigneeName,
    overdueMs,
  })
  const html = applyTemplate(tpl.bodyHtml, vars)
  const subject = applySubject(tpl.subject, { DOCUMENT_TITLE: params.documentTitle })

  const h = Math.floor(overdueMs / 3600000)
  const m = Math.floor((overdueMs % 3600000) / 60000)
  const durationText = h > 0 ? `${h}ч ${m > 0 ? m + 'мин' : ''}`.trim() : `${m}мин`
  const text = [
    `ПРОСРОЧЕНО! Заявка не согласована в срок — DocsFlow`,
    ``,
    `Документ: ${params.documentTitle}${doc?.number ? ` (№ ${doc.number})` : ''}`,
    `Шаг: ${params.stepName}`,
    params.dueAt ? `Срок был: ${formatDateTime(params.dueAt)}` : '',
    overdueMs > 0 ? `Просрочено на: ${durationText}` : '',
    ...allComments.map((c) => `Комментарий${c.deciderName ? ` (${c.deciderName})` : ''}: ${c.comment.trim()}`),
    ``,
    `Перейти к документу: ${docUrl}`,
  ].filter((l) => l !== '').join('\n')

  const attachmentRecords = await db.documentAttachment.findMany({
    where: { documentId: params.documentId, isLatest: true, deletedAt: null },
    select: { originalName: true, fileName: true, mimeType: true },
  })
  const uploadDir = await getUploadDir(params.documentId)
  const mailAttachments = attachmentRecords.map((a) => ({
    filename: a.originalName,
    path: path.join(uploadDir, a.fileName),
    contentType: a.mimeType,
  }))

  await dispatchEmail(cfg, allEmails, subject, html, text, mailAttachments)
}

export async function sendSlaWarningEmail(params: {
  stepId: string
  stepName: string
  dueAt: Date | null
  assigneeUserId?: string | null
  assigneeDepId?: string | null
  documentId: string
  documentTitle: string
}): Promise<void> {
  const cfg = await loadSmtpConfig()
  if (!cfg) return

  const emails = await resolveEmails(params.assigneeUserId, params.assigneeDepId)
  if (emails.length === 0) return

  let assigneeName: string | undefined
  if (params.assigneeUserId) {
    const u = await db.user.findUnique({ where: { id: params.assigneeUserId }, select: { name: true } })
    assigneeName = u?.name ?? undefined
  }

  const doc = await db.document.findUnique({
    where: { id: params.documentId },
    select: { number: true, data: true, typeId: true },
  })
  const docType = doc?.typeId
    ? await db.documentType.findUnique({ where: { id: doc.typeId }, select: { formSchema: true } })
    : null
  const fieldsHtml = await buildFieldsHtml(docType?.formSchema ?? '[]', doc?.data ?? '{}')

  const allComments = await buildAllComments(params.documentId)
  const commentHtml = buildCommentsHtml(allComments)

  const appUrl = (cfg.appUrl || process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const docUrl = `${appUrl}/?doc=${params.documentId}`

  let quickApproveUrl: string | undefined
  if (params.assigneeUserId) {
    const token = generateQuickApproveToken(params.stepId, params.assigneeUserId)
    quickApproveUrl = `${appUrl}/api/approve-quick?step=${params.stepId}&user=${params.assigneeUserId}&token=${token}`
  }

  const tpl = await loadEmailTemplate('sla_warning')
  const vars = buildTemplateVars({
    title: params.documentTitle,
    number: doc?.number ?? null,
    stepName: params.stepName,
    dueAt: params.dueAt,
    fieldsHtml,
    commentHtml,
    docUrl,
    assigneeName,
    quickApproveUrl,
  })
  const html = applyTemplate(tpl.bodyHtml, vars)
  const subject = applySubject(tpl.subject, { DOCUMENT_TITLE: params.documentTitle })

  const text = [
    `ВАЖНО!!! Срок согласования подходит к концу — DocsFlow`,
    ``,
    `Документ: ${params.documentTitle}${doc?.number ? ` (№ ${doc.number})` : ''}`,
    `Шаг: ${params.stepName}`,
    params.dueAt ? `Срок: ${formatDateTime(params.dueAt)}` : '',
    ...allComments.map((c) => `Комментарий${c.deciderName ? ` (${c.deciderName})` : ''}: ${c.comment.trim()}`),
    ``,
    `Перейти к документу: ${docUrl}`,
    quickApproveUrl ? `Согласовать без изменений: ${quickApproveUrl}` : '',
  ].filter((l) => l !== undefined && !(l === '' && false)).join('\n')

  const attachmentRecords = await db.documentAttachment.findMany({
    where: { documentId: params.documentId, isLatest: true, deletedAt: null },
    select: { originalName: true, fileName: true, mimeType: true },
  })
  const uploadDir = await getUploadDir(params.documentId)
  const mailAttachments = attachmentRecords.map((a) => ({
    filename: a.originalName,
    path: path.join(uploadDir, a.fileName),
    contentType: a.mimeType,
  }))

  await dispatchEmail(cfg, emails, subject, html, text, mailAttachments)
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function sendApprovalEmail(payload: ApprovalEmailPayload): Promise<void> {
  const cfg = await loadSmtpConfig()
  if (!cfg) return

  const emails = await resolveEmails(payload.assigneeUserId, payload.assigneeDepId)
  if (emails.length === 0) return

  let assigneeName: string | undefined
  if (payload.assigneeUserId) {
    const u = await db.user.findUnique({ where: { id: payload.assigneeUserId }, select: { name: true } })
    assigneeName = u?.name ?? undefined
  }

  const docType = await db.documentType.findUnique({ where: { id: payload.documentTypeId }, select: { formSchema: true } })
  const fieldsHtml = await buildFieldsHtml(docType?.formSchema ?? '[]', payload.documentData)

  const allComments = await buildAllComments(payload.documentId)
  const commentHtml = buildCommentsHtml(allComments)

  const appUrl = (cfg.appUrl || process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const docUrl = `${appUrl}/?doc=${payload.documentId}`

  let quickApproveUrl: string | undefined
  if (payload.stepId && payload.assigneeUserId) {
    const token = generateQuickApproveToken(payload.stepId, payload.assigneeUserId)
    quickApproveUrl = `${appUrl}/api/approve-quick?step=${payload.stepId}&user=${payload.assigneeUserId}&token=${token}`
  }

  const tpl = await loadEmailTemplate('approval_request')
  const vars = buildTemplateVars({
    title: payload.documentTitle,
    number: payload.documentNumber,
    stepName: payload.stepName,
    dueAt: payload.dueAt,
    fieldsHtml,
    commentHtml,
    docUrl,
    assigneeName,
    quickApproveUrl,
  })
  const html = applyTemplate(tpl.bodyHtml, vars)
  const subject = applySubject(tpl.subject, { DOCUMENT_TITLE: payload.documentTitle })

  const text = [
    `Запрос на согласование — DocsFlow`,
    ``,
    `Документ: ${payload.documentTitle}${payload.documentNumber ? ` (№ ${payload.documentNumber})` : ''}`,
    `Шаг: ${payload.stepName}`,
    payload.dueAt ? `Срок: ${formatDateTime(payload.dueAt)}` : '',
    ...allComments.map((c) => `Комментарий${c.deciderName ? ` (${c.deciderName})` : ''}: ${c.comment.trim()}`),
    ``,
    `Перейти к документу: ${docUrl}`,
    quickApproveUrl ? `Согласовать без изменений: ${quickApproveUrl}` : '',
  ].filter((l) => l !== undefined && !(l === '' && false)).join('\n')

  const attachmentRecords = await db.documentAttachment.findMany({
    where: { documentId: payload.documentId, isLatest: true, deletedAt: null },
    select: { originalName: true, fileName: true, mimeType: true },
  })
  const uploadDir = await getUploadDir(payload.documentId)
  const mailAttachments = attachmentRecords.map((a) => ({
    filename: a.originalName,
    path: path.join(uploadDir, a.fileName),
    contentType: a.mimeType,
  }))

  await dispatchEmail(cfg, emails, subject, html, text, mailAttachments)
}

// ─── custom step email (SEND_EMAIL process step) ──────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function resolveEmailFromDocumentField(
  fieldName: string,
  documentData: string,
  documentTypeId: string,
): Promise<string | null> {
  const tag = `[SEND_EMAIL field="${fieldName}"]`

  let values: Record<string, unknown> = {}
  try { values = JSON.parse(documentData) } catch {
    console.error(tag, 'не удалось распарсить documentData')
    return null
  }

  const docType = await db.documentType.findUnique({
    where: { id: documentTypeId },
    select: { formSchema: true },
  })
  if (!docType) {
    console.error(tag, 'тип документа не найден:', documentTypeId)
    return null
  }

  let fields: FormField[] = []
  try { fields = JSON.parse(docType.formSchema) } catch {
    console.error(tag, 'не удалось распарсить formSchema')
    return null
  }

  // ищем поле по systemName или id
  const field = fields.find((f) => (f.systemName ?? f.id) === fieldName)
  if (!field) {
    const available = fields.map((f) => f.systemName ?? f.id).filter(Boolean).join(', ')
    console.error(tag, `поле не найдено. Доступные системные имена: [${available}]`)
    return null
  }

  // значения хранятся по field.id (CUID), не по systemName
  const raw = values[field.id] ?? (field.systemName ? values[field.systemName] : undefined)
  if (!raw || typeof raw !== 'string') {
    console.error(tag, `поле найдено (id=${field.id}, type=${field.type}), но значение пустое. Ключи в данных: [${Object.keys(values).join(', ')}]`)
    return null
  }

  console.log(tag, `значение поля: "${raw}", тип: ${field.type}`)

  if (EMAIL_RE.test(raw)) {
    console.log(tag, `прямой email: ${raw}`)
    return raw
  }

  if (field.type === 'select' && field.source === 'directory' && field.directorySource === 'contacts') {
    const contact = await db.contact.findUnique({ where: { id: raw }, select: { email: true } })
    console.log(tag, `справочник контактов, id=${raw}, email=${contact?.email ?? '(нет)'}`)
    return contact?.email ?? null
  }

  console.error(tag, `значение "${raw}" не является email и поле не является справочником контактов (source=${field.source}, directorySource=${field.directorySource})`)
  return null
}

export async function sendCustomStepEmail(params: {
  documentId: string
  documentTitle: string
  documentNumber?: string | null
  documentData: string
  documentTypeId: string
  stepName: string
  emailConfig: {
    recipientType?: 'user' | 'department' | 'email' | 'field'
    userId?: string | null
    departmentId?: string | null
    customEmail?: string | null
    fieldName?: string | null
    templateSlug?: string | null
  }
}): Promise<void> {
  const cfg = await loadSmtpConfig()
  if (!cfg) return

  const { emailConfig } = params
  const emails: string[] = []

  if (emailConfig.recipientType === 'user' && emailConfig.userId) {
    const u = await db.user.findUnique({ where: { id: emailConfig.userId }, select: { email: true } })
    if (u?.email) emails.push(u.email)
  } else if (emailConfig.recipientType === 'department' && emailConfig.departmentId) {
    const users = await db.user.findMany({ where: { departmentId: emailConfig.departmentId, active: true }, select: { email: true } })
    emails.push(...users.map((u) => u.email))
  } else if (emailConfig.recipientType === 'email' && emailConfig.customEmail) {
    emails.push(emailConfig.customEmail)
  } else if (emailConfig.recipientType === 'field' && emailConfig.fieldName) {
    const fieldEmail = await resolveEmailFromDocumentField(
      emailConfig.fieldName,
      params.documentData,
      params.documentTypeId,
    )
    if (fieldEmail) emails.push(fieldEmail)
  } else {
    console.warn('[SEND_EMAIL] recipientType не распознан или не хватает данных:', JSON.stringify(emailConfig))
  }

  console.log('[SEND_EMAIL] получатели:', emails.length ? emails.join(', ') : '(пусто — письмо не отправится)')
  if (emails.length === 0) return

  const docType = await db.documentType.findUnique({ where: { id: params.documentTypeId }, select: { formSchema: true } })
  const fieldsHtml = await buildFieldsHtml(docType?.formSchema ?? '[]', params.documentData)
  const allComments = await buildAllComments(params.documentId)
  const commentHtml = buildCommentsHtml(allComments)

  const appUrl = (cfg.appUrl || process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const docUrl = `${appUrl}/?doc=${params.documentId}`

  const tpl = await loadEmailTemplate(emailConfig.templateSlug || 'approval_request')
  const vars = buildTemplateVars({
    title: params.documentTitle,
    number: params.documentNumber ?? null,
    stepName: params.stepName,
    fieldsHtml,
    commentHtml,
    docUrl,
  })
  const html = applyTemplate(tpl.bodyHtml, vars)
  const subject = applySubject(tpl.subject, { DOCUMENT_TITLE: params.documentTitle })
  const text = `${params.stepName} — DocsFlow\n\nДокумент: ${params.documentTitle}\n\nПерейти к документу: ${docUrl}`

  let mailAttachments: { filename: string; path: string; contentType: string }[] = []
  if (tpl.includeAttachments) {
    const attachmentRecords = await db.documentAttachment.findMany({
      where: { documentId: params.documentId, isLatest: true, deletedAt: null },
      select: { originalName: true, fileName: true, mimeType: true },
    })
    const uploadDir = await getUploadDir(params.documentId)
    mailAttachments = attachmentRecords.map((a) => ({
      filename: a.originalName,
      path: path.join(uploadDir, a.fileName),
      contentType: a.mimeType,
    }))
  }

  await dispatchEmail(cfg, emails, subject, html, text, mailAttachments)
}
