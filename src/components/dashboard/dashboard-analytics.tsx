'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Document, Folder } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import { apiFetch } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FolderOpen,
  TrendingUp,
  Activity,
} from 'lucide-react';

// ─── Status Chart Colors ──────────────────────────────────────────────
const STATUS_CHART_COLORS: Record<string, string> = {
  DRAFT: '#64748b',        // slate-500
  IN_PROGRESS: '#0ea5e9',  // sky-500
  APPROVED: '#10b981',     // emerald-500
  REJECTED: '#f43f5e',     // rose-500
  COMPLETED: '#8b5cf6',    // violet-500
};

const STATUS_DOT_CLASSES: Record<string, string> = {
  DRAFT: 'bg-slate-500',
  IN_PROGRESS: 'bg-sky-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-rose-500',
  COMPLETED: 'bg-violet-500',
};

// ─── Activity Action Labels ──────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Вход в систему',
  CREATE_DOCUMENT: 'Создал документ',
  EDIT_DOCUMENT: 'Редактировал документ',
  DELETE_DOCUMENT: 'Удалил документ',
  CHANGE_STATUS: 'Изменил статус',
  CREATE_FOLDER: 'Создал папку',
  DELETE_FOLDER: 'Удалил папку',
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-sky-500',
  CREATE_DOCUMENT: 'bg-emerald-500',
  EDIT_DOCUMENT: 'bg-amber-500',
  DELETE_DOCUMENT: 'bg-rose-500',
  CHANGE_STATUS: 'bg-violet-500',
  CREATE_FOLDER: 'bg-teal-500',
  DELETE_FOLDER: 'bg-rose-500',
};

// ─── Types ────────────────────────────────────────────────────────────
interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
}

// ─── Helper: relative time ───────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'только что';
    if (diffMin < 60) {
      const last = diffMin % 10;
      const suffix = last === 1 ? 'у' : last >= 2 && last <= 4 ? 'ы' : '';
      return `${diffMin} минут${suffix} назад`;
    }
    if (diffHours < 24) {
      const last = diffHours % 10;
      const suffix = last === 1 ? '' : last >= 2 && last <= 4 ? 'а' : 'ов';
      return `${diffHours} час${suffix} назад`;
    }
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) {
      const last = diffDays % 10;
      const suffix = last === 1 ? 'ень' : last >= 2 && last <= 4 ? 'ня' : 'ней';
      return `${diffDays} д${suffix} назад`;
    }
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  } catch {
    return '—';
  }
}

