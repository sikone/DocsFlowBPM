'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Download,
  FileText,
  Clock,
  ClipboardList,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { useStore } from '@/lib/store';
import { ROLE_LABELS } from '@/lib/types';
import { apiFetch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

interface ActivityLogUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: ActivityLogUser;
}

interface ActivityLogResponse {
  logs: ActivityLogEntry[];
  total: number;
}

// ============================================================
// Constants
// ============================================================

// Map filter group key → comma-separated action values sent to the API
const ACTION_GROUP_MAP: Record<string, string> = {
  auth:        'LOGIN,LOGOUT',
  documents:   'CREATE_DOCUMENT,EDIT_DOCUMENT,DELETE_DOCUMENT,CHANGE_STATUS',
  attachments: 'ADD_ATTACHMENT,UPDATE_ATTACHMENT,DELETE_ATTACHMENT,RESTORE_ATTACHMENT,PERMANENT_DELETE_ATTACHMENT',
  approval:    'APPROVAL_STARTED,APPROVAL_STEP_APPROVED,APPROVAL_STEP_APPROVED_WITH_CHANGES,APPROVAL_STEP_REJECTED,APPROVAL_COMPLETED',
  comments:    'COMMENT_DOCUMENT',
  folders:     'CREATE_FOLDER,DELETE_FOLDER',
  users:       'CREATE_USER,EDIT_USER,DELETE_USER',
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Вход в систему',
  LOGOUT: 'Выход из системы',
  CREATE_DOCUMENT: 'Создание документа',
  EDIT_DOCUMENT: 'Редактирование документа',
  DELETE_DOCUMENT: 'Удаление документа',
  CHANGE_STATUS: 'Смена статуса',
  ADD_ATTACHMENT: 'Добавление вложения',
  UPDATE_ATTACHMENT: 'Обновление вложения',
  DELETE_ATTACHMENT: 'Удаление вложения',
  RESTORE_ATTACHMENT: 'Восстановление вложения',
  PERMANENT_DELETE_ATTACHMENT: 'Безвозвратное удаление вложения',
  COMMENT_DOCUMENT: 'Комментарий к документу',
  APPROVAL_STARTED: 'Отправлен на согласование',
  APPROVAL_STEP_APPROVED: 'Шаг согласован',
  APPROVAL_STEP_APPROVED_WITH_CHANGES: 'Согласовано с изменениями',
  APPROVAL_STEP_REJECTED: 'Шаг отклонён',
  APPROVAL_COMPLETED: 'Согласование завершено',
  CREATE_FOLDER: 'Создание папки',
  DELETE_FOLDER: 'Удаление папки',
  CREATE_USER: 'Создание пользователя',
  EDIT_USER: 'Редактирование пользователя',
  DELETE_USER: 'Удаление пользователя',
  AD_SYNC: 'Синхронизация AD',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  DOCUMENT: 'Документ',
  Document: 'Документ',
  FOLDER: 'Папка',
  Folder: 'Папка',
  USER: 'Пользователь',
  User: 'Пользователь',
  COMMENT: 'Комментарий',
  Comment: 'Комментарий',
};

