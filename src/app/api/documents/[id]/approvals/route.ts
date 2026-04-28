import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, extractToken } from '@/lib/auth'
import { grantStepPermissions, grantDocumentPermission } from '@/lib/doc-permissions'
import { logActivity } from '@/lib/activity-log'
import { computeStepDueAt } from '@/lib/sla'
import { notifyStepAssignees } from '@/lib/notifications'
import { sendApprovalEmail } from '@/lib/mailer'
import { resolveEffectiveUserId } from '@/lib/approval-utils'

async function applyGrantAccess(
  documentId: string,
  grantedById: string,
  cfg: { grantType?: string; userId?: string; departmentId?: string; role?: string; permission?: string },
) {
  const permission = (cfg.permission === 'EDIT' ? 'EDIT' : 'VIEW') as 'VIEW' | 'EDIT'
  if (cfg.grantType === 'user' && cfg.userId) {
    await grantDocumentPermission(documentId, cfg.userId, permission, grantedById)
  } else if (cfg.grantType === 'department' && cfg.departmentId) {
    const users = await db.user.findMany({
      where: { departmentId: cfg.departmentId, active: true },
      select: { id: true },
    })
    await Promise.all(users.map((u) => grantDocumentPermission(documentId, u.id, permission, grantedById)))
  } else if (cfg.grantType === 'role' && cfg.role) {
    const users = await db.user.findMany({
      where: { role: cfg.role, active: true },
      select: { id: true },
    })
    await Promise.all(users.map((u) => grantDocumentPermission(documentId, u.id, permission, grantedById)))
  }
}

