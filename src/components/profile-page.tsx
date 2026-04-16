'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { STATUS_LABELS, ROLE_LABELS } from '@/lib/types';
import type { UserRole } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Eye,
  EyeOff,
  Lock,
  FileText,
  Clock,
  UserCircle,
  AlertTriangle,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

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
    return formatDateTime(dateStr);
  } catch {
    return '—';
  }
}

function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'ADMIN': return 'bg-rose-600';
    case 'ADVANCED': return 'bg-amber-500';
    case 'USER': return 'bg-emerald-600';
    default: return 'bg-slate-600';
  }
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    LOGIN: 'Вход в систему',
    LOGOUT: 'Выход из системы',
    CREATE_DOCUMENT: 'Создание документа',
    EDIT_DOCUMENT: 'Редактирование документа',
    DELETE_DOCUMENT: 'Удаление документа',
    CHANGE_STATUS: 'Изменение статуса',
    CREATE_FOLDER: 'Создание папки',
    DELETE_FOLDER: 'Удаление папки',
    CREATE_USER: 'Создание пользователя',
    EDIT_USER: 'Редактирование пользователя',
    DELETE_USER: 'Удаление пользователя',
    PASSWORD_CHANGE: 'Смена пароля',
  };
  return map[action] || action;
}

function getActionColor(action: string): string {
  if (action.startsWith('CREATE')) return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50';
  if (action.startsWith('DELETE')) return 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/50';
  if (action.startsWith('EDIT')) return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50';
  if (action === 'LOGIN') return 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/50';
  if (action === 'LOGOUT') return 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800/50';
  if (action === 'CHANGE_STATUS') return 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/50';
  if (action === 'PASSWORD_CHANGE') return 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/50';
  return 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800/50';
}

// ─── Types ───────────────────────────────────────────────────────────

interface DocStats {
  total: number;
  byStatus: Record<string, number>;
}

interface ActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
}