// ─── Helper: get initials from name ──────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Helper: deterministic color for avatar ──────────────────────────
function getAvatarColor(name: string): string {
  const colors = [
    'bg-emerald-600',
    'bg-sky-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-violet-600',
    'bg-teal-600',
    'bg-orange-600',
    'bg-pink-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── Helper: format day for bar chart ────────────────────────────────
function formatDay(date: Date): string {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return days[date.getDay()];
}

// ═══════════════════════════════════════════════════════════════════════
// ── Main Dashboard Analytics Component ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
export default function DashboardAnalytics() {
  const { documents, folders, token } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // ── Fetch activity logs ─────────────────────────────────────────────
  const fetchActivityLogs = useCallback(async () => {
    if (!token) return;
    setActivityLoading(true);
    try {
      const data = await apiFetch<{ logs: ActivityLogEntry[]; total: number }>(
        '/api/activity-log?limit=5',
        token,
      );
      setActivityLogs(Array.isArray(data) ? data : data.logs || []);
    } catch {
      // Silently fail — activity log is optional
    } finally {
      setActivityLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && activityLogs.length === 0) {
      fetchActivityLogs();
    }
  }, [isOpen, fetchActivityLogs, activityLogs.length]);

  // ── Statistics ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalDocs = documents.length;

    // Count by status
    const statusCounts: Record<string, number> = {
      DRAFT: 0,
      IN_PROGRESS: 0,
      APPROVED: 0,
      REJECTED: 0,
      COMPLETED: 0,
    };
    documents.forEach((d) => {
      if (d.status in statusCounts) {
        statusCounts[d.status]++;
      }
    });

    // Docs created this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const docsThisWeek = documents.filter(
      (d) => new Date(d.createdAt) >= startOfWeek,
    ).length;

    // Most active folder
    const folderDocCounts: Record<string, number> = {};
    documents.forEach((d) => {
      if (d.folderId) {
        folderDocCounts[d.folderId] = (folderDocCounts[d.folderId] || 0) + 1;
      }
    });
    let mostActiveFolder: Folder | null = null;
    let maxCount = 0;
    Object.entries(folderDocCounts).forEach(([folderId, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveFolder = folders.find((f) => f.id === folderId) || null;
      }
    });

    return { totalDocs, statusCounts, docsThisWeek, mostActiveFolder };
  }, [documents, folders]);

  // ── Status chart data ───────────────────────────────────────────────
  const statusChartData = useMemo(() => {
    return Object.entries(stats.statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count,
        status,
      }));
  }, [stats.statusCounts]);

  // ── Documents over time (last 7 days) ──────────────────────────────
  const docsOverTime = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const count = documents.filter((d) => {
        const createdAt = new Date(d.createdAt);
        return createdAt >= day && createdAt < nextDay;
      }).length;

      result.push({
        day: formatDay(day),
        date: `${day.getDate()}.${String(day.getMonth() + 1).padStart(2, '0')}`,
        count,
      });
    }
    return result;
  }, [documents]);

  // ── Render Custom Legend for PieChart ───────────────────────────────
  const renderPieLegend = useMemo(() => {
    if (statusChartData.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {statusChartData.map((entry) => (
          <div key={entry.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT_CLASSES[entry.status] || 'bg-slate-400'}`}
            />
            <span>{entry.name}</span>
            <span className="font-medium text-foreground">({entry.value})</span>
          </div>
        ))}
      </div>
    );
  }, [statusChartData]);

  return (
    <div className="px-4 pt-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {isOpen ? 'Скрыть аналитику' : 'Показать аналитику'}
            </span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-4 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          {/* ═══ Statistics Overview Bar ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Documents */}
            <Card className="py-4 gap-0 transition-shadow hover:shadow-md">
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
                    <FileText className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold leading-tight text-foreground">
                      {stats.totalDocs}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      Всего документов
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents this week */}
            <Card className="py-4 gap-0 transition-shadow hover:shadow-md">
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-900/30 shrink-0">
                    <TrendingUp className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold leading-tight text-foreground">
                      {stats.docsThisWeek}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      За эту неделю
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Most Active Folder */}
            <Card className="py-4 gap-0 transition-shadow hover:shadow-md col-span-2 sm:col-span-1">
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 shrink-0">
                    <FolderOpen className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight text-foreground truncate max-w-[120px]">
                      {stats.mostActiveFolder?.name || '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      Активная папка
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution Mini */}
            <Card className="py-4 gap-0 transition-shadow hover:shadow-md col-span-2 sm:col-span-3 lg:col-span-2">
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-3 flex-wrap">
                  {Object.entries(stats.statusCounts).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
                      <span className="text-xs text-muted-foreground">
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="text-xs font-semibold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ Charts Row ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* ── Documents by Status (Donut Chart) ── */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2 px-4 pt-4 gap-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  По статусам
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {statusChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
                    Нет данных
                  </div>
                ) : (
                  <>
                    <div className="h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {statusChartData.map((entry) => (
                              <Cell
                                key={entry.status}
                                fill={STATUS_CHART_COLORS[entry.status] || '#94a3b8'}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {renderPieLegend}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── Documents Over Time (Bar Chart) ── */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2 px-4 pt-4 gap-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  За последние 7 дней
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {docsOverTime.every((d) => d.count === 0) ? (
                  <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
                    Нет данных
                  </div>
                ) : (
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={docsOverTime} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                          width={24}
                        />
                        <Bar
                          dataKey="count"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Recent Activity Timeline ── */}
            <Card className="transition-shadow hover:shadow-md md:col-span-2 xl:col-span-1">
              <CardHeader className="pb-2 px-4 pt-4 gap-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Последние действия
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="space-y-0">
                  {activityLoading ? (
                    <div className="space-y-3 py-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <Skeleton className="h-3.5 w-3/4" />
                            <Skeleton className="h-3 w-1/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
                      Нет данных
                    </div>
                  ) : (
                    <div className="space-y-3 py-1">
                      {activityLogs.slice(0, 5).map((log, idx) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-2.5 group"
                        >
                          {/* Connector line */}
                          <div className="flex flex-col items-center shrink-0">
                            <span
                              className={`inline-block w-7 h-7 rounded-full ${getAvatarColor(log.user.name)} text-white text-[10px] font-medium flex items-center justify-center`}
                            >
                              {getInitials(log.user.name)}
                            </span>
                            {idx < Math.min(activityLogs.length, 5) - 1 && (
                              <div className="w-px h-4 bg-border mt-1" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-slate-400'}`} />
                              <span className="text-xs font-medium text-foreground truncate">
                                {log.user.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                — {ACTION_LABELS[log.action] || log.action}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatRelativeTime(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