const approvalSelect = {
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
    orderBy: { order: 'asc' as const },
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
      sendEmail: true,
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
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId } = await params

    const [approvals, allStepDecisions] = await Promise.all([
      db.documentApproval.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        select: approvalSelect,
      }),
      db.approvalStepDecision.findMany({
        where: { step: { approval: { documentId } } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          decision: true,
          comment: true,
          createdAt: true,
          decidedBy: { select: { id: true, name: true } },
          step: { select: { name: true } },
        },
      }),
    ])

    return NextResponse.json({ approvals, allStepDecisions })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = extractToken(request)
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 })

    const user = await getAuthUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

    const { id: documentId } = await params

    const doc = await db.document.findUnique({ where: { id: documentId } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Reject if there's already an active approval
    const active = await db.documentApproval.findFirst({
      where: { documentId, status: 'IN_PROGRESS' },
    })
    if (active)
      return NextResponse.json({ error: 'Документ уже находится на согласовании' }, { status: 400 })

    const body = await request.json()
    const { processId, routeId, steps } = body

    type ResolvedStep = {
      name: string
      stepType: 'APPROVAL' | 'CONDITION' | 'STATUS_CHANGE' | 'GRANT_ACCESS' | 'NOTIFICATION' | 'SIGNATURE'
      userId?: string | null
      departmentId?: string | null
      conditionConfig?: string | null
      slaConfig?: string | null
      sendEmail?: boolean
    }

    let resolvedSteps: ResolvedStep[] = []
    let resolvedRouteId: string | null = routeId || null

    if (processId) {
      const process = await db.processDefinition.findUnique({ where: { id: processId } })
      if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 })
      try {
        const allSteps: any[] = JSON.parse(process.steps)
        // Include APPROVAL, CONDITION, STATUS_CHANGE, GRANT_ACCESS, NOTIFICATION, SIGNATURE steps (exclude START, END)
        const meaningful = allSteps.filter((s: any) => s.type === 'APPROVAL' || s.type === 'CONDITION' || s.type === 'STATUS_CHANGE' || s.type === 'GRANT_ACCESS' || s.type === 'NOTIFICATION' || s.type === 'SIGNATURE')
        // Build a map from process step id → resolved order index
        const stepIdToOrder = new Map<string, number>(meaningful.map((s: any, i: number) => [s.id, i]))

        resolvedSteps = meaningful.map((s: any) => {
          if (s.type === 'STATUS_CHANGE') {
            return {
              name: s.name,
              stepType: 'STATUS_CHANGE' as const,
              conditionConfig: s.targetStatus
                ? JSON.stringify({ targetStatus: s.targetStatus })
                : null,
            }
          }
          if (s.type === 'GRANT_ACCESS') {
            return {
              name: s.name,
              stepType: 'GRANT_ACCESS' as const,
              conditionConfig: s.grantAccessConfig
                ? JSON.stringify(s.grantAccessConfig)
                : null,
            }
          }
          if (s.type === 'CONDITION') {
            const cond = s.condition as {
              conditionSource?: string
              checkValue?: string
              fieldSystemName?: string
              operator?: string
              value?: string
              trueStepId?: string
              falseStepId?: string
            } | undefined
            const config = cond ? {
              conditionSource: cond.conditionSource || 'document_field',
              checkValue: cond.checkValue || null,
              fieldSystemName: cond.fieldSystemName || null,
              operator: cond.operator || null,
              value: cond.value || null,
              trueJumpToOrder: cond.trueStepId ? (stepIdToOrder.get(cond.trueStepId) ?? null) : null,
              falseJumpToOrder: cond.falseStepId ? (stepIdToOrder.get(cond.falseStepId) ?? null) : null,
            } : null
            return {
              name: s.name,
              stepType: 'CONDITION' as const,
              conditionConfig: config ? JSON.stringify(config) : null,
            }
          }
          if (s.type === 'NOTIFICATION') {
            return {
              name: s.name,
              stepType: 'NOTIFICATION' as const,
              userId: s.assigneeType === 'initiator' ? doc.createdById : (s.userId || null),
              departmentId: s.departmentId || null,
              sendEmail: (s as any).sendEmail ?? true,
            }
          }
          if (s.type === 'SIGNATURE') {
            return {
              name: s.name,
              stepType: 'SIGNATURE' as const,
              userId: s.assigneeType === 'initiator' ? doc.createdById : (s.userId || null),
              departmentId: s.departmentId || null,
              slaConfig: (s as any).slaConfig ?? null,
              sendEmail: (s as any).sendEmail ?? true,
            }
          }
          return {
            name: s.name,
            stepType: 'APPROVAL' as const,
            userId: s.assigneeType === 'initiator' ? doc.createdById : (s.userId || null),
            departmentId: s.departmentId || null,
            slaConfig: (s as any).slaConfig ?? null,
            sendEmail: (s as any).sendEmail ?? true,
          }
        })
      } catch {
        return NextResponse.json({ error: 'Invalid process steps' }, { status: 400 })
      }
    } else if (routeId) {
      const route = await db.approvalRoute.findUnique({
        where: { id: routeId },
        include: { steps: { orderBy: { order: 'asc' } } },
      })
      if (!route) return NextResponse.json({ error: 'Route not found' }, { status: 404 })
      resolvedSteps = route.steps.map((s) => ({
        name: s.name,
        stepType: 'APPROVAL' as const,
        userId: s.userId,
        departmentId: s.departmentId,
        slaConfig: (s as any).slaConfig ?? null,
        sendEmail: (s as any).sendEmail ?? true,
      }))
    } else if (Array.isArray(steps) && steps.length > 0) {
      resolvedSteps = steps
      resolvedRouteId = null
    } else {
      return NextResponse.json({ error: 'processId, routeId or steps required' }, { status: 400 })
    }

    if (resolvedSteps.length === 0)
      return NextResponse.json({ error: 'At least one step is required' }, { status: 400 })

    // Load system settings for SLA deadline calculation
    const settingRows = await db.systemSettings.findMany()
    const settings: Record<string, string> = {}
    for (const row of settingRows) settings[row.key] = row.value

    const now = new Date()
    const firstHumanIdx = resolvedSteps.findIndex((s) => s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE')

    const approval = await db.documentApproval.create({
      data: {
        documentId,
        routeId: resolvedRouteId,
        processId: processId || null,
        status: 'IN_PROGRESS',
        createdById: user.id,
        steps: {
          create: resolvedSteps.map((s, i) => {
            const isFirstApproval = i === firstHumanIdx && (s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE')
            const dueAt = isFirstApproval
              ? computeStepDueAt(doc.urgency ?? 'MEDIUM', s.slaConfig ?? null, settings, now)
              : null
            return {
              order: i,
              name: s.name,
              stepType: s.stepType,
              conditionConfig: s.conditionConfig || null,
              slaConfig: s.slaConfig || null,
              dueAt,
              userId: s.userId || null,
              departmentId: s.departmentId || null,
              status: 'PENDING',
              sendEmail: s.sendEmail ?? true,
            }
          }),
        },
      },
      select: approvalSelect,
    })

    // Auto-execute STATUS_CHANGE and GRANT_ACCESS steps that precede the first human step
    let docStatus = 'IN_PROGRESS'
    const VALID_DOC_STATUSES = ['IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED']
    for (const createdStep of approval.steps) {
      if (createdStep.stepType === 'APPROVAL' || createdStep.stepType === 'CONDITION' || createdStep.stepType === 'SIGNATURE') break
      if (createdStep.stepType === 'STATUS_CHANGE') {
        try {
          const cfg = JSON.parse((createdStep as any).conditionConfig || '{}')
          if (cfg.targetStatus && VALID_DOC_STATUSES.includes(cfg.targetStatus)) {
            docStatus = cfg.targetStatus
          }
        } catch { /* ignore */ }
        await db.documentApprovalStep.update({
          where: { id: createdStep.id },
          data: { status: 'APPROVED', decidedAt: now },
        })
      } else if (createdStep.stepType === 'GRANT_ACCESS') {
        try {
          const cfg = JSON.parse((createdStep as any).conditionConfig || '{}')
          await applyGrantAccess(documentId, user.id, cfg)
        } catch { /* ignore */ }
        await db.documentApprovalStep.update({
          where: { id: createdStep.id },
          data: { status: 'APPROVED', decidedAt: now },
        })
      } else if (createdStep.stepType === 'NOTIFICATION') {
        try {
          await notifyStepAssignees(
            { userId: (createdStep as any).userId ?? null, departmentId: (createdStep as any).departmentId ?? null },
            {
              type: 'NOTIFICATION',
              title: `Уведомление по документу «${doc.title}»`,
              entityType: 'DOCUMENT',
              entityId: documentId,
            },
          )
          if ((createdStep as any).sendEmail ?? true) {
            sendApprovalEmail({
              documentId,
              documentTitle: doc.title,
              documentNumber: doc.number ?? null,
              documentData: doc.data,
              documentTypeId: doc.typeId,
              stepId: null,
              stepName: createdStep.name,
              dueAt: null,
              assigneeUserId: (createdStep as any).userId ?? null,
              assigneeDepId: (createdStep as any).departmentId ?? null,
            }).catch((e) => console.error('sendNotificationEmail error:', e))
          }
        } catch { /* ignore */ }
        await db.documentApprovalStep.update({
          where: { id: createdStep.id },
          data: { status: 'APPROVED', decidedAt: now },
        })
      }
    }

    // Update document status (IN_PROGRESS by default, or overridden by leading STATUS_CHANGE)
    await db.document.update({
      where: { id: documentId },
      data: { status: docStatus },
    })

    // Grant VIEW and notify the first human step (APPROVAL or SIGNATURE)
    const firstHumanStep = resolvedSteps.find((s) => s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE')
    if (firstHumanStep) {
      const firstHumanStepIdx = resolvedSteps.indexOf(firstHumanStep)
      const createdStep = approval.steps.find((s) => s.order === firstHumanStepIdx)

      let effectiveUserId = firstHumanStep.userId ?? null
      if (effectiveUserId) {
        const resolvedId = await resolveEffectiveUserId(effectiveUserId)
        if (resolvedId !== effectiveUserId) {
          effectiveUserId = resolvedId
          if (createdStep) {
            await db.documentApprovalStep.update({
              where: { id: createdStep.id },
              data: { userId: effectiveUserId },
            })
          }
        }
      }

      await grantStepPermissions(documentId, user.id, {
        userId: effectiveUserId,
        departmentId: firstHumanStep.departmentId ?? null,
      })
      const notifyTitle = firstHumanStep.stepType === 'SIGNATURE'
        ? `Документ «${doc.title}» ожидает вашей подписи`
        : `Документ «${doc.title}» ожидает вашего согласования`
      await notifyStepAssignees(
        { userId: effectiveUserId, departmentId: firstHumanStep.departmentId ?? null },
        {
          type: 'APPROVAL_REQUEST',
          title: notifyTitle,
          entityType: 'DOCUMENT',
          entityId: documentId,
        },
      )
      if (firstHumanStep.sendEmail ?? true) {
        sendApprovalEmail({
          documentId,
          documentTitle: doc.title,
          documentNumber: doc.number ?? null,
          documentData: doc.data,
          documentTypeId: doc.typeId,
          stepId: createdStep?.id ?? null,
          stepName: firstHumanStep.name,
          dueAt: (createdStep as any)?.dueAt ?? null,
          assigneeUserId: effectiveUserId,
          assigneeDepId: firstHumanStep.departmentId ?? null,
        }).catch((e) => console.error('sendApprovalEmail error:', e))
      }
    }

    logActivity({
      userId: user.id,
      action: 'APPROVAL_STARTED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      details: `Отправлен на согласование`,
    })

    return NextResponse.json({ approval }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
