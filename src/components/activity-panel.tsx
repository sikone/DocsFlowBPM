'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  Bell,
  LogIn,
  FilePlus,
  Pencil,
  Trash2,
  RefreshCw,
  FolderPlus,
  FolderMinus,
  FolderOpen,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
interface ActivityLogUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ActivityLog {
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
  logs: ActivityLog[];
  total: number;
}

// ─── Helper: Relative time in Russian ───────────────────────────────
function getRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 5) return 'только что';
    if (diffSec < 60) {
      const remainder = diffSec % 10;
      const word =
        diffSec >= 11 && diffSec <= 19
          ? 'секунд'
          : remainder === 1
            ? 'секунду'
            : remainder >= 2 && remainder <= 4
              ? 'секунды'
              : 'секунд';
      return `${diffSec} ${word} назад`;
    }
    if (diffMin < 60) {
      const remainder = diffMin % 10;
      const word =
        diffMin >= 11 && diffMin <= 19
          ? 'минут'
          : remainder === 1
            ? 'минуту'
            : remainder >= 2 && remainder <= 4
              ? 'минуты'
              : 'минут';
      return `${diffMin} ${word} назад`;
    }
    if (diffHour < 24) {
      const remainder = diffHour % 10;
      const word =
        diffHour >= 11 && diffHour <= 19
          ? 'часов'
          : remainder === 1
            ? 'час'
            : remainder >= 2 && remainder <= 4
              ? 'часа'
              : 'часов';
      return `${diffHour} ${word} назад`;
    }
    if (diffDay === 1) return 'вчера';
    if (diffDay < 7) {
      const remainder = diffDay % 10;
      const word =
        diffDay >= 11 && diffDay <= 19
          ? 'дней'
          : remainder === 1
            ? 'день'
            : remainder >= 2 && remainder <= 4
              ? 'дня'
              : 'дней';
      return `${diffDay} ${word} назад`;
    }
    // Older than 7 days — show date
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ─── Helper: Action color dot ──────────────────────────────────────
function getActionColor(action: string): string {
  const colorMap: Record<string, string> = {
    LOGIN: 'bg-emerald-500',
    CREATE_DOCUMENT: 'bg-sky-500',
    CREATE_FOLDER: 'bg-sky-500',
    EDIT_DOCUMENT: 'bg-amber-500',
    DELETE_DOCUMENT: 'bg-rose-500',
    DELETE_FOLDER: 'bg-rose-500',
    CHANGE_STATUS: 'bg-violet-500',
  };
  return colorMap[action] || 'bg-slate-400';
}

// ─── Helper: Action icon ───────────────────────────────────────────
function getActionIcon(action: string, className = 'h-4 w-4') {
  const iconMap: Record<string, React.ReactNode> = {
    LOGIN: <LogIn className={className} />,
    CREATE_DOCUMENT: <FilePlus className={className} />,
    EDIT_DOCUMENT: <Pencil className={className} />,
    DELETE_DOCUMENT: <Trash2 className={className} />,
    CHANGE_STATUS: <RefreshCw className={className} />,
    CREATE_FOLDER: <FolderPlus className={className} />,
    DELETE_FOLDER: <FolderMinus className={className} />,
  };
  return iconMap[action] || <Bell className={className} />;
}

// ─── Helper: User initials ─────────────────────────────────────────
function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Avatar color from user name (deterministic) ───────────────────
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
    'bg-cyan-600',
    'bg-indigo-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── Loading Skeleton ──────────────────────────────────────────────
function ActivitySkeleton() {
  return (
    <div className="space-y-3 px-4 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-muted-foreground">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Bell className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium">Нет новых уведомлений</p>
      <p className="text-xs mt-1 text-muted-foreground/70">
        Здесь будут отображаться события
      </p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function ActivityPanel() {
  const { token } = useStore();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<ActivityLogResponse>(
        `/api/activity-log?limit=20`,
        token
      );
      // apiFetch may unwrap or return the whole object depending on envelope keys
      const response = data as ActivityLogResponse;
      setLogs(Array.isArray((response as Record<string, unknown>).logs) ? response.logs : []);
      setTotal(
        typeof (response as Record<string, unknown>).total === 'number'
          ? (response as Record<string, unknown>).total as number
          : Array.isArray(response) ? response.length : 0
      );
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch logs when popover opens
  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, fetchLogs]);

  const unreadCount = Math.min(total, 99);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Уведомления</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 max-h-[480px] p-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Уведомления</span>
            {total > 0 && (
              <span className="text-xs text-muted-foreground">
                ({total})
              </span>
            )}
          </div>
          <button
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
            onClick={() => {}}
          >
            Все события
          </button>
        </div>

        {/* ── Content ── */}
        <ScrollArea className="max-h-[392px]">
          {loading ? (
            <ActivitySkeleton />
          ) : logs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="py-1">
              {logs.map((log, index) => (
                <React.Fragment key={log.id}>
                  <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-default group">
                    {/* Avatar */}
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback
                        className={`${getAvatarColor(log.user.name)} text-white text-[11px] font-semibold`}
                      >
                        {getUserInitials(log.user.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Colored action dot */}
                        <span
                          className={`inline-block w-2 h-2 rounded-full shrink-0 ${getActionColor(log.action)}`}
                        />

                        {/* Details text */}
                        <p className="text-sm leading-snug truncate">
                          {log.details || log.action}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 ml-3.5">
                        {/* Action icon */}
                        <span className="text-muted-foreground/50">
                          {getActionIcon(log.action, 'h-3 w-3')}
                        </span>
                        {/* Relative time */}
                        <span className="text-xs text-muted-foreground">
                          {getRelativeTime(log.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {index < logs.length - 1 && (
                    <Separator className="ml-14 mr-4 opacity-50" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* ── Footer ── */}
        {logs.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2.5 text-center border-t">
              <button
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                onClick={() => {}}
              >
                Показать все
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
