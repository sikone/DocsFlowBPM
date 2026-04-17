'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppView } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  BellOff,
  CheckCheck,
  Inbox,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
interface NotificationCenterProps {
  token: string | null;
  onNavigate?: (view: AppView) => void;
}

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

type FilterTab = 'all' | 'documents' | 'system';

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
    CREATE_DOCUMENT: 'bg-emerald-500',
    DELETE_DOCUMENT: 'bg-rose-500',
    CHANGE_STATUS: 'bg-amber-500',
    LOGIN: 'bg-blue-500',
    CREATE_FOLDER: 'bg-violet-500',
    DELETE_FOLDER: 'bg-rose-500',
    EDIT_DOCUMENT: 'bg-slate-400',
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
    'bg-blue-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── Helper: Status badge for CHANGE_STATUS actions ────────────────
function getStatusBadgeClass(action: string, details: string | null): string | null {
  if (action !== 'CHANGE_STATUS' || !details) return null;

  const statusMap: Record<string, string> = {
    'Черновик': 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
    'В работе': 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700',
    'Утверждён': 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
    'Отклонён': 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700',
    'Завершён': 'bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-700',
    'DRAFT': 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
    'IN_PROGRESS': 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700',
    'APPROVED': 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
    'REJECTED': 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700',
    'COMPLETED': 'bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-700',
  };

  for (const [key, cls] of Object.entries(statusMap)) {
    if (details.includes(key)) return cls;
  }
  return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
}

// ─── Helper: Extract status label from details ─────────────────────
function extractStatusLabel(action: string, details: string | null): string | null {
  if (action !== 'CHANGE_STATUS' || !details) return null;

  const labels = ['Черновик', 'В работе', 'Утверждён', 'Отклонён', 'Завершён'];
  for (const label of labels) {
    if (details.includes(label)) return label;
  }
  return null;
}

// ─── Helper: Filter logs by tab ────────────────────────────────────
function filterLogs(logs: ActivityLog[], tab: FilterTab): ActivityLog[] {
  if (tab === 'all') return logs;
  if (tab === 'documents') {
    return logs.filter(
      (log) =>
        log.action === 'CREATE_DOCUMENT' ||
        log.action === 'EDIT_DOCUMENT' ||
        log.action === 'DELETE_DOCUMENT' ||
        log.action === 'CHANGE_STATUS'
    );
  }
  if (tab === 'system') {
    return logs.filter(
      (log) =>
        log.action === 'LOGIN' ||
        log.action === 'CREATE_FOLDER' ||
        log.action === 'DELETE_FOLDER'
    );
  }
  return logs;
}

// ─── Loading Skeleton ──────────────────────────────────────────────
function ActivitySkeleton() {
  return (
    <div className="space-y-4 px-1 py-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-4/5 rounded" />
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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-muted-foreground">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Inbox className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium">Нет уведомлений</p>
      <p className="text-xs mt-1.5 text-muted-foreground/70">
        Новые события будут отображаться здесь
      </p>
    </div>
  );
}

