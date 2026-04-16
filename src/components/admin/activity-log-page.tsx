'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  FileText,
  Clock,
  ClipboardList,
  Search,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Вход в систему',
  LOGOUT: 'Выход из системы',
  CREATE_DOCUMENT: 'Создание документа',
  EDIT_DOCUMENT: 'Редактирование документа',
  DELETE_DOCUMENT: 'Удаление документа',
  CHANGE_STATUS: 'Смена статуса',
  CREATE_FOLDER: 'Создание папки',
  DELETE_FOLDER: 'Удаление папки',
  CREATE_USER: 'Создание пользователя',
  EDIT_USER: 'Редактирование пользователя',
  DELETE_USER: 'Удаление пользователя',
};

function getActionBadgeClass(action: string): string {
  if (action === 'LOGIN' || action === 'LOGOUT') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (action.startsWith('CREATE_')) {
    return 'bg-sky-50 text-sky-700 border-sky-200';
  }
  if (action.startsWith('EDIT_')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (action.startsWith('DELETE_')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (action === 'CHANGE_STATUS') {
    return 'bg-violet-50 text-violet-700 border-violet-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  Document: 'Документ',
  Folder: 'Папка',
  User: 'Пользователь',
  DocumentType: 'Тип документа',
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'ADVANCED':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

// ============================================================
// Skeleton rows
// ============================================================

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-36 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ============================================================
// Main Component
// ============================================================

export function ActivityLogPage() {
  const { token } = useStore();

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('offset', '0');

      if (actionFilter !== 'all') {
        // Map filter groups to actual action values
        switch (actionFilter) {
          case 'auth':
            params.set('action', 'LOGIN,LOGOUT');
            break;
          case 'create':
            params.set('action', 'CREATE_DOCUMENT,CREATE_FOLDER,CREATE_USER');
            break;
          case 'edit':
            params.set('action', 'EDIT_DOCUMENT,EDIT_USER');
            break;
          case 'delete':
            params.set('action', 'DELETE_DOCUMENT,DELETE_FOLDER,DELETE_USER');
            break;
          case 'status':
            params.set('action', 'CHANGE_STATUS');
            break;
        }
      }

      if (entityFilter !== 'all') {
        params.set('entityType', entityFilter);
      }

      const url = `/api/activity-log?${params.toString()}`;
      // apiFetch won't unwrap since 'logs' is not in ENVELOPE_KEYS,
      // so we get the full { logs, total } response
      const data = await apiFetch<ActivityLogResponse>(url, token);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки журнала');
    } finally {
      setLoading(false);
    }
  }, [token, actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Client-side filter for action grouping
  const filteredLogs = logs.filter((log) => {
    if (actionFilter === 'all') return true;

    switch (actionFilter) {
      case 'auth':
        return log.action === 'LOGIN' || log.action === 'LOGOUT';
      case 'create':
        return log.action.startsWith('CREATE_');
      case 'edit':
        return log.action.startsWith('EDIT_');
      case 'delete':
        return log.action.startsWith('DELETE_');
      case 'status':
        return log.action === 'CHANGE_STATUS';
      default:
        return true;
    }
  });

  const displayedCount = filteredLogs.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Журнал активности</h1>
          <p className="text-slate-500 mt-1">История всех действий в системе</p>
        </div>
        <Button variant="outline" className="gap-2" disabled>
          <Download className="w-4 h-4" />
          Экспорт
        </Button>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Action type filter */}
            <div className="flex flex-col gap-1.5 min-w-0 flex-1 sm:max-w-xs w-full">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Filter className="w-3 h-3" />
                Тип действия
              </label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="auth">Вход / Выход</SelectItem>
                  <SelectItem value="create">Создание</SelectItem>
                  <SelectItem value="edit">Редактирование</SelectItem>
                  <SelectItem value="delete">Удаление</SelectItem>
                  <SelectItem value="status">Смена статуса</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity type filter */}
            <div className="flex flex-col gap-1.5 min-w-0 flex-1 sm:max-w-xs w-full">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Тип сущности
              </label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="Document">Документы</SelectItem>
                  <SelectItem value="Folder">Папки</SelectItem>
                  <SelectItem value="User">Пользователи</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range placeholder */}
            <div className="flex flex-col gap-1.5 min-w-0 flex-1 sm:max-w-xs w-full">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Период
              </label>
              <Input
                value="Все время"
                readOnly
                className="w-full text-slate-500 cursor-default bg-slate-50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Время</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead className="w-[200px]">Действие</TableHead>
                <TableHead className="w-[160px]">Сущность</TableHead>
                <TableHead>Детали</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-rose-400" />
                      </div>
                      <p className="text-slate-600 font-medium">Ошибка загрузки</p>
                      <p className="text-sm text-slate-400">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={fetchLogs}
                      >
                        Повторить
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!error && loading && <SkeletonRows />}

              {!error && !loading && filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Search className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">Нет записей в журнале</p>
                      <p className="text-sm text-slate-400">
                        Журнал пока пуст или фильтры не дают результатов
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!error && !loading && filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  {/* Time */}
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </TableCell>

                  {/* User */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {log.user.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${getRoleBadgeClass(log.user.role)}`}
                      >
                        {ROLE_LABELS[log.user.role] || log.user.role}
                      </Badge>
                    </div>
                  </TableCell>

                  {/* Action */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getActionBadgeClass(log.action)}`}
                    >
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </TableCell>

                  {/* Entity */}
                  <TableCell className="text-sm">
                    {log.entityType ? (
                      <span className="text-slate-700">
                        {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}
                        {log.entityId && (
                          <span className="text-slate-400 ml-1.5 font-mono text-xs">
                            {log.entityId.length > 8
                              ? `#${log.entityId.slice(0, 8)}…`
                              : `#${log.entityId}`}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>

                  {/* Details */}
                  <TableCell className="text-sm text-slate-600 max-w-xs">
                    {log.details ? (
                      <span className="line-clamp-2">{log.details}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination info */}
      {!error && !loading && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>
            Показано <span className="font-medium text-slate-700">{displayedCount}</span> из{' '}
            <span className="font-medium text-slate-700">{total}</span>
          </p>
        </div>
      )}
    </div>
  );
}
