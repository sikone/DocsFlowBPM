'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AppView } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  Bell,
  CheckCheck,
  Inbox,
  FileCheck2,
  FileX2,
  FileClock,
  Share2,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
interface NotificationCenterProps {
  token: string | null;
  userId?: string | null;
  onNavigate?: (view: AppView) => void;
}

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

// ─── Helper: Relative time in Russian ───────────────────────────────
function getRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const diffMs = now - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 5) return 'только что';
    if (diffSec < 60) {
      const r = diffSec % 10;
      const w = diffSec >= 11 && diffSec <= 19 ? 'секунд' : r === 1 ? 'секунду' : r >= 2 && r <= 4 ? 'секунды' : 'секунд';
      return `${diffSec} ${w} назад`;
    }
    if (diffMin < 60) {
      const r = diffMin % 10;
      const w = diffMin >= 11 && diffMin <= 19 ? 'минут' : r === 1 ? 'минуту' : r >= 2 && r <= 4 ? 'минуты' : 'минут';
      return `${diffMin} ${w} назад`;
    }
    if (diffHour < 24) {
      const r = diffHour % 10;
      const w = diffHour >= 11 && diffHour <= 19 ? 'часов' : r === 1 ? 'час' : r >= 2 && r <= 4 ? 'часа' : 'часов';
      return `${diffHour} ${w} назад`;
    }
    if (diffDay === 1) return 'вчера';
    if (diffDay < 7) {
      const r = diffDay % 10;
      const w = diffDay >= 11 && diffDay <= 19 ? 'дней' : r === 1 ? 'день' : r >= 2 && r <= 4 ? 'дня' : 'дней';
      return `${diffDay} ${w} назад`;
    }
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

// ─── Helper: Notification icon ─────────────────────────────────────
function getNotificationIcon(type: string, className = 'h-4 w-4') {
  const map: Record<string, React.ReactNode> = {
    APPROVAL_REQUEST:  <FileClock className={className} />,
    APPROVAL_APPROVED: <FileCheck2 className={className} />,
    APPROVAL_REJECTED: <FileX2 className={className} />,
    DOCUMENT_SHARED:   <Share2 className={className} />,
    SLA_WARNING:       <AlertTriangle className={className} />,
  };
  return map[type] || <Bell className={className} />;
}

// ─── Helper: Notification icon bg ─────────────────────────────────
function getNotificationIconBg(type: string): string {
  const map: Record<string, string> = {
    APPROVAL_REQUEST:  'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    APPROVAL_APPROVED: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    APPROVAL_REJECTED: 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
    DOCUMENT_SHARED:   'bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400',
    SLA_WARNING:       'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
  };
  return map[type] || 'bg-muted text-muted-foreground';
}

// ─── Loading Skeleton ──────────────────────────────────────────────
function NotificationSkeleton() {
  return (
    <div className="space-y-4 px-1 py-2">
      {[1, 2, 3].map((i) => (
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
        Уведомления из бизнес-процессов появятся здесь
      </p>
    </div>
  );
}

// ─── Single Notification Item ──────────────────────────────────────
function NotificationItem({
  notification,
  onRead,
  onNavigate,
  onClose,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate?: (view: AppView) => void;
  onClose?: () => void;
}) {
  const isDocumentLink = notification.entityType === 'DOCUMENT' && !!notification.entityId && !!onNavigate;

  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id);
    if (isDocumentLink) {
      onNavigate!({ page: 'edit-document', documentId: notification.entityId! });
      onClose?.();
    }
  };

  return (
    <div
      className={`flex items-start gap-3 px-1 py-3 rounded-lg transition-colors group ${
        isDocumentLink || !notification.isRead ? 'cursor-pointer' : 'cursor-default'
      } ${
        notification.isRead ? 'hover:bg-muted/50' : 'bg-blue-50/50 dark:bg-blue-950/10 hover:bg-blue-50 dark:hover:bg-blue-950/20'
      }`}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${getNotificationIconBg(notification.type)}`}>
        {getNotificationIcon(notification.type, 'h-4 w-4')}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {!notification.isRead && (
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
          )}
          <p className={`text-sm leading-snug ${!notification.isRead ? 'font-medium' : ''}`}>
            {notification.title}
          </p>
        </div>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 ml-4 leading-snug">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1 ml-4">
          {getRelativeTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Notification sound (Web Audio API, no file needed) ────────────
function playNotificationSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    const t = ctx.currentTime;
    playTone(880, t, 0.25);        // A5
    playTone(1174.66, t + 0.12, 0.35); // D6
  } catch { /* Web Audio unavailable */ }
}

// ─── Main Component ────────────────────────────────────────────────
export default function NotificationCenter({
  token,
  userId,
  onNavigate,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // -1 means "not yet initialised" — prevents sound on first page load
  const prevUnreadRef = useRef<number>(-1);

  // ── Fetch notifications ──
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?token=${encodeURIComponent(token)}`);
      if (!res.ok) return;
      const data = await res.json();
      const newCount = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(newCount);
      // Initialise ref on first load so polling can detect future increases
      if (prevUnreadRef.current === -1) prevUnreadRef.current = newCount;
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch on mount and when sheet opens
  useEffect(() => { fetchNotifications(); }, []);
  useEffect(() => { if (open) fetchNotifications(); }, [open]);

  // Poll for unread count every 30s; play sound when count grows
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/notifications?limit=1&token=${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const data = await res.json();
        const newCount = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
        if (prevUnreadRef.current !== -1 && newCount > prevUnreadRef.current) {
          playNotificationSound();
        }
        prevUnreadRef.current = newCount;
        setUnreadCount(newCount);
      } catch { /* silent */ }
    };
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // ── Mark as read ──
  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications?token=${encodeURIComponent(token ?? '')}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch { /* silent */ }
  }, [token]);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch(`/api/notifications?token=${encodeURIComponent(token ?? '')}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch { /* silent */ }
  }, [token]);

  return (
    <>
      {/* ── Bell trigger ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => setOpen(true)}
          >
            <Bell className={`h-4 w-4 ${unreadCount > 0 ? 'animate-bell-shake' : ''}`} />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold leading-none px-1 animate-pulse-badge"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
            <span className="sr-only">Уведомления</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Уведомления</TooltipContent>
      </Tooltip>

      {/* ── Sheet panel ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          {/* ── Header ── */}
          <SheetHeader className="px-5 pt-5 pb-0 gap-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-muted p-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <SheetTitle className="text-base">Уведомления</SheetTitle>
                  <SheetDescription className="text-xs mt-0.5">
                    {unreadCount > 0
                      ? `${unreadCount} непрочитан${unreadCount === 1 ? 'ое' : 'ых'}`
                      : 'Все прочитано'}
                  </SheetDescription>
                </div>
              </div>
              {unreadCount > 0 && !loading && (
                <button
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Прочитать все
                </button>
              )}
            </div>
          </SheetHeader>

          <Separator className="mt-4" />

          {/* ── Content ── */}
          <ScrollArea className="flex-1">
            <div className="px-4">
              {loading ? (
                <NotificationSkeleton />
              ) : notifications.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="py-1">
                  {notifications.map((n, index) => (
                    <React.Fragment key={n.id}>
                      <NotificationItem notification={n} onRead={handleMarkRead} onNavigate={onNavigate} onClose={() => setOpen(false)} />
                      {index < notifications.length - 1 && (
                        <Separator className="ml-12 mr-1 opacity-40" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
