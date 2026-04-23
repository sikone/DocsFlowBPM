'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GitMerge,
  Check,
  X,
  Loader2,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  GitBranch,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { DocumentApproval } from '@/lib/types';
import { formatCountdown } from '@/lib/sla';

// Live countdown that re-renders every minute
function StepCountdown({ dueAt }: { dueAt: string }) {
  const [result, setResult] = React.useState(() => formatCountdown(dueAt));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setResult(formatCountdown(dueAt));
    timerRef.current = setInterval(() => setResult(formatCountdown(dueAt)), 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [dueAt]);

  const colorClass =
    result.status === 'overdue'  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' :
    result.status === 'warning'  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' :
                                   'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${colorClass}`}>
      <Clock className="w-2.5 h-2.5" />
      {result.text}
    </span>
  );
}

interface ProcessDefinition {
  id: string;
  name: string;
  status: string;
  steps: string; // JSON
  documentTypes: { id: string; name: string; systemName: string }[];
}

interface ProcessStep {
  id: string;
  name: string;
  type: 'START' | 'APPROVAL' | 'NOTIFICATION' | 'CONDITION';
  assigneeType?: 'role' | 'user' | 'department';
  userId?: string | null;
  departmentId?: string | null;
  assigneeRole: string;
}

interface Props {
  documentId: string;
  documentTypeId: string;
  documentStatus?: string;
  token: string;
  currentUserId: string;
  currentUserRole: string;
  currentUserDepartmentId?: string | null;
  onApprovalChange?: () => void;
  onUserPendingStep?: (step: { approvalId: string; stepId: string; stepName: string } | null) => void;
  onSendReady?: (sendFn: (() => void) | null) => void;
}

function stepStatusIcon(status: string, stepType?: string) {
  if (stepType === 'CONDITION') return <GitBranch className="w-4 h-4 text-violet-500 shrink-0" />;
  switch (status) {
    case 'APPROVED':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case 'APPROVED_WITH_CHANGES':
      return <Pencil className="w-4 h-4 text-amber-500 shrink-0" />;
    case 'REJECTED':
      return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
    case 'SKIPPED':
      return <MinusCircle className="w-4 h-4 text-slate-400 shrink-0" />;
    default:
      return <Clock className="w-4 h-4 text-amber-400 shrink-0" />;
  }
}

function approvalStatusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">Согласован</Badge>;
    case 'REJECTED':
      return <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400">Отклонён</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">На согласовании</Badge>;
  }
}

