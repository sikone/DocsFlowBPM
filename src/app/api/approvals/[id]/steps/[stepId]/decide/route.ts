import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { grantStepPermissions } from '@/lib/doc-permissions'
import { logActivity } from '@/lib/activity-log'
import { computeStepDueAt } from '@/lib/sla'

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
        steps: { orderBy: { order: 'asc' }, select: {
          id: true, order: true, name: true, stepType: true,
          conditionConfig: true, slaConfig: true, userId: true, departmentId: true, status: true,
        }},
        process: true,
        document: { select: { urgency: true } },
      },
    })
    if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    if (approval.status !== 'IN_PROGRESS')
      return NextResponse.json({ error: 'Approval is already completed' }, { status: 400 })

    const step = approval.steps.find((s) => s.id === stepId)
    if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    if (step.status !== 'PENDING')
      return NextResponse.json({ error: 'Step is already decided' }, { status: 400 })
    if (step.stepType === 'CONDITION')
      return NextResponse.json({ error: 'CONDITION steps are auto-evaluated' }, { status: 400 })

    // Sequential enforcement: only the first PENDING APPROVAL step can be decided
    const firstPendingApproval = approval.steps
      .filter((s) => s.status === 'PENDING' && s.stepType === 'APPROVAL')
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
      // Reject the whole approval — mark all remaining PENDING steps as SKIPPED
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

      let targetOrder: number | null = null

      // Wave 1: get pending steps after the decided step; auto-execute leading STATUS_CHANGE steps
      let stepsAfter = approval.steps
        .filter((s) => s.order > step.order && s.status === 'PENDING')
        .sort((a, b) => a.order - b.order)

      while (stepsAfter.length > 0 && stepsAfter[0].stepType === 'STATUS_CHANGE') {
        await executeStatusChange(stepsAfter[0])
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
            // Backward jump: reset condition step and steps from target back to PENDING
            const toReset = approval.steps.filter(
              (s) => s.order >= jumpToOrder! && s.order <= condStep.order,
            )
            if (toReset.length > 0) {
              await db.documentApprovalStep.updateMany({
                where: { id: { in: toReset.map((s) => s.id) } },
                data: { status: 'PENDING', decidedById: null, comment: null, decidedAt: null },
              })
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

      // Wave 2: auto-execute STATUS_CHANGE steps at the jump target (e.g., after a CONDITION branch)
      while (targetOrder !== null) {
        const tStep = approval.steps.find(
          (s) => s.order === targetOrder && !autoExecutedIds.has(s.id) && s.status === 'PENDING',
        )
        if (!tStep || tStep.stepType !== 'STATUS_CHANGE') break
        await executeStatusChange(tStep)
        // Advance to next pending step
        const next = approval.steps
          .filter((s) => s.order > tStep.order && s.status === 'PENDING' && !autoExecutedIds.has(s.id))
          .sort((a, b) => a.order - b.order)[0]
        targetOrder = next?.order ?? null
      }

      // Grant permissions and compute dueAt for the next APPROVAL step
      if (targetOrder !== null) {
        const targetStep = approval.steps.find((s) => s.order === targetOrder)
        if (targetStep && targetStep.stepType === 'APPROVAL') {
          await grantStepPermissions(approval.documentId, user.id, {
            userId: targetStep.userId,
            departmentId: targetStep.departmentId,
          })

          // Compute dueAt if the step has an SLA config
          if (targetStep.slaConfig) {
            const settingRows = await db.systemSettings.findMany()
            const settings: Record<string, string> = {}
            for (const row of settingRows) settings[row.key] = row.value
            const urgency = (approval as any).document?.urgency ?? 'MEDIUM'
            const dueAt = computeStepDueAt(urgency, targetStep.slaConfig, settings)
            if (dueAt) {
              await db.documentApprovalStep.update({
                where: { id: targetStep.id },
                data: { dueAt },
              })
            }
          }
        }
      }

      // Re-fetch latest step statuses to check completion
      const freshSteps = await db.documentApprovalStep.findMany({
        where: { approvalId },
        select: { id: true, status: true, stepType: true },
      })
      const stillPending = freshSteps.filter(
        (s) => s.status === 'PENDING' && s.stepType === 'APPROVAL',
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

    // Re-fetch updated approval
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
