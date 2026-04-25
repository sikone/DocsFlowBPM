'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Search, MoreHorizontal, Loader2,
  Building2, CheckCircle, XCircle, UserRound, Mail, Phone, Send, Unlink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import type { Counterparty, Contact } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { CounterpartyDialog } from '@/components/directory/counterparty-dialog';

function ContactSearchInput({
  contacts, linkedIds, onSelect,
}: {
  contacts: Contact[];
  linkedIds: string[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const available = contacts.filter((c) => {
    if (linkedIds.includes(c.id)) return false;
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q)
      || (c.email ?? '').toLowerCase().includes(q)
      || (c.phone ?? '').includes(q);
  });

  return (
    <div className="relative" ref={ref}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <input type="text" value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Найти контакт для привязки..."
        className="w-full h-9 pl-8 pr-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
          {available.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {query ? 'Ничего не найдено' : 'Все контакты уже привязаны'}
            </p>
          ) : (
            available.map((c) => (
              <button key={c.id} type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(c.id); setQuery(''); setOpen(false); }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
              >
                <UserRound className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {c.phone && <span>{c.phone}</span>}
                    {c.email && <span>{c.email}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function AdminCounterpartiesPage() {
  const { token } = useStore();
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Counterparty | null>(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [linkedContacts, setLinkedContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<Counterparty[]>('/api/counterparties?active=false', token);
      setCounterparties(data);
    } catch {
      toast.error('Не удалось загрузить контрагентов');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const loadContacts = useCallback(async (counterpartyId: string) => {
    if (!token) return;
    setContactsLoading(true);
    try {
      const [linked, all] = await Promise.all([
        fetch(`/api/counterparties/${counterpartyId}/contacts?token=${encodeURIComponent(token)}`).then(r => r.json()),
        apiFetch<Contact[]>('/api/contacts', token),
      ]);
      setLinkedContacts(linked.contacts ?? []);
      setAllContacts(all);
    } catch {
      // silent
    } finally {
      setContactsLoading(false);
    }
  }, [token]);

  const openCreate = () => {
    setEditing(null);
    setLinkedContacts([]);
    setDialogOpen(true);
  };

  const openEdit = (c: Counterparty) => {
    setEditing(c);
    setLinkedContacts([]);
    setDialogOpen(true);
    loadContacts(c.id);
  };

  const handleLinkContact = async (contactId: string) => {
    if (!token || !editing) return;
    try {
      await fetch(`/api/counterparties/${editing.id}/contacts?token=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId }),
      });
      loadContacts(editing.id);
    } catch {
      toast.error('Ошибка привязки контакта');
    }
  };

  const handleUnlinkContact = async (contactId: string) => {
    if (!token || !editing) return;
    setUnlinkingId(contactId);
    try {
      await fetch(`/api/counterparties/${editing.id}/contacts?token=${encodeURIComponent(token)}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId }),
      });
      setLinkedContacts(prev => prev.filter(c => c.id !== contactId));
    } catch {
      toast.error('Ошибка отвязки контакта');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/counterparties/${id}`, token, { method: 'DELETE' });
      setCounterparties((prev) => prev.filter((c) => c.id !== id));
      toast.success('Контрагент удалён');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = counterparties.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.shortName ?? '').toLowerCase().includes(q) || c.inn.includes(q);
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
          <h1 className="text-2xl font-bold text-foreground">Контрагенты</h1>
          <p className="text-muted-foreground mt-1">Справочник организаций и партнёров</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить контрагента
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Поиск по названию или ИНН..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Наименование</TableHead>
                  <TableHead className="hidden sm:table-cell">ИНН</TableHead>
                  <TableHead className="hidden md:table-cell">КПП</TableHead>
                  <TableHead className="hidden lg:table-cell">ОГРН</TableHead>
                  <TableHead className="hidden xl:table-cell">Банк</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center">
                        <Building2 className="w-10 h-10 text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-sm">
                          {search ? 'Контрагенты не найдены' : 'Справочник пуст'}
                        </p>
                        {!search && (
                          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={openCreate}>
                            <Plus className="w-4 h-4" />Добавить первого контрагента
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          {c.shortName && <p className="text-xs text-muted-foreground">{c.shortName}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm font-mono">{c.inn}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-mono">{c.kpp || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-mono">{c.ogrn || '—'}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{c.bank || '—'}</TableCell>
                      <TableCell>
                        {c.active ? (
                          <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3" />Активен
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-slate-500 border-slate-300">
                            <XCircle className="w-3 h-3" />Неактивен
                          </Badge>
                        )}
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
                                  <AlertDialogTitle>Удалить контрагента?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Контрагент &quot;{c.name}&quot; будет удалён из справочника. Документы, в которых он указан, не пострадают.
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

      {!loading && counterparties.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Всего: {counterparties.length} &middot; Показано: {filtered.length}
        </p>
      )}

      <CounterpartyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        token={token}
        editing={editing}
        onSaved={() => load()}
      >
        {editing && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Контакты</p>
              <div className="mb-3">
                <ContactSearchInput
                  contacts={allContacts}
                  linkedIds={linkedContacts.map(c => c.id)}
                  onSelect={handleLinkContact}
                />
              </div>
              {contactsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : linkedContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Нет привязанных контактов</p>
              ) : (
                <div className="space-y-1.5">
                  {linkedContacts.map(c => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <UserRound className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {c.email && <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{c.email}</span>}
                          {c.phone && <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{c.phone}</span>}
                          {c.telegramId && <span className="flex items-center gap-1"><Send className="w-2.5 h-2.5" />{c.telegramId}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleUnlinkContact(c.id)} disabled={unlinkingId === c.id}
                        className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-500 transition-colors"
                        title="Отвязать">
                        {unlinkingId === c.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Unlink className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CounterpartyDialog>
    </div>
  );
}
