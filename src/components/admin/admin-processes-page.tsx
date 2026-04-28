'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreHorizontal,
  Loader2,
  GitBranch,
  ArrowUp,
  ArrowDown,
  X,
  Play,
  Eye,
  Bell,
  HelpCircle,
  GitMerge,
  ChevronRight,
  Flag,
  FileCheck2,
  KeyRound,
  PenLine,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, Mail } from 'lucide-react';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { Department, User as UserType, DocumentType } from '@/lib/types';
import { DEFAULT_SLA, URGENCY_LABELS, type SlaConfig, type UrgencyLevel } from '@/lib/sla';

// ============================================================
// Types
// ============================================================
export type ConditionOperator =
  | '>'
  | '<'
  | '>='
  | '<='
  | '=='
  | '!='
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty';

export interface StepCondition {
  conditionSource?: 'document_field' | 'last_decision';
  // document_field fields:
  fieldSystemName: string;
  operator: ConditionOperator;
  value: string;
  // last_decision fields:
  checkValue?: string;
  // shared:
  trueStepId: string;
  falseStepId: string;
}

interface GrantAccessConfig {
  grantType: 'user' | 'department' | 'role';
  userId?: string | null;
  userName?: string | null;
  departmentId?: string | null;
  role?: 'ADMIN' | 'ADVANCED' | 'USER' | null;
  permission: 'VIEW' | 'EDIT';
}

interface ProcessStep {
  id: string;
  name: string;
  type: 'START' | 'APPROVAL' | 'NOTIFICATION' | 'CONDITION' | 'END' | 'STATUS_CHANGE' | 'GRANT_ACCESS' | 'SIGNATURE';
  assigneeRole: 'ADMIN' | 'ADVANCED' | 'USER';
  assigneeType?: 'role' | 'user' | 'department' | 'initiator';
  userId?: string | null;
  userName?: string | null;
  departmentId?: string | null;
  order: number;
  condition?: StepCondition;
  slaConfig?: string | null;
  sendEmail?: boolean;
  targetStatus?: string | null;
  grantAccessConfig?: GrantAccessConfig | null;
}

const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  '>': 'больше (>)',
  '<': 'меньше (<)',
  '>=': 'больше или равно (≥)',
  '<=': 'меньше или равно (≤)',
  '==': 'равно (=)',
  '!=': 'не равно (≠)',
  'contains': 'содержит',
  'not_contains': 'не содержит',
  'is_empty': 'пустое',
  'is_not_empty': 'не пустое',
};

interface ProcessDefinition {
  id: string;
  name: string;
  description: string | null;
  systemName: string;
  version: number;
  status: string;
  steps: string;
  createdAt: string;
  updatedAt: string;
  documentTypes: { id: string; name: string; systemName: string }[];
}

interface ProcessFormData {
  name: string;
  description: string;
  systemName: string;
  status: string;
  steps: ProcessStep[];
  documentTypeIds: string[];
}

const DEFAULT_PROCESS_FORM: ProcessFormData = {
  name: '',
  description: '',
  systemName: '',
  status: 'DRAFT',
  steps: [],
  documentTypeIds: [],
};

// ============================================================
// Step type/role labels
// ============================================================
const STEP_TYPE_LABELS: Record<string, string> = {
  START: 'Старт',
  APPROVAL: 'Согласование',
  NOTIFICATION: 'Уведомление',
  CONDITION: 'Условие',
  STATUS_CHANGE: 'Статус документа',
  GRANT_ACCESS: 'Выдать доступ',
  SIGNATURE: 'Подписание ЭЦП',
  END: 'Финиш',
};

const STEP_TYPE_ICONS: Record<string, React.ElementType> = {
  START: Play,
  APPROVAL: Eye,
  NOTIFICATION: Bell,
  CONDITION: HelpCircle,
  STATUS_CHANGE: FileCheck2,
  GRANT_ACCESS: KeyRound,
  SIGNATURE: PenLine,
  END: Flag,
};

const STEP_TYPE_COLORS: Record<string, string> = {
  START: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  APPROVAL: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  NOTIFICATION: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  CONDITION: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
  STATUS_CHANGE: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
  GRANT_ACCESS: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  SIGNATURE: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  END: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const DOC_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'В работе',
  APPROVED: 'Утверждён',
  REJECTED: 'Отклонён',
  COMPLETED: 'Завершён',
};

const ASSIGNEE_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  ADVANCED: 'Расширенный',
  USER: 'Обычный',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активен',
  DRAFT: 'Черновик',
  ARCHIVED: 'Архив',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

// ============================================================
// User picker — server-side search via /api/users/search
// ============================================================
interface SearchUser { id: string; name: string; email: string; role: string }

