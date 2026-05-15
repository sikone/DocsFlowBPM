'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Building, MoreHorizontal, Crown, UserPlus, X, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { Department, DepartmentMember, User } from '@/lib/types';

export function AdminDepartmentsPage() {
  const { token } = useStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit sheet
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  // All users for add-member combobox
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ departments: Department[] }>('/api/departments', token);
      setDepartments((data as any).departments ?? data);
    } catch {
      toast.error('Ошибка загрузки отделов');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const loadUsers = useCallback(async () => {
    if (!token || allUsers.length > 0) return;
    setUsersLoading(true);
    try {
      const data = await apiFetch<{ users: User[] }>('/api/users', token);
      setAllUsers((data as any).users ?? data);
    } catch {
      toast.error('Ошибка загрузки сотрудников');
    } finally {
      setUsersLoading(false);
    }
  }, [token, allUsers.length]);

  const openEditSheet = (dept: Department) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditSheetOpen(true);
    loadUsers();
  };

  const handleCreate = async () => {
    if (!token || !newName.trim()) return;
    setCreating(true);
    try {
      await apiFetch('/api/departments', token, {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      });
      toast.success('Отдел создан');
      setCreateOpen(false);
      setNewName('');
      load();
    } catch {
      toast.error('Ошибка создания отдела');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!token || !editingDept || !editName.trim() || editName === editingDept.name) return;
    setRenameSaving(true);
    try {
      await apiFetch(`/api/departments/${editingDept.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ name: editName }),
      });
      toast.success('Отдел переименован');
      setDepartments(prev => prev.map(d => d.id === editingDept.id ? { ...d, name: editName } : d));
      setEditingDept(prev => prev ? { ...prev, name: editName } : null);
    } catch {
      toast.error('Ошибка переименования');
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/departments/${id}`, token, { method: 'DELETE' });
      setDepartments(prev => prev.filter(d => d.id !== id));
      toast.success('Отдел удалён');
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка удаления');
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!token || !editingDept) return;
    setMemberActionLoading(userId);
    setAddPopoverOpen(false);
    try {
      await apiFetch(`/api/users/${userId}`, token, {
        method: 'PUT',
        body: JSON.stringify({ departmentId: editingDept.id }),
      });
      const user = allUsers.find(u => u.id === userId);
      if (user) {
        const newMember: DepartmentMember = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isDepartmentHead: false,
          avatar: user.avatar,
        };
        setEditingDept(prev => prev ? { ...prev, users: [...(prev.users ?? []), newMember] } : null);
        setDepartments(prev => prev.map(d =>
          d.id === editingDept.id ? { ...d, users: [...(d.users ?? []), newMember] } : d
        ));
      }
      toast.success('Сотрудник добавлен в отдел');
    } catch {
      toast.error('Ошибка добавления сотрудника');
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!token || !editingDept) return;
    setMemberActionLoading(userId);
    try {
      await apiFetch(`/api/users/${userId}`, token, {
        method: 'PUT',
        body: JSON.stringify({ departmentId: null, isDepartmentHead: false }),
      });
      setEditingDept(prev => prev ? { ...prev, users: prev.users?.filter(u => u.id !== userId) } : null);
      setDepartments(prev => prev.map(d =>
        d.id === editingDept.id ? { ...d, users: d.users?.filter(u => u.id !== userId) } : d
      ));
      toast.success('Сотрудник убран из отдела');
    } catch {
      toast.error('Ошибка удаления сотрудника из отдела');
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleToggleHead = async (userId: string, currentIsHead: boolean) => {
    if (!token || !editingDept) return;
    setMemberActionLoading(userId);
    try {
      await apiFetch(`/api/users/${userId}`, token, {
        method: 'PUT',
        body: JSON.stringify({ isDepartmentHead: !currentIsHead }),
      });
      const sortMembers = (members: DepartmentMember[]) =>
        [...members].sort((a, b) => {
          if (a.isDepartmentHead && !b.isDepartmentHead) return -1;
          if (!a.isDepartmentHead && b.isDepartmentHead) return 1;
          return a.name.localeCompare(b.name, 'ru');
        });
      setEditingDept(prev => {
        if (!prev) return null;
        const updated = (prev.users ?? []).map(u =>
          u.id === userId ? { ...u, isDepartmentHead: !currentIsHead } : u
        );
        return { ...prev, users: sortMembers(updated) };
      });
      setDepartments(prev => prev.map(d => {
        if (d.id !== editingDept.id) return d;
        const updated = (d.users ?? []).map(u =>
          u.id === userId ? { ...u, isDepartmentHead: !currentIsHead } : u
        );
        return { ...d, users: sortMembers(updated) };
      }));
      toast.success(currentIsHead ? 'Статус руководителя снят' : 'Назначен руководителем отдела');
    } catch {
      toast.error('Ошибка обновления статуса');
    } finally {
      setMemberActionLoading(null);
    }
  };

  const memberIds = new Set(editingDept?.users?.map(u => u.id) ?? []);
  const availableUsers = allUsers.filter(u => !memberIds.has(u.id));

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
          <h1 className="text-2xl font-bold text-foreground">Отделы</h1>
          <p className="text-muted-foreground mt-1">Справочник отделов организации</p>
        </div>
        <Button onClick={() => { setNewName(''); setCreateOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить отдел
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Сотрудников</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12">
                      <div className="flex flex-col items-center">
                        <Building className="w-10 h-10 text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-sm">Отделы не найдены</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => (
                    <TableRow key={dept.id} className="cursor-pointer" onClick={() => openEditSheet(dept)}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {dept.users?.length ?? 0}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditSheet(dept)} className="gap-2">
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
                                  <AlertDialogTitle>Удалить отдел?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Удаление невозможно, если в отделе есть сотрудники.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-rose-600 hover:bg-rose-700"
                                    onClick={() => handleDelete(dept.id)}
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Новый отдел</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-dept-name">Название</Label>
              <Input
                id="new-dept-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название отдела"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>Редактирование отдела</SheetTitle>
            <SheetDescription>{editingDept?.name}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-6">

              {/* Name section */}
              <div className="space-y-2">
                <Label htmlFor="edit-dept-name">Название отдела</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-dept-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Название отдела"
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  />
                  <Button
                    onClick={handleRename}
                    disabled={renameSaving || !editName.trim() || editName === editingDept?.name}
                    size="sm"
                    className="shrink-0"
                  >
                    {renameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                  </Button>
                </div>
              </div>

              {/* Members section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Сотрудники
                    {(editingDept?.users?.length ?? 0) > 0 && (
                      <Badge variant="secondary" className="ml-0.5">
                        {editingDept!.users!.length}
                      </Badge>
                    )}
                  </Label>

                  <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8"
                        disabled={usersLoading}
                      >
                        {usersLoading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <UserPlus className="w-3.5 h-3.5" />
                        }
                        Добавить
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Поиск сотрудника..." />
                        <CommandList>
                          <CommandEmpty>Нет доступных сотрудников</CommandEmpty>
                          <CommandGroup>
                            {availableUsers.map((u) => (
                              <CommandItem
                                key={u.id}
                                value={`${u.name} ${u.email}`}
                                onSelect={() => handleAddMember(u.id)}
                                disabled={memberActionLoading === u.id}
                                className="cursor-pointer"
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm truncate">{u.name}</span>
                                  <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {(editingDept?.users?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center py-10 text-muted-foreground border border-dashed rounded-lg">
                    <Users className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">В отделе нет сотрудников</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {editingDept?.users?.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium">{member.name}</span>
                            {member.isDepartmentHead && (
                              <Badge
                                variant="outline"
                                className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-xs py-0 px-1.5 gap-0.5"
                              >
                                <Crown className="w-2.5 h-2.5" />
                                Руководитель
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={member.isDepartmentHead ? 'Снять с должности руководителя' : 'Назначить руководителем'}
                            onClick={() => handleToggleHead(member.id, member.isDepartmentHead)}
                            disabled={memberActionLoading === member.id}
                          >
                            {memberActionLoading === member.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Crown
                                className={`w-3.5 h-3.5 ${member.isDepartmentHead
                                  ? 'text-amber-500 fill-amber-400'
                                  : 'text-muted-foreground'
                                  }`}
                              />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            title="Убрать из отдела"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={memberActionLoading === member.id}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
