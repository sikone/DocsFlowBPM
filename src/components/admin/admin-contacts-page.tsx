'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Search, MoreHorizontal, Loader2,
  UserRound, Mail, Phone, Send, Building2, X, ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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
import type { Contact, Counterparty } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  telegramId: string;
  note: string;
  counterpartyIds: string[];
}

const EMPTY: ContactForm = { name: '', email: '', phone: '', telegramId: '', note: '', counterpartyIds: [] };

function toForm(c: Contact): ContactForm {
  return {
    name: c.name,
    email: c.email ?? '',
    phone: c.phone ?? '',
    telegramId: c.telegramId ?? '',
    note: c.note ?? '',
    counterpartyIds: c.counterparties?.map((l) => l.counterparty.id) ?? [],
  };
}

function CounterpartyMultiSelect({
  counterparties,
  selected,
  onChange,
}: {
  counterparties: Counterparty[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = counterparties.filter((cp) => {
    if (selected.includes(cp.id)) return false;
    const q = query.toLowerCase();
    return (cp.shortName ?? '').toLowerCase().includes(q) || cp.name.toLowerCase().includes(q) || cp.inn.includes(q);
  });

  const selectedItems = counterparties.filter((cp) => selected.includes(cp.id));

  const add = (id: string) => { onChange([...selected, id]); setQuery(''); };
  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Selected badges */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map((cp) => (
            <span key={cp.id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs">
              <Building2 className="w-3 h-3" />
              {cp.shortName || cp.name}
              <button type="button" onClick={() => remove(cp.id)} className="hover:text-rose-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Поиск контрагента..."
          className="w-full h-9 pl-8 pr-8 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {query ? 'Ничего не найдено' : (counterparties.length === selected.length ? 'Все контрагенты уже выбраны' : 'Нет доступных контрагентов')}
              </p>
            ) : (
              filtered.map((cp) => (
                <button
                  key={cp.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(cp.id); setOpen(false); }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{cp.shortName || cp.name}</p>
                    {cp.shortName && <p className="text-xs text-muted-foreground truncate">{cp.name}</p>}
                    <p className="text-xs text-muted-foreground">ИНН {cp.inn}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, id, value, onChange, placeholder, type = 'text' }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className="h-9 text-sm" />
    </div>
  );
}

export function AdminContactsPage() {
  const { token } = useStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const set = <K extends keyof ContactForm>(k: K, v: ContactForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const cp = await apiFetch<Counterparty[]>('/api/counterparties?active=false', token);
      setCounterparties(cp);
    } catch {
      toast.error('Не удалось загрузить контрагентов');
    }
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

  const openCreate = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setForm(toForm(c)); setDialogOpen(true); };

  const handleSave = async () => {
    if (!token || !form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        telegramId: form.telegramId.trim() || null,
        note: form.note.trim() || null,
        counterpartyIds: form.counterpartyIds,
      };
      if (editing) {
        await apiFetch(`/api/contacts/${editing.id}`, token, { method: 'PUT', body: JSON.stringify(body) });
        toast.success('Контакт обновлён');
      } else {
        await apiFetch('/api/contacts', token, { method: 'POST', body: JSON.stringify(body) });
        toast.success('Контакт добавлен');
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

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
        <Input placeholder="Поиск по ФИО, email, телефону..."
          value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать контакт' : 'Новый контакт'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Измените данные контактного лица' : 'Заполните данные нового контактного лица'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field label="ФИО *" id="name" value={form.name} onChange={(v) => set('name', v)} placeholder="Иванов Иван Иванович" />

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email" id="email" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="ivan@example.com" />
              <Field label="Телефон" id="phone" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+7 (999) 123-45-67" />
            </div>
            <Field label="Telegram ID" id="telegram" value={form.telegramId} onChange={(v) => set('telegramId', v)} placeholder="@username или числовой ID" />

            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-sm">Примечание</Label>
              <Textarea id="note" value={form.note} onChange={(e) => set('note', e.target.value)}
                placeholder="Дополнительная информация..." className="text-sm min-h-[60px] resize-none" />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm">Контрагенты</Label>
              <CounterpartyMultiSelect
                counterparties={counterparties}
                selected={form.counterpartyIds}
                onChange={(ids) => set('counterpartyIds', ids)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