function UserPicker({
  token,
  value,
  displayName,
  onChange,
}: {
  token: string;
  value: string | null | undefined;
  displayName?: string | null;
  onChange: (id: string | null, name: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [fetching, setFetching] = useState(false);

  // Fetch on open and on search change
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFetching(true);
    const url = `/api/users/search?token=${encodeURIComponent(token)}&q=${encodeURIComponent(search)}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setResults(d.users ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [open, search, token]);

  const handleSelect = (u: SearchUser) => {
    onChange(u.id, u.name);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  const label = displayName ?? (value ? '...' : '— Выбрать —');

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-40 h-7 text-xs justify-between font-normal px-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate text-left flex-1">{label}</span>
          {displayName || value ? (
            <X className="ml-1 h-3 w-3 shrink-0 opacity-50 hover:opacity-100" onClick={handleClear} />
          ) : (
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center border-b px-3 py-1.5 gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder="Поиск по имени..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground py-1"
          />
          {fetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
        </div>
        <div className="max-h-56 overflow-y-auto">
          {results.length === 0 && !fetching ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {search ? 'Не найдено' : 'Начните вводить имя'}
            </p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left transition-colors ${value === u.id ? 'bg-accent' : ''}`}
                onClick={() => handleSelect(u)}
              >
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Document type multi-select picker (client-side filter)
// ============================================================
function DocTypePicker({
  docTypes,
  selectedIds,
  onChange,
}: {
  docTypes: DocumentType[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = docTypes.filter((dt) =>
    dt.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedNames = selectedIds
    .map((id) => docTypes.find((dt) => dt.id === id)?.name)
    .filter(Boolean);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full h-auto min-h-9 justify-between font-normal text-sm px-3 py-2"
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {selectedNames.length === 0 ? (
              <span className="text-muted-foreground">Выберите типы документов...</span>
            ) : (
              selectedNames.map((name, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-medium"
                >
                  {name}
                </span>
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <div className="flex items-center border-b px-3 py-1.5 gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder="Поиск типа документа..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground py-1"
          />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Не найдено</p>
          ) : (
            filtered.map((dt) => {
              const selected = selectedIds.includes(dt.id);
              return (
                <button
                  key={dt.id}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left transition-colors ${selected ? 'bg-accent/60' : ''}`}
                  onClick={() => toggle(dt.id)}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-emerald-600 border-emerald-600' : 'border-muted-foreground/30'}`}>
                    {selected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="flex-1 truncate">{dt.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{dt.systemName}</span>
                </button>
              );
            })
          )}
        </div>
        {selectedIds.length > 0 && (
          <div className="border-t px-3 py-2 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Выбрано: {selectedIds.length}</span>
            <button
              className="text-xs text-rose-500 hover:text-rose-600"
              onClick={() => onChange([])}
            >
              Очистить
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Main Component
// ============================================================
export function AdminProcessesPage() {
  const { token } = useStore();
  const [processes, setProcesses] = useState<ProcessDefinition[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessDefinition | null>(null);
  const [form, setForm] = useState<ProcessFormData>(DEFAULT_PROCESS_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [stepsExpanded, setStepsExpanded] = useState<string | null>(null);

  const loadProcesses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [procData, usersData, deptsData, typesData] = await Promise.allSettled([
        apiFetch<ProcessDefinition[]>('/api/processes', token),
        apiFetch<{ users: UserType[] }>('/api/users', token),
        apiFetch<{ departments: Department[] }>('/api/departments', token),
        apiFetch<{ types: DocumentType[] }>('/api/document-types', token),
      ]);
      if (procData.status === 'fulfilled') setProcesses(procData.value as ProcessDefinition[]);
      if (usersData.status === 'fulfilled') setUsers(((usersData.value as any).users ?? usersData.value) as UserType[]);
      if (deptsData.status === 'fulfilled') setDepartments(((deptsData.value as any).departments ?? deptsData.value) as Department[]);
      if (typesData.status === 'fulfilled') setDocTypes(((typesData.value as any).types ?? typesData.value) as DocumentType[]);
    } catch {
      toast.error('Ошибка загрузки процессов');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProcesses();
  }, [loadProcesses]);

  const openCreate = () => {
    setEditingProcess(null);
    setForm(DEFAULT_PROCESS_FORM);
    setDialogOpen(true);
  };

  const openEdit = (process: ProcessDefinition) => {
    setEditingProcess(process);
    let steps: ProcessStep[] = [];
    try {
      steps = JSON.parse(process.steps);
    } catch {
      steps = [];
    }
    setForm({
      name: process.name,
      description: process.description || '',
      systemName: process.systemName,
      status: process.status,
      steps,
      documentTypeIds: (process.documentTypes ?? []).map((dt) => dt.id),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!token || !form.name.trim() || !form.systemName.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        systemName: form.systemName,
        status: form.status,
        steps: form.steps,
        documentTypeIds: form.documentTypeIds,
      };
      if (editingProcess) {
        await apiFetch(`/api/processes/${editingProcess.id}`, token, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        toast.success('Процесс обновлён');
      } else {
        await apiFetch('/api/processes', token, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Процесс создан');
      }
      setDialogOpen(false);
      loadProcesses();
    } catch {
      toast.error('Ошибка сохранения процесса');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (processId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/processes/${processId}`, token, { method: 'DELETE' });
      setProcesses((prev) => prev.filter((p) => p.id !== processId));
      toast.success('Процесс удалён');
    } catch {
      toast.error('Ошибка удаления процесса');
    }
  };

  // Step management
  const addStep = (type: ProcessStep['type'] = 'APPROVAL') => {
    const newStep: ProcessStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: STEP_TYPE_LABELS[type] || 'Новый шаг',
      type,
      assigneeRole: 'ADMIN',
      assigneeType: 'role',
      userId: null,
      departmentId: null,
      order: form.steps.length + 1,
      ...((type === 'APPROVAL' || type === 'NOTIFICATION' || type === 'SIGNATURE') ? { sendEmail: true } : {}),
      ...(type === 'STATUS_CHANGE' ? { targetStatus: 'APPROVED' } : {}),
      ...(type === 'GRANT_ACCESS' ? { grantAccessConfig: { grantType: 'role' as const, role: 'USER' as const, permission: 'VIEW' as const } } : {}),
    };
    setForm((f) => ({ ...f, steps: [...f.steps, newStep] }));
  };

  const updateStep = (stepId: string, updates: Partial<ProcessStep>) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
    }));
  };

  const removeStep = (stepId: string) => {
    const updated = form.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setForm((f) => ({ ...f, steps: updated }));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= form.steps.length) return;
    const updated = [...form.steps];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((s, i) => (s.order = i + 1));
    setForm((f) => ({ ...f, steps: updated }));
  };

  const getStepCount = (stepsJson: string): number => {
    try {
      return JSON.parse(stepsJson).length;
    } catch {
      return 0;
    }
  };

  const filtered = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.systemName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Процессы</h1>
          <p className="text-muted-foreground mt-1">Управление BPMN-процессами и маршрутами согласования</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Новый процесс
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="hidden sm:table-cell">Описание</TableHead>
                <TableHead>Версия</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="hidden md:table-cell">Шаги</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Процессы не найдены
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((process) => {
                  const stepCount = getStepCount(process.steps);
                  return (
                    <TableRow key={process.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>{process.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {process.systemName}
                        </p>
                        {process.documentTypes && process.documentTypes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {process.documentTypes.map((dt) => (
                              <span
                                key={dt.id}
                                className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] font-medium border border-emerald-200 dark:border-emerald-800"
                              >
                                {dt.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                        {process.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          v{process.version}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${STATUS_BADGE_CLASSES[process.status] || ''}`}
                        >
                          {STATUS_LABELS[process.status] || process.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {stepCount} {stepCount === 1 ? 'шаг' : stepCount < 5 ? 'шага' : 'шагов'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setStepsExpanded(
                                  stepsExpanded === process.id ? null : process.id
                                )
                              }
                              className="gap-2"
                            >
                              <GitBranch className="w-4 h-4" />
                              {stepsExpanded === process.id ? 'Скрыть шаги' : 'Показать шаги'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(process)} className="gap-2">
                              <Pencil className="w-4 h-4" />
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="gap-2 text-rose-600 focus:text-rose-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Удалить
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Удалить процесс?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Вы уверены, что хотите удалить процесс &quot;{process.name}&quot;?
                                    Это действие нельзя отменить.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-rose-600 hover:bg-rose-700"
                                    onClick={() => handleDelete(process.id)}
                                  >
                                    Удалить
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Expanded Steps */}
      {stepsExpanded && (
        <StepsPreview
          process={processes.find((p) => p.id === stepsExpanded)!}
          users={users}
          departments={departments}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>
              {editingProcess ? 'Редактировать процесс' : 'Новый процесс'}
            </DialogTitle>
            <DialogDescription>
              {editingProcess
                ? 'Измените параметры процесса и шаги'
                : 'Настройте новый BPMN-процесс'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="process-name">Название</Label>
                <Input
                  id="process-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Согласование документа"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="process-system-name">Системное имя</Label>
                <Input
                  id="process-system-name"
                  value={form.systemName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      systemName: e.target.value
                        .toUpperCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^A-Z0-9_]/g, ''),
                    }))
                  }
                  placeholder="DOCUMENT_APPROVAL"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="process-description">Описание</Label>
              <Textarea
                id="process-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Описание процесса..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="process-status">Статус</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm((f) => ({ ...f, status: val }))}
              >
                <SelectTrigger id="process-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Черновик</SelectItem>
                  <SelectItem value="ACTIVE">Активен</SelectItem>
                  <SelectItem value="ARCHIVED">Архив</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Типы документов</Label>
              <DocTypePicker
                docTypes={docTypes}
                selectedIds={form.documentTypeIds}
                onChange={(ids) => setForm((f) => ({ ...f, documentTypeIds: ids }))}
              />
              <p className="text-xs text-muted-foreground">
                Процесс будет доступен для этих типов документов
              </p>
            </div>

            <Separator />

            {/* Step Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Шаги процесса</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Plus className="w-3.5 h-3.5" />
                      Добавить шаг
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.entries(STEP_TYPE_LABELS).map(([key, label]) => {
                      const Icon = STEP_TYPE_ICONS[key];
                      return (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => addStep(key as ProcessStep['type'])}
                          className="gap-2"
                        >
                          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
                          {label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {form.steps.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-8">
                    <GitBranch className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Нет шагов</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Добавьте шаги для определения процесса
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {form.steps.map((step, index) => {
                    const StepIcon = STEP_TYPE_ICONS[step.type] || Play;
                    return (
                      <Card key={step.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            {/* Reorder */}
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                className="text-muted-foreground/40 hover:text-muted-foreground"
                                onClick={() => moveStep(index, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="text-muted-foreground/40 hover:text-muted-foreground"
                                onClick={() => moveStep(index, 'down')}
                                disabled={index === form.steps.length - 1}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Step number */}
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                              {index + 1}
                            </div>

                            {/* Type icon */}
                            <div
                              className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                                STEP_TYPE_COLORS[step.type] || 'bg-muted text-muted-foreground'
                              }`}
                            >
                              <StepIcon className="w-4 h-4" />
                            </div>

                            {/* Step fields */}
                            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                              <Input
                                value={step.name}
                                onChange={(e) =>
                                  updateStep(step.id, { name: e.target.value })
                                }
                                className="h-7 text-sm min-w-[120px]"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex items-center gap-2 flex-wrap">
                                <Select
                                  value={step.type}
                                  onValueChange={(val) =>
                                    updateStep(step.id, {
                                      type: val as ProcessStep['type'],
                                      name:
                                        STEP_TYPE_LABELS[val] === step.name
                                          ? STEP_TYPE_LABELS[val] || step.name
                                          : step.name,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-28 sm:w-32 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(STEP_TYPE_LABELS).map(([key, label]) => (
                                      <SelectItem key={key} value={key} className="text-xs">
                                        {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {/* Assignee selector — user/dept for APPROVAL/NOTIFICATION/SIGNATURE, none for END */}
                                {step.type === 'APPROVAL' || step.type === 'NOTIFICATION' || step.type === 'SIGNATURE' ? (
                                  <>
                                    <Select
                                      value={step.assigneeType || 'role'}
                                      onValueChange={(val) =>
                                        updateStep(step.id, {
                                          assigneeType: val as ProcessStep['assigneeType'],
                                          userId: null,
                                          departmentId: null,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="w-24 sm:w-28 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="role" className="text-xs">По роли</SelectItem>
                                        <SelectItem value="user" className="text-xs">Пользователь</SelectItem>
                                        <SelectItem value="department" className="text-xs">Отдел</SelectItem>
                                        <SelectItem value="initiator" className="text-xs">Инициатор</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {(step.assigneeType === 'role' || !step.assigneeType) && (
                                      <Select
                                        value={step.assigneeRole}
                                        onValueChange={(val) =>
                                          updateStep(step.id, { assigneeRole: val as ProcessStep['assigneeRole'] })
                                        }
                                      >
                                        <SelectTrigger className="w-24 sm:w-28 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Object.entries(ASSIGNEE_ROLE_LABELS).map(([key, label]) => (
                                            <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                    {step.assigneeType === 'user' && (
                                      <UserPicker
                                        token={token!}
                                        value={step.userId}
                                        displayName={step.userName}
                                        onChange={(id, name) =>
                                          updateStep(step.id, { userId: id, userName: name })
                                        }
                                      />
                                    )}
                                    {step.assigneeType === 'department' && (
                                      <Select
                                        value={step.departmentId || '__none__'}
                                        onValueChange={(val) =>
                                          updateStep(step.id, { departmentId: val === '__none__' ? null : val })
                                        }
                                      >
                                        <SelectTrigger className="w-32 sm:w-40 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                          <SelectValue placeholder="Выбрать..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__" className="text-xs">— Выбрать —</SelectItem>
                                          {departments.map((d) => (
                                            <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                    {step.assigneeType === 'initiator' && (
                                      <span className="text-xs text-muted-foreground italic">Инициатор документа</span>
                                    )}
                                  </>
                                ) : step.type === 'START' ? (
                                  <span className="text-xs text-muted-foreground italic">Инициатор документа</span>
                                ) : step.type === 'END' ? (
                                  <span className="text-xs text-muted-foreground italic">Документооборот завершён</span>
                                ) : step.type === 'STATUS_CHANGE' ? (
                                  <Select
                                    value={step.targetStatus || 'APPROVED'}
                                    onValueChange={(val) => updateStep(step.id, { targetStatus: val })}
                                  >
                                    <SelectTrigger className="w-36 h-7 text-xs border-teal-200 dark:border-teal-800" onClick={(e) => e.stopPropagation()}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="IN_PROGRESS" className="text-xs">В работе</SelectItem>
                                      <SelectItem value="APPROVED" className="text-xs">Утверждён</SelectItem>
                                      <SelectItem value="REJECTED" className="text-xs">Отклонён</SelectItem>
                                      <SelectItem value="COMPLETED" className="text-xs">Завершён</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : step.type === 'GRANT_ACCESS' ? (
                                  <>
                                    <Select
                                      value={step.grantAccessConfig?.permission || 'VIEW'}
                                      onValueChange={(val) =>
                                        updateStep(step.id, {
                                          grantAccessConfig: {
                                            ...(step.grantAccessConfig || { grantType: 'role' }),
                                            permission: val as 'VIEW' | 'EDIT',
                                          },
                                        })
                                      }
                                    >
                                      <SelectTrigger className="w-32 h-7 text-xs border-orange-200 dark:border-orange-800" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="VIEW" className="text-xs">Просмотр</SelectItem>
                                        <SelectItem value="EDIT" className="text-xs">Редактирование</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={step.grantAccessConfig?.grantType || 'role'}
                                      onValueChange={(val) =>
                                        updateStep(step.id, {
                                          grantAccessConfig: {
                                            ...(step.grantAccessConfig || { permission: 'VIEW' }),
                                            grantType: val as GrantAccessConfig['grantType'],
                                            userId: null,
                                            userName: null,
                                            departmentId: null,
                                            role: null,
                                          },
                                        })
                                      }
                                    >
                                      <SelectTrigger className="w-28 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="role" className="text-xs">По роли</SelectItem>
                                        <SelectItem value="user" className="text-xs">Пользователь</SelectItem>
                                        <SelectItem value="department" className="text-xs">Отдел</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {(step.grantAccessConfig?.grantType === 'role' || !step.grantAccessConfig?.grantType) && (
                                      <Select
                                        value={step.grantAccessConfig?.role || 'USER'}
                                        onValueChange={(val) =>
                                          updateStep(step.id, {
                                            grantAccessConfig: {
                                              ...(step.grantAccessConfig || { permission: 'VIEW', grantType: 'role' }),
                                              role: val as 'ADMIN' | 'ADVANCED' | 'USER',
                                            },
                                          })
                                        }
                                      >
                                        <SelectTrigger className="w-28 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Object.entries(ASSIGNEE_ROLE_LABELS).map(([key, label]) => (
                                            <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                    {step.grantAccessConfig?.grantType === 'user' && (
                                      <UserPicker
                                        token={token!}
                                        value={step.grantAccessConfig?.userId}
                                        displayName={step.grantAccessConfig?.userName}
                                        onChange={(id, name) =>
                                          updateStep(step.id, {
                                            grantAccessConfig: {
                                              ...(step.grantAccessConfig || { permission: 'VIEW', grantType: 'user' }),
                                              userId: id,
                                              userName: name,
                                            },
                                          })
                                        }
                                      />
                                    )}
                                    {step.grantAccessConfig?.grantType === 'department' && (
                                      <Select
                                        value={step.grantAccessConfig?.departmentId || '__none__'}
                                        onValueChange={(val) =>
                                          updateStep(step.id, {
                                            grantAccessConfig: {
                                              ...(step.grantAccessConfig || { permission: 'VIEW', grantType: 'department' }),
                                              departmentId: val === '__none__' ? null : val,
                                            },
                                          })
                                        }
                                      >
                                        <SelectTrigger className="w-40 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                          <SelectValue placeholder="Выбрать отдел..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__" className="text-xs">— Выбрать —</SelectItem>
                                          {departments.map((d) => (
                                            <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {/* Delete */}
                            <button
                              className="p-1 rounded text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                              onClick={() => removeStep(step.id)}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Send email for APPROVAL/NOTIFICATION/SIGNATURE steps */}
                          {(step.type === 'APPROVAL' || step.type === 'NOTIFICATION' || step.type === 'SIGNATURE') && (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`send-email-${step.id}`}
                                checked={step.sendEmail ?? true}
                                onChange={(e) => updateStep(step.id, { sendEmail: e.target.checked })}
                                className="h-3.5 w-3.5 rounded border-border accent-emerald-600"
                              />
                              <label htmlFor={`send-email-${step.id}`} className="text-xs cursor-pointer flex items-center gap-1.5 text-muted-foreground select-none">
                                <Mail className="w-3 h-3 text-blue-500" />
                                Отправить e-mail уведомление исполнителю
                              </label>
                            </div>
                          )}

                          {/* SLA matrix for APPROVAL/SIGNATURE steps */}
                          {(step.type === 'APPROVAL' || step.type === 'SIGNATURE') && (() => {
                            let slaEnabled = false;
                            let slaHours: SlaConfig = { ...DEFAULT_SLA };
                            if (step.slaConfig) {
                              try {
                                const parsed = JSON.parse(step.slaConfig);
                                slaEnabled = true;
                                slaHours = {
                                  LOW:      typeof parsed.LOW      === 'number' ? parsed.LOW      : DEFAULT_SLA.LOW,
                                  MEDIUM:   typeof parsed.MEDIUM   === 'number' ? parsed.MEDIUM   : DEFAULT_SLA.MEDIUM,
                                  HIGH:     typeof parsed.HIGH     === 'number' ? parsed.HIGH     : DEFAULT_SLA.HIGH,
                                  CRITICAL: typeof parsed.CRITICAL === 'number' ? parsed.CRITICAL : DEFAULT_SLA.CRITICAL,
                                };
                              } catch { /* ignore */ }
                            }
                            return (
                              <div className={`mt-3 pt-3 border-t ${step.type === 'SIGNATURE' ? 'border-indigo-100 dark:border-indigo-900/30' : 'border-amber-100 dark:border-amber-900/30'} space-y-2`}>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`sla-${step.id}`}
                                    checked={slaEnabled}
                                    onChange={(e) =>
                                      updateStep(step.id, {
                                        slaConfig: e.target.checked ? JSON.stringify(DEFAULT_SLA) : null,
                                      })
                                    }
                                    className="h-3.5 w-3.5 rounded border-border accent-emerald-600"
                                  />
                                  <Label htmlFor={`sla-${step.id}`} className={`text-xs cursor-pointer ${step.type === 'SIGNATURE' ? 'text-indigo-700 dark:text-indigo-400' : 'text-amber-700 dark:text-amber-400'} font-medium`}>
                                    SLA матрица (контроль сроков по срочности)
                                  </Label>
                                  {slaEnabled && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                      {slaHours.LOW}/{slaHours.MEDIUM}/{slaHours.HIGH}/{slaHours.CRITICAL}ч
                                    </span>
                                  )}
                                </div>
                                {slaEnabled && (
                                  <div className="rounded-md border border-border overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-muted/50 border-b border-border">
                                          <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Срочность</th>
                                          <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Рабочих часов</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as UrgencyLevel[]).map((level) => (
                                          <tr key={level} className="border-b border-border/50 last:border-0">
                                            <td className="px-2 py-1.5 text-muted-foreground">{URGENCY_LABELS[level]}</td>
                                            <td className="px-2 py-1.5">
                                              <input
                                                type="number"
                                                min={1}
                                                max={999}
                                                value={slaHours[level]}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value, 10);
                                                  if (Number.isFinite(val) && val > 0) {
                                                    updateStep(step.id, { slaConfig: JSON.stringify({ ...slaHours, [level]: val }) });
                                                  }
                                                }}
                                                className="w-16 h-6 text-xs text-right rounded border border-border bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 ml-auto block"
                                              />
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Condition editor */}
                          {step.type === 'CONDITION' && (
                            <div className="mt-3 pt-3 border-t border-violet-100 dark:border-violet-900/30 space-y-3">
                              <p className="text-xs font-medium text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                                <GitMerge className="w-3.5 h-3.5" />
                                Настройка условия
                              </p>

                              {/* Condition source selector */}
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Тип условия</Label>
                                <Select
                                  value={step.condition?.conditionSource || 'document_field'}
                                  onValueChange={(val) =>
                                    updateStep(step.id, {
                                      condition: {
                                        ...(step.condition || { fieldSystemName: '', operator: '==' as ConditionOperator, value: '', trueStepId: '', falseStepId: '' }),
                                        conditionSource: val as 'document_field' | 'last_decision',
                                      },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="document_field" className="text-xs">По полю документа</SelectItem>
                                    <SelectItem value="last_decision" className="text-xs">По последнему решению</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* last_decision config */}
                              {(step.condition?.conditionSource === 'last_decision') && (
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Значение решения</Label>
                                  <Select
                                    value={step.condition?.checkValue || 'APPROVED_WITH_CHANGES'}
                                    onValueChange={(val) =>
                                      updateStep(step.id, {
                                        condition: {
                                          ...(step.condition || { fieldSystemName: '', operator: '==' as ConditionOperator, value: '', trueStepId: '', falseStepId: '' }),
                                          checkValue: val,
                                        },
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="APPROVED_WITH_CHANGES" className="text-xs">Согласовано с изменениями</SelectItem>
                                      <SelectItem value="APPROVED" className="text-xs">Согласовано</SelectItem>
                                      <SelectItem value="REJECTED" className="text-xs">Отклонено</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* document_field config */}
                              {(!step.condition?.conditionSource || step.condition?.conditionSource === 'document_field') && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Поле документа</Label>
                                    <Input
                                      value={step.condition?.fieldSystemName || ''}
                                      onChange={(e) =>
                                        updateStep(step.id, {
                                          condition: {
                                            ...(step.condition || { operator: '>' as ConditionOperator, value: '', trueStepId: '', falseStepId: '' }),
                                            fieldSystemName: e.target.value,
                                          },
                                        })
                                      }
                                      className="h-7 text-xs font-mono"
                                      placeholder="contract_amount"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Оператор</Label>
                                    <Select
                                      value={step.condition?.operator || '>'}
                                      onValueChange={(val) =>
                                        updateStep(step.id, {
                                          condition: {
                                            ...(step.condition || { fieldSystemName: '', value: '', trueStepId: '', falseStepId: '' }),
                                            operator: val as ConditionOperator,
                                          },
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(CONDITION_OPERATOR_LABELS).map(([key, label]) => (
                                          <SelectItem key={key} value={key} className="text-xs">
                                            {label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {step.condition?.operator !== 'is_empty' && step.condition?.operator !== 'is_not_empty' && (
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Значение</Label>
                                      <Input
                                        value={step.condition?.value || ''}
                                        onChange={(e) =>
                                          updateStep(step.id, {
                                            condition: {
                                              ...(step.condition || { fieldSystemName: '', operator: '>' as ConditionOperator, trueStepId: '', falseStepId: '' }),
                                              value: e.target.value,
                                            },
                                          })
                                        }
                                        className="h-7 text-xs"
                                        placeholder="100000"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Jump targets — shared for both sources */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <ChevronRight className="w-3 h-3" />
                                    Да → перейти к шагу
                                  </Label>
                                  <Select
                                    value={step.condition?.trueStepId || '__none__'}
                                    onValueChange={(val) =>
                                      updateStep(step.id, {
                                        condition: {
                                          ...(step.condition || { fieldSystemName: '', operator: '>' as ConditionOperator, value: '', falseStepId: '' }),
                                          trueStepId: val === '__none__' ? '' : val,
                                        },
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs border-emerald-200 dark:border-emerald-800" onClick={(e) => e.stopPropagation()}>
                                      <SelectValue placeholder="Следующий по порядку" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__" className="text-xs text-muted-foreground">Следующий по порядку</SelectItem>
                                      {form.steps.filter((s) => s.id !== step.id && s.type !== 'START').map((s) => (
                                        <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                    <ChevronRight className="w-3 h-3" />
                                    Нет → перейти к шагу
                                  </Label>
                                  <Select
                                    value={step.condition?.falseStepId || '__none__'}
                                    onValueChange={(val) =>
                                      updateStep(step.id, {
                                        condition: {
                                          ...(step.condition || { fieldSystemName: '', operator: '>' as ConditionOperator, value: '', trueStepId: '' }),
                                          falseStepId: val === '__none__' ? '' : val,
                                        },
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs border-rose-200 dark:border-rose-800" onClick={(e) => e.stopPropagation()}>
                                      <SelectValue placeholder="Следующий по порядку" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__" className="text-xs text-muted-foreground">Следующий по порядку</SelectItem>
                                      {form.steps.filter((s) => s.id !== step.id && s.type !== 'START').map((s) => (
                                        <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Summary */}
                              <p className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
                                {step.condition?.conditionSource === 'last_decision' ? (
                                  <>
                                    Если последнее решение{' '}
                                    <span className="font-medium">
                                      {step.condition.checkValue === 'APPROVED_WITH_CHANGES' ? 'согласовано с изменениями' :
                                       step.condition.checkValue === 'APPROVED' ? 'согласовано' :
                                       step.condition.checkValue === 'REJECTED' ? 'отклонено' :
                                       step.condition.checkValue}
                                    </span>
                                    {step.condition.trueStepId && <> → Да: <span className="font-mono">{form.steps.find(s => s.id === step.condition!.trueStepId)?.name || step.condition.trueStepId}</span></>}
                                    {step.condition.falseStepId && <>, Нет: <span className="font-mono">{form.steps.find(s => s.id === step.condition!.falseStepId)?.name || step.condition.falseStepId}</span></>}
                                  </>
                                ) : (
                                  <>
                                    {step.condition?.fieldSystemName && <>Если <span className="font-mono text-violet-600 dark:text-violet-400">{step.condition.fieldSystemName}</span></>}
                                    {step.condition?.operator && <>{' '}<span className="font-medium">{CONDITION_OPERATOR_LABELS[step.condition.operator]}</span></>}
                                    {step.condition?.operator !== 'is_empty' && step.condition?.operator !== 'is_not_empty' && step.condition?.value && (
                                      <> <span className="font-mono">{step.condition.value}</span></>
                                    )}
                                    {step.condition?.trueStepId && <> → Да: шаг <span className="font-mono">{form.steps.find(s => s.id === step.condition!.trueStepId)?.name || step.condition.trueStepId}</span></>}
                                    {step.condition?.falseStepId && <>, Нет: шаг <span className="font-mono">{form.steps.find(s => s.id === step.condition!.falseStepId)?.name || step.condition.falseStepId}</span></>}
                                  </>
                                )}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingProcess ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ============================================================
// Steps Preview Sub-component
// ============================================================
function StepsPreview({
  process,
  users,
  departments,
}: {
  process: ProcessDefinition;
  users: UserType[];
  departments: Department[];
}) {
  let steps: ProcessStep[] = [];
  try {
    steps = JSON.parse(process.steps);
  } catch {
    // empty
  }

  if (steps.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Шаги: {process.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Нет настроенных шагов</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Шаги: {process.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex flex-col gap-0">
          {steps.map((step, index) => {
            const StepIcon = STEP_TYPE_ICONS[step.type] || Play;
            return (
              <div key={step.id} className="flex items-start gap-3">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      STEP_TYPE_COLORS[step.type] || 'bg-muted'
                    }`}
                  >
                    <StepIcon className="w-4 h-4" />
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-0.5 h-6 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {STEP_TYPE_LABELS[step.type] || step.type}
                    </Badge>
                    {step.type === 'START' && (
                      <span className="text-xs text-muted-foreground">→ Инициатор документа</span>
                    )}
                    {step.type === 'STATUS_CHANGE' && (
                      <span className="text-xs text-muted-foreground">
                        → {DOC_STATUS_LABELS[step.targetStatus || 'APPROVED'] ?? step.targetStatus ?? '—'}
                      </span>
                    )}
                    {step.type === 'GRANT_ACCESS' && step.grantAccessConfig && (() => {
                      const cfg = step.grantAccessConfig!;
                      const permLabel = cfg.permission === 'EDIT' ? 'Редактирование' : 'Просмотр';
                      let target = '—';
                      if (cfg.grantType === 'user') {
                        const u = users.find((x) => x.id === cfg.userId);
                        target = u?.name ?? cfg.userName ?? cfg.userId ?? '—';
                      } else if (cfg.grantType === 'department') {
                        const d = departments.find((x) => x.id === cfg.departmentId);
                        target = `отдел: ${d?.name ?? cfg.departmentId ?? '—'}`;
                      } else {
                        target = `роль: ${ASSIGNEE_ROLE_LABELS[cfg.role || 'USER'] || cfg.role || '—'}`;
                      }
                      return <span className="text-xs text-muted-foreground">→ {permLabel} / {target}</span>;
                    })()}
                    {(step.type === 'APPROVAL' || step.type === 'NOTIFICATION') && (() => {
                      if (step.assigneeType === 'initiator') {
                        return <span className="text-xs text-muted-foreground">→ Инициатор документа</span>;
                      }
                      if (step.assigneeType === 'user' && step.userId) {
                        const u = users.find((x) => x.id === step.userId);
                        return <span className="text-xs text-muted-foreground">→ {u?.name ?? step.userName ?? step.userId}</span>;
                      }
                      if (step.assigneeType === 'department' && step.departmentId) {
                        const d = departments.find((x) => x.id === step.departmentId);
                        return <span className="text-xs text-muted-foreground">→ отдел: {d?.name ?? step.departmentId}</span>;
                      }
                      return <span className="text-xs text-muted-foreground">→ {ASSIGNEE_ROLE_LABELS[step.assigneeRole] || step.assigneeRole}</span>;
                    })()}
                  </div>
                  {step.type === 'CONDITION' && step.condition && (
                    <div className="mt-2 text-[10px] bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/30 rounded px-2 py-1.5 space-y-0.5">
                      <p className="font-medium text-violet-700 dark:text-violet-400 flex items-center gap-1">
                        <GitMerge className="w-3 h-3" />
                        {step.condition.conditionSource === 'last_decision' ? 'По последнему решению' : 'Условие'}
                      </p>
                      {step.condition.conditionSource === 'last_decision' ? (
                        <p className="text-muted-foreground">
                          Решение{' '}
                          <span className="font-medium text-violet-600 dark:text-violet-400">
                            {step.condition.checkValue === 'APPROVED_WITH_CHANGES' ? 'согласовано с изменениями' :
                             step.condition.checkValue === 'APPROVED' ? 'согласовано' :
                             step.condition.checkValue === 'REJECTED' ? 'отклонено' :
                             step.condition.checkValue || '—'}
                          </span>
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          <span className="font-mono text-violet-600 dark:text-violet-400">{step.condition.fieldSystemName || '—'}</span>
                          {' '}{CONDITION_OPERATOR_LABELS[step.condition.operator] || step.condition.operator}
                          {step.condition.operator !== 'is_empty' && step.condition.operator !== 'is_not_empty' && step.condition.value && (
                            <> <span className="font-mono">{step.condition.value}</span></>
                          )}
                        </p>
                      )}
                      {(step.condition.trueStepId || step.condition.falseStepId) && (
                        <div className="flex gap-3 mt-0.5">
                          {step.condition.trueStepId && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ✓ Да → {steps.find(s => s.id === step.condition!.trueStepId)?.name || step.condition.trueStepId}
                            </span>
                          )}
                          {step.condition.falseStepId && (
                            <span className="text-rose-600 dark:text-rose-400">
                              ✗ Нет → {steps.find(s => s.id === step.condition!.falseStepId)?.name || step.condition.falseStepId}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
