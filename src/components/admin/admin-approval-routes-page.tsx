'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GitMerge,
  MoreHorizontal,
  User,
  Building2,
  GripVertical,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { ApprovalRoute, Department, User as UserType } from '@/lib/types';
import { DEFAULT_SLA, URGENCY_LABELS, type SlaConfig, type UrgencyLevel } from '@/lib/sla';

const URGENCY_LEVELS: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface StepDraft {
  id: string;
  name: string;
  assigneeType: 'user' | 'department';
  userId: string;
  departmentId: string;
  slaEnabled: boolean;
  slaHours: SlaConfig;
}

function makeStep(): StepDraft {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    assigneeType: 'user',
    userId: '',
    departmentId: '',
    slaEnabled: false,
    slaHours: { ...DEFAULT_SLA },
  };
}

function parseSlaForDraft(slaConfig: string | null | undefined): { slaEnabled: boolean; slaHours: SlaConfig } {
  if (!slaConfig) return { slaEnabled: false, slaHours: { ...DEFAULT_SLA } };
  try {
    const parsed = JSON.parse(slaConfig);
    return {
      slaEnabled: true,
      slaHours: {
        LOW:      typeof parsed.LOW      === 'number' ? parsed.LOW      : DEFAULT_SLA.LOW,
        MEDIUM:   typeof parsed.MEDIUM   === 'number' ? parsed.MEDIUM   : DEFAULT_SLA.MEDIUM,
        HIGH:     typeof parsed.HIGH     === 'number' ? parsed.HIGH     : DEFAULT_SLA.HIGH,
        CRITICAL: typeof parsed.CRITICAL === 'number' ? parsed.CRITICAL : DEFAULT_SLA.CRITICAL,
      },
    };
  } catch {
    return { slaEnabled: false, slaHours: { ...DEFAULT_SLA } };
  }
}

