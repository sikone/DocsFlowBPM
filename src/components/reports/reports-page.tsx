'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  ArrowLeft,
  Search,
  X,
  FileSpreadsheet,
  FileJson,
  Loader2,
  AlertCircle,
  FileText,
  GitMerge,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  HelpCircle,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types';
import type { DocumentType } from '@/lib/types';

type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  LOW: 'Низкая',
  MEDIUM: 'Средняя',
  HIGH: 'Высокая',
  CRITICAL: 'Экстренная',
};

const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  MEDIUM: 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700',
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  any: 'Любой',
  none: 'Не запускалось',
  in_progress: 'Запущено',
  approved: 'Согласован',
  rejected: 'Отклонён',
};

const APPROVAL_STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
  APPROVED_WITH_CHANGES: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700',
};

const APPROVAL_STATUS_TEXT: Record<string, string> = {
  IN_PROGRESS: 'Запущено',
  APPROVED: 'Согласован',
  APPROVED_WITH_CHANGES: 'С замечаниями',
  REJECTED: 'Отклонён',
};

const STEP_STATUS_TEXT: Record<string, string> = {
  APPROVED: 'Согласовано',
  APPROVED_WITH_CHANGES: 'С замечаниями',
  REJECTED: 'Отклонено',
};

interface ReportDocument {
  id: string;
  title: string;
  number?: string;
  status: string;
  urgency: UrgencyLevel;
  createdAt: string;
  updatedAt: string;
  type?: { id: string; name: string; icon: string; color: string };
  creator?: { id: string; name: string };
  approvals: { id: string; status: string; createdAt: string }[];
}

interface UserReportStep {
  id: string;
  name: string;
  status: string;
  dueAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  approval: {
    document: { id: string; title: string; number?: string | null };
  };
}

interface UserReportResult {
  total: number;
  onTime: number;
  late: number;
  noSla: number;
  avgMs: number;
  steps: UserReportStep[];
}

interface CreatorOption {
  id: string;
  name: string;
}

const ALL_STATUSES = ['DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED'] as const;
const ALL_URGENCIES: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ALL_APPROVAL_STATUSES = ['any', 'none', 'in_progress', 'approved', 'rejected'] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} мин`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}д ${rh}ч` : `${d}д`;
}

type ReportType = 'documents' | 'users';

