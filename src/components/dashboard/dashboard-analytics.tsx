'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_LABELS } from '@/lib/types';
import { apiFetch } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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
} from 'recharts';

import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  TrendingUp,
  Activity,
  Clock,
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

// ─── Types ────────────────────────────────────────────────────────────
interface DocumentStats {
  totalDocuments: number;
  byStatus: Record<string, number>;
  byType: { name: string; count: number }[];
  recentDocuments: number;
  documentsThisWeek: number;
  documentsThisMonth: number;
  topCreators: { name: string; count: number }[];
  docsOverTime: { day: string; date: string; count: number }[];
  mostActiveFolder: { id: string; name: string; count: number } | null;
}

interface DashboardAnalyticsProps {
  token: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// ── Loading Skeleton ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="py-4 gap-0">
            <CardContent className="px-4 py-0">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-6 w-10" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {/* Status distribution card (wider) */}
        <Card className="py-4 gap-0 col-span-2 sm:col-span-3 lg:col-span-2">
          <CardContent className="px-4 py-0">
            <div className="flex items-center gap-3 flex-wrap">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-4" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Pie chart skeleton */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4 gap-0">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <Skeleton className="h-[160px] w-full rounded-lg" />
            <div className="flex gap-3 justify-center mt-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-16" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bar chart skeleton */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4 gap-0">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <Skeleton className="h-[180px] w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Top creators skeleton */}
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2 px-4 pt-4 gap-0">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Main Dashboard Analytics Component ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
export default function DashboardAnalytics({ token }: DashboardAnalyticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch stats ─────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DocumentStats>('/api/documents/stats', token);
      setStats(data);
    } catch {
      setError('Не удалось загрузить аналитику');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen, fetchStats]);

  // ── Derived data ────────────────────────────────────────────────────
  const statusChartData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count,
        status,
      }));
  }, [stats]);

  const docsOverTime = useMemo(() => {
    if (!stats) return [];
    return stats.docsOverTime || [];
  }, [stats]);

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

  const isEmpty = stats && stats.totalDocuments === 0;

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
          {/* ═══ Loading State ═══ */}
          {loading && <AnalyticsSkeleton />}

          {/* ═══ Error State ═══ */}
          {!loading && error && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              {error}
            </div>
          )}

          {/* ═══ Empty State ═══ */}
          {!loading && !error && isEmpty && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Документов пока нет
            </div>
          )}

          {/* ═══ Data Loaded ═══ */}
          {!loading && !error && stats && !isEmpty && (
            <>
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
                          {stats.totalDocuments}
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
                          {stats.documentsThisWeek}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          За эту неделю
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Documents this month */}
                <Card className="py-4 gap-0 transition-shadow hover:shadow-md">
                  <CardContent className="px-4 py-0">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/30 shrink-0">
                        <Activity className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold leading-tight text-foreground">
                          {stats.documentsThisMonth}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          За этот месяц
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
                      {Object.entries(stats.byStatus).map(([status, count]) => (
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
                    {docsOverTime.length === 0 || docsOverTime.every((d) => d.count === 0) ? (
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

                {/* ── Top Creators ── */}
                <Card className="transition-shadow hover:shadow-md md:col-span-2 xl:col-span-1">
                  <CardHeader className="pb-2 px-4 pt-4 gap-0">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Топ авторов
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    {!stats.topCreators || stats.topCreators.length === 0 ? (
                      <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
                        Нет данных
                      </div>
                    ) : (
                      <div className="space-y-3 py-1">
                        {stats.topCreators.slice(0, 5).map((creator, idx) => {
                          const creatorCount = stats.topCreators!.length;
                          const barWidth = stats.topCreators![0].count > 0
                            ? Math.max(8, (creator.count / stats.topCreators![0].count) * 100)
                            : 0;

                          return (
                            <div key={idx} className="group">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                                  {creator.name}
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {creator.count}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              {idx < creatorCount - 1 && (
                                <div className="h-px bg-border mt-3" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