export function AdminApprovalRoutesPage() {
  const { token } = useStore();
  const [routes, setRoutes] = useState<ApprovalRoute[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalRoute | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([makeStep()]);
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [routesData, usersData, deptsData] = await Promise.allSettled([
        apiFetch<{ routes: ApprovalRoute[] }>('/api/approval-routes', token),
        apiFetch<{ users: UserType[] }>('/api/users', token),
        apiFetch<{ departments: Department[] }>('/api/departments', token),
      ]);
      if (routesData.status === 'fulfilled') setRoutes((routesData.value as any).routes ?? []);
      if (usersData.status === 'fulfilled') setUsers((usersData.value as any).users ?? []);
      if (deptsData.status === 'fulfilled') setDepartments((deptsData.value as any).departments ?? []);
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setSteps([makeStep()]);
    setDialogOpen(true);
  };

  const openEdit = (route: ApprovalRoute) => {
    setEditing(route);
    setName(route.name);
    setDescription(route.description ?? '');
    setSteps(
      route.steps.map((s) => {
        const { slaEnabled, slaHours } = parseSlaForDraft(s.slaConfig);
        return {
          id: s.id,
          name: s.name,
          assigneeType: s.userId ? 'user' : 'department',
          userId: s.userId ?? '',
          departmentId: s.departmentId ?? '',
          slaEnabled,
          slaHours,
        };
      }),
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!token || !name.trim()) return;
    for (const s of steps) {
      if (!s.name.trim()) { toast.error('Укажите название каждого шага'); return; }
      if (s.assigneeType === 'user' && !s.userId) { toast.error('Выберите пользователя для каждого шага'); return; }
      if (s.assigneeType === 'department' && !s.departmentId) { toast.error('Выберите отдел для каждого шага'); return; }
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        steps: steps.map((s) => ({
          name: s.name,
          userId: s.assigneeType === 'user' ? s.userId : null,
          departmentId: s.assigneeType === 'department' ? s.departmentId : null,
          slaConfig: s.slaEnabled ? JSON.stringify(s.slaHours) : null,
        })),
      };
      if (editing) {
        await apiFetch(`/api/approval-routes/${editing.id}`, token, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Маршрут обновлён');
      } else {
        await apiFetch('/api/approval-routes', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Маршрут создан');
      }
      setDialogOpen(false);
      load();
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/approval-routes/${id}`, token, { method: 'DELETE' });
      setRoutes((prev) => prev.filter((r) => r.id !== id));
      toast.success('Маршрут удалён');
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка удаления');
    }
  };

  const addStep = () => setSteps((prev) => [...prev, makeStep()]);
  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx));
  const updateStep = (idx: number, patch: Partial<StepDraft>) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const moveStep = (idx: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Маршруты согласования</h1>
          <p className="text-muted-foreground mt-1">Шаблоны последовательного согласования документов</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить маршрут
        </Button>
      </div>

      {routes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <GitMerge className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Маршруты не созданы</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => (
            <Card key={route.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <button
                      className="flex items-center gap-2 w-full text-left group"
                      onClick={() => setExpandedId(expandedId === route.id ? null : route.id)}
                    >
                      <span className="font-semibold text-foreground truncate">{route.name}</span>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {route.steps.length} шаг{route.steps.length !== 1 ? (route.steps.length < 5 ? 'а' : 'ов') : ''}
                      </Badge>
                      {expandedId === route.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
                      )}
                    </button>
                    {route.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{route.description}</p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(route)} className="gap-2">
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
                            <AlertDialogTitle>Удалить маршрут?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Маршрут будет удалён. Документы, уже отправленные по этому маршруту, сохранятся.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-rose-600 hover:bg-rose-700"
                              onClick={() => handleDelete(route.id)}
                            >
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {expandedId === route.id && (
                  <div className="mt-4 space-y-2">
                    {route.steps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-3 text-sm">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center text-xs font-semibold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-medium">{step.name}</span>
                        <span className="text-muted-foreground">—</span>
                        {step.user ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                            {step.user.name}
                          </span>
                        ) : step.department ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5" />
                            {step.department.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">не указан</span>
                        )}
                        {step.slaConfig && (() => {
                          try {
                            const sla = JSON.parse(step.slaConfig);
                            return (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                                SLA: {sla.LOW}/{sla.MEDIUM}/{sla.HIGH}/{sla.CRITICAL}ч
                              </span>
                            );
                          } catch { return null; }
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать маршрут' : 'Новый маршрут согласования'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div className="space-y-2">
              <Label htmlFor="route-name">Название маршрута</Label>
              <Input
                id="route-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Согласование договора"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="route-desc">Описание (необязательно)</Label>
              <Textarea
                id="route-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое описание маршрута"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Шаги согласования</Label>
                <Button variant="outline" size="sm" onClick={addStep} className="h-7 gap-1 text-xs">
                  <Plus className="w-3 h-3" />
                  Добавить шаг
                </Button>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={step.id} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center text-xs font-semibold shrink-0">
                        {idx + 1}
                      </span>
                      <Input
                        value={step.name}
                        onChange={(e) => updateStep(idx, { name: e.target.value })}
                        placeholder={`Название шага ${idx + 1}`}
                        className="h-8 text-sm flex-1"
                      />
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveStep(idx, -1)}
                          disabled={idx === 0}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveStep(idx, 1)}
                          disabled={idx === steps.length - 1}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                        {steps.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-500 hover:text-rose-600"
                            onClick={() => removeStep(idx)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* SLA matrix toggle + table */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`sla-enabled-${step.id}`}
                          checked={step.slaEnabled}
                          onChange={(e) => updateStep(idx, { slaEnabled: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-border accent-emerald-600"
                        />
                        <Label htmlFor={`sla-enabled-${step.id}`} className="text-xs cursor-pointer">
                          SLA матрица (контроль сроков по срочности)
                        </Label>
                      </div>

                      {step.slaEnabled && (
                        <div className="rounded-md border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 border-b border-border">
                                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Срочность</th>
                                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground">Рабочих часов</th>
                              </tr>
                            </thead>
                            <tbody>
                              {URGENCY_LEVELS.map((level) => (
                                <tr key={level} className="border-b border-border/50 last:border-0">
                                  <td className="px-2 py-1.5 text-muted-foreground">{URGENCY_LABELS[level]}</td>
                                  <td className="px-2 py-1.5">
                                    <input
                                      type="number"
                                      min={1}
                                      max={999}
                                      value={step.slaHours[level]}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (Number.isFinite(val) && val > 0) {
                                          updateStep(idx, { slaHours: { ...step.slaHours, [level]: val } });
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

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Тип исполнителя</Label>
                        <Select
                          value={step.assigneeType}
                          onValueChange={(v) =>
                            updateStep(idx, {
                              assigneeType: v as 'user' | 'department',
                              userId: '',
                              departmentId: '',
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">
                              <span className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5" />
                                Пользователь
                              </span>
                            </SelectItem>
                            <SelectItem value="department">
                              <span className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5" />
                                Отдел
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          {step.assigneeType === 'user' ? 'Пользователь' : 'Отдел'}
                        </Label>
                        {step.assigneeType === 'user' ? (
                          <Select
                            value={step.userId || '__none__'}
                            onValueChange={(v) =>
                              updateStep(idx, { userId: v === '__none__' ? '' : v })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Выбрать..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Выбрать —</SelectItem>
                              {users
                                .filter((u) => u.active)
                                .map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={step.departmentId || '__none__'}
                            onValueChange={(v) =>
                              updateStep(idx, { departmentId: v === '__none__' ? '' : v })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Выбрать..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Выбрать —</SelectItem>
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
