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
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================
interface ProcessStep {
  id: string;
  name: string;
  type: 'START' | 'APPROVAL' | 'NOTIFICATION' | 'CONDITION';
  assigneeRole: 'ADMIN' | 'ADVANCED' | 'USER';
  order: number;
}

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
}

interface ProcessFormData {
  name: string;
  description: string;
  systemName: string;
  status: string;
  steps: ProcessStep[];
}

const DEFAULT_PROCESS_FORM: ProcessFormData = {
  name: '',
  description: '',
  systemName: '',
  status: 'DRAFT',
  steps: [],
};

// ============================================================
// Step type/role labels
// ============================================================
const STEP_TYPE_LABELS: Record<string, string> = {
  START: 'Старт',
  APPROVAL: 'Согласование',
  NOTIFICATION: 'Уведомление',
  CONDITION: 'Условие',
};

const STEP_TYPE_ICONS: Record<string, React.ElementType> = {
  START: Play,
  APPROVAL: Eye,
  NOTIFICATION: Bell,
  CONDITION: HelpCircle,
};

const STEP_TYPE_COLORS: Record<string, string> = {
  START: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  APPROVAL: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  NOTIFICATION: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  CONDITION: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
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
// Main Component
// ============================================================
export function AdminProcessesPage() {
  const { token } = useStore();
  const [processes, setProcesses] = useState<ProcessDefinition[]>([]);
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
      const data = await apiFetch<ProcessDefinition[]>('/api/processes', token);
      setProcesses(data);
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
      order: form.steps.length + 1,
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
          <p className="text-muted-foreground mt-1">Управление BPMN-процессами</p>
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
                                      <SelectItem key={key} value={key} className="text-xs">
                                        {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
function StepsPreview({ process }: { process: ProcessDefinition }) {
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
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {STEP_TYPE_LABELS[step.type] || step.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      → {ASSIGNEE_ROLE_LABELS[step.assigneeRole] || step.assigneeRole}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
