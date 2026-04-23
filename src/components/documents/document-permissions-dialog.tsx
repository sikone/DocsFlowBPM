'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Trash2, ShieldCheck, UserPlus, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ROLE_LABELS } from '@/lib/types';
import { toast } from 'sonner';

interface UserShort {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Permission {
  id: string;
  userId: string;
  permission: string;
  user: UserShort;
  grantedBy: { id: string; name: string };
  createdAt: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  VIEW: 'Просмотр',
  EDIT: 'Редактирование',
};

interface Props {
  documentId: string;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentPermissionsDialog({ documentId, token, open, onOpenChange }: Props) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserShort[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    setLoadingPerms(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/permissions?token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      setPermissions(data.permissions ?? []);
    } catch {
      toast.error('Ошибка загрузки прав доступа');
    } finally {
      setLoadingPerms(false);
    }
  }, [documentId, token]);

  const fetchUsers = useCallback(async (q = '') => {
    setLoadingUsers(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(q)}&token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      // silent
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      fetchPermissions();
      fetchUsers();
    }
  }, [open, fetchPermissions, fetchUsers]);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchUsers]);

  const grantedUserIds = new Set(permissions.map((p) => p.userId));
  const availableUsers = users.filter((u) => !grantedUserIds.has(u.id));

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/permissions?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUserId, permission: selectedPermission }),
        }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPermissions((prev) => [...prev, data.permission]);
      setSelectedUserId('');
      toast.success('Доступ предоставлен');
    } catch {
      toast.error('Ошибка добавления доступа');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (perm: Permission) => {
    setDeletingId(perm.id);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/permissions/${perm.id}?token=${encodeURIComponent(token)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      setPermissions((prev) => prev.filter((p) => p.id !== perm.id));
      toast.success('Доступ отозван');
    } catch {
      toast.error('Ошибка удаления доступа');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Управление доступом
          </DialogTitle>
          <DialogDescription>
            Назначьте пользователям права на просмотр или редактирование документа
          </DialogDescription>
        </DialogHeader>

        {/* Add user */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск пользователя..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1 h-9 text-sm">
                <SelectValue placeholder="Выберите пользователя" />
              </SelectTrigger>
              <SelectContent>
                {loadingUsers ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : availableUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Нет пользователей</p>
                ) : (
                  availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground ml-1 text-xs">{u.email}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Select
              value={selectedPermission}
              onValueChange={(v) => setSelectedPermission(v as 'VIEW' | 'EDIT')}
            >
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEW">Просмотр</SelectItem>
                <SelectItem value="EDIT">Редактирование</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!selectedUserId || adding}
              className="h-9 gap-1 shrink-0"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Current permissions */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Текущий доступ
          </p>
          {loadingPerms ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет назначенных прав
            </p>
          ) : (
            permissions.map((perm) => (
              <div
                key={perm.id}
                className="flex items-center gap-3 p-2 rounded-md border bg-muted/20"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{perm.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{perm.user.email}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {ROLE_LABELS[perm.user.role] ?? perm.user.role}
                </Badge>
                <Badge
                  className={`text-xs shrink-0 ${
                    perm.permission === 'EDIT'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400'
                  }`}
                  variant="outline"
                >
                  {PERMISSION_LABELS[perm.permission]}
                </Badge>
                <button
                  onClick={() => handleDelete(perm)}
                  disabled={deletingId === perm.id}
                  className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-500 transition-colors"
                >
                  {deletingId === perm.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
