import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { grantStepPermissions, grantDocumentPermission } from '@/lib/doc-permissions'
import { logActivity } from '@/lib/activity-log'
import { computeStepDueAt } from '@/lib/sla'
import { notifyStepAssignees, notifyUsers } from '@/lib/notifications'
import { sendApprovalEmail, generateQuickApproveToken } from '@/lib/mailer'

function verifyToken(stepId: string, userId: string, token: string): boolean {
  try {
    const expected = generateQuickApproveToken(stepId, userId)
    if (token.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

function html(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} — DocsFlow</title></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">${body}<p style="position:fixed;bottom:16px;width:100%;text-align:center;font-size:11px;color:#cbd5e1;margin:0">DocsFlow</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

function card(icon: string, iconBg: string, iconColor: string, heading: string, text: string, btnUrl?: string, btnLabel?: string): string {
  const btn = btnUrl
    ? `<a href="${btnUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-top:24px">${btnLabel}</a>`
    : ''
  return `<div style="max-width:440px;margin:0 auto;padding:40px 24px;text-align:center">
    <div style="width:72px;height:72px;background:${iconBg};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
    </div>
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a">${heading}</h1>
    <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6">${text}</p>
    ${btn}
  </div>`
}

const CHECKMARK = '<polyline points="20 6 9 17 4 12"/>'
const CLOCK = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
const X_ICON = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stepId = searchParams.get('step') ?? ''
  const userId = searchParams.get('user') ?? ''
  const token = searchParams.get('token') ?? ''

  if (!stepId || !userId || !token) {
    return html('Ошибка', card(X_ICON, '#fee2e2', '#dc2626', 'Неверная ссылка', 'Ссылка для быстрого согласования недействительна.'))
  }

  if (!verifyToken(stepId, userId, token)) {
    return html('Ошибка', card(X_ICON, '#fee2e2', '#dc2626', 'Ссылка недействительна', 'Токен безопасности не совпадает. Возможно, ссылка устарела.'))
  }

  // Load step with approval and document info
  const step = await db.documentApprovalStep.findFirst({
    where: { id: stepId, isActive: true } as any,
    select: {
      id: true, order: true, name: true, stepType: true,
      conditionConfig: true, slaConfig: true, userId: true, departmentId: true,
      status: true, iteration: true, sendEmail: true, approvalId: true,
    },
  })

  if (!step) {
    return html('Не найдено', card(X_ICON, '#fee2e2', '#dc2626', 'Шаг не найден', 'Шаг согласования не существует или был удалён.'))
  }

  if (step.stepType !== 'APPROVAL') {
    return html('Ошибка', card(X_ICON, '#fee2e2', '#dc2626', 'Ошибка', 'Этот шаг не является шагом согласования.'))
  }

  const approval = await db.documentApproval.findUnique({
    where: { id: step.approvalId },
    include: {
      steps: {
        where: { isActive: true } as any,
        orderBy: { order: 'asc' },
        select: {
          id: true, order: true, name: true, stepType: true,
          conditionConfig: true, slaConfig: true, userId: true, departmentId: true,
          status: true, iteration: true, sendEmail: true,
        },
      },
      process: true,
      document: { select: { urgency: true, title: true, number: true, data: true, typeId: true, createdById: true } },
    },
  })

  if (!approval) {
    return html('Не найдено', card(X_ICON, '#fee2e2', '#dc2626', 'Согласование не найдено', 'Процесс согласования не найден.'))
  }

  const appUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const docUrl = `${appUrl}/?doc=${approval.documentId}`
  const docTitle = approval.document.title

  // Already decided — idempotent response
  if (step.status !== 'PENDING') {
    return html(
      'Уже обработано',
      card(CLOCK, '#fef9c3', '#ca8a04', 'Уже обработано', `Шаг «${step.name}» по документу <strong>«${docTitle}»</strong> уже был обработан ранее.`, docUrl, 'Открыть документ'),
    )
  }

  if (approval.status !== 'IN_PROGRESS') {
    return html(
      'Согласование завершено',
      card(CLOCK, '#fef9c3', '#ca8a04', 'Согласование завершено', `Процесс согласования документа <strong>«${docTitle}»</strong> уже завершён.`, docUrl, 'Открыть документ'),
    )
  }

  // Verify the user exists and can decide this step
  const decider = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, departmentId: true },
  })
  if (!decider) {
    return html('Ошибка', card(X_ICON, '#fee2e2', '#dc2626', 'Пользователь не найден', 'Не удалось найти пользователя, для которого создана ссылка.'))
  }

  let canDecide = false
  if (step.userId) canDecide = step.userId === userId
  else if (step.departmentId) canDecide = decider.departmentId === step.departmentId
  if (['ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT'].includes(decider.role)) canDecide = true

  if (!canDecide) {
    return html('Нет прав', card(X_ICON, '#fee2e2', '#dc2626', 'Нет прав', 'У вас нет прав для согласования этого шага.'))
  }

  const decision = 'APPROVED'
  const now = new Date()

  // Mark step approved
  await db.documentApprovalStep.update({
    where: { id: stepId },
    data: { status: decision, decidedById: userId, decidedAt: now },
  })

  await db.approvalStepDecision.create({
    data: { stepId, decision, comment: null, decidedById: userId },
  })

  // ── Wave execution (mirrors decide/route.ts APPROVED branch) ─────────────────
  const VALID_DOC_STATUSES = ['IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED']
  let statusChangedByStep = false
  const autoExecutedIds = new Set<string>()

  const executeStatusChange = async (scStep: typeof approval.steps[0]) => {
    try {
      const cfg = JSON.parse((scStep as any).conditionConfig || '{}')
      if (cfg.targetStatus && VALID_DOC_STATUSES.includes(cfg.targetStatus)) {
        await db.document.update({ where: { id: approval.documentId }, data: { status: cfg.targetStatus } })
        statusChangedByStep = true
      }
    } catch { /* ignore */ }
    await db.documentApprovalStep.update({ where: { id: scStep.id }, data: { status: 'APPROVED', decidedAt: now } })
    autoExecutedIds.add(scStep.id)
  }

  const executeNotification = async (notStep: typeof approval.steps[0]) => {
    try {
      await notifyStepAssignees(
        { userId: notStep.userId ?? null, departmentId: notStep.departmentId ?? null },
        { type: 'NOTIFICATION', title: `Уведомление по документу «${docTitle}»`, entityType: 'DOCUMENT', entityId: approval.documentId },
      )
      if ((notStep as any).sendEmail ?? true) {
        sendApprovalEmail({
          documentId: approval.documentId,
          documentTitle: docTitle,
          documentNumber: (approval.document as any).number ?? null,
          documentData: (approval.document as any).data ?? '{}',
          documentTypeId: (approval.document as any).typeId,
          stepId: null,
          stepName: notStep.name,
          dueAt: null,
          assigneeUserId: notStep.userId ?? null,
          assigneeDepId: notStep.departmentId ?? null,
          prevDeciderName: decider.name,
          prevComment: null,
        }).catch((e) => console.error('sendNotificationEmail error:', e))
      }
    } catch { /* ignore */ }
    await db.documentApprovalStep.update({ where: { id: notStep.id }, data: { status: 'APPROVED', decidedAt: now } })
    autoExecutedIds.add(notStep.id)
  }

  const executeGrantAccess = async (gaStep: typeof approval.steps[0]) => {
    try {
      const cfg = JSON.parse((gaStep as any).conditionConfig || '{}')
      const permission = (cfg.permission === 'EDIT' ? 'EDIT' : 'VIEW') as 'VIEW' | 'EDIT'
      if (cfg.grantType === 'user' && cfg.userId) {
        await grantDocumentPermission(approval.documentId, cfg.userId, permission, userId)
      } else if (cfg.grantType === 'department' && cfg.departmentId) {
        const deptUsers = await db.user.findMany({ where: { departmentId: cfg.departmentId, active: true }, select: { id: true } })
        await Promise.all(deptUsers.map((u) => grantDocumentPermission(approval.documentId, u.id, permission, userId)))
      } else if (cfg.grantType === 'role' && cfg.role) {
        const roleUsers = await db.user.findMany({ where: { role: cfg.role, active: true }, select: { id: true } })
        await Promise.all(roleUsers.map((u) => grantDocumentPermission(approval.documentId, u.id, permission, userId)))
      }
    } catch { /* ignore */ }
    await db.documentApprovalStep.update({ where: { id: gaStep.id }, data: { status: 'APPROVED', decidedAt: now } })
    autoExecutedIds.add(gaStep.id)
  }

  let targetOrder: number | null = null
  let backwardJumpOrders: number[] = []

  // Wave 1: auto-execute leading STATUS_CHANGE / GRANT_ACCESS / NOTIFICATION after the decided step
  let stepsAfter = approval.steps
    .filter((s) => s.order > step.order && s.status === 'PENDING')
    .sort((a, b) => a.order - b.order)

  while (stepsAfter.length > 0 && ['STATUS_CHANGE', 'GRANT_ACCESS', 'NOTIFICATION'].includes(stepsAfter[0].stepType)) {
    if (stepsAfter[0].stepType === 'GRANT_ACCESS') await executeGrantAccess(stepsAfter[0])
    else if (stepsAfter[0].stepType === 'NOTIFICATION') await executeNotification(stepsAfter[0])
    else await executeStatusChange(stepsAfter[0])
    stepsAfter = stepsAfter.slice(1)
  }

  // CONDITION step
  if (stepsAfter.length > 0 && stepsAfter[0].stepType === 'CONDITION') {
    const condStep = stepsAfter[0]
    let jumpToOrder: number | null = null
    try {
      const cfg = JSON.parse(condStep.conditionConfig || '{}') as {
        conditionSource: string; checkValue?: string | null
        trueJumpToOrder?: number | null; falseJumpToOrder?: number | null
      }
      const condResult = cfg.conditionSource === 'last_decision' ? decision === cfg.checkValue : false
      jumpToOrder = condResult ? (cfg.trueJumpToOrder ?? null) : (cfg.falseJumpToOrder ?? null)
    } catch { /* ignore */ }

    await db.documentApprovalStep.update({ where: { id: condStep.id }, data: { status: 'APPROVED', decidedAt: now } })
    autoExecutedIds.add(condStep.id)

    if (jumpToOrder !== null) {
      if (jumpToOrder <= condStep.order) {
        const toReset = approval.steps.filter((s) => s.order >= jumpToOrder! && s.order <= condStep.order)
        if (toReset.length > 0) {
          await db.documentApprovalStep.updateMany({ where: { id: { in: toReset.map((s) => s.id) } }, data: { isActive: false } as any })
          await Promise.all(toReset.map((s) =>
            db.documentApprovalStep.create({
              data: {
                approvalId: step.approvalId, order: s.order, name: s.name, stepType: s.stepType,
                conditionConfig: s.conditionConfig, slaConfig: s.slaConfig, userId: s.userId,
                departmentId: s.departmentId, status: 'PENDING',
                iteration: ((s as any).iteration ?? 1) + 1, isActive: true, sendEmail: (s as any).sendEmail ?? true,
              } as any,
            })
          ))
          backwardJumpOrders = toReset.map((s) => s.order)
        }
      } else {
        const toSkip = approval.steps.filter((s) => s.order > condStep.order && s.order < jumpToOrder! && s.status === 'PENDING')
        if (toSkip.length > 0) {
          await db.documentApprovalStep.updateMany({ where: { id: { in: toSkip.map((s) => s.id) } }, data: { status: 'SKIPPED' } })
        }
      }
      targetOrder = jumpToOrder
    } else {
      targetOrder = condStep.order + 1
    }
  } else {
    targetOrder = stepsAfter.length > 0 ? stepsAfter[0].order : null
  }

  // Wave 2: auto-execute STATUS_CHANGE / GRANT_ACCESS / NOTIFICATION at the jump target
  while (targetOrder !== null) {
    const tStep = approval.steps.find((s) => s.order === targetOrder && !autoExecutedIds.has(s.id) && s.status === 'PENDING')
    if (!tStep || !['STATUS_CHANGE', 'GRANT_ACCESS', 'NOTIFICATION'].includes(tStep.stepType)) break
    if (tStep.stepType === 'GRANT_ACCESS') await executeGrantAccess(tStep)
    else if (tStep.stepType === 'NOTIFICATION') await executeNotification(tStep)
    else await executeStatusChange(tStep)
    const next = approval.steps.filter((s) => s.order > tStep.order && s.status === 'PENDING' && !autoExecutedIds.has(s.id)).sort((a, b) => a.order - b.order)[0]
    targetOrder = next?.order ?? null
  }

  // Grant permissions + notify + email the next APPROVAL step assignee
  if (targetOrder !== null) {
    const targetStep = approval.steps.find((s) => s.order === targetOrder)
    if (targetStep && targetStep.stepType === 'APPROVAL') {
      await grantStepPermissions(approval.documentId, userId, { userId: targetStep.userId, departmentId: targetStep.departmentId })
      await notifyStepAssignees(
        { userId: targetStep.userId, departmentId: targetStep.departmentId },
        { type: 'APPROVAL_REQUEST', title: `Документ «${docTitle}» ожидает вашего согласования (шаг: ${targetStep.name})`, entityType: 'DOCUMENT', entityId: approval.documentId },
      )

      let nextDueAt: Date | null = null
      if (targetStep.slaConfig) {
        const settingRows = await db.systemSettings.findMany()
        const settings: Record<string, string> = {}
        for (const row of settingRows) settings[row.key] = row.value
        nextDueAt = computeStepDueAt((approval.document as any).urgency ?? 'MEDIUM', targetStep.slaConfig, settings)
        if (nextDueAt) {
          const stepIdForUpdate = backwardJumpOrders.includes(targetOrder)
            ? (await db.documentApprovalStep.findFirst({ where: { approvalId: step.approvalId, order: targetOrder, isActive: true } as any, select: { id: true } }))?.id ?? targetStep.id
            : targetStep.id
          await db.documentApprovalStep.update({ where: { id: stepIdForUpdate }, data: { dueAt: nextDueAt } })
        }
      }

      if ((targetStep as any).sendEmail ?? true) {
        // Look up the new step's id (may have been recreated by backward jump)
        const newStepRecord = backwardJumpOrders.includes(targetOrder)
          ? await db.documentApprovalStep.findFirst({ where: { approvalId: step.approvalId, order: targetOrder, isActive: true } as any, select: { id: true } })
          : targetStep
        sendApprovalEmail({
          documentId: approval.documentId,
          documentTitle: docTitle,
          documentNumber: (approval.document as any).number ?? null,
          documentData: (approval.document as any).data ?? '{}',
          documentTypeId: (approval.document as any).typeId,
          stepId: newStepRecord?.id ?? targetStep.id,
          stepName: targetStep.name,
          dueAt: nextDueAt,
          assigneeUserId: targetStep.userId ?? null,
          assigneeDepId: targetStep.departmentId ?? null,
          prevDeciderName: decider.name,
          prevComment: null,
        }).catch((e) => console.error('sendApprovalEmail error:', e))
      }
    }
  }

  // Check completion
  const freshSteps = await db.documentApprovalStep.findMany({
    where: { approvalId: step.approvalId, isActive: true } as any,
    select: { status: true, stepType: true },
  })
  const stillPending = freshSteps.filter((s) => s.status === 'PENDING' && s.stepType === 'APPROVAL')

  logActivity({
    userId,
    action: 'APPROVAL_STEP_APPROVED',
    entityType: 'DOCUMENT',
    entityId: approval.documentId,
    details: `Шаг «${step.name}» согласован (быстрое согласование из email)`,
  })

  if (approval.document.createdById !== userId) {
    await notifyUsers([approval.document.createdById], {
      type: 'APPROVAL_APPROVED',
      title: `Шаг «${step.name}» согласован — документ «${docTitle}»`,
      entityType: 'DOCUMENT',
      entityId: approval.documentId,
    })
  }

  if (stillPending.length === 0) {
    await db.documentApproval.update({ where: { id: step.approvalId }, data: { status: 'APPROVED' } })
    if (!statusChangedByStep) {
      let hasEndStep = false
      if (approval.process?.steps) {
        try { const ps: { type: string }[] = JSON.parse(approval.process.steps); hasEndStep = ps.some((s) => s.type === 'END') } catch { /* ignore */ }
      }
      await db.document.update({ where: { id: approval.documentId }, data: { status: hasEndStep ? 'COMPLETED' : 'APPROVED' } })
    }
    logActivity({
      userId,
      action: 'APPROVAL_COMPLETED',
      entityType: 'DOCUMENT',
      entityId: approval.documentId,
      details: 'Согласование завершено',
    })
  }

  return html(
    'Документ согласован',
    card(CHECKMARK, '#dcfce7', '#16a34a', 'Документ согласован', `Шаг <strong>«${step.name}»</strong> по документу <strong>«${docTitle}»</strong> успешно согласован.`, docUrl, 'Открыть документ'),
  )
}
