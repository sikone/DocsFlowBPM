import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { grantStepPermissions, grantDocumentPermission } from '@/lib/doc-permissions'
import { logActivity } from '@/lib/activity-log'
import { computeStepDueAt } from '@/lib/sla'
import { notifyStepAssignees, notifyUsers } from '@/lib/notifications'
import { sendApprovalEmail, sendCustomStepEmail } from '@/lib/mailer'
import { resolveEffectiveUserId } from '@/lib/approval-utils'

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
    const body = await request.json()
    const { decision, comment } = body // decision: 'APPROVED' | 'APPROVED_WITH_CHANGES' | 'REJECTED'

    if (!['APPROVED', 'APPROVED_WITH_CHANGES', 'REJECTED'].includes(decision))
      return NextResponse.json({ error: 'decision must be APPROVED, APPROVED_WITH_CHANGES or REJECTED' }, { status: 400 })

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
    if (step.stepType === 'CONDITION' || step.stepType === 'GRANT_ACCESS')
      return NextResponse.json({ error: 'Этот шаг выполняется автоматически' }, { status: 400 })
    if (step.stepType === 'SIGNATURE')
      return NextResponse.json({ error: 'Шаг подписания выполняется через /sign' }, { status: 400 })
    if (step.stepType === 'PAPER_SIGNATURE')
      return NextResponse.json({ error: 'Шаг подписания на бумаге выполняется через /paper-sign' }, { status: 400 })

    // Sequential enforcement: first PENDING human step (APPROVAL or SIGNATURE) must be this one
    const firstPendingApproval = approval.steps
      .filter((s) => s.status === 'PENDING' && (s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE' || s.stepType === 'PAPER_SIGNATURE'))
      .sort((a, b) => a.order - b.order)[0]
    if (firstPendingApproval?.id !== stepId)
      return NextResponse.json({ error: 'Этот шаг ещё не активен — дождитесь завершения предыдущих шагов' }, { status: 400 })

    // Check that this user can decide: either directly assigned or in the assigned department
    let canDecide = false
    if (step.userId) {
      canDecide = step.userId === user.id
    } else if (step.departmentId) {
      canDecide = user.departmentId === step.departmentId
    }
    if (['ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT'].includes(user.role)) canDecide = true

    if (!canDecide)
      return NextResponse.json({ error: 'Нет прав для принятия решения по этому шагу' }, { status: 403 })

    // Update the step
    await db.documentApprovalStep.update({
      where: { id: stepId },
      data: {
        status: decision,
        decidedById: user.id,
        comment: comment?.trim() || null,
        decidedAt: new Date(),
      },
    })

    // Persist decision history (immutable — survives step resets)
    await db.approvalStepDecision.create({
      data: {
        stepId,
        decision,
        comment: comment?.trim() || null,
        decidedById: user.id,
      },
    })

    if (decision === 'REJECTED') {
      // Reject the whole approval — mark all remaining active PENDING steps as SKIPPED
      const pendingIds = approval.steps
        .filter((s) => s.id !== stepId && s.status === 'PENDING')
        .map((s) => s.id)
      if (pendingIds.length > 0) {
        await db.documentApprovalStep.updateMany({
          where: { id: { in: pendingIds } },
          data: { status: 'SKIPPED' },
        })
      }
      await db.documentApproval.update({ where: { id: approvalId }, data: { status: 'REJECTED' } })
      await db.document.update({ where: { id: approval.documentId }, data: { status: 'REJECTED' } })
      logActivity({
        userId: user.id,
        action: 'APPROVAL_STEP_REJECTED',
        entityType: 'DOCUMENT',
        entityId: approval.documentId,
        details: `Шаг «${step.name}» отклонён${comment?.trim() ? `: ${comment.trim()}` : ''}`,
      })
      if (approval.document.createdById !== user.id) {
        await notifyUsers([approval.document.createdById], {
          type: 'APPROVAL_REJECTED',
          title: `Шаг «${step.name}» отклонён — документ «${approval.document.title}»`,
          entityType: 'DOCUMENT',
          entityId: approval.documentId,
        })
      }
    } else {
      // APPROVED or APPROVED_WITH_CHANGES
      const VALID_DOC_STATUSES = ['IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED']
      let statusChangedByStep = false
      const autoExecutedIds = new Set<string>()

      // Helper: auto-execute a STATUS_CHANGE step
      const executeStatusChange = async (scStep: typeof approval.steps[0]) => {
        try {
          const cfg = JSON.parse((scStep as any).conditionConfig || '{}')
          if (cfg.targetStatus && VALID_DOC_STATUSES.includes(cfg.targetStatus)) {
            await db.document.update({
              where: { id: approval.documentId },
              data: { status: cfg.targetStatus },
            })
            statusChangedByStep = true
          }
        } catch { /* ignore malformed config */ }
        await db.documentApprovalStep.update({
          where: { id: scStep.id },
          data: { status: 'APPROVED', decidedAt: new Date() },
        })
        autoExecutedIds.add(scStep.id)
      }

      // Helper: auto-execute a NOTIFICATION step
      const executeNotification = async (notStep: typeof approval.steps[0]) => {
        try {
          await notifyStepAssignees(
            { userId: notStep.userId ?? null, departmentId: notStep.departmentId ?? null },
            {
              type: 'NOTIFICATION',
              title: `Уведомление по документу «${approval.document.title}»`,
              entityType: 'DOCUMENT',
              entityId: approval.documentId,
            },
          )
          if ((notStep as any).sendEmail ?? true) {
            sendApprovalEmail({
              documentId: approval.documentId,
              documentTitle: approval.document.title,
              documentNumber: (approval.document as any).number ?? null,
              documentData: (approval.document as any).data ?? '{}',
              documentTypeId: (approval.document as any).typeId,
              stepId: null,
              stepName: notStep.name,
              dueAt: null,
              assigneeUserId: notStep.userId ?? null,
              assigneeDepId: notStep.departmentId ?? null,
              prevDeciderName: user.name,
              prevComment: comment?.trim() || null,
            }).catch((e) => console.error('sendNotificationEmail error:', e))
          }
        } catch { /* ignore */ }
        await db.documentApprovalStep.update({
          where: { id: notStep.id },
          data: { status: 'APPROVED', decidedAt: new Date() },
        })
        autoExecutedIds.add(notStep.id)
      }

      // Helper: auto-execute a SEND_EMAIL step
      const executeSendEmail = async (seStep: typeof approval.steps[0]) => {
        try {
          const emailCfg = JSON.parse((seStep as any).conditionConfig || '{}')
          sendCustomStepEmail({
            documentId: approval.documentId,
            documentTitle: approval.document.title,
            documentNumber: (approval.document as any).number ?? null,
            documentData: (approval.document as any).data ?? '{}',
            documentTypeId: (approval.document as any).typeId,
            stepName: seStep.name,
            emailConfig: emailCfg,
          }).catch((e) => console.error('sendCustomStepEmail error:', e))
        } catch { /* ignore */ }
        await db.documentApprovalStep.update({
          where: { id: seStep.id },
          data: { status: 'APPROVED', decidedAt: new Date() },
        })
        autoExecutedIds.add(seStep.id)
      }

      // Helper: auto-execute a GRANT_ACCESS step
      const executeGrantAccess = async (gaStep: typeof approval.steps[0]) => {
        try {
          const cfg = JSON.parse((gaStep as any).conditionConfig || '{}')
          const permission = (cfg.permission === 'EDIT' ? 'EDIT' : 'VIEW') as 'VIEW' | 'EDIT'
          if (cfg.grantType === 'user' && cfg.userId) {
            await grantDocumentPermission(approval.documentId, cfg.userId, permission, user.id)
          } else if (cfg.grantType === 'department' && cfg.departmentId) {
            const deptUsers = await db.user.findMany({
              where: { departmentId: cfg.departmentId, active: true },
              select: { id: true },
            })
            await Promise.all(deptUsers.map((u) => grantDocumentPermission(approval.documentId, u.id, permission, user.id)))
          } else if (cfg.grantType === 'role' && cfg.role) {
            const roleUsers = await db.user.findMany({
              where: { role: cfg.role, active: true },
              select: { id: true },
            })
            await Promise.all(roleUsers.map((u) => grantDocumentPermission(approval.documentId, u.id, permission, user.id)))
          }
        } catch { /* ignore malformed config */ }
        await db.documentApprovalStep.update({
          where: { id: gaStep.id },
          data: { status: 'APPROVED', decidedAt: new Date() },
        })
        autoExecutedIds.add(gaStep.id)
      }

      let targetOrder: number | null = null
      // Track which orders were reset via backward jump (to look up new step IDs for dueAt)
      let backwardJumpOrders: number[] = []

      // Wave 1: get pending steps after the decided step; auto-execute leading STATUS_CHANGE steps
      let stepsAfter = approval.steps
        .filter((s) => s.order > step.order && s.status === 'PENDING')
        .sort((a, b) => a.order - b.order)

      while (stepsAfter.length > 0 && (stepsAfter[0].stepType === 'STATUS_CHANGE' || stepsAfter[0].stepType === 'GRANT_ACCESS' || stepsAfter[0].stepType === 'NOTIFICATION' || stepsAfter[0].stepType === 'SEND_EMAIL')) {
        if (stepsAfter[0].stepType === 'GRANT_ACCESS') {
          await executeGrantAccess(stepsAfter[0])
        } else if (stepsAfter[0].stepType === 'NOTIFICATION') {
          await executeNotification(stepsAfter[0])
        } else if (stepsAfter[0].stepType === 'SEND_EMAIL') {
          await executeSendEmail(stepsAfter[0])
        } else {
          await executeStatusChange(stepsAfter[0])
        }
        stepsAfter = stepsAfter.slice(1)
      }

      // Handle CONDITION step (existing logic, operating on updated stepsAfter)
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

            if (cfg.conditionSource === 'last_decision') {
              condResult = decision === cfg.checkValue
            }
            // document_field conditions: treated as FALSE (requires doc data parsing)
            if (condResult === null) condResult = false

            jumpToOrder = condResult
              ? (cfg.trueJumpToOrder ?? null)
              : (cfg.falseJumpToOrder ?? null)
          } catch { /* ignore malformed config */ }
        }

        // Mark the CONDITION step as auto-approved
        await db.documentApprovalStep.update({
          where: { id: condStep.id },
          data: { status: 'APPROVED', decidedAt: new Date() },
        })
        autoExecutedIds.add(condStep.id)

        if (jumpToOrder !== null) {
          if (jumpToOrder <= condStep.order) {
            // ── Backward jump ───────────────────────────────────────────────
            // Archive the decided steps and create new iterations so that
            // the original decision data is preserved for historical reports.
            const toReset = approval.steps.filter(
              (s) => s.order >= jumpToOrder! && s.order <= condStep.order,
            )
            if (toReset.length > 0) {
              // 1. Mark old step records as inactive (preserves all decision data)
              await db.documentApprovalStep.updateMany({
                where: { id: { in: toReset.map((s) => s.id) } },
                data: { isActive: false } as any,
              })

              // 2. Create new active iterations for each step in the reset range
              await Promise.all(
                toReset.map((s) =>
                  db.documentApprovalStep.create({
                    data: {
                      approvalId,
                      order: s.order,
                      name: s.name,
                      stepType: s.stepType,
                      conditionConfig: s.conditionConfig,
                      slaConfig: s.slaConfig,
                      userId: s.userId,
                      departmentId: s.departmentId,
                      status: 'PENDING',
                      iteration: ((s as any).iteration ?? 1) + 1,
                      isActive: true,
                      sendEmail: (s as any).sendEmail ?? true,
                    } as any,
                  })
                )
              )

              backwardJumpOrders = toReset.map((s) => s.order)
            }
          } else {
            // Forward jump: mark skipped steps between condition and target
            const toSkip = approval.steps.filter(
              (s) => s.order > condStep.order && s.order < jumpToOrder! && s.status === 'PENDING',
            )
            if (toSkip.length > 0) {
              await db.documentApprovalStep.updateMany({
                where: { id: { in: toSkip.map((s) => s.id) } },
                data: { status: 'SKIPPED' },
              })
            }
          }
          targetOrder = jumpToOrder
        } else {
          targetOrder = condStep.order + 1
        }
      } else {
        targetOrder = stepsAfter.length > 0 ? stepsAfter[0].order : null
      }

      // Wave 2: auto-execute STATUS_CHANGE/GRANT_ACCESS steps at the jump target (e.g., after a CONDITION branch)
      while (targetOrder !== null) {
        const tStep = approval.steps.find(
          (s) => s.order === targetOrder && !autoExecutedIds.has(s.id) && s.status === 'PENDING',
        )
        if (!tStep || (tStep.stepType !== 'STATUS_CHANGE' && tStep.stepType !== 'GRANT_ACCESS' && tStep.stepType !== 'NOTIFICATION' && tStep.stepType !== 'SEND_EMAIL')) break
        if (tStep.stepType === 'GRANT_ACCESS') {
          await executeGrantAccess(tStep)
        } else if (tStep.stepType === 'NOTIFICATION') {
          await executeNotification(tStep)
        } else if (tStep.stepType === 'SEND_EMAIL') {
          await executeSendEmail(tStep)
        } else {
          await executeStatusChange(tStep)
        }
        // Advance to next pending step
        const next = approval.steps
          .filter((s) => s.order > tStep.order && s.status === 'PENDING' && !autoExecutedIds.has(s.id))
          .sort((a, b) => a.order - b.order)[0]
        targetOrder = next?.order ?? null
      }

      // Grant permissions and compute dueAt for the next APPROVAL step
      if (targetOrder !== null) {
        const targetStep = approval.steps.find((s) => s.order === targetOrder)
        if (targetStep && (targetStep.stepType === 'APPROVAL' || targetStep.stepType === 'SIGNATURE' || targetStep.stepType === 'PAPER_SIGNATURE')) {
          // Resolve the actual DB step ID once (new record if recreated by backward jump)
          const nextStepDbId = backwardJumpOrders.includes(targetOrder)
            ? (await db.documentApprovalStep.findFirst({
                where: { approvalId, order: targetOrder, isActive: true } as any,
                select: { id: true },
              }))?.id ?? targetStep.id
            : targetStep.id

          // Redirect to substitute if the assigned user is absent
          let effectiveUserId = targetStep.userId ?? null
          if (effectiveUserId) {
            const resolvedId = await resolveEffectiveUserId(effectiveUserId)
            if (resolvedId !== effectiveUserId) {
              effectiveUserId = resolvedId
              await db.documentApprovalStep.update({
                where: { id: nextStepDbId },
                data: { userId: effectiveUserId },
              })
            }
          }

          await grantStepPermissions(approval.documentId, user.id, {
            userId: effectiveUserId,
            departmentId: targetStep.departmentId,
          })
          const notifyTitle = targetStep.stepType === 'SIGNATURE'
            ? `Документ «${approval.document.title}» ожидает вашей подписи ЭЦП (шаг: ${targetStep.name})`
            : targetStep.stepType === 'PAPER_SIGNATURE'
            ? `Документ «${approval.document.title}» ожидает вашей подписи на бумаге (шаг: ${targetStep.name})`
            : `Документ «${approval.document.title}» ожидает вашего согласования (шаг: ${targetStep.name})`
          await notifyStepAssignees(
            { userId: effectiveUserId, departmentId: targetStep.departmentId },
            {
              type: 'APPROVAL_REQUEST',
              title: notifyTitle,
              entityType: 'DOCUMENT',
              entityId: approval.documentId,
            },
          )

          // Compute dueAt if the step has an SLA config
          let nextDueAt: Date | null = null
          if (targetStep.slaConfig) {
            const settingRows = await db.systemSettings.findMany()
            const settings: Record<string, string> = {}
            for (const row of settingRows) settings[row.key] = row.value
            const urgency = (approval as any).document?.urgency ?? 'MEDIUM'
            nextDueAt = computeStepDueAt(urgency, targetStep.slaConfig, settings)
            if (nextDueAt) {
              await db.documentApprovalStep.update({
                where: { id: nextStepDbId },
                data: { dueAt: nextDueAt },
              })
            }
          }

          // Send email notification to the next step assignee
          if ((targetStep as any).sendEmail ?? true) {
            sendApprovalEmail({
              documentId: approval.documentId,
              documentTitle: approval.document.title,
              documentNumber: (approval.document as any).number ?? null,
              documentData: (approval.document as any).data ?? '{}',
              documentTypeId: (approval.document as any).typeId,
              stepId: nextStepDbId,
              stepName: targetStep.name,
              dueAt: nextDueAt,
              assigneeUserId: effectiveUserId,
              assigneeDepId: targetStep.departmentId ?? null,
              prevDeciderName: user.name,
              prevComment: comment?.trim() || null,
            }).catch((e) => console.error('sendApprovalEmail error:', e))
          }
        }
      }

      // Re-fetch latest step statuses (active only) to check completion
      const freshSteps = await db.documentApprovalStep.findMany({
        where: { approvalId, isActive: true } as any,
        select: { id: true, status: true, stepType: true },
      })
      const stillPending = freshSteps.filter(
        (s) => s.status === 'PENDING' && (s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE' || s.stepType === 'PAPER_SIGNATURE'),
      )
      const decisionLabel =
        decision === 'APPROVED' ? 'Согласован' : 'Согласован с изменениями'
      logActivity({
        userId: user.id,
        action: decision === 'APPROVED' ? 'APPROVAL_STEP_APPROVED' : 'APPROVAL_STEP_APPROVED_WITH_CHANGES',
        entityType: 'DOCUMENT',
        entityId: approval.documentId,
        details: `Шаг «${step.name}» — ${decisionLabel}${comment?.trim() ? `: ${comment.trim()}` : ''}`,
      })
      if (approval.document.createdById !== user.id) {
        await notifyUsers([approval.document.createdById], {
          type: 'APPROVAL_APPROVED',
          title: `Шаг «${step.name}» ${decision === 'APPROVED' ? 'согласован' : 'согласован с изменениями'} — документ «${approval.document.title}»`,
          entityType: 'DOCUMENT',
          entityId: approval.documentId,
        })
      }

      if (stillPending.length === 0) {
        await db.documentApproval.update({ where: { id: approvalId }, data: { status: 'APPROVED' } })

        // Only auto-update document status if no STATUS_CHANGE step already set it
        if (!statusChangedByStep) {
          let hasEndStep = false
          if (approval.process?.steps) {
            try {
              const ps: { type: string }[] = JSON.parse(approval.process.steps)
              hasEndStep = ps.some((s) => s.type === 'END')
            } catch { /* ignore */ }
          }
          const finalDocStatus = hasEndStep ? 'COMPLETED' : 'APPROVED'
          await db.document.update({ where: { id: approval.documentId }, data: { status: finalDocStatus } })
        }

        logActivity({
          userId: user.id,
          action: 'APPROVAL_COMPLETED',
          entityType: 'DOCUMENT',
          entityId: approval.documentId,
          details: `Согласование завершено — документ ${statusChangedByStep ? 'обновлён шагом статуса' : 'утверждён'}`,
        })
      }
    }

    // Re-fetch updated approval — show only active steps to the UI
    const updated = await db.documentApproval.findUnique({
      where: { id: approvalId },
      select: {
        id: true,
        documentId: true,
        routeId: true,
        route: { select: { id: true, name: true } },
        status: true,
        createdById: true,
        createdBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
        steps: {
          where: { isActive: true } as any,
          orderBy: { order: 'asc' },
          select: {
            id: true,
            approvalId: true,
            order: true,
            name: true,
            stepType: true,
            conditionConfig: true,
            slaConfig: true,
            dueAt: true,
            userId: true,
            user: { select: { id: true, name: true } },
            departmentId: true,
            department: { select: { id: true, name: true } },
            status: true,
            iteration: true,
            decidedById: true,
            decidedBy: { select: { id: true, name: true } },
            comment: true,
            decidedAt: true,
            createdAt: true,
            decisions: {
              orderBy: { createdAt: 'asc' as const },
              select: {
                id: true,
                stepId: true,
                decision: true,
                comment: true,
                decidedById: true,
                decidedBy: { select: { id: true, name: true } },
                createdAt: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ approval: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
