'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreHorizontal,
  Loader2,
  Building2,
  CheckCircle,
  XCircle,
  UserRound,
  Mail,
  Phone,
  Send,
  Unlink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useStore } from '@/lib/store';
import type { Counterparty, Contact } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

interface CounterpartyForm {
  name: string;
  shortName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  actualAddress: string;
  postalAddress: string;
  postalCode: string;
  bankAccount: string;
  bank: string;
  bik: string;
  active: boolean;
}

const EMPTY_FORM: CounterpartyForm = {
  name: '',
  shortName: '',
  inn: '',
  kpp: '',
  ogrn: '',
  legalAddress: '',
  actualAddress: '',
  postalAddress: '',
  postalCode: '',
  bankAccount: '',
  bank: '',
  bik: '',
  active: true,
};

function toForm(c: Counterparty): CounterpartyForm {
  return {
    name: c.name,
    shortName: c.shortName ?? '',
    inn: c.inn,
    kpp: c.kpp ?? '',
    ogrn: c.ogrn ?? '',
    legalAddress: c.legalAddress ?? '',
    actualAddress: c.actualAddress ?? '',
    postalAddress: c.postalAddress ?? '',
    postalCode: c.postalCode ?? '',
    bankAccount: c.bankAccount ?? '',
    bank: c.bank ?? '',
    bik: c.bik ?? '',
    active: c.active,
  };
}

function Field({ label, id, value, onChange, placeholder, maxLength }: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-9 text-sm"
      />
    </div>
  );
}

function ContactSearchInput({
  contacts,
  linkedIds,
  onSelect,
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
      <input
        type="text"
        value={query}
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
              <button
                key={c.id}
                type="button"
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
  const [form, setForm] = useState<CounterpartyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Contacts for the currently-edited counterparty
  const [linkedContacts, setLinkedContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const setField = <K extends keyof CounterpartyForm>(key: K, value: CounterpartyForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

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

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setLinkedContacts([]);
    setDialogOpen(true);
  };

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

  const openEdit = (c: Counterparty) => {
    setEditing(c);
    setForm(toForm(c));
    setLinkedContacts([]);
    setDialogOpen(true);
    loadContacts(c.id);
  };

  const handleLinkContact = async (contactId: string) => {
    if (!token || !editing) return;
    try {
      await fetch(`/api/counterparties/${editing.id}/contacts?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
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
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      });
      setLinkedContacts(prev => prev.filter(c => c.id !== contactId));
    } catch {
      toast.error('Ошибка отвязки контакта');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleSave = async () => {
    if (!token || !form.name.trim() || !form.inn.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        shortName: form.shortName.trim() || null,
        inn: form.inn.trim(),
        kpp: form.kpp.trim() || null,
        ogrn: form.ogrn.trim() || null,
        legalAddress: form.legalAddress.trim() || null,
        actualAddress: form.actualAddress.trim() || null,
        postalAddress: form.postalAddress.trim() || null,
        postalCode: form.postalCode.trim() || null,
        bankAccount: form.bankAccount.trim() || null,
        bank: form.bank.trim() || null,
        bik: form.bik.trim() || null,
        active: form.active,
      };

      if (editing) {
        await apiFetch(`/api/counterparties/${editing.id}`, token, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        toast.success('Контрагент обновлён');
      } else {
        await apiFetch('/api/counterparties', token, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Контрагент добавлен');
      }

      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
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
    return (
      c.name.toLowerCase().includes(q) ||
      (c.shortName ?? '').toLowerCase().includes(q) ||
      c.inn.includes(q)
    );
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
      {/* Header */}
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или ИНН..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
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
                            <Plus className="w-4 h-4" />
                            Добавить первого контрагента
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
                          {c.shortName && (
                            <p className="text-xs text-muted-foreground">{c.shortName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm font-mono">{c.inn}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-mono">{c.kpp || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-mono">{c.ogrn || '—'}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{c.bank || '—'}</TableCell>
                      <TableCell>
                        {c.active ? (
                          <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Активен
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-slate-500 border-slate-300">
                            <XCircle className="w-3 h-3" />
                            Неактивен
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
                                  <AlertDialogTitle>Удалить контрагента?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Контрагент &quot;{c.name}&quot; будет удалён из справочника. Документы, в которых он указан, не пострадают.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-rose-600 hover:bg-rose-700"
                                    onClick={() => handleDelete(c.id)}
                                    disabled={deletingId === c.id}
                                  >
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать контрагента' : 'Новый контрагент'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Измените данные контрагента' : 'Заполните реквизиты нового контрагента'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Основная информация */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Основная информация</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Field label="Полное наименование *" id="name" value={form.name} onChange={(v) => setField('name', v)} placeholder="ООО «Название компании»" />
                </div>
                <Field label="Краткое наименование" id="shortName" value={form.shortName} onChange={(v) => setField('shortName', v)} placeholder="ООО «Название»" />
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    id="active"
                    checked={form.active}
                    onCheckedChange={(v) => setField('active', v)}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                  <Label htmlFor="active" className="text-sm cursor-pointer">Активен</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Регистрационные данные */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Регистрационные данные</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="ИНН *" id="inn" value={form.inn} onChange={(v) => setField('inn', v)} placeholder="1234567890" maxLength={12} />
                <Field label="КПП" id="kpp" value={form.kpp} onChange={(v) => setField('kpp', v)} placeholder="123456789" maxLength={9} />
                <Field label="ОГРН" id="ogrn" value={form.ogrn} onChange={(v) => setField('ogrn', v)} placeholder="1234567890123" maxLength={15} />
              </div>
            </div>

            <Separator />

            {/* Адреса */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Адреса</p>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Юридический адрес" id="legalAddress" value={form.legalAddress} onChange={(v) => setField('legalAddress', v)} placeholder="123456, г. Москва, ул. Примерная, д. 1" />
                <Field label="Фактический адрес" id="actualAddress" value={form.actualAddress} onChange={(v) => setField('actualAddress', v)} placeholder="Совпадает с юридическим или иной адрес" />
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <Field label="Почтовый адрес" id="postalAddress" value={form.postalAddress} onChange={(v) => setField('postalAddress', v)} placeholder="г. Москва, ул. Почтовая, д. 2" />
                  </div>
                  <Field label="Индекс" id="postalCode" value={form.postalCode} onChange={(v) => setField('postalCode', v)} placeholder="123456" maxLength={6} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Банковские реквизиты */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Банковские реквизиты</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Расчётный счёт" id="bankAccount" value={form.bankAccount} onChange={(v) => setField('bankAccount', v)} placeholder="40702810000000000000" maxLength={20} />
                <Field label="БИК" id="bik" value={form.bik} onChange={(v) => setField('bik', v)} placeholder="044525225" maxLength={9} />
                <div className="sm:col-span-2">
                  <Field label="Наименование банка" id="bank" value={form.bank} onChange={(v) => setField('bank', v)} placeholder="ПАО Сбербанк" />
                </div>
              </div>
            </div>
            {/* Контакты — только при редактировании */}
            {editing && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Контакты</p>

                  {/* Привязать контакт */}
                  <div className="mb-3">
                    <ContactSearchInput
                      contacts={allContacts}
                      linkedIds={linkedContacts.map(c => c.id)}
                      onSelect={handleLinkContact}
                    />
                  </div>

                  {/* Список привязанных контактов */}
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
                          <button
                            onClick={() => handleUnlinkContact(c.id)}
                            disabled={unlinkingId === c.id}
                            className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-500 transition-colors"
                            title="Отвязать"
                          >
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.inn.trim()}
              className="gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
