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
  PenLine,
  ShieldCheck,
  Stamp,
  FileUp,
  Trash2,
  FileText,
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
  type: 'START' | 'APPROVAL' | 'NOTIFICATION' | 'CONDITION' | 'SIGNATURE' | 'PAPER_SIGNATURE';
  assigneeType?: 'role' | 'user' | 'department';
  userId?: string | null;
  departmentId?: string | null;
  assigneeRole: string;
}

interface CertInfo {
  index: number;
  thumbprint: string;
  subjectName: string;
  issuerName: string;
  validFrom: string;
  validTo: string;
  isExpired: boolean;
  certObject: unknown;
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
  if (stepType === 'SIGNATURE' && status === 'APPROVED') return <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />;
  if (stepType === 'SIGNATURE' && status === 'PENDING') return <PenLine className="w-4 h-4 text-indigo-400 shrink-0" />;
  if (stepType === 'PAPER_SIGNATURE' && status === 'APPROVED') return <Stamp className="w-4 h-4 text-amber-600 shrink-0" />;
  if (stepType === 'PAPER_SIGNATURE' && status === 'PENDING') return <Stamp className="w-4 h-4 text-amber-400 shrink-0" />;
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

// Module-level flag so the script is injected only once per page session
let _cadesScriptLoaded = false;

async function loadCadesScript(): Promise<void> {
  if (_cadesScriptLoaded) return;
  // Clear any failed initialization from the npm-bundled cadesplugin_api.js
  // which has outdated extension IDs
  delete (window as any).cadesplugin;

  const tryLoad = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(src));
      document.head.appendChild(s);
    });

  try {
    await tryLoad('/cadesplugin_api.js');
  } catch {
    // Local copy missing — fall back to official CDN
    delete (window as any).cadesplugin;
    try {
      await tryLoad('https://cryptopro.ru/sites/default/files/products/cades/cadesplugin_api.js');
    } catch {
      throw new Error('Не удалось загрузить скрипт КриптоПро Browser Plugin (ни из /public, ни с CDN).');
    }
  }
  _cadesScriptLoaded = true;
}