export function DocumentApprovalPanel({
  documentId,
  documentTypeId,
  documentStatus,
  token,
  currentUserId,
  currentUserRole,
  currentUserDepartmentId,
  onApprovalChange,
  onUserPendingStep,
  onSendReady,
}: Props) {
  const [approvals, setApprovals] = useState<DocumentApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const [processes, setProcesses] = useState<ProcessDefinition[]>([]);
  const [sending, setSending] = useState(false);

  const [decideDialogOpen, setDecideDialogOpen] = useState(false);
  const [decideStep, setDecideStep] = useState<{
    approvalId: string;
    stepId: string;
    stepName: string;
    decision: 'APPROVED' | 'APPROVED_WITH_CHANGES' | 'REJECTED';
  } | null>(null);
  const [decideComment, setDecideComment] = useState('');
  const [deciding, setDeciding] = useState(false);

  const loadApprovals = useCallback(async () => {
    if (!documentId || !token) return;
    try {
      const data = await apiFetch<{ approvals: DocumentApproval[] }>(
        `/api/documents/${documentId}/approvals`,
        token,
      );
      setApprovals((data as any).approvals ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [documentId, token]);

  const loadProcesses = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<ProcessDefinition[]>('/api/processes', token);
      // Only ACTIVE processes that have at least one APPROVAL step
      const active = (Array.isArray(data) ? data : []).filter((p) => {
        if (p.status !== 'ACTIVE') return false;
        try {
          const steps: ProcessStep[] = JSON.parse(p.steps);
          return steps.some((s) => s.type === 'APPROVAL');
        } catch {
          return false;
        }
      });
      setProcesses(active);
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    loadApprovals();
    loadProcesses();
  }, [loadApprovals, loadProcesses]);

  useEffect(() => {
    if (!onUserPendingStep) return;
    const active = approvals.find((a) => a.status === 'IN_PROGRESS') ?? null;
    if (!active) { onUserPendingStep(null); return; }
    // Only the first PENDING APPROVAL step can be acted on (sequential flow)
    const firstPending = active.steps
      .filter((s) => s.status === 'PENDING' && s.stepType === 'APPROVAL')
      .sort((a, b) => a.order - b.order)[0] ?? null;
    if (!firstPending) { onUserPendingStep(null); return; }
    const isAssigned = (() => {
      if (currentUserRole === 'ADMIN' || currentUserRole === 'DIRECTOR' || currentUserRole === 'CHIEF_ACCOUNTANT') return true;
      if (firstPending.userId) return firstPending.userId === currentUserId;
      if (firstPending.departmentId) return firstPending.departmentId === currentUserDepartmentId;
      return false;
    })();
    onUserPendingStep(isAssigned ? { approvalId: active.id, stepId: firstPending.id, stepName: firstPending.name } : null);
  }, [approvals, onUserPendingStep, currentUserRole, currentUserId, currentUserDepartmentId]);

  const activeApproval = approvals.find((a) => a.status === 'IN_PROGRESS') ?? approvals[0] ?? null;

  // Only the first PENDING APPROVAL step (by order) is active — sequential flow enforcement
  const firstPendingApprovalStep = activeApproval?.steps
    .filter((s) => s.status === 'PENDING' && s.stepType === 'APPROVAL')
    .sort((a, b) => a.order - b.order)[0] ?? null;

  const canDecideStep = (step: DocumentApproval['steps'][number]) => {
    if (step.status !== 'PENDING' || step.stepType === 'CONDITION') return false;
    if (step.id !== firstPendingApprovalStep?.id) return false;
    if (currentUserRole === 'ADMIN' || currentUserRole === 'DIRECTOR' || currentUserRole === 'CHIEF_ACCOUNTANT') return true;
    if (step.userId) return step.userId === currentUserId;
    if (step.departmentId) return step.departmentId === currentUserDepartmentId;
    return false;
  };

  // Find the process linked to this document's type
  const matchedProcess = processes.find((p) =>
    p.documentTypes.some((dt) => dt.id === documentTypeId),
  ) ?? null;

  const handleSend = async () => {
    if (!matchedProcess) {
      toast.error('Для этого типа документа не настроен бизнес-процесс');
      return;
    }
    setSending(true);
    try {
      await apiFetch(`/api/documents/${documentId}/approvals`, token, {
        method: 'POST',
        body: JSON.stringify({ processId: matchedProcess.id }),
      });
      toast.success('Документ отправлен на согласование');
      await loadApprovals();
      onApprovalChange?.();
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  // Keep a ref to always-current handleSend so stableHandleSend never recreates
  const handleSendRef = React.useRef(handleSend);
  handleSendRef.current = handleSend;
  const stableHandleSend = React.useRef(() => handleSendRef.current()).current;

  const matchedProcessId = matchedProcess?.id ?? null;
  useEffect(() => {
    onSendReady?.(matchedProcessId ? stableHandleSend : null);
  }, [matchedProcessId, stableHandleSend, onSendReady]);

  const openDecide = (
    approvalId: string,
    stepId: string,
    stepName: string,
    decision: 'APPROVED' | 'APPROVED_WITH_CHANGES' | 'REJECTED',
  ) => {
    setDecideStep({ approvalId, stepId, stepName, decision });
    setDecideComment('');
    setDecideDialogOpen(true);
  };

  const handleDecide = async () => {
    if (!decideStep) return;
    setDeciding(true);
    try {
      await apiFetch(
        `/api/approvals/${decideStep.approvalId}/steps/${decideStep.stepId}/decide`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ decision: decideStep.decision, comment: decideComment }),
        },
      );
      const toastMsg =
        decideStep.decision === 'APPROVED' ? 'Шаг согласован' :
        decideStep.decision === 'APPROVED_WITH_CHANGES' ? 'Согласовано с изменениями' :
        'Шаг отклонён';
      toast.success(toastMsg);
      setDecideDialogOpen(false);
      await loadApprovals();
      onApprovalChange?.();
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка');
    } finally {
      setDeciding(false);
    }
  };

  const hasActiveApproval = activeApproval?.status === 'IN_PROGRESS';

  return (
    <>
      <div className="space-y-3">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <GitMerge className="h-3.5 w-3.5" />
            Согласование
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : activeApproval ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  {approvalStatusBadge(activeApproval.status)}
                  {activeApproval.route && (
                    <span className="text-xs text-muted-foreground truncate ml-2">
                      {activeApproval.route.name}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {activeApproval.steps.map((step, idx) => {
                    const isCondition = step.stepType === 'CONDITION';
                    const isSkipped = step.status === 'SKIPPED';
                    const isActive = step.id === firstPendingApprovalStep?.id;
                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-2 rounded-md transition-colors ${isSkipped ? 'opacity-40' : ''} ${isActive ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-1.5 -mx-2' : ''}`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5 ${isCondition ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' : isActive ? 'bg-amber-400 text-white' : 'bg-muted'}`}>
                          {isCondition ? '?' : idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {stepStatusIcon(step.status, step.stepType)}
                            <span className={`text-xs truncate ${isSkipped ? 'line-through font-medium' : isActive ? 'font-semibold text-amber-800 dark:text-amber-300' : 'font-medium'}`}>
                              {step.name}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded shrink-0">
                                сейчас
                              </span>
                            )}
                            {isActive && step.dueAt && (
                              <StepCountdown dueAt={step.dueAt} />
                            )}
                            {isCondition && (
                              <span className="text-[10px] text-violet-600 dark:text-violet-400 italic">авто</span>
                            )}
                          </div>
                          {!isCondition && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                              {step.user ? (
                                <><User className="w-3 h-3" />{step.user.name}</>
                              ) : step.department ? (
                                <><Building2 className="w-3 h-3" />{step.department.name}</>
                              ) : null}
                            </div>
                          )}
                          {step.status === 'APPROVED_WITH_CHANGES' && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">С изменениями</span>
                          )}
                          {step.comment && (
                            <p className="text-[11px] text-muted-foreground italic mt-0.5 break-words">
                              «{step.comment}»
                            </p>
                          )}
                          {canDecideStep(step) && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <Button
                                size="sm"
                                className="h-6 text-[11px] px-2 gap-1 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => openDecide(activeApproval.id, step.id, step.name, 'APPROVED')}
                              >
                                <Check className="w-3 h-3" />
                                Согласовать
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] px-2 gap-1 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                onClick={() => openDecide(activeApproval.id, step.id, step.name, 'APPROVED_WITH_CHANGES')}
                              >
                                <Pencil className="w-3 h-3" />
                                С изменениями
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] px-2 gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                                onClick={() => openDecide(activeApproval.id, step.id, step.name, 'REJECTED')}
                              >
                                <X className="w-3 h-3" />
                                Отклонить
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Согласование не запущено</p>
            )}

            {!hasActiveApproval && documentStatus !== 'COMPLETED' && documentStatus !== 'APPROVED' && documentStatus !== 'REJECTED' && (
              matchedProcess ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs h-8"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Отправить на согласование
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  Нет бизнес-процесса для этого типа документа
                </p>
              )
            )}
          </div>
        )}
      </div>

      {/* Decide dialog */}
      <Dialog open={decideDialogOpen} onOpenChange={setDecideDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {decideStep?.decision === 'APPROVED' ? 'Согласовать шаг' :
               decideStep?.decision === 'APPROVED_WITH_CHANGES' ? 'Согласовать с изменениями' :
               'Отклонить шаг'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Шаг: <strong>{decideStep?.stepName}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="decide-comment">
                Комментарий {decideStep?.decision !== 'APPROVED' ? '(рекомендуется)' : '(необязательно)'}
              </Label>
              <Textarea
                id="decide-comment"
                value={decideComment}
                onChange={(e) => setDecideComment(e.target.value)}
                placeholder="Оставьте комментарий..."
                rows={7}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideDialogOpen(false)}>Отмена</Button>
            <Button
              onClick={handleDecide}
              disabled={deciding}
              className={`gap-2 ${
                decideStep?.decision === 'REJECTED' ? 'bg-rose-600 hover:bg-rose-700' :
                decideStep?.decision === 'APPROVED_WITH_CHANGES' ? 'bg-amber-600 hover:bg-amber-700' :
                ''
              }`}
            >
              {deciding && <Loader2 className="w-4 h-4 animate-spin" />}
              {decideStep?.decision === 'APPROVED' ? 'Согласовать' :
               decideStep?.decision === 'APPROVED_WITH_CHANGES' ? 'С изменениями' :
               'Отклонить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