export default function ReportsPage() {
  const { token, navigate, user } = useStore();

  const canViewAllUsers = user?.role === 'ADMIN' || user?.role === 'DIRECTOR';
  const isDeptHead = !canViewAllUsers && (user?.isDepartmentHead === true) && !!user?.departmentId;
  const showUserPicker = canViewAllUsers || isDeptHead;

  const [reportType, setReportType] = useState<ReportType>('documents');

  // ── Document report state ──────────────────────────────────────────────────
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedUrgencies, setSelectedUrgencies] = useState<string[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('all');
  const [approvalStatus, setApprovalStatus] = useState<string>('any');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [createdById, setCreatedById] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [docResults, setDocResults] = useState<ReportDocument[] | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState('');

  // ── User report state ──────────────────────────────────────────────────────
  const [userSelectedId, setUserSelectedId] = useState<string>('');
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userDateFrom, setUserDateFrom] = useState('');
  const [userDateTo, setUserDateTo] = useState('');
  const [userStepStatus, setUserStepStatus] = useState<string>('all');
  const [userTimeliness, setUserTimeliness] = useState<string>('all');
  const [userResults, setUserResults] = useState<UserReportResult | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');

  // ── Shared data ────────────────────────────────────────────────────────────
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [creators, setCreators] = useState<CreatorOption[]>([]);

  useEffect(() => {
    if (!token) return;
    apiFetch<DocumentType[]>('/api/document-types', token)
      .then((data) => setDocumentTypes(Array.isArray(data) ? data.filter((t) => t.active) : []))
      .catch(() => {});
    const isDeptHeadUser = !canViewAllUsers && (user?.isDepartmentHead === true) && !!user?.departmentId;
    const searchUrl = isDeptHeadUser
      ? `/api/users/search?q=&departmentId=${user!.departmentId}`
      : '/api/users/search?q=';
    apiFetch<CreatorOption[]>(searchUrl, token)
      .then((data) => {
        const others: CreatorOption[] = Array.isArray(data) ? data : [];
        const selfEntry = user ? { id: user.id, name: `${user.name} (я)` } : null;
        const withoutSelf = others.filter((u) => u.id !== user?.id);
        setCreators(selfEntry ? [selfEntry, ...withoutSelf] : withoutSelf);
      })
      .catch(() => {});
  }, [token]);

  // Set default user for user report
  useEffect(() => {
    if (user && !userSelectedId) setUserSelectedId(user.id);
  }, [user]);

  // ── Document report handlers ───────────────────────────────────────────────
  const toggleStatus = (s: string) =>
    setSelectedStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const toggleUrgency = (u: string) =>
    setSelectedUrgencies((prev) => prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]);

  const hasDocFilters =
    selectedStatuses.length > 0 || selectedUrgencies.length > 0 ||
    selectedTypeId !== 'all' || approvalStatus !== 'any' ||
    dateFrom || dateTo || createdById !== 'all';

  const handleDocReset = () => {
    setSelectedStatuses([]); setSelectedUrgencies([]); setSelectedTypeId('all');
    setApprovalStatus('any'); setDateFrom(''); setDateTo('');
    setCreatedById('all'); setSearch(''); setDocResults(null); setDocError('');
  };

  const handleDocRun = useCallback(async () => {
    if (!token) return;
    setDocLoading(true); setDocError('');
    try {
      const params = new URLSearchParams();
      selectedStatuses.forEach((s) => params.append('status', s));
      selectedUrgencies.forEach((u) => params.append('urgency', u));
      if (selectedTypeId !== 'all') params.set('typeId', selectedTypeId);
      if (approvalStatus !== 'any') params.set('approvalStatus', approvalStatus);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (createdById !== 'all') params.set('createdById', createdById);
      const data = await apiFetch<ReportDocument[]>(`/api/reports?${params.toString()}`, token);
      setDocResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setDocError(e?.message || 'Ошибка выполнения отчёта');
    } finally {
      setDocLoading(false);
    }
  }, [token, selectedStatuses, selectedUrgencies, selectedTypeId, approvalStatus, dateFrom, dateTo, createdById]);

  const filteredDocResults = docResults
    ? docResults.filter((d) =>
        !search ||
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        (d.number ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : null;

  // ── User report handlers ───────────────────────────────────────────────────
  const handleUserRun = useCallback(async () => {
    if (!token) return;
    setUserLoading(true); setUserError('');
    try {
      const params = new URLSearchParams();
      if (userSelectedId) params.set('userId', userSelectedId);
      if (userDateFrom) params.set('dateFrom', userDateFrom);
      if (userDateTo) params.set('dateTo', userDateTo);
      if (userStepStatus !== 'all') params.set('stepStatus', userStepStatus);
      const data = await apiFetch<UserReportResult>(`/api/reports/users?${params.toString()}`, token);
      setUserResults(data as UserReportResult);
    } catch (e: any) {
      setUserError(e?.message || 'Ошибка выполнения отчёта');
    } finally {
      setUserLoading(false);
    }
  }, [token, userSelectedId, userDateFrom, userDateTo, userStepStatus]);

  const hasUserFilters = userDateFrom || userDateTo || userStepStatus !== 'all' || userTimeliness !== 'all';

  const handleUserReset = () => {
    setUserDateFrom(''); setUserDateTo('');
    setUserStepStatus('all'); setUserTimeliness('all');
    setUserSelectedId(user?.id ?? '');
    setUserResults(null); setUserError('');
  };

  const filteredUserSteps = userResults?.steps.filter((s) => {
    if (userTimeliness === 'no_sla') return !s.dueAt;
    if (userTimeliness === 'on_time') return s.dueAt && s.decidedAt && new Date(s.decidedAt) <= new Date(s.dueAt);
    if (userTimeliness === 'late') return s.dueAt && s.decidedAt && new Date(s.decidedAt) > new Date(s.dueAt);
    return true;
  }) ?? [];

  // ── Export helpers ─────────────────────────────────────────────────────────
  const exportDocCsv = () => {
    if (!filteredDocResults?.length) return;
    const headers = ['Номер', 'Название', 'Тип', 'Статус', 'Срочность', 'Согласование', 'Автор', 'Дата создания'];
    const rows = filteredDocResults.map((d) => [
      d.number ?? '',
      d.title,
      d.type?.name ?? '',
      STATUS_LABELS[d.status] ?? d.status,
      URGENCY_LABELS[d.urgency] ?? d.urgency,
      d.approvals[0] ? (APPROVAL_STATUS_TEXT[d.approvals[0].status] ?? d.approvals[0].status) : 'Нет',
      d.creator?.name ?? '',
      formatDate(d.createdAt),
    ]);
    downloadCsv(rows, headers, 'report_docs');
  };

  const exportDocJson = () => {
    if (!filteredDocResults?.length) return;
    downloadJson(filteredDocResults, 'report_docs');
  };

  const exportUserCsv = () => {
    if (!filteredUserSteps.length) return;
    const headers = ['Документ', 'Номер', 'Шаг', 'Статус', 'Создан (шаг)', 'Срок (SLA)', 'Решение принято', 'Своевременно'];
    const rows = filteredUserSteps.map((s) => {
      const onTime = !s.dueAt ? 'Без SLA' : s.decidedAt && new Date(s.decidedAt) <= new Date(s.dueAt) ? 'Да' : 'Нет';
      return [
        s.approval.document.title,
        s.approval.document.number ?? '',
        s.name,
        STEP_STATUS_TEXT[s.status] ?? s.status,
        formatDateTime(s.createdAt),
        s.dueAt ? formatDateTime(s.dueAt) : '—',
        s.decidedAt ? formatDateTime(s.decidedAt) : '—',
        onTime,
      ];
    });
    downloadCsv(rows, headers, 'report_users');
  };

  const exportUserJson = () => {
    if (!filteredUserSteps.length) return;
    downloadJson({ ...userResults, steps: filteredUserSteps }, 'report_users');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate({ page: 'dashboard' })}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-semibold">Отчёты</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Report type switcher */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReportType('documents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              reportType === 'documents'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            Конструктор отчёта
          </button>
          <button
            type="button"
            onClick={() => setReportType('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              reportType === 'users'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
            }`}
          >
            <Users className="w-4 h-4" />
            Отчёт по пользователям
          </button>
        </div>

        {/* ─── Document report ──────────────────────────────────────────────── */}
        {reportType === 'documents' && (
          <>
            <div className="rounded-xl border bg-card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Конструктор отчёта</h2>
                {hasDocFilters && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={handleDocReset}>
                    <X className="w-3 h-3" />
                    Сбросить
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Статус документа</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_STATUSES.map((s) => (
                      <button
                        key={s} type="button" onClick={() => toggleStatus(s)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          selectedStatuses.includes(s) ? STATUS_COLORS[s] : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Срочность</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_URGENCIES.map((u) => (
                      <button
                        key={u} type="button" onClick={() => toggleUrgency(u)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          selectedUrgencies.includes(u) ? URGENCY_COLORS[u] : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {URGENCY_LABELS[u]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Статус согласования</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_APPROVAL_STATUSES.map((s) => (
                      <button
                        key={s} type="button" onClick={() => setApprovalStatus(s)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          approvalStatus === s
                            ? s === 'any' ? 'bg-muted border-border text-foreground'
                              : s === 'none' ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                              : s === 'in_progress' ? 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700'
                              : s === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700'
                              : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {APPROVAL_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Тип документа</Label>
                  <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Все типы" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все типы</SelectItem>
                      {documentTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Дата создания</Label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
                    <span className="text-xs text-muted-foreground shrink-0">—</span>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Автор</Label>
                  <Select value={createdById} onValueChange={setCreatedById}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Все авторы" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все авторы</SelectItem>
                      {creators.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Button onClick={handleDocRun} disabled={docLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {docLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Сформировать отчёт
                </Button>
                {filteredDocResults !== null && (
                  <span className="text-sm text-muted-foreground">
                    Найдено: <strong>{filteredDocResults.length}</strong>
                  </span>
                )}
              </div>
            </div>

            {docError && <ErrorAlert message={docError} />}

            {filteredDocResults !== null && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <span className="text-sm font-medium">
                    Результаты
                    {filteredDocResults.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs font-normal">{filteredDocResults.length}</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию..." className="h-7 text-xs pl-7 w-48" />
                    </div>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={filteredDocResults.length === 0} onClick={exportDocCsv}>
                      <FileSpreadsheet className="w-3.5 h-3.5" />CSV
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={filteredDocResults.length === 0} onClick={exportDocJson}>
                      <FileJson className="w-3.5 h-3.5" />JSON
                    </Button>
                  </div>
                </div>

                {filteredDocResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <FileText className="w-10 h-10 opacity-30" />
                    <p className="text-sm">Нет документов, соответствующих условиям</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-32">Номер</TableHead>
                          <TableHead>Название</TableHead>
                          <TableHead className="w-36">Тип</TableHead>
                          <TableHead className="w-28">Статус</TableHead>
                          <TableHead className="w-28">Срочность</TableHead>
                          <TableHead className="w-32">
                            <span className="flex items-center gap-1"><GitMerge className="w-3 h-3" />Согласование</span>
                          </TableHead>
                          <TableHead className="w-36">Автор</TableHead>
                          <TableHead className="w-28">Создан</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDocResults.map((doc) => {
                          const latestApproval = doc.approvals[0] ?? null;
                          return (
                            <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/30 text-xs" onClick={() => navigate({ page: 'edit-document', documentId: doc.id })}>
                              <TableCell className="font-mono text-muted-foreground text-[11px]">{doc.number ?? '—'}</TableCell>
                              <TableCell><span className="font-medium line-clamp-2">{doc.title}</span></TableCell>
                              <TableCell><span className="text-muted-foreground truncate block max-w-[130px]">{doc.type?.name ?? '—'}</span></TableCell>
                              <TableCell>
                                <Badge className={`text-[10px] font-medium px-1.5 py-0.5 border ${STATUS_COLORS[doc.status]}`}>{STATUS_LABELS[doc.status] ?? doc.status}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-[10px] font-medium px-1.5 py-0.5 border ${URGENCY_COLORS[doc.urgency] ?? ''}`}>{URGENCY_LABELS[doc.urgency] ?? doc.urgency}</Badge>
                              </TableCell>
                              <TableCell>
                                {latestApproval ? (
                                  <Badge className={`text-[10px] font-medium px-1.5 py-0.5 border ${APPROVAL_STATUS_COLORS[latestApproval.status] ?? ''}`}>{APPROVAL_STATUS_TEXT[latestApproval.status] ?? latestApproval.status}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-[11px]">Нет</span>
                                )}
                              </TableCell>
                              <TableCell><span className="truncate block max-w-[130px]">{doc.creator?.name ?? '—'}</span></TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ─── User report ──────────────────────────────────────────────────── */}
        {reportType === 'users' && (
          <>
            <div className="rounded-xl border bg-card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Параметры отчёта</h2>
                {hasUserFilters && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={handleUserReset}>
                    <X className="w-3 h-3" />Сбросить
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {showUserPicker && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Пользователь</Label>
                    <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={userSearchOpen}
                          className="h-8 text-xs w-full justify-between font-normal"
                        >
                          <span className="truncate">
                            {userSelectedId
                              ? creators.find((u) => u.id === userSelectedId)?.name ?? 'Пользователь'
                              : 'Выберите пользователя'}
                          </span>
                          <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Поиск пользователя..." className="text-xs" />
                          <CommandList>
                            <CommandEmpty className="text-xs py-4">Не найдено</CommandEmpty>
                            <CommandGroup>
                              {creators.map((u) => (
                                <CommandItem
                                  key={u.id}
                                  value={u.name}
                                  onSelect={() => {
                                    setUserSelectedId(u.id);
                                    setUserSearchOpen(false);
                                  }}
                                  className="text-xs"
                                >
                                  <Check className={`w-3.5 h-3.5 mr-1.5 ${userSelectedId === u.id ? 'opacity-100' : 'opacity-0'}`} />
                                  {u.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Период (дата решения)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={userDateFrom} onChange={(e) => setUserDateFrom(e.target.value)} className="h-8 text-xs" />
                    <span className="text-xs text-muted-foreground shrink-0">—</span>
                    <Input type="date" value={userDateTo} onChange={(e) => setUserDateTo(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Статус решения</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { value: 'all', label: 'Все' },
                      { value: 'APPROVED', label: 'Согласовано', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700' },
                      { value: 'APPROVED_WITH_CHANGES', label: 'С замечаниями', cls: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700' },
                      { value: 'REJECTED', label: 'Отклонено', cls: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700' },
                    ] as const).map(({ value, label, cls }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setUserStepStatus(value)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          userStepStatus === value
                            ? value === 'all' ? 'bg-muted border-border text-foreground' : cls
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Своевременность (фильтр таблицы)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { value: 'all', label: 'Все', cls: '' },
                      { value: 'on_time', label: 'Вовремя', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700' },
                      { value: 'late', label: 'С опозданием', cls: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700' },
                      { value: 'no_sla', label: 'Без SLA', cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600' },
                    ] as const).map(({ value, label, cls }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setUserTimeliness(value)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          userTimeliness === value
                            ? value === 'all' ? 'bg-muted border-border text-foreground' : cls
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              <Button onClick={handleUserRun} disabled={userLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                {userLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Сформировать отчёт
              </Button>
            </div>

            {userError && <ErrorAlert message={userError} />}

            {userResults !== null && (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatCard icon={<GitMerge className="w-4 h-4" />} label="Всего решений" value={String(userResults.total)} color="default" />
                  <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Вовремя" value={userResults.total > 0 ? `${userResults.onTime} (${Math.round(userResults.onTime / userResults.total * 100)}%)` : '0'} color="green" />
                  <StatCard icon={<XCircle className="w-4 h-4" />} label="С опозданием" value={userResults.total > 0 ? `${userResults.late} (${Math.round(userResults.late / userResults.total * 100)}%)` : '0'} color="red" />
                  <StatCard icon={<HelpCircle className="w-4 h-4" />} label="Без SLA" value={String(userResults.noSla)} color="muted" />
                  <StatCard icon={<Timer className="w-4 h-4" />} label="Среднее время" value={userResults.avgMs > 0 ? formatDuration(userResults.avgMs) : '—'} color="default" />
                </div>

                {/* Steps table */}
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <span className="text-sm font-medium flex items-center gap-2">
                      Детализация
                      <Badge variant="secondary" className="text-xs font-normal">{filteredUserSteps.length}</Badge>
                      {userTimeliness !== 'all' && filteredUserSteps.length !== userResults.steps.length && (
                        <span className="text-xs text-muted-foreground">из {userResults.steps.length}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={filteredUserSteps.length === 0} onClick={exportUserCsv}>
                        <FileSpreadsheet className="w-3.5 h-3.5" />CSV
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={filteredUserSteps.length === 0} onClick={exportUserJson}>
                        <FileJson className="w-3.5 h-3.5" />JSON
                      </Button>
                    </div>
                  </div>

                  {filteredUserSteps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                      <Clock className="w-10 h-10 opacity-30" />
                      <p className="text-sm">
                        {userResults.steps.length === 0
                          ? 'Нет закрытых шагов согласования за указанный период'
                          : 'Нет шагов, соответствующих фильтру своевременности'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead>Документ</TableHead>
                            <TableHead className="w-40">Шаг согласования</TableHead>
                            <TableHead className="w-32">Статус</TableHead>
                            <TableHead className="w-36">Срок (SLA)</TableHead>
                            <TableHead className="w-36">Решение принято</TableHead>
                            <TableHead className="w-28">Своевременно</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUserSteps.map((step) => {
                            const isOnTime = step.dueAt && step.decidedAt
                              ? new Date(step.decidedAt) <= new Date(step.dueAt)
                              : null;
                            return (
                              <TableRow
                                key={step.id}
                                className="cursor-pointer hover:bg-muted/30 text-xs"
                                onClick={() => navigate({ page: 'edit-document', documentId: step.approval.document.id })}
                              >
                                <TableCell>
                                  <div>
                                    <span className="font-medium line-clamp-1">{step.approval.document.title}</span>
                                    {step.approval.document.number && (
                                      <span className="text-[10px] text-muted-foreground font-mono block">{step.approval.document.number}</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="truncate block max-w-[150px]">{step.name}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className={`text-[10px] font-medium px-1.5 py-0.5 border ${APPROVAL_STATUS_COLORS[step.status] ?? ''}`}>
                                    {STEP_STATUS_TEXT[step.status] ?? step.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-[11px]">
                                  {step.dueAt ? formatDateTime(step.dueAt) : <span className="text-muted-foreground/50">Не задан</span>}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-[11px]">
                                  {step.decidedAt ? formatDateTime(step.decidedAt) : '—'}
                                </TableCell>
                                <TableCell>
                                  {isOnTime === null ? (
                                    <span className="text-[11px] text-muted-foreground">Без SLA</span>
                                  ) : isOnTime ? (
                                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                      <CheckCircle2 className="w-3.5 h-3.5" />Да
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                      <XCircle className="w-3.5 h-3.5" />Нет
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg px-4 py-3">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: 'green' | 'red' | 'muted' | 'default' }) {
  const colorClass =
    color === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : color === 'red' ? 'text-rose-600 dark:text-rose-400'
    : color === 'muted' ? 'text-muted-foreground'
    : 'text-foreground';

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
      <div className={`${colorClass} opacity-70`}>{icon}</div>
      <div className={`text-lg font-semibold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function downloadCsv(rows: string[][], headers: string[], name: string) {
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${name}_${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadJson(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${name}_${new Date().toISOString().slice(0, 10)}.json`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
