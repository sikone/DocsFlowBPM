'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Save, FolderOpen, SlidersHorizontal, Clock, Timer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { DEFAULT_SLA, DEFAULT_WORKING_HOURS, URGENCY_LABELS, type UrgencyLevel } from '@/lib/sla';

const URGENCY_LEVELS: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const WEEK_DAYS = [
  { iso: 1, label: 'Пн' },
  { iso: 2, label: 'Вт' },
  { iso: 3, label: 'Ср' },
  { iso: 4, label: 'Чт' },
  { iso: 5, label: 'Пт' },
  { iso: 6, label: 'Сб' },
  { iso: 7, label: 'Вс' },
];

export function AdminSettingsPage() {
  const { token } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // File storage
  const [uploadPath, setUploadPath] = useState('');

  // Working hours
  const [workStart, setWorkStart] = useState(String(DEFAULT_WORKING_HOURS.start).padStart(2, '0') + ':00');
  const [workEnd, setWorkEnd]     = useState(String(DEFAULT_WORKING_HOURS.end).padStart(2, '0') + ':00');
  const [workingDays, setWorkingDays] = useState<number[]>(DEFAULT_WORKING_HOURS.workingDays);

  // Default SLA hours per urgency (used when a step has no individual slaConfig)
  const [slaHours, setSlaHours] = useState<Record<UrgencyLevel, number>>({ ...DEFAULT_SLA });

  useEffect(() => {
    if (!token) return;
    apiFetch<{ settings: Record<string, string> }>('/api/settings', token)
      .then(({ settings }) => {
        setUploadPath(settings.uploadPath ?? './storage/uploads');

        const start = parseInt(settings.workHoursStart ?? '', 10);
        const end   = parseInt(settings.workHoursEnd   ?? '', 10);
        setWorkStart((Number.isFinite(start) ? start : DEFAULT_WORKING_HOURS.start).toString().padStart(2, '0') + ':00');
        setWorkEnd(  (Number.isFinite(end)   ? end   : DEFAULT_WORKING_HOURS.end  ).toString().padStart(2, '0') + ':00');

        if (settings.workingDays) {
          try { setWorkingDays(JSON.parse(settings.workingDays)); } catch { /* fallback */ }
        }

        const merged = { ...DEFAULT_SLA };
        for (const level of URGENCY_LEVELS) {
          const key = `slaDefault${level}` as string;
          const val = parseInt(settings[key] ?? '', 10);
          if (Number.isFinite(val) && val > 0) merged[level] = val;
        }
        setSlaHours(merged);
      })
      .catch(() => toast.error('Ошибка загрузки настроек'))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleDay = (iso: number) =>
    setWorkingDays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()
    );

  const handleSave = async () => {
    if (!token) return;
    const startH = parseInt(workStart.split(':')[0], 10);
    const endH   = parseInt(workEnd.split(':')[0],   10);
    if (!Number.isFinite(startH) || !Number.isFinite(endH) || startH >= endH) {
      toast.error('Время начала должно быть меньше времени окончания');
      return;
    }
    if (workingDays.length === 0) {
      toast.error('Выберите хотя бы один рабочий день');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {
        uploadPath: uploadPath.trim() || './storage/uploads',
        workHoursStart: String(startH),
        workHoursEnd:   String(endH),
        workingDays: JSON.stringify(workingDays),
      };
      for (const level of URGENCY_LEVELS) {
        body[`slaDefault${level}`] = String(slaHours[level]);
      }
      await apiFetch('/api/settings', token, { method: 'PUT', body: JSON.stringify(body) });
      toast.success('Настройки сохранены');
    } catch {
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <SlidersHorizontal className="w-6 h-6 text-emerald-500" />
          Настройки системы
        </h1>
        <p className="text-slate-500 mt-1">Конфигурация приложения</p>
      </div>

      {/* File storage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-500" />
            Хранилище файлов
          </CardTitle>
          <CardDescription>
            Папка для хранения вложений документов.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upload-path">Путь к папке загрузок</Label>
            <Input
              id="upload-path"
              value={uploadPath}
              onChange={(e) => setUploadPath(e.target.value)}
              placeholder="./storage/uploads"
              className="font-mono"
            />
            <p className="text-xs text-slate-400">
              Абсолютный или относительный путь от корня проекта.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Working hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-500" />
            Рабочее время
          </CardTitle>
          <CardDescription>
            Используется для расчёта дедлайнов SLA — часы вне рабочего времени не учитываются.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1.5">
              <Label htmlFor="work-start">Начало рабочего дня</Label>
              <Input
                id="work-start"
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="work-end">Конец рабочего дня</Label>
              <Input
                id="work-end"
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Рабочие дни</Label>
            <div className="flex gap-2 flex-wrap">
              {WEEK_DAYS.map(({ iso, label }) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => toggleDay(iso)}
                  className={`w-10 h-10 rounded-md text-sm font-medium border transition-colors ${
                    workingDays.includes(iso)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-background text-muted-foreground border-border hover:border-emerald-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default SLA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="w-4 h-4 text-amber-500" />
            SLA по умолчанию
          </CardTitle>
          <CardDescription>
            Используется, когда у шага согласования нет собственной SLA матрицы.
            Значения в рабочих часах.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Срочность</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Описание</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Рабочих часов</th>
                </tr>
              </thead>
              <tbody>
                {URGENCY_LEVELS.map((level, idx) => (
                  <tr key={level} className={`border-b border-border/50 last:border-0 ${idx % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium">{URGENCY_LABELS[level]}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {level === 'LOW'      && 'Стандартные задачи без спешки'}
                      {level === 'MEDIUM'   && 'Обычный рабочий приоритет'}
                      {level === 'HIGH'     && 'Срочные задачи, требуют внимания сегодня'}
                      {level === 'CRITICAL' && 'Экстренные — максимальный приоритет'}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={slaHours[level]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (Number.isFinite(val) && val > 0)
                            setSlaHours((prev) => ({ ...prev, [level]: val }));
                        }}
                        className="w-20 h-7 text-sm text-right rounded border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 ml-auto block"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}
