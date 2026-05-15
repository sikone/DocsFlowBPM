import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { getUploadDir } from '@/lib/uploads'
import { grantStepPermissions, grantDocumentPermission } from '@/lib/doc-permissions'
import { logActivity } from '@/lib/activity-log'
import { computeStepDueAt } from '@/lib/sla'
import { notifyStepAssignees, notifyUsers } from '@/lib/notifications'
import { sendApprovalEmail } from '@/lib/mailer'
import { resolveEffectiveUserId } from '@/lib/approval-utils'

const MAX_FILE_SIZE = 100 * 1024 * 1024

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: approvalId, stepId } = await params

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'Необходимо загрузить хотя бы один PDF-файл' }, { status: 400 })

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `Файл ${file.name} слишком большой (макс. 100 МБ)` }, { status: 413 })
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) return NextResponse.json({ error: `Файл ${file.name} не является PDF` }, { status: 400 })
    }

    const approval = await db.documentApproval.findUnique({
      where: { id: approvalId },
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
    if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    if (approval.status !== 'IN_PROGRESS')
      return NextResponse.json({ error: 'Approval is already completed' }, { status: 400 })

    const step = approval.steps.find((s) => s.id === stepId)
    if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    if (step.status !== 'PENDING')
      return NextResponse.json({ error: 'Step is already decided' }, { status: 400 })
    if (step.stepType !== 'PAPER_SIGNATURE')
      return NextResponse.json({ error: 'Этот шаг не является шагом подписания на бумаге' }, { status: 400 })

    const firstPendingHuman = approval.steps
      .filter((s) => s.status === 'PENDING' && (s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE' || s.stepType === 'PAPER_SIGNATURE'))
      .sort((a, b) => a.order - b.order)[0]
    if (firstPendingHuman?.id !== stepId)
      return NextResponse.json({ error: 'Этот шаг ещё не активен — дождитесь завершения предыдущих шагов' }, { status: 400 })

    let canSign = false
    if (step.userId) {
      canSign = step.userId === user.id
    } else if (step.departmentId) {
      canSign = user.departmentId === step.departmentId
    }
    if (['ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT'].includes(user.role)) canSign = true
    if (!canSign)
      return NextResponse.json({ error: 'Нет прав для подписания этого шага' }, { status: 403 })

    // Upload PDF files as signed attachments
    const uploadDir = await getUploadDir(approval.documentId)
    const uploadedNames: string[] = []

    for (const file of files) {
      const ext = path.extname(file.name) || '.pdf'
      const fileName = crypto.randomUUID() + ext
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(path.join(uploadDir, fileName), buffer)

      await db.documentAttachment.create({
        data: {
          documentId: approval.documentId,
          originalName: file.name,
          fileName,
          fileSize: file.size,
          mimeType: 'application/pdf',
          uploadedById: user.id,
          groupId: crypto.randomUUID(),
          version: 1,
          isLatest: true,
          isSigned: true,
        } as any,
      })
      uploadedNames.push(file.name)

      logActivity({
        userId: user.id,
        action: 'ADD_ATTACHMENT',
        entityType: 'DOCUMENT',
        entityId: approval.documentId,
        details: `Загружен подписанный документ: ${file.name}`,
      })
    }

    const signedComment = `Подписано на бумаге. Загружено файлов: ${files.length} (${uploadedNames.join(', ')})`

    // Mark step as completed
    await db.documentApprovalStep.update({
      where: { id: stepId },
      data: { status: 'APPROVED', decidedById: user.id, comment: signedComment, decidedAt: new Date() },
    })

    // Mark document as signed on paper
    await db.document.update({ where: { id: approval.documentId }, data: { isSignedPaper: true } as any })

    // Persist immutable decision history
    await db.approvalStepDecision.create({
      data: { stepId, decision: 'APPROVED', comment: signedComment, decidedById: user.id },
    })

    // ── Wave execution ────────────────────────────────────────────────────────
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
      await db.documentApprovalStep.update({ where: { id: scStep.id }, data: { status: 'APPROVED', decidedAt: new Date() } })
      autoExecutedIds.add(scStep.id)
    }

    const executeNotification = async (notStep: typeof approval.steps[0]) => {
      try {
        await notifyStepAssignees(
          { userId: notStep.userId ?? null, departmentId: notStep.departmentId ?? null },
          { type: 'NOTIFICATION', title: `Уведомление по документу «${approval.document.title}»`, entityType: 'DOCUMENT', entityId: approval.documentId },
        )
        if ((notStep as any).sendEmail ?? true) {
          sendApprovalEmail({
            documentId: approval.documentId, documentTitle: approval.document.title,
            documentNumber: (approval.document as any).number ?? null,
            documentData: (approval.document as any).data ?? '{}',
            documentTypeId: (approval.document as any).typeId,
            stepId: null, stepName: notStep.name, dueAt: null,
            assigneeUserId: notStep.userId ?? null, assigneeDepId: notStep.departmentId ?? null,
            prevDeciderName: user.name, prevComment: signedComment,
          }).catch((e) => console.error('sendNotificationEmail error:', e))
        }
      } catch { /* ignore */ }
      await db.documentApprovalStep.update({ where: { id: notStep.id }, data: { status: 'APPROVED', decidedAt: new Date() } })
      autoExecutedIds.add(notStep.id)
    }

    const executeGrantAccess = async (gaStep: typeof approval.steps[0]) => {
      try {
        const cfg = JSON.parse((gaStep as any).conditionConfig || '{}')
        const permission = (cfg.permission === 'EDIT' ? 'EDIT' : 'VIEW') as 'VIEW' | 'EDIT'
        if (cfg.grantType === 'user' && cfg.userId) {
          await grantDocumentPermission(approval.documentId, cfg.userId, permission, user.id)
        } else if (cfg.grantType === 'department' && cfg.departmentId) {
          const deptUsers = await db.user.findMany({ where: { departmentId: cfg.departmentId, active: true }, select: { id: true } })
          await Promise.all(deptUsers.map((u) => grantDocumentPermission(approval.documentId, u.id, permission, user.id)))
        } else if (cfg.grantType === 'role' && cfg.role) {
          const roleUsers = await db.user.findMany({ where: { role: cfg.role, active: true }, select: { id: true } })
          await Promise.all(roleUsers.map((u) => grantDocumentPermission(approval.documentId, u.id, permission, user.id)))
        }
      } catch { /* ignore */ }
      await db.documentApprovalStep.update({ where: { id: gaStep.id }, data: { status: 'APPROVED', decidedAt: new Date() } })
      autoExecutedIds.add(gaStep.id)
    }

    let targetOrder: number | null = null
    let backwardJumpOrders: number[] = []

    let stepsAfter = approval.steps
      .filter((s) => s.order > step.order && s.status === 'PENDING')
      .sort((a, b) => a.order - b.order)

    while (stepsAfter.length > 0 && (stepsAfter[0].stepType === 'STATUS_CHANGE' || stepsAfter[0].stepType === 'GRANT_ACCESS' || stepsAfter[0].stepType === 'NOTIFICATION')) {
      if (stepsAfter[0].stepType === 'GRANT_ACCESS') await executeGrantAccess(stepsAfter[0])
      else if (stepsAfter[0].stepType === 'NOTIFICATION') await executeNotification(stepsAfter[0])
      else await executeStatusChange(stepsAfter[0])
      stepsAfter = stepsAfter.slice(1)
    }

    if (stepsAfter.length > 0 && stepsAfter[0].stepType === 'CONDITION') {
      const condStep = stepsAfter[0]
      let condResult: boolean | null = null
      let jumpToOrder: number | null = null

      if (condStep.conditionConfig) {
        try {
          const cfg = JSON.parse(condStep.conditionConfig) as {
            conditionSource: string
            checkValue?: string | null
            trueJumpToOrder?: number | null
            falseJumpToOrder?: number | null
          }
          if (cfg.conditionSource === 'last_decision') condResult = 'APPROVED' === cfg.checkValue
          if (condResult === null) condResult = false
          jumpToOrder = condResult ? (cfg.trueJumpToOrder ?? null) : (cfg.falseJumpToOrder ?? null)
        } catch { /* ignore */ }
      }

      await db.documentApprovalStep.update({ where: { id: condStep.id }, data: { status: 'APPROVED', decidedAt: new Date() } })
      autoExecutedIds.add(condStep.id)

      if (jumpToOrder !== null) {
        if (jumpToOrder <= condStep.order) {
          const toReset = approval.steps.filter((s) => s.order >= jumpToOrder! && s.order <= condStep.order)
          if (toReset.length > 0) {
            await db.documentApprovalStep.updateMany({ where: { id: { in: toReset.map((s) => s.id) } }, data: { isActive: false } as any })
            await Promise.all(toReset.map((s) =>
              db.documentApprovalStep.create({
                data: {
                  approvalId, order: s.order, name: s.name, stepType: s.stepType,
                  conditionConfig: s.conditionConfig, slaConfig: s.slaConfig,
                  userId: s.userId, departmentId: s.departmentId,
                  status: 'PENDING', iteration: ((s as any).iteration ?? 1) + 1,
                  isActive: true, sendEmail: (s as any).sendEmail ?? true,
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

    while (targetOrder !== null) {
      const tStep = approval.steps.find((s) => s.order === targetOrder && !autoExecutedIds.has(s.id) && s.status === 'PENDING')
      if (!tStep || (tStep.stepType !== 'STATUS_CHANGE' && tStep.stepType !== 'GRANT_ACCESS' && tStep.stepType !== 'NOTIFICATION')) break
      if (tStep.stepType === 'GRANT_ACCESS') await executeGrantAccess(tStep)
      else if (tStep.stepType === 'NOTIFICATION') await executeNotification(tStep)
      else await executeStatusChange(tStep)
      const next = approval.steps
        .filter((s) => s.order > tStep.order && s.status === 'PENDING' && !autoExecutedIds.has(s.id))
        .sort((a, b) => a.order - b.order)[0]
      targetOrder = next?.order ?? null
    }

    if (targetOrder !== null) {
      const targetStep = approval.steps.find((s) => s.order === targetOrder)
      if (targetStep && (targetStep.stepType === 'APPROVAL' || targetStep.stepType === 'SIGNATURE' || targetStep.stepType === 'PAPER_SIGNATURE')) {
        const nextStepDbId = backwardJumpOrders.includes(targetOrder)
          ? (await db.documentApprovalStep.findFirst({ where: { approvalId, order: targetOrder, isActive: true } as any, select: { id: true } }))?.id ?? targetStep.id
          : targetStep.id

        let effectiveUserId = targetStep.userId ?? null
        if (effectiveUserId) {
          const resolvedId = await resolveEffectiveUserId(effectiveUserId)
          if (resolvedId !== effectiveUserId) {
            effectiveUserId = resolvedId
            await db.documentApprovalStep.update({ where: { id: nextStepDbId }, data: { userId: effectiveUserId } })
          }
        }

        await grantStepPermissions(approval.documentId, user.id, { userId: effectiveUserId, departmentId: targetStep.departmentId })
        const notifyTitle = targetStep.stepType === 'SIGNATURE'
          ? `Документ «${approval.document.title}» ожидает вашей подписи ЭЦП (шаг: ${targetStep.name})`
          : targetStep.stepType === 'PAPER_SIGNATURE'
          ? `Документ «${approval.document.title}» ожидает вашей подписи на бумаге (шаг: ${targetStep.name})`
          : `Документ «${approval.document.title}» ожидает вашего согласования (шаг: ${targetStep.name})`
        await notifyStepAssignees(
          { userId: effectiveUserId, departmentId: targetStep.departmentId },
          { type: 'APPROVAL_REQUEST', title: notifyTitle, entityType: 'DOCUMENT', entityId: approval.documentId },
        )

        let nextDueAt: Date | null = null
        if (targetStep.slaConfig) {
          const settingRows = await db.systemSettings.findMany()
          const settings: Record<string, string> = {}
          for (const row of settingRows) settings[row.key] = row.value
          nextDueAt = computeStepDueAt((approval as any).document?.urgency ?? 'MEDIUM', targetStep.slaConfig, settings)
          if (nextDueAt) await db.documentApprovalStep.update({ where: { id: nextStepDbId }, data: { dueAt: nextDueAt } })
        }

        if ((targetStep as any).sendEmail ?? true) {
          sendApprovalEmail({
            documentId: approval.documentId, documentTitle: approval.document.title,
            documentNumber: (approval.document as any).number ?? null,
            documentData: (approval.document as any).data ?? '{}',
            documentTypeId: (approval.document as any).typeId,
            stepId: nextStepDbId, stepName: targetStep.name, dueAt: nextDueAt,
            assigneeUserId: effectiveUserId, assigneeDepId: targetStep.departmentId ?? null,
            prevDeciderName: user.name, prevComment: signedComment,
          }).catch((e) => console.error('sendApprovalEmail error:', e))
        }
      }
    }

    // Check completion
    const freshSteps = await db.documentApprovalStep.findMany({
      where: { approvalId, isActive: true } as any,
      select: { id: true, status: true, stepType: true },
    })
    const stillPending = freshSteps.filter(
      (s) => s.status === 'PENDING' && (s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE' || s.stepType === 'PAPER_SIGNATURE'),
    )

    logActivity({
      userId: user.id,
      action: 'APPROVAL_STEP_SIGNED',
      entityType: 'DOCUMENT',
      entityId: approval.documentId,
      details: signedComment,
    })
    if (approval.document.createdById !== user.id) {
      await notifyUsers([approval.document.createdById], {
        type: 'APPROVAL_APPROVED',
        title: `Шаг «${step.name}» подписан на бумаге — документ «${approval.document.title}»`,
        entityType: 'DOCUMENT',
        entityId: approval.documentId,
      })
    }

    if (stillPending.length === 0) {
      await db.documentApproval.update({ where: { id: approvalId }, data: { status: 'APPROVED' } })
      if (!statusChangedByStep) {
        let hasEndStep = false
        if (approval.process?.steps) {
          try {
            const ps: { type: string }[] = JSON.parse(approval.process.steps)
            hasEndStep = ps.some((s) => s.type === 'END')
          } catch { /* ignore */ }
        }
        await db.document.update({ where: { id: approval.documentId }, data: { status: hasEndStep ? 'COMPLETED' : 'APPROVED' } })
      }
      logActivity({
        userId: user.id,
        action: 'APPROVAL_COMPLETED',
        entityType: 'DOCUMENT',
        entityId: approval.documentId,
        details: 'Согласование завершено',
      })
    }

    const updated = await db.documentApproval.findUnique({
      where: { id: approvalId },
      select: {
        id: true, documentId: true, routeId: true,
        route: { select: { id: true, name: true } },
        status: true, createdById: true,
        createdBy: { select: { id: true, name: true } },
        createdAt: true, updatedAt: true,
        steps: {
          where: { isActive: true } as any,
          orderBy: { order: 'asc' },
          select: {
            id: true, approvalId: true, order: true, name: true, stepType: true,
            conditionConfig: true, slaConfig: true, dueAt: true,
            userId: true, user: { select: { id: true, name: true } },
            departmentId: true, department: { select: { id: true, name: true } },
            status: true, iteration: true,
            decidedById: true, decidedBy: { select: { id: true, name: true } },
            comment: true, decidedAt: true, createdAt: true,
            decisions: {
              orderBy: { createdAt: 'asc' as const },
              select: {
                id: true, stepId: true, decision: true, comment: true,
                decidedById: true, decidedBy: { select: { id: true, name: true } },
                createdAt: true,
              },
            },
            signature: {
              select: {
                id: true, stepId: true, documentId: true, signerUserId: true,
                thumbprint: true, issuer: true, subject: true, signedAt: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ approval: updated })
  } catch (e) {
    console.error('paper-sign route error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