// ─── Single Activity Item ──────────────────────────────────────────
function ActivityItem({ log }: { log: ActivityLog }) {
  const statusBadgeClass = getStatusBadgeClass(log.action, log.details);
  const statusLabel = extractStatusLabel(log.action, log.details);

  return (
    <div className="flex items-start gap-3 px-1 py-3 hover:bg-muted/50 rounded-lg transition-colors group">
      {/* Avatar */}
      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
        <AvatarFallback
          className={`${getAvatarColor(log.user.name)} text-white text-xs font-semibold`}
        >
          {getUserInitials(log.user.name)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {/* Colored action dot */}
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1.5 ${getActionColor(log.action)}`}
          />

          {/* Details text */}
          <p className="text-sm leading-snug">
            {log.details || log.action}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-1.5 ml-4 flex-wrap">
          {/* Action icon */}
          <span className="text-muted-foreground/50">
            {getActionIcon(log.action, 'h-3 w-3')}
          </span>
          {/* Relative time */}
          <span className="text-xs text-muted-foreground">
            {getRelativeTime(log.createdAt)}
          </span>
          {/* Status badge */}
          {statusLabel && statusBadgeClass && (
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none ${statusBadgeClass}`}
            >
              {statusLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function NotificationCenter({
  token,
  onNavigate,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // ── Fetch activity logs ──
  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/activity-log?token=${encodeURIComponent(token)}`
      );
      if (!res.ok) return;
      const data = await res.json();

      // Handle both array and { logs, total } response formats
      if (Array.isArray(data)) {
        setLogs(data);
        setUnreadCount(data.length);
      } else if (data.logs) {
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setUnreadCount(typeof data.total === 'number' ? data.total : (Array.isArray(data.logs) ? data.logs.length : 0));
      } else {
        setLogs([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
      setLogs([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch on mount
  useEffect(() => {
    fetchLogs();
  }, []);

  // Fetch when sheet opens
  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open]);

  // Check for unread activities periodically
  useEffect(() => {
    if (!token) return;

    const checkUnread = async () => {
      try {
        const res = await fetch(
          `/api/activity-log?limit=1&token=${encodeURIComponent(token)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const latestLog = Array.isArray(data)
          ? data[0]
          : data.logs?.[0] || null;

        if (latestLog) {
          const lastViewed = localStorage.getItem('nc_last_viewed');
          if (!lastViewed) {
            setHasUnread(false);
            localStorage.setItem('nc_last_viewed', new Date().toISOString());
          } else {
            const viewedTime = new Date(lastViewed).getTime();
            const logTime = new Date(latestLog.createdAt).getTime();
            setHasUnread(logTime > viewedTime);
          }
        }
      } catch {
        // silent
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // ── Mark all as read ──
  const handleMarkAllRead = useCallback(() => {
    try {
      localStorage.setItem('nc_last_viewed', new Date().toISOString());
    } catch {
      // silent
    }
    setHasUnread(false);
    setUnreadCount(0);
  }, []);

  // ── Filtered logs ──
  const filteredLogs = useMemo(
    () => filterLogs(logs, activeTab),
    [logs, activeTab]
  );

  // ── Badge display ──
  const showBadge = hasUnread || unreadCount > 0;
  const displayCount = Math.min(unreadCount, 99);

  return (
    <>
      {/* ── Bell trigger button ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => setOpen(true)}
          >
            <Bell
              className={`h-4 w-4 ${hasUnread ? 'animate-bell-shake' : ''}`}
            />
            {showBadge && (
              <Badge
                variant="destructive"
                className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold leading-none px-1 ${
                  hasUnread ? 'animate-pulse-badge' : ''
                }`}
              >
                {displayCount > 99 ? '99+' : displayCount}
              </Badge>
            )}
            <span className="sr-only">Уведомления</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Уведомления</TooltipContent>
      </Tooltip>

      {/* ── Sheet panel ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col"
        >
          {/* ── Header ── */}
          <SheetHeader className="px-5 pt-5 pb-0 gap-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-muted p-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <SheetTitle className="text-base">
                    Уведомления
                  </SheetTitle>
                  <SheetDescription className="text-xs mt-0.5">
                    {unreadCount > 0
                      ? `${unreadCount} непрочитан${unreadCount === 1 ? 'ое' : unreadCount >= 2 && unreadCount <= 4 ? 'ых' : 'ых'}`
                      : 'Все прочитано'}
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* ── Filter tabs ── */}
          <div className="px-5 pt-4 pb-0">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as FilterTab)}
            >
              <TabsList className="w-full h-9">
                <TabsTrigger value="all" className="flex-1 text-xs">
                  Все
                  {logs.length > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {logs.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex-1 text-xs">
                  Документы
                </TabsTrigger>
                <TabsTrigger value="system" className="flex-1 text-xs">
                  Система
                </TabsTrigger>
              </TabsList>

              {/* ── All tab content ── */}
              <TabsContent value="all" className="mt-0">
                <ActivityList
                  logs={filteredLogs}
                  loading={loading}
                  hasUnread={hasUnread}
                  onMarkAllRead={handleMarkAllRead}
                />
              </TabsContent>

              {/* ── Documents tab content ── */}
              <TabsContent value="documents" className="mt-0">
                <ActivityList
                  logs={filteredLogs}
                  loading={loading}
                  hasUnread={hasUnread}
                  onMarkAllRead={handleMarkAllRead}
                />
              </TabsContent>

              {/* ── System tab content ── */}
              <TabsContent value="system" className="mt-0">
                <ActivityList
                  logs={filteredLogs}
                  loading={loading}
                  hasUnread={hasUnread}
                  onMarkAllRead={handleMarkAllRead}
                />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Activity List (reusable for each tab) ─────────────────────────
function ActivityList({
  logs,
  loading,
  hasUnread,
  onMarkAllRead,
}: {
  logs: ActivityLog[];
  loading: boolean;
  hasUnread: boolean;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Mark all as read bar ── */}
      {hasUnread && !loading && (
        <div className="px-5 pt-3 pb-1">
          <button
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Отметить все как прочитанные
          </button>
        </div>
      )}

      {/* ── Separator ── */}
      <Separator className="mt-2" />

      {/* ── Scrollable list ── */}
      <ScrollArea className="flex-1 h-[calc(100vh-16rem)]">
        <div className="px-4">
          {loading ? (
            <ActivitySkeleton />
          ) : logs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="py-1">
              {logs.map((log, index) => (
                <React.Fragment key={log.id}>
                  <ActivityItem log={log} />
                  {index < logs.length - 1 && (
                    <Separator className="ml-12 mr-1 opacity-40" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Footer ── */}
      {logs.length > 0 && !loading && (
        <>
          <Separator />
          <div className="px-5 py-3 flex items-center justify-center border-t">
            <button
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors flex items-center gap-1.5"
              onClick={() => {}}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Показать все уведомления
            </button>
          </div>
        </>
      )}
    </div>
  );
}