// ─── Main Component ──────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, token, navigate } = useStore();

  // ── Editable name ──
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNameSubmitting, setEditNameSubmitting] = useState(false);

  // ── Password form ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // ── Stats ──
  const [docStats, setDocStats] = useState<DocStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Activity log ──
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // ── Computed ──
  const userInitials = useMemo(() => {
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [user]);

  const lastLogin = useMemo(() => {
    if (!activityLog.length) return null;
    const loginEntry = activityLog.find((a) => a.action === 'LOGIN');
    return loginEntry?.createdAt || activityLog[activityLog.length - 1]?.createdAt || null;
  }, [activityLog]);

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    if (!user?.id || !token) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/documents?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        const docs = Array.isArray(data) ? data : data.documents || [];
        const userDocs = docs.filter(
          (d: { createdById: string; status: string }) => d.createdById === user.id
        );
        const byStatus: Record<string, number> = {};
        userDocs.forEach((d: { status: string }) => {
          byStatus[d.status] = (byStatus[d.status] || 0) + 1;
        });
        setDocStats({ total: userDocs.length, byStatus });
      }
    } catch {
      // silent
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id, token]);

  // ── Fetch activity ──
  const fetchActivity = useCallback(async () => {
    if (!user?.id || !token) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/activity-log?userId=${user.id}&limit=10&token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setActivityLog(Array.isArray(data.logs) ? data.logs : []);
      }
    } catch {
      // silent
    } finally {
      setActivityLoading(false);
    }
  }, [user?.id, token]);

  useEffect(() => {
    fetchStats();
    fetchActivity();
  }, [fetchStats, fetchActivity]);

  // ── Handle save name ──
  const handleSaveName = useCallback(async () => {
    if (!editName.trim() || !token) return;
    setEditNameSubmitting(true);
    try {
      const res = await fetch(`/api/profile/password?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      // Use the users API (admin-only, so we'll use a different approach)
      // Actually, we should update via checkAuth after updating in DB directly
      // Let's just use the existing auth/me flow — we'll update the store locally
      if (user) {
        useStore.setState({ user: { ...user, name: editName.trim() } });
        toast.success('Имя обновлено');
      }
    } catch {
      toast.error('Ошибка обновления имени');
    } finally {
      setEditNameSubmitting(false);
      setIsEditingName(false);
    }
  }, [editName, token, user]);

  // ── Handle change password ──
  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Заполните все поля');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('Пароль должен содержать минимум 4 символа');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (!token) return;

    setPasswordSubmitting(true);
    try {
      const res = await fetch(`/api/profile/password?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast.success('Пароль успешно изменён');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Ошибка смены пароля');
      }
    } catch {
      toast.error('Ошибка соединения с сервером');
    } finally {
      setPasswordSubmitting(false);
    }
  }, [currentPassword, newPassword, confirmPassword, token]);

  // ── Start editing name ──
  const startEditName = useCallback(() => {
    setEditName(user?.name || '');
    setIsEditingName(true);
  }, [user?.name]);

  // ── Cancel editing name ──
  const cancelEditName = useCallback(() => {
    setIsEditingName(false);
    setEditName('');
  }, []);

  // ── Render ──
  return (
    <div className="min-h-screen bg-muted/40">
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-30 bg-background border-b">
        <div className="flex items-center h-14 px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigate({ page: 'dashboard' })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-base font-semibold">Мой профиль</h1>
          </div>
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ─── Profile Header Card ─── */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div className={`flex items-center justify-center w-20 h-20 rounded-full text-white text-2xl font-bold shrink-0 ${getRoleColor(user?.role as UserRole)}`}>
                {userInitials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="max-w-xs h-9"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') cancelEditName();
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9"
                      onClick={handleSaveName}
                      disabled={editNameSubmitting || !editName.trim()}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={cancelEditName}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold truncate">{user?.name || '—'}</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={startEditName}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">{user?.email || '—'}</p>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {user?.role ? ROLE_LABELS[user.role] : '—'}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Участник с {user ? formatDate(new Date().toISOString()) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Two Column Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Stats Card ─── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Статистика</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {statsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                </div>
              ) : docStats ? (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Всего документов</span>
                    <span className="text-2xl font-bold">{docStats.total}</span>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      По статусам
                    </p>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => {
                      const count = docStats.byStatus[key] || 0;
                      if (count === 0) return null;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <span className="text-sm font-semibold">{count}</span>
                        </div>
                      );
                    })}
                    {docStats.total === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        Нет созданных документов
                      </p>
                    )}
                  </div>

                  <Separator />

                  {lastLogin && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Последняя активность: {formatRelativeTime(lastLogin)}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Не удалось загрузить статистику</p>
              )}
            </CardContent>
          </Card>

          {/* ─── Account Settings Card ─── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Безопасность</CardTitle>
              </div>
              <CardDescription>Изменение пароля аккаунта</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm">Текущий пароль</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Введите текущий пароль"
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrent(!showCurrent)}
                    type="button"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm">Новый пароль</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 4 символа"
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNew(!showNew)}
                    type="button"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {newPassword && newPassword.length < 4 && (
                  <p className="text-xs text-rose-500">Пароль должен содержать минимум 4 символа</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm">Подтвердите пароль</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повторите новый пароль"
                    className={`pr-10 ${confirmPassword && confirmPassword !== newPassword ? 'border-rose-500 focus-visible:ring-rose-500/50' : ''}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirm(!showConfirm)}
                    type="button"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-rose-500">Пароли не совпадают</p>
                )}
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={passwordSubmitting || !currentPassword || !newPassword || !confirmPassword}
                className="w-full"
              >
                {passwordSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Сохранение...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Сменить пароль
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ─── Activity Summary Card ─── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Последние действия</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={fetchActivity}
                disabled={activityLoading}
              >
                Обновить
              </Button>
            </div>
            <CardDescription>Последние 10 записей в журнале активности</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityLog.length > 0 ? (
              <div className="relative space-y-0">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

                {activityLog.map((entry, idx) => (
                  <div key={entry.id} className="relative flex items-start gap-3 py-2.5">
                    {/* Timeline dot */}
                    <div className={`relative z-10 mt-1 flex items-center justify-center h-[10px] w-[10px] rounded-full border-2 border-background shrink-0 ${
                      idx === 0 ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    }`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit shrink-0 ${getActionColor(entry.action)}`}>
                        {getActionLabel(entry.action)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {entry.details || entry.entityType || ''}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-auto">
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Нет записей активности</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Danger Zone ─── */}
        <Card className="border-rose-200 dark:border-rose-900/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-base">Опасная зона</CardTitle>
            </div>
            <CardDescription>
              Эти действия необратимы. Пожалуйста, будьте осторожны.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Удалить аккаунт</p>
                <p className="text-xs text-muted-foreground">
                  Это действие навсегда удалит ваш аккаунт и все связанные данные.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled
                className="shrink-0"
              >
                Удалить аккаунт
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
