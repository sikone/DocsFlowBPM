'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Search, MoreHorizontal, Loader2,
  UserRound, Mail, Phone, Send, Building2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStore } from '@/lib/store';
import type { Contact } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ContactDialog } from '@/components/directory/contact-dialog';

export function AdminContactsPage() {
  const { token } = useStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const c = await apiFetch<Contact[]>('/api/contacts', token);
      setContacts(c);
    } catch {
      // contacts may not be available yet
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setDialogOpen(true); };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/contacts/${id}`, token, { method: 'DELETE' });
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success('Контакт удалён');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q)
      || (c.email ?? '').toLowerCase().includes(q)
      || (c.phone ?? '').includes(q);
  });

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
          <h1 className="text-2xl font-bold">Контакты</h1>
          <p className="text-muted-foreground mt-1">Справочник контактных лиц контрагентов</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить контакт
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Поиск по ФИО, email, телефону..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Телефон</TableHead>
                  <TableHead className="hidden lg:table-cell">Telegram</TableHead>
                  <TableHead>Контрагенты</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center">
                        <UserRound className="w-10 h-10 text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-sm">
                          {search ? 'Контакты не найдены' : 'Справочник пуст'}
                        </p>
                        {!search && (
                          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={openCreate}>
                            <Plus className="w-4 h-4" />Добавить первый контакт
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <UserRound className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <span className="font-medium text-sm">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {c.email
                          ? <a href={`mailto:${c.email}`} className="text-sm text-sky-600 hover:underline flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</a>
                          : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.phone
                          ? <span className="text-sm flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" />{c.phone}</span>
                          : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {c.telegramId
                          ? <span className="text-sm flex items-center gap-1"><Send className="w-3 h-3 text-sky-500" />{c.telegramId}</span>
                          : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(c.counterparties ?? []).length === 0
                            ? <span className="text-muted-foreground text-xs">—</span>
                            : (c.counterparties ?? []).slice(0, 2).map((l) => (
                              <Badge key={l.counterparty.id} variant="outline" className="text-xs gap-1">
                                <Building2 className="w-2.5 h-2.5" />
                                {l.counterparty.shortName || l.counterparty.name}
                              </Badge>
                            ))}
                          {(c.counterparties ?? []).length > 2 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              +{(c.counterparties ?? []).length - 2}
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
                            <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2">
                              <Pencil className="w-4 h-4" />Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="gap-2 text-rose-600 focus:text-rose-600"
                                  onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="w-4 h-4" />Удалить
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Контакт &quot;{c.name}&quot; будет удалён. Связи с контрагентами также удалятся.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction className="bg-rose-600 hover:bg-rose-700"
                                    onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}>
                                    {deletingId === c.id && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
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

      {!loading && contacts.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Всего: {contacts.length} · Показано: {filtered.length}
        </p>
      )}

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        token={token}
        editing={editing}
        onSaved={() => load()}
      />
    </div>
  );
}