function getActionBadgeClass(action: string): string {
  if (action === 'LOGIN' || action === 'LOGOUT') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
  }
  if (action.startsWith('CREATE_')) {
    return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
  }
  if (action.startsWith('EDIT_') || action.startsWith('UPDATE_') || action === 'AD_SYNC') {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
  }
  if (action.startsWith('DELETE_') || action === 'PERMANENT_DELETE_ATTACHMENT') {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
  }
  if (action === 'CHANGE_STATUS' || action.startsWith('APPROVAL_')) {
    return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800';
  }
  if (action === 'COMMENT_DOCUMENT' || action === 'RESTORE_ATTACHMENT') {
    return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800';
    case 'ADVANCED':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ============================================================
// Skeleton rows
// ============================================================

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-6 w-36 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ============================================================
// Main Component
// ============================================================

const PAGE_SIZES = [25, 50, 100];

export function ActivityLogPage() {
  const { token } = useStore();

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Debounce search input → searchFilter
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchFilter(searchInput), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchFilter, actionFilter, entityFilter, dateFrom, dateTo, pageSize]);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));

      if (actionFilter !== 'all') {
        params.set('action', ACTION_GROUP_MAP[actionFilter] ?? actionFilter);
      }
      if (entityFilter !== 'all') {
        params.set('entityType', entityFilter);
      }
      if (searchFilter) {
        params.set('search', searchFilter);
      }
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const data = await apiFetch<ActivityLogResponse>(`/api/activity-log?${params.toString()}`, token);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки журнала');
    } finally {
      setLoading(false);
    }
  }, [token, actionFilter, entityFilter, searchFilter, dateFrom, dateTo, page, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const hasFilters = actionFilter !== 'all' || entityFilter !== 'all' || searchFilter || dateFrom || dateTo;

  const resetFilters = () => {
    setSearchInput('');
    setSearchFilter('');
    setActionFilter('all');
    setEntityFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = page * pageSize + 1;
  const pageEnd = Math.min((page + 1) * pageSize, total);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Журнал активности</h1>
          <p className="text-muted-foreground mt-1">История всех действий в системе</p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Поиск по пользователю или деталям..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action filter */}
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9 text-sm w-44">
                <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Действие" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все действия</SelectItem>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Категории</SelectLabel>
                  <SelectItem value="auth">Авторизация</SelectItem>
                  <SelectItem value="documents">Документы</SelectItem>
                  <SelectItem value="attachments">Вложения</SelectItem>
                  <SelectItem value="approval">Согласование</SelectItem>
                  <SelectItem value="comments">Комментарии</SelectItem>
                  <SelectItem value="folders">Папки</SelectItem>
                  <SelectItem value="users">Пользователи</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* Entity type filter */}
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-9 text-sm w-40">
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Объект" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все объекты</SelectItem>
                <SelectItem value="DOCUMENT">Документ</SelectItem>
                <SelectItem value="FOLDER">Папка</SelectItem>
                <SelectItem value="USER">Пользователь</SelectItem>
                <SelectItem value="COMMENT">Комментарий</SelectItem>
              </SelectContent>
            </Select>

            {/* Date from */}
            <div className="relative">
              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
                className="h-9 text-sm pl-8 w-40"
                title="Начало периода"
              />
            </div>

            {/* Date to */}
            <div className="relative">
              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                className="h-9 text-sm pl-8 w-40"
                title="Конец периода"
              />
            </div>

            {/* Reset */}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1.5 text-muted-foreground hover:text-foreground shrink-0">
                <X className="w-3.5 h-3.5" />
                Сбросить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <div className="custom-scrollbar max-h-[600px] overflow-y-auto min-w-[640px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Время</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead className="w-[220px]">Действие</TableHead>
                  <TableHead className="w-[140px]">Объект</TableHead>
                  <TableHead>Детали</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-rose-400" />
                        </div>
                        <p className="text-foreground font-medium">Ошибка загрузки</p>
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={fetchLogs}>
                          Повторить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!error && loading && <SkeletonRows />}

                {!error && !loading && logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Search className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                        <p className="text-muted-foreground font-medium">Записей не найдено</p>
                        <p className="text-sm text-muted-foreground/70">
                          {hasFilters ? 'Попробуйте изменить фильтры' : 'Журнал пока пуст'}
                        </p>
                        {hasFilters && (
                          <Button variant="outline" size="sm" className="mt-1" onClick={resetFilters}>
                            Сбросить фильтры
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!error && !loading && logs.map((log) => (
                  <TableRow key={log.id} className="transition-colors hover:bg-muted/50">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{log.user.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{log.user.email}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 shrink-0 ${getRoleBadgeClass(log.user.role)}`}
                        >
                          {ROLE_LABELS[log.user.role] || log.user.role}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getActionBadgeClass(log.action)}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm">
                      {log.entityType ? (
                        <span className="text-muted-foreground">
                          {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}
                          {log.entityId && (
                            <span className="ml-1.5 font-mono text-xs opacity-60">
                              #{log.entityId.slice(0, 8)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground max-w-xs">
                      {log.details ? (
                        <span className="line-clamp-2">{log.details}</span>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {!error && !loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <p>
              Записи <span className="font-medium text-foreground">{pageStart}–{pageEnd}</span> из{' '}
              <span className="font-medium text-foreground">{total}</span>
            </p>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-24 gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s} строк</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 text-xs">
              Стр. {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
