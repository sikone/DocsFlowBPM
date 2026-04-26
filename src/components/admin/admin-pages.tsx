'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  FileText,
  FolderOpen,
  TrendingUp,
  Search,
  MoreHorizontal,
  Star,
  X,
  ChevronDown,
  Type,
  AlignLeft,
  Hash,
  DollarSign,
  Calendar,
  Mail,
  Phone,
  List,
  CheckSquare,
  ToggleLeft,
  Heading,
  Minus,
  Eye,
  Loader2,
  ArrowLeft,
  GitBranch,
  Building2,
  Calculator,
  ChevronsUpDown,
  UserX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useStore } from '@/lib/store';
import {
  ROLE_LABELS,
  FIELD_TYPES,
  STATUS_LABELS,
} from '@/lib/types';
import type { User, UserRole, DocumentType, FormField, Document, Department } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

// ============================================================
// 1. AdminDashboard
// ============================================================
export function AdminDashboard() {
  const { token } = useStore();
  const [stats, setStats] = useState({ documents: 0, users: 0, docTypes: 0, folders: 0 });
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [chartData, setChartData] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      try {
        const [docs, users, types, folders] = await Promise.allSettled([
          apiFetch<Document[]>('/api/documents', token),
          apiFetch<User[]>('/api/users', token),
          apiFetch<DocumentType[]>('/api/document-types', token),
          apiFetch<any[]>('/api/folders', token),
        ]);

        const docList = docs.status === 'fulfilled' ? docs.value : [];
        const userList = users.status === 'fulfilled' ? users.value : [];
        const typeList = types.status === 'fulfilled' ? types.value : [];
        const folderList = folders.status === 'fulfilled' ? folders.value : [];

        setStats({
          documents: docList.length,
          users: userList.length,
          docTypes: typeList.length,
          folders: folderList.length,
        });

        setRecentDocs(
          [...docList]
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .slice(0, 5)
        );

        // Group docs by type for chart
        const typeMap = new Map<string, number>();
        for (const d of docList) {
          const typeName = d.type?.name || 'Другие';
          typeMap.set(typeName, (typeMap.get(typeName) || 0) + 1);
        }
        setChartData(
          Array.from(typeMap.entries()).map(([name, count]) => ({ name, count }))
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const statCards = [
    {
      label: 'Всего документов',
      value: stats.documents,
      icon: FileText,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    },
    {
      label: 'Пользователи',
      value: stats.users,
      icon: Users,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-900/30',
    },
    {
      label: 'Типы документов',
      value: stats.docTypes,
      icon: FileText,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/30',
    },
    {
      label: 'Папки',
      value: stats.folders,
      icon: FolderOpen,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-900/30',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
        <p className="text-muted-foreground mt-1">Обзор системы управления документами</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="relative overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{card.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Активно</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent documents */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Последние документы</CardTitle>
                <CardDescription>Последние 5 созданных документов</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Документы пока не созданы</p>
 </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="hidden sm:table-cell">Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentDocs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium text-sm">{doc.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.type?.name || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {STATUS_LABELS[doc.status] || doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                          {new Date(doc.createdAt).toLocaleDateString('ru-RU')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Документы по типам</CardTitle>
            <CardDescription>Распределение по типам</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Нет данных для отображения</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                      backgroundColor: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// 2. AdminUsers — substitute picker
// ============================================================
interface SearchUser { id: string; name: string; email: string }

function SubstitutePicker({
  token,
  value,
  displayName,
  excludeId,
  onChange,
}: {
  token: string;
  value: string;
  displayName: string;
  excludeId?: string;
  onChange: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFetching(true);
    fetch(`/api/users/search?token=${encodeURIComponent(token)}&q=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setResults((d.users ?? []).filter((u: SearchUser) => u.id !== excludeId)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [open, search, token, excludeId]);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{value ? displayName || '...' : 'Выбрать сотрудника'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder="Поиск по имени..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {fetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        </div>
        <div className="max-h-52 overflow-y-auto">
          {results.length === 0 && !fetching ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {search ? 'Не найдено' : 'Начните вводить имя'}
            </p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent text-left transition-colors ${value === u.id ? 'bg-accent' : ''}`}
                onClick={() => { onChange(u.id, u.name); setOpen(false); setSearch(''); }}
              >
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
  isDepartmentHead: boolean;
  departmentId: string;
  isAbsent: boolean;
  substituteId: string;
  substituteName: string;
  absentUntil: string;
}

const DEFAULT_USER_FORM: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'USER',
  active: true,
  isDepartmentHead: false,
  departmentId: '',
  isAbsent: false,
  substituteId: '',
  substituteName: '',
  absentUntil: '',
};

export function AdminUsers() {
  const { token } = useStore();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(DEFAULT_USER_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersData, deptsData] = await Promise.allSettled([
        apiFetch<{ users: User[] }>('/api/users', token),
        apiFetch<{ departments: Department[] }>('/api/departments', token),
      ]);
      if (usersData.status === 'fulfilled') {
        const d = usersData.value as any;
        setUsers(d.users ?? d);
      }
      if (deptsData.status === 'fulfilled') {
        const d = deptsData.value as any;
        setDepartments(d.departments ?? d);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(DEFAULT_USER_FORM);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      active: user.active,
      isDepartmentHead: user.isDepartmentHead ?? false,
      departmentId: user.departmentId ?? '',
      isAbsent: user.isAbsent ?? false,
      substituteId: user.substituteId ?? '',
      substituteName: user.substitute?.name ?? '',
      absentUntil: user.absentUntil ? new Date(user.absentUntil).toISOString().split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!token || !form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      if (editingUser) {
        const body: Record<string, string | boolean | null> = {
          name: form.name,
          email: form.email,
          role: form.role,
          active: form.active,
          isDepartmentHead: form.isDepartmentHead,
          departmentId: form.departmentId || null,
          isAbsent: form.isAbsent,
          substituteId: form.isAbsent ? (form.substituteId || null) : null,
          absentUntil: form.isAbsent && form.absentUntil ? form.absentUntil : null,
        };
        if (form.password) body.password = form.password;
        await apiFetch(`/api/users/${editingUser.id}`, token, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        if (!form.password) return;
        await apiFetch('/api/users', token, {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            departmentId: form.departmentId || null,
            isDepartmentHead: form.isDepartmentHead,
            isAbsent: form.isAbsent,
            substituteId: form.isAbsent ? (form.substituteId || null) : null,
            absentUntil: form.isAbsent && form.absentUntil ? form.absentUntil : null,
          }),
        });
      }
      setDialogOpen(false);
      loadUsers();
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/users/${userId}`, token, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      /* silent */
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800';
      case 'DIRECTOR':
        return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
      case 'CHIEF_ACCOUNTANT':
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      case 'ADVANCED':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Пользователи</h1>
          <p className="text-muted-foreground mt-1">Управление пользователями системы</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить пользователя
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Отдел</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <Users className="w-10 h-10 text-muted-foreground/30 mb-2" />
                      <p className="text-muted-foreground text-sm">Пользователи не найдены</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                      {user.department?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getRoleBadgeClass(user.role)}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className={
                            user.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 text-xs'
                              : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-xs'
                          }
                        >
                          {user.active ? 'Активен' : 'Неактивен'}
                        </Badge>
                        {user.isAbsent && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 text-xs w-fit">
                            Отсутствует{user.absentUntil ? ` до ${new Date(user.absentUntil).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}` : ''}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(user)} className="gap-2">
                            <Pencil className="w-4 h-4" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="gap-2 text-rose-600 focus:text-rose-600"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="w-4 h-4" />
                                Удалить
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Вы уверены, что хотите удалить пользователя &quot;{user.name}&quot;? Это
                                  действие нельзя отменить.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-rose-600 hover:bg-rose-700"
                                  onClick={() => handleDelete(user.id)}
                                >
                                  Удалить
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Измените данные пользователя'
                : 'Заполните данные для создания нового пользователя'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Имя</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Иванов Иван"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">
                Пароль {editingUser && <span className="text-muted-foreground font-normal">(оставьте пустым, чтобы не менять)</span>}
              </Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editingUser ? '••••••••' : 'Минимум 6 символов'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-dept">Отдел</Label>
              <Select
                value={form.departmentId || '__none__'}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    departmentId: val === '__none__' ? '' : val,
                    isDepartmentHead: val === '__none__' ? false : f.isDepartmentHead,
                  }))
                }
              >
                <SelectTrigger id="user-dept">
                  <SelectValue placeholder="Не указан" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Не указан</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.departmentId && (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="user-dept-head"
                    checked={form.isDepartmentHead}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, isDepartmentHead: checked === true }))
                    }
                  />
                  <Label htmlFor="user-dept-head" className="cursor-pointer font-normal text-sm">
                    Руководитель отдела
                  </Label>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Роль</Label>
              <Select
                value={form.role}
                onValueChange={(val) => setForm((f) => ({ ...f, role: val as UserRole }))}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Администратор</SelectItem>
                  <SelectItem value="DIRECTOR">Директор</SelectItem>
                  <SelectItem value="CHIEF_ACCOUNTANT">Главный бухгалтер</SelectItem>
                  <SelectItem value="ADVANCED">Расширенный</SelectItem>
                  <SelectItem value="USER">Обычный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="user-active" className="cursor-pointer">
                Активен
              </Label>
              <Switch
                id="user-active"
                checked={form.active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, active: checked }))}
              />
            </div>
            <div className={`rounded-lg border p-3 space-y-3 ${form.isAbsent ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="user-absent" className="cursor-pointer">
                    Отсутствует
                  </Label>
                </div>
                <Switch
                  id="user-absent"
                  checked={form.isAbsent}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isAbsent: checked, substituteId: checked ? f.substituteId : '', substituteName: checked ? f.substituteName : '', absentUntil: checked ? f.absentUntil : '' }))
                  }
                />
              </div>
              {form.isAbsent && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Замещающий сотрудник</Label>
                    <SubstitutePicker
                      token={token ?? ''}
                      value={form.substituteId}
                      displayName={form.substituteName}
                      excludeId={editingUser?.id}
                      onChange={(id, name) => setForm((f) => ({ ...f, substituteId: id, substituteName: name }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Отсутствует до</Label>
                    <Input
                      type="date"
                      value={form.absentUntil}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setForm((f) => ({ ...f, absentUntil: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingUser ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// 3. AdminDocTypes
// ============================================================
interface ProcessSummary { id: string; name: string; documentTypes: { id: string }[] }

export function AdminDocTypes() {
  const { token, navigate } = useStore();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [processMap, setProcessMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadTypes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [typesRes, procsRes] = await Promise.allSettled([
        apiFetch<DocumentType[]>('/api/document-types', token),
        apiFetch<ProcessSummary[]>('/api/processes', token),
      ]);
      if (typesRes.status === 'fulfilled') setDocTypes(typesRes.value);
      if (procsRes.status === 'fulfilled') {
        const map: Record<string, string> = {};
        for (const proc of procsRes.value) {
          for (const dt of proc.documentTypes ?? []) {
            map[dt.id] = proc.name;
          }
        }
        setProcessMap(map);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const handleDelete = async (typeId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/document-types/${typeId}`, token, { method: 'DELETE' });
      setDocTypes((prev) => prev.filter((t) => t.id !== typeId));
    } catch {
      /* silent */
    }
  };

  const getFieldCount = (schema: string) => {
    try {
      const fields: FormField[] = JSON.parse(schema);
      return fields.length;
    } catch {
      return 0;
    }
  };

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="w-3.5 h-3.5" />;
      case 'textarea':
        return <AlignLeft className="w-3.5 h-3.5" />;
      case 'number':
        return <Hash className="w-3.5 h-3.5" />;
      case 'money':
        return <DollarSign className="w-3.5 h-3.5" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5" />;
      case 'phone':
        return <Phone className="w-3.5 h-3.5" />;
      case 'select':
        return <List className="w-3.5 h-3.5" />;
      case 'checkbox':
        return <CheckSquare className="w-3.5 h-3.5" />;
      case 'switch':
        return <ToggleLeft className="w-3.5 h-3.5" />;
      case 'heading':
        return <Heading className="w-3.5 h-3.5" />;
      case 'separator':
        return <Minus className="w-3.5 h-3.5" />;
      default:
        return <Type className="w-3.5 h-3.5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Типы документов</h1>
          <p className="text-muted-foreground mt-1">Управление шаблонами документов</p>
        </div>
        <Button
          onClick={() => navigate({ page: 'admin-doc-type-form' })}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Добавить тип
        </Button>
      </div>

      {docTypes.length === 0 ? (
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground font-medium">Нет типов документов</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">Создайте первый тип документа для начала работы</p>
            <Button
              variant="outline"
              className="mt-0"
              onClick={() => navigate({ page: 'admin-doc-type-form' })}
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать тип
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docTypes.map((type) => {
            const fieldCount = getFieldCount(type.formSchema);
            return (
              <Card key={type.id} className="group relative overflow-hidden transition-shadow hover:shadow-md">
                <div
                  className="absolute top-0 left-0 w-full h-1"
                  style={{ backgroundColor: type.color || '#10b981' }}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0"
                        style={{ backgroundColor: type.color || '#10b981' }}
                      >
                        {type.icon || '📄'}
                      </div>
                      <div>
                        <CardTitle className="text-base">{type.name}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{type.systemName}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate({ page: 'admin-doc-type-form', typeId: type.id })
                          }
                          className="gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="gap-2 text-rose-600 focus:text-rose-600"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="w-4 h-4" />
                              Удалить
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Удалить тип документа?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Вы уверены, что хотите удалить тип &quot;{type.name}&quot;?
                                <br />
                                Если существуют документы этого типа, удаление невозможно.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-rose-600 hover:bg-rose-700"
                                onClick={() => handleDelete(type.id)}
                              >
                                Удалить
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {type.description || 'Без описания'}
                  </p>
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                    <Badge variant="outline" className="text-xs">
                      {fieldCount} {fieldCount === 1 ? 'поле' : fieldCount < 5 ? 'поля' : 'полей'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        type.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      {type.active ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {processMap[type.id] ? (
                      <span className="text-xs text-muted-foreground truncate">{processMap[type.id]}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 italic">Процесс не привязан</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 4. Form Builder (sub-component inside AdminDocTypeForm)
// ============================================================

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  money: DollarSign,
  date: Calendar,
  email: Mail,
  phone: Phone,
  select: List,
  checkbox: CheckSquare,
  switch: ToggleLeft,
  heading: Heading,
  separator: Minus,
  counterparty: Building2,
  computed: Calculator,
};

function OptionsTextarea({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const [raw, setRaw] = React.useState(() => options.join(', '));

  React.useEffect(() => {
    setRaw(options.join(', '));
  }, [options.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Textarea
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => onChange(raw.split(',').map((s) => s.trim()).filter(Boolean))}
      className="text-sm min-h-[60px]"
      placeholder="Вариант 1, Вариант 2"
    />
  );
}

const FORMULA_FUNCTIONS = [
  { name: 'IF(условие, если_да, если_нет)', hint: 'Условие' },
  { name: 'ROUND(значение, знаки)', hint: 'Округление' },
  { name: 'ABS(значение)', hint: 'Модуль' },
  { name: 'MIN(a, b)', hint: 'Минимум' },
  { name: 'MAX(a, b)', hint: 'Максимум' },
];

function FormulaEditor({
  formula,
  fields,
  onChange,
}: {
  formula: string;
  fields: FormField[];
  onChange: (f: string) => void;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(formula + text);
      return;
    }
    const start = el.selectionStart ?? formula.length;
    const end = el.selectionEnd ?? formula.length;
    const next = formula.slice(0, start) + text + formula.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Формула</Label>
      <Textarea
        ref={textareaRef}
        value={formula}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs font-mono min-h-[80px] resize-none"
        placeholder={'IF({поле1}, {поле2} * 0.2, {поле2} / 1.2 * 0.2)'}
        spellCheck={false}
      />
      {fields.filter((f) => f.type !== 'heading' && f.type !== 'separator' && f.type !== 'computed').length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Поля формы</p>
          <div className="flex flex-wrap gap-1">
            {fields
              .filter((f) => f.type !== 'heading' && f.type !== 'separator' && f.type !== 'computed')
              .map((f) => {
                const ref = f.systemName || f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => insertAtCursor(`{${ref}}`)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-muted/80 border text-[10px] font-mono cursor-pointer transition-colors"
                    title={`Вставить: {${ref}}\nМетка: ${f.label}`}
                  >
                    <span className="text-emerald-600 dark:text-emerald-400">{`{`}</span>
                    <span>{ref}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{`}`}</span>
                    <span className="text-muted-foreground ml-0.5 not-italic">({f.label})</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Функции</p>
        <div className="flex flex-wrap gap-1">
          {FORMULA_FUNCTIONS.map((fn) => (
            <button
              key={fn.name}
              type="button"
              onClick={() => insertAtCursor(fn.name.split('(')[0] + '(')}
              className="inline-flex items-center px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-[10px] font-mono text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950/60 cursor-pointer transition-colors"
              title={fn.hint}
            >
              {fn.name}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Операторы: + − * / == != &gt; &lt; &amp;&amp; ||
      </p>
    </div>
  );
}

interface FormBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

function generateFieldSystemName(label: string): string {
  const translitMap: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return label
    .toLowerCase()
    .split('')
    .map((c) => translitMap[c] ?? c)
    .join('')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'field';
}

function FormBuilder({ fields, onChange }: FormBuilderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  const addField = (type: FormField['type']) => {
    const label = FIELD_TYPES.find((ft) => ft.value === type)?.label || type;
    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label,
      systemName: generateFieldSystemName(label),
      type,
      required: false,
      column: 1,
      row: fields.length + 1,
      placeholder: '',
      options: type === 'select' ? ['Вариант 1', 'Вариант 2'] : undefined,
      width: 'full',
    };
    onChange([...fields, newField]);
    setSelectedFieldId(newField.id);
    setAddMenuOpen(false);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    const updated = fields.filter((f) => f.id !== id);
    // Re-index rows
    updated.forEach((f, i) => (f.row = i + 1));
    onChange(updated);
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((f, i) => (f.row = i + 1));
    onChange(updated);
  };

  const getFirstChar = (type: string) => {
    const Icon = FIELD_TYPE_ICONS[type];
    if (Icon) return null;
    return type[0]?.toUpperCase();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Fields list */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Поля формы</Label>
          <DropdownMenu open={addMenuOpen} onOpenChange={setAddMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="w-3.5 h-3.5" />
                Добавить поле
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {FIELD_TYPES.map((ft) => {
                const Icon = FIELD_TYPE_ICONS[ft.value];
                return (
                  <DropdownMenuItem
                    key={ft.value}
                    onClick={() => addField(ft.value)}
                    className="gap-2"
                  >
                    {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
                    {ft.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {fields.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <List className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Пустая форма</p>
              <p className="text-xs text-muted-foreground/60 mt-1 mb-3">Нажмите «Добавить поле» чтобы начать построение формы</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => {
              const Icon = FIELD_TYPE_ICONS[field.type];
              const isSelected = field.id === selectedFieldId;
              const typeLabel = FIELD_TYPES.find((ft) => ft.value === field.type)?.label || field.type;

              return (
                <Card
                  key={field.id}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700'
                      : 'hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setSelectedFieldId(field.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Drag handle */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          className="text-muted-foreground/40 hover:text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveField(index, 'up');
                          }}
                          disabled={index === 0}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 2L10 6H2L6 2Z" fill="currentColor" />
                          </svg>
                        </button>
                        <button
                          className="text-muted-foreground/40 hover:text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveField(index, 'down');
                          }}
                          disabled={index === fields.length - 1}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 10L2 6H10L6 10Z" fill="currentColor" />
                          </svg>
                        </button>
                      </div>

                      {/* Type icon */}
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                          field.type === 'heading'
                            ? 'bg-muted text-muted-foreground'
                            : field.type === 'separator'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {Icon ? (
                          <Icon className="w-4 h-4" />
                        ) : (
                          <Type className="w-4 h-4" />
                        )}
                      </div>

                      {/* Field info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {field.label}
                          </span>
                          {field.required && (
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{typeLabel}</span>
                          {field.systemName && field.type !== 'heading' && field.type !== 'separator' && (
                            <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1 rounded truncate max-w-[100px]">
                              {field.systemName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Column selector */}
                      {field.type !== 'heading' && field.type !== 'separator' && (
                        <Select
                          value={String(field.column)}
                          onValueChange={(val) => updateField(field.id, { column: Number(val) })}
                        >
                          <SelectTrigger
                            className="w-16 h-7 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Кол. 1</SelectItem>
                            <SelectItem value="2">Кол. 2</SelectItem>
                            <SelectItem value="3">Кол. 3</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* Delete */}
                      <button
                        className="p-1 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(field.id);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Visual Preview */}
        {fields.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Предпросмотр формы
            </Label>
            <Card className="bg-slate-50">
              <CardContent className="p-4">
                <div className="grid grid-cols-6 gap-4">
                  {[...fields].sort((a, b) => a.row - b.row).map((field) => {
                    const colSpan =
                      field.type === 'heading' || field.type === 'separator'
                        ? 'col-span-6'
                        : field.width === 'third'
                        ? 'col-span-6 sm:col-span-2'
                        : field.width === 'half'
                        ? 'col-span-6 sm:col-span-3'
                        : 'col-span-6';
                    if (field.type === 'heading') {
                      return (
                        <div key={field.id} className={colSpan}>
                          <h3 className="text-sm font-semibold text-slate-700">{field.label}</h3>
                        </div>
                      );
                    }
                    if (field.type === 'separator') {
                      return (
                        <div key={field.id} className={colSpan}>
                          <Separator />
                        </div>
                      );
                    }
                    return (
                      <div key={field.id} className={`${colSpan} space-y-1.5`}>
                        <Label className="text-xs text-slate-500">
                          {field.label}
                          {field.required && <span className="text-rose-400 ml-0.5">*</span>}
                        </Label>
                        <div className={`h-8 rounded-md border px-3 flex items-center gap-1.5 ${field.type === 'computed' ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                          {field.type === 'computed' && (
                            <Calculator className="w-3.5 h-3.5 text-slate-300" />
                          )}
                          {(field.type === 'counterparty' || (field.type === 'select' && field.source === 'directory')) && (
                            <Building2 className="w-3.5 h-3.5 text-slate-300" />
                          )}
                          <span className="text-xs text-slate-300">
                            {field.type === 'computed'
                              ? (field.formula ? '= ' + field.formula.slice(0, 30) + (field.formula.length > 30 ? '…' : '') : 'формула не задана')
                              : field.type === 'counterparty' || (field.type === 'select' && field.source === 'directory')
                              ? `Из справочника: ${field.directorySource || 'контрагенты'}`
                              : (field.placeholder || field.type)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Properties panel */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Свойства поля</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedField ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Метка</Label>
                  <Input
                    value={selectedField.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      updateField(selectedField.id, {
                        label: newLabel,
                        systemName: generateFieldSystemName(newLabel),
                      });
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                {selectedField.type !== 'heading' && selectedField.type !== 'separator' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Системное имя</Label>
                    <Input
                      value={selectedField.systemName || ''}
                      onChange={(e) =>
                        updateField(selectedField.id, {
                          systemName: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, '_')
                            .replace(/_+/g, '_')
                            .replace(/^_|_$/g, ''),
                        })
                      }
                      className="h-8 text-sm font-mono"
                      placeholder="field_name"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Используется в построителе процессов
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">Тип</Label>
                  <Select
                    value={selectedField.type}
                    onValueChange={(val) =>
                      updateField(selectedField.id, {
                        type: val as FormField['type'],
                        options: val === 'select' ? ['Вариант 1', 'Вариант 2'] : undefined,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Placeholder</Label>
                  <Input
                    value={selectedField.placeholder || ''}
                    onChange={(e) =>
                      updateField(selectedField.id, { placeholder: e.target.value })
                    }
                    className="h-8 text-sm"
                    placeholder="Подсказка для поля"
                  />
                </div>

                {selectedField.type === 'select' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Источник данных</Label>
                      <div className="flex rounded-md border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateField(selectedField.id, { source: 'options' })}
                          className={`flex-1 text-xs py-1.5 transition-colors ${
                            (selectedField.source ?? 'options') === 'options'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          Варианты
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField(selectedField.id, { source: 'directory' })}
                          className={`flex-1 text-xs py-1.5 transition-colors ${
                            selectedField.source === 'directory'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          Из справочника
                        </button>
                      </div>
                    </div>

                    {(selectedField.source ?? 'options') === 'options' ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Варианты (через запятую)</Label>
                        <OptionsTextarea
                          options={selectedField.options ?? []}
                          onChange={(opts) => updateField(selectedField.id, { options: opts })}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Справочник</Label>
                        <Select
                          value={selectedField.directorySource || 'counterparties'}
                          onValueChange={(v) => updateField(selectedField.id, { directorySource: v })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="counterparties">Контрагенты</SelectItem>
                            <SelectItem value="contacts">Контакты</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {selectedField.type === 'computed' && (
                  <>
                    <FormulaEditor
                      formula={selectedField.formula || ''}
                      fields={fields.filter((f) => f.id !== selectedField.id)}
                      onChange={(formula) => updateField(selectedField.id, { formula })}
                    />
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label className="text-xs cursor-pointer">Неизменяемое</Label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Запрещает ручное редактирование
                        </p>
                      </div>
                      <Switch
                        checked={selectedField.readonly !== false}
                        onCheckedChange={(checked) =>
                          updateField(selectedField.id, { readonly: checked })
                        }
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label className="text-xs">Ширина</Label>
                  <Select
                    value={selectedField.width || 'full'}
                    onValueChange={(val) =>
                      updateField(selectedField.id, { width: val as FormField['width'] })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Полная</SelectItem>
                      <SelectItem value="half">Половина</SelectItem>
                      <SelectItem value="third">Треть</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-xs cursor-pointer">Обязательное поле</Label>
                  <Switch
                    checked={selectedField.required}
                    onCheckedChange={(checked) =>
                      updateField(selectedField.id, { required: checked })
                    }
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">
                Выберите поле для редактирования его свойств
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// 5. AdminDocTypeForm
// ============================================================
const PREDEFINED_COLORS = [
  '#10b981',
  '#059669',
  '#0d9488',
  '#0891b2',
  '#0284c7',
  '#4f46e5',
  '#7c3aed',
  '#c026d3',
  '#e11d48',
  '#ea580c',
  '#d97706',
  '#65a30d',
  '#475569',
  '#1e293b',
];

export function AdminDocTypeForm() {
  const { token, view, navigate } = useStore();
  const typeId = view.page === 'admin-doc-type-form' ? view.typeId : undefined;
  const isEditing = !!typeId;

  const [name, setName] = useState('');
  const [systemName, setSystemName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📄');
  const [color, setColor] = useState('#10b981');
  const [formSchema, setFormSchema] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const skipAutoGenerateRef = React.useRef(false);

  // Generate system name from Russian name
  const generateSystemName = (text: string) => {
    const translitMap: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
      з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
      п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
      ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
      я: 'ya',
    };
    return text
      .toLowerCase()
      .split('')
      .map((c) => translitMap[c] || c)
      .join('')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toUpperCase()
      .slice(0, 30);
  };

  useEffect(() => {
    if (skipAutoGenerateRef.current) return;
    if (!name) {
      setSystemName('');
      return;
    }
    setSystemName(generateSystemName(name));
  }, [name]);

  // Load existing type for editing
  useEffect(() => {
    if (!typeId || !token) return;
    setLoadingLocal(true);
    skipAutoGenerateRef.current = true;
    apiFetch<DocumentType>(`/api/document-types/${typeId}`, token)
      .then((data) => {
        setName(data.name);
        setSystemName(data.systemName);
        setDescription(data.description || '');
        setIcon(data.icon);
        setColor(data.color);
        try {
          setFormSchema(JSON.parse(data.formSchema || '[]'));
        } catch {
          setFormSchema([]);
        }
      })
      .catch(() => {
        toast.error('Ошибка загрузки типа документа');
      })
      .finally(() => {
        setLoadingLocal(false);
        // Re-enable auto-generate after a tick so it doesn't fire on the loaded name
        setTimeout(() => { skipAutoGenerateRef.current = false; }, 0);
      });
  }, [typeId, token]);

  const handleSave = async () => {
    if (!token || !name.trim() || !systemName.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        systemName: systemName.trim(),
        description: description.trim(),
        icon,
        color,
        formSchema: JSON.stringify(formSchema),
        active: true,
      };

      if (isEditing && typeId) {
        await apiFetch(`/api/document-types/${typeId}`, token, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        toast.success('Тип документа обновлён');
      } else {
        await apiFetch('/api/document-types', token, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Тип документа создан');
      }
      navigate({ page: 'admin-doc-types' });
    } catch {
      toast.error('Ошибка сохранения типа документа');
    } finally {
      setSaving(false);
    }
  };

  if (loadingLocal) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigate({ page: 'admin-doc-types' })}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing ? 'Редактирование типа' : 'Новый тип документа'}
          </h1>
          <p className="text-slate-500 mt-0.5">
            {isEditing ? 'Измените параметры типа документа' : 'Создайте новый шаблон документа'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">Основные настройки</TabsTrigger>
          <TabsTrigger value="form">
            Форма документа
            <Badge variant="outline" className="ml-2 text-xs">
              {formSchema.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Информация</CardTitle>
                <CardDescription>Основные данные типа документа</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dt-name">
                    Название <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="dt-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Счёт"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dt-sysname">
                    Системное имя <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="dt-sysname"
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value.toUpperCase())}
                    placeholder="INVOICE"
                    className="font-mono"
                  />
                  <p className="text-xs text-slate-400">Автоматически генерируется из названия</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dt-desc">Описание</Label>
                  <Textarea
                    id="dt-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Описание типа документа..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Внешний вид</CardTitle>
                <CardDescription>Настройки отображения</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dt-icon">Иконка (эмодзи)</Label>
                  <Input
                    id="dt-icon"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="📄"
                    className="text-lg"
                    maxLength={4}
                  />
                  <div className="flex gap-2 mt-1">
                    {['📄', '📝', '📋', '📑', '🗂️', '💼', '✍️', '📌', '📎', '📑'].map(
                      (emoji) => (
                        <button
                          key={emoji}
                          className={`w-9 h-9 rounded-md border flex items-center justify-center text-lg hover:bg-slate-50 transition-colors ${
                            icon === emoji ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'
                          }`}
                          onClick={() => setIcon(emoji)}
                        >
                          {emoji}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Цвет</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {PREDEFINED_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          color === c
                            ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Label htmlFor="dt-color-custom" className="text-xs text-slate-400">
                      Свой цвет:
                    </Label>
                    <input
                      id="dt-color-custom"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-400">{color}</span>
                  </div>
                </div>

                {/* Preview card */}
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-xs text-slate-400 mb-2 block">Предпросмотр</Label>
                  <div className="rounded-lg border p-4 flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                      style={{ backgroundColor: color }}
                    >
                      {icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{name || 'Без названия'}</p>
                      <p className="text-xs text-slate-400 font-mono">{systemName || 'NO_NAME'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="form" className="space-y-4">
          <FormBuilder fields={formSchema} onChange={setFormSchema} />
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => navigate({ page: 'admin-doc-types' })}>
          Отмена
        </Button>
        <div className="flex gap-2">
          {isEditing && (
            <Button variant="outline" className="gap-2" onClick={() => navigate({ page: 'admin-doc-types' })}>
              <X className="w-4 h-4" />
              Отменить
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !systemName.trim()}
            className="gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Сохранить изменения' : 'Создать тип'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 6. Processes & Tasks are in separate files
// ============================================================
export { AdminProcessesPage as PlaceholderProcesses } from '@/components/admin/admin-processes-page';
export { AdminTasksPage as PlaceholderTasks } from '@/components/admin/admin-tasks-page';