function extractCN(dn: string): string {
  const m = dn.match(/CN=([^,]+)/)
  return m ? m[1].trim() : dn
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunk) as any))
  }
  return btoa(binary)
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
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

  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signStep, setSignStep] = useState<{ approvalId: string; stepId: string; stepName: string } | null>(null);
  const [pluginState, setPluginState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [pluginError, setPluginError] = useState('');
  const [certificates, setCertificates] = useState<CertInfo[]>([]);
  const [selectedCertIdx, setSelectedCertIdx] = useState<number | null>(null);
  const [signing, setSigning] = useState(false);
  const [signProgress, setSignProgress] = useState<string[]>([]);
  const [signError, setSignError] = useState('');
  const [signableAttachments, setSignableAttachments] = useState<any[]>([]);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<string>>(new Set());
  const [loadingSignAttachments, setLoadingSignAttachments] = useState(false);

  const [paperSignDialogOpen, setPaperSignDialogOpen] = useState(false);
  const [paperSignStep, setPaperSignStep] = useState<{ approvalId: string; stepId: string; stepName: string } | null>(null);
  const [paperSignFiles, setPaperSignFiles] = useState<File[]>([]);
  const [paperSigning, setPaperSigning] = useState(false);
  const [paperSignError, setPaperSignError] = useState('');

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
      // Only ACTIVE processes that have at least one APPROVAL or SIGNATURE step
      const active = (Array.isArray(data) ? data : []).filter((p) => {
        if (p.status !== 'ACTIVE') return false;
        try {
          const steps: ProcessStep[] = JSON.parse(p.steps);
          return steps.some((s) => s.type === 'APPROVAL' || s.type === 'SIGNATURE');
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
    window.addEventListener('refresh-approvals', loadApprovals);
    return () => window.removeEventListener('refresh-approvals', loadApprovals);
  }, [loadApprovals]);

  useEffect(() => {
    if (!onUserPendingStep) return;
    const active = approvals.find((a) => a.status === 'IN_PROGRESS') ?? null;
    if (!active) { onUserPendingStep(null); return; }
    // Only the first PENDING human step (APPROVAL or SIGNATURE) can be acted on
    const firstPending = active.steps
      .filter((s) => s.status === 'PENDING' && (s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE' || s.stepType === 'PAPER_SIGNATURE'))
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

  // First PENDING human step (APPROVAL / SIGNATURE / PAPER_SIGNATURE) — sequential flow enforcement
  const firstPendingHumanStep = activeApproval?.steps
    .filter((s) => s.status === 'PENDING' && (s.stepType === 'APPROVAL' || s.stepType === 'SIGNATURE' || s.stepType === 'PAPER_SIGNATURE'))
    .sort((a, b) => a.order - b.order)[0] ?? null;

  const isAssignedToCurrentUser = (step: DocumentApproval['steps'][number]) => {
    if (currentUserRole === 'ADMIN' || currentUserRole === 'DIRECTOR' || currentUserRole === 'CHIEF_ACCOUNTANT') return true;
    if (step.userId) return step.userId === currentUserId;
    if (step.departmentId) return step.departmentId === currentUserDepartmentId;
    return false;
  };

  const canDecideStep = (step: DocumentApproval['steps'][number]) => {
    if (step.status !== 'PENDING' || step.stepType !== 'APPROVAL') return false;
    if (step.id !== firstPendingHumanStep?.id) return false;
    return isAssignedToCurrentUser(step);
  };

  const canSignStep = (step: DocumentApproval['steps'][number]) => {
    if (step.status !== 'PENDING' || step.stepType !== 'SIGNATURE') return false;
    if (step.id !== firstPendingHumanStep?.id) return false;
    return isAssignedToCurrentUser(step);
  };

  const canPaperSignStep = (step: DocumentApproval['steps'][number]) => {
    if (step.status !== 'PENDING' || step.stepType !== 'PAPER_SIGNATURE') return false;
    if (step.id !== firstPendingHumanStep?.id) return false;
    return isAssignedToCurrentUser(step);
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

  const loadCertificates = async () => {
    setPluginState('loading');
    setPluginError('');
    setCertificates([]);
    setSelectedCertIdx(null);
    try {
      await loadCadesScript();
      const { default: cadespluginApi } = await import('crypto-pro-cadesplugin');
      const api = await cadespluginApi();
      const rawCerts: any[] = await api.getCertsList();
      const certs: CertInfo[] = rawCerts.map((cert: any, idx: number) => {
        let subjectName = cert.subjectInfo as string;
        let issuerName = cert.issuerInfo as string;
        let validFrom = '';
        let validTo = '';
        let isExpired = false;
        try { subjectName = cert.getSubjectInfo()['Владелец'] || subjectName; } catch { /* fallback */ }
        try { issuerName = cert.getInfo('issuerInfo')['Удостоверяющий центр'] || issuerName; } catch { /* fallback */ }
        try {
          const vp = cert.friendlyValidPeriod();
          validFrom = vp.from.ddmmyy;
          validTo = vp.to.ddmmyy;
          const [d, m, y] = vp.to.ddmmyy.split('/').map(Number);
          isExpired = new Date(y, m - 1, d) < new Date();
        } catch { /* fallback */ }
        return { index: idx, thumbprint: cert.thumbprint, subjectName, issuerName, validFrom, validTo, isExpired, certObject: cert };
      });
      setCertificates(certs);
      if (certs.length === 1 && !certs[0].isExpired) setSelectedCertIdx(0);
      setPluginState('ready');
    } catch (e: any) {
      setPluginState('error');
      setPluginError(e?.message || 'Ошибка при инициализации плагина КриптоПро');
    }
  };

  const handleSign = async () => {
    if (!signStep || selectedCertIdx === null) return;
    const cert = certificates[selectedCertIdx];
    if (!cert) return;
    setSigning(true);
    setSignError('');
    const log = (msg: string) => setSignProgress((prev) => [...prev, msg]);
    try {
      await loadCadesScript();
      const { default: cadespluginApi } = await import('crypto-pro-cadesplugin');
      const api = await cadespluginApi();

      const attachments = signableAttachments.filter((a: any) => selectedAttachmentIds.has(a.id));

      if (attachments.length === 0) {
        log('Вложений нет. Подписание реквизитов документа...');
        const stub = `documentId:${documentId}\nstep:${signStep.stepName}\ndate:${new Date().toISOString()}`;
        const b64 = arrayBufferToBase64(new TextEncoder().encode(stub).buffer as ArrayBuffer);
        const sigB64: string = await api.signBase64(cert.thumbprint, b64, true);
        const sigFile = new File([base64ToArrayBuffer(sigB64)], 'signed_document.sig', { type: 'application/pkcs7-signature' });
        const fd = new FormData();
        fd.append('file', sigFile);
        await fetch(`/api/documents/${documentId}/attachments`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        log('Сохранено: signed_document.sig');
      } else {
        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i];
          const isWord = /\.(doc|docx)$/i.test(att.originalName);

          let fileBuffer: ArrayBuffer;
          let sigFileName: string;

          if (isWord) {
            log(`Конвертация в PDF: ${att.originalName} (${i + 1}/${attachments.length})`);
            const convResp = await fetch(
              `/api/documents/${documentId}/attachments/${att.id}/to-pdf`,
              { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
            );
            if (!convResp.ok) {
              const err = await convResp.json().catch(() => ({}));
              throw new Error(err.error || `Не удалось конвертировать ${att.originalName} в PDF`);
            }
            fileBuffer = await convResp.arrayBuffer();
            const pdfBaseName = att.originalName.replace(/\.docx?$/i, '.pdf');
            sigFileName = `${pdfBaseName}.sig`;

            // Upload the converted PDF as a signed attachment
            log(`Загрузка подписанного PDF: ${pdfBaseName}`);
            const pdfFile = new File([fileBuffer], pdfBaseName, { type: 'application/pdf' });
            const pdfFd = new FormData();
            pdfFd.append('file', pdfFile);
            pdfFd.append('isSigned', 'true');
            const pdfUp = await fetch(`/api/documents/${documentId}/attachments`, {
              method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: pdfFd,
            });
            if (!pdfUp.ok) throw new Error(`Не удалось загрузить подписанный PDF: ${pdfBaseName}`);

            log(`Подписание PDF: ${pdfBaseName} (${i + 1}/${attachments.length})`);
          } else {
            log(`Подписание: ${att.originalName} (${i + 1}/${attachments.length})`);
            const fileResp = await fetch(`/api/documents/${documentId}/attachments/${att.id}/download`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!fileResp.ok) throw new Error(`Не удалось скачать файл: ${att.originalName}`);
            fileBuffer = await fileResp.arrayBuffer();
            // Detached CAdES-BES: original stays untouched, sig saved alongside
            sigFileName = `${att.originalName}.sig`;
          }

          const b64 = arrayBufferToBase64(fileBuffer);
          const sigB64: string = await api.signBase64(cert.thumbprint, b64, true);
          const signedName = sigFileName;
          log(`Загрузка: ${signedName}`);
          const sigFile = new File([base64ToArrayBuffer(sigB64)], signedName, { type: 'application/pkcs7-signature' });
          const fd = new FormData();
          fd.append('file', sigFile);
          const up = await fetch(`/api/documents/${documentId}/attachments`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
          });
          if (!up.ok) throw new Error(`Не удалось загрузить: ${signedName}`);
        }
      }

      log('Подтверждение шага...');
      await apiFetch(`/api/approvals/${signStep.approvalId}/steps/${signStep.stepId}/sign`, token, {
        method: 'POST',
        body: JSON.stringify({ thumbprint: cert.thumbprint, subject: cert.subjectName, issuer: cert.issuerName }),
      });
      toast.success('Документ подписан ЭЦП');
      setSignDialogOpen(false);
      await loadApprovals();
      window.dispatchEvent(new Event('refresh-attachments'));
      onApprovalChange?.();
    } catch (e: any) {
      setSignError(e?.message || 'Ошибка подписания');
    } finally {
      setSigning(false);
    }
  };

  const handlePaperSign = async () => {
    if (!paperSignStep || paperSignFiles.length === 0) return;
    setPaperSigning(true);
    setPaperSignError('');
    try {
      const fd = new FormData();
      for (const file of paperSignFiles) fd.append('files', file);
      await apiFetch(
        `/api/approvals/${paperSignStep.approvalId}/steps/${paperSignStep.stepId}/paper-sign`,
        token,
        { method: 'POST', body: fd },
      );
      setPaperSignDialogOpen(false);
      setPaperSignFiles([]);
      await loadApprovals();
      window.dispatchEvent(new Event('refresh-recent'));
      toast.success('Документ успешно подписан на бумаге');
    } catch (e: any) {
      setPaperSignError(e?.message || 'Ошибка при загрузке файлов');
    } finally {
      setPaperSigning(false);
    }
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
                    const isSignature = step.stepType === 'SIGNATURE';
                    const isPaperSignature = step.stepType === 'PAPER_SIGNATURE';
                    const isSkipped = step.status === 'SKIPPED';
                    const isActive = step.id === firstPendingHumanStep?.id;
                    const activeBg = isSignature
                      ? 'bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800'
                      : isPaperSignature
                      ? 'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800'
                      : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800';
                    const activeTextColor = isSignature
                      ? 'font-semibold text-indigo-800 dark:text-indigo-300'
                      : isPaperSignature
                      ? 'font-semibold text-orange-800 dark:text-orange-300'
                      : 'font-semibold text-amber-800 dark:text-amber-300';
                    const activeBadgeColor = isSignature
                      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40'
                      : isPaperSignature
                      ? 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40';
                    const activeDotColor = isSignature ? 'bg-indigo-500' : isPaperSignature ? 'bg-orange-500' : 'bg-amber-400';
                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-2 rounded-md transition-colors ${isSkipped ? 'opacity-40' : ''} ${isActive ? `${activeBg} px-2 py-1.5 -mx-2` : ''}`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5 ${isCondition ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' : isActive ? `${activeDotColor} text-white` : 'bg-muted'}`}>
                          {isCondition ? '?' : isSignature ? <PenLine className="w-2.5 h-2.5" /> : isPaperSignature ? <Stamp className="w-2.5 h-2.5" /> : idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {stepStatusIcon(step.status, step.stepType)}
                            <span className={`text-xs truncate ${isSkipped ? 'line-through font-medium' : isActive ? activeTextColor : 'font-medium'}`}>
                              {step.name}
                            </span>
                            {isActive && (
                              <span className={`text-[10px] font-medium ${activeBadgeColor} px-1 py-0.5 rounded shrink-0`}>
                                {isSignature ? 'подписать ЭЦП' : isPaperSignature ? 'подписать на бумаге' : 'сейчас'}
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
                          {canSignStep(step) && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <Button
                                size="sm"
                                className="h-6 text-[11px] px-2 gap-1 bg-indigo-600 hover:bg-indigo-700"
                                onClick={() => {
                                  setSignStep({ approvalId: activeApproval.id, stepId: step.id, stepName: step.name });
                                  setSignProgress([]);
                                  setSignError('');
                                  setSelectedCertIdx(null);
                                  setSignableAttachments([]);
                                  setSelectedAttachmentIds(new Set());
                                  setSignDialogOpen(true);
                                  loadCertificates();
                                  setLoadingSignAttachments(true);
                                  apiFetch<any[]>(`/api/documents/${documentId}/attachments`, token)
                                    .then((all) => {
                                      const signable = (all ?? []).filter(
                                        (a: any) => a.isLatest && !a.deletedAt && !a.isSigned && !/\.(sig|p7s)$/i.test(a.originalName)
                                      );
                                      setSignableAttachments(signable);
                                      setSelectedAttachmentIds(new Set(signable.map((a: any) => a.id)));
                                    })
                                    .catch(() => {})
                                    .finally(() => setLoadingSignAttachments(false));
                                }}
                              >
                                <PenLine className="w-3 h-3" />
                                Подписать ЭЦП
                              </Button>
                            </div>
                          )}
                          {canPaperSignStep(step) && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <Button
                                size="sm"
                                className="h-6 text-[11px] px-2 gap-1 bg-orange-600 hover:bg-orange-700"
                                onClick={() => {
                                  setPaperSignStep({ approvalId: activeApproval.id, stepId: step.id, stepName: step.name });
                                  setPaperSignFiles([]);
                                  setPaperSignError('');
                                  setPaperSignDialogOpen(true);
                                }}
                              >
                                <Stamp className="w-3 h-3" />
                                Подписать на бумаге
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

      {/* Sign dialog — КриптоПро Browser Plugin */}
      <Dialog open={signDialogOpen} onOpenChange={(open) => { if (!signing) setSignDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Подписание ЭЦП (ГОСТ Р 34.10-2012)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Шаг: <strong>{signStep?.stepName}</strong>
            </p>

            {/* File selection */}
            {signProgress.length === 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Файлы для подписания</p>
                {loadingSignAttachments ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    Загрузка вложений...
                  </div>
                ) : signableAttachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Нет вложений — будет подписан идентификатор документа.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {signableAttachments.map((att) => (
                      <label
                        key={att.id}
                        className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer hover:bg-accent transition-colors text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAttachmentIds.has(att.id)}
                          onChange={(e) =>
                            setSelectedAttachmentIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(att.id);
                              else next.delete(att.id);
                              return next;
                            })
                          }
                          className="accent-indigo-600 shrink-0"
                        />
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{att.originalName}</span>
                        <span className="text-muted-foreground shrink-0">
                          {att.fileSize ? `${(att.fileSize / 1024).toFixed(0)} КБ` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Plugin loading */}
            {pluginState === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Загрузка плагина КриптоПро...
              </div>
            )}

            {/* Plugin error */}
            {pluginState === 'error' && (
              <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 p-3 space-y-2">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-400">Плагин недоступен</p>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/80">{pluginError}</p>
                <p className="text-xs text-muted-foreground">
                  Установите КриптоПро CSP и расширение КриптоПро ЭЦП Browser Plugin, затем поместите файл <code className="font-mono">cadesplugin.js</code> в папку <code className="font-mono">/public/</code>.
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={loadCertificates}>
                  Повторить
                </Button>
              </div>
            )}

            {/* No certs */}
            {pluginState === 'ready' && certificates.length === 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Сертификаты не найдены. Убедитесь, что КриптоПро CSP установлен и в личном хранилище есть действующие сертификаты.
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={loadCertificates}>
                  Обновить
                </Button>
              </div>
            )}

            {/* Certificate list */}
            {pluginState === 'ready' && certificates.length > 0 && signProgress.length === 0 && (
              <div className="space-y-2">
                <Label>Выберите сертификат</Label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {certificates.map((cert, idx) => (
                    <div
                      key={cert.thumbprint}
                      onClick={() => !cert.isExpired && setSelectedCertIdx(idx)}
                      className={`rounded-md border p-2.5 cursor-pointer transition-colors ${
                        selectedCertIdx === idx
                          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20'
                          : cert.isExpired
                          ? 'border-rose-200 bg-rose-50/40 dark:bg-rose-950/10 opacity-60 cursor-default'
                          : 'border-input hover:border-indigo-300 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          readOnly
                          checked={selectedCertIdx === idx}
                          disabled={cert.isExpired}
                          className="mt-0.5 accent-indigo-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{extractCN(cert.subjectName)}</p>
                          <p className="text-xs text-muted-foreground truncate">{extractCN(cert.issuerName)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-medium ${cert.isExpired ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {cert.isExpired ? 'Истёк' : 'Действует'} до {cert.validTo}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">{cert.thumbprint.slice(0, 8)}…</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signing progress log */}
            {signProgress.length > 0 && (
              <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-3 space-y-1 max-h-40 overflow-y-auto">
                {signProgress.map((msg, i) => (
                  <div key={i} className="text-xs flex items-center gap-1.5">
                    {i === signProgress.length - 1 && signing
                      ? <Loader2 className="w-3 h-3 animate-spin text-indigo-500 shrink-0" />
                      : <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                    }
                    {msg}
                  </div>
                ))}
              </div>
            )}

            {/* Sign error */}
            {signError && (
              <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 p-2">
                <p className="text-xs text-rose-600 dark:text-rose-400">{signError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={signing} onClick={() => setSignDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSign}
              disabled={signing || selectedCertIdx === null || pluginState !== 'ready'}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Подписать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paper sign dialog */}
      <Dialog open={paperSignDialogOpen} onOpenChange={(open) => { if (!paperSigning) setPaperSignDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stamp className="w-5 h-5 text-orange-600" />
              Подписание на бумаге
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Шаг: <strong>{paperSignStep?.stepName}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Загрузите подписанный документ в формате PDF. Файл будет сохранён как подписанное вложение.
            </p>
            <div>
              <label
                htmlFor="paper-sign-file"
                className={`flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${paperSigning ? 'opacity-50 cursor-default' : 'hover:border-orange-400 hover:bg-orange-50/40 dark:hover:bg-orange-950/10'} border-input`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (paperSigning) return;
                  const dropped = Array.from(e.dataTransfer.files).filter(
                    (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
                  );
                  if (dropped.length > 0) {
                    setPaperSignFiles((prev) => {
                      const names = new Set(prev.map((f) => f.name));
                      return [...prev, ...dropped.filter((f) => !names.has(f.name))];
                    });
                  }
                }}
              >
                <FileUp className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center">
                  Нажмите для выбора PDF-файлов<br />
                  <span className="text-xs">или перетащите сюда</span>
                </span>
                <input
                  id="paper-sign-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  disabled={paperSigning}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    setPaperSignFiles((prev) => {
                      const names = new Set(prev.map((f) => f.name));
                      return [...prev, ...selected.filter((f) => !names.has(f.name))];
                    });
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {paperSignFiles.length > 0 && (
              <div className="space-y-1">
                {paperSignFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                    <span className="flex-1 truncate text-foreground">{file.name}</span>
                    <span className="text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} КБ</span>
                    <button
                      onClick={() => setPaperSignFiles((prev) => prev.filter((_, j) => j !== i))}
                      disabled={paperSigning}
                      className="text-muted-foreground hover:text-rose-500 shrink-0 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {paperSignError && (
              <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 p-2">
                <p className="text-xs text-rose-600 dark:text-rose-400">{paperSignError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={paperSigning} onClick={() => setPaperSignDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handlePaperSign}
              disabled={paperSigning || paperSignFiles.length === 0}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {paperSigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stamp className="w-4 h-4" />}
              Подтвердить подписание
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
