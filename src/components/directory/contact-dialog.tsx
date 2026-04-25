'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Building2, Search, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { Contact, Counterparty } from '@/lib/types';
import { toast } from 'sonner';

function CounterpartyMultiSelect({
  counterparties, selected, onChange,
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
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input type="text" value={query}
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
                <button key={cp.id} type="button"
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

interface ContactForm {
  name: string; email: string; phone: string; telegramId: string; note: string;
  counterpartyIds: string[];
}

const EMPTY: ContactForm = { name: '', email: '', phone: '', telegramId: '', note: '', counterpartyIds: [] };

function fromContact(c: Contact): ContactForm {
  return {
    name: c.name, email: c.email ?? '', phone: c.phone ?? '',
    telegramId: c.telegramId ?? '', note: c.note ?? '',
    counterpartyIds: c.counterparties?.map((l) => l.counterparty.id) ?? [],
  };
}

export interface ContactDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  editing?: Contact | null;
  onSaved?: (contact: Contact) => void;
}

export function ContactDialog({ open, onOpenChange, token, editing = null, onSaved }: ContactDialogProps) {
  const [form, setForm] = useState<ContactForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);

  useEffect(() => {
    setForm(editing ? fromContact(editing) : EMPTY);
  }, [editing, open]);

  useEffect(() => {
    if (!open || !token) return;
    fetch(`/api/counterparties?active=false&token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setCounterparties(d.counterparties ?? []))
      .catch(() => {});
  }, [open, token]);

  const set = <K extends keyof ContactForm>(k: K, v: ContactForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
      const url = editing ? `/api/contacts/${editing.id}` : '/api/contacts';
      const res = await fetch(`${url}?token=${encodeURIComponent(token)}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка сохранения');
      toast.success(editing ? 'Контакт обновлён' : 'Контакт добавлен');
      onOpenChange(false);
      onSaved?.(json.contact);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать контакт' : 'Новый контакт'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Измените данные контактного лица' : 'Заполните данные нового контактного лица'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ct-name" className="text-sm">ФИО *</Label>
            <Input id="ct-name" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="Иванов Иван Иванович" className="h-9 text-sm" autoFocus />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-email" className="text-sm">Email</Label>
              <Input id="ct-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="ivan@example.com" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-phone" className="text-sm">Телефон</Label>
              <Input id="ct-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                placeholder="+7 (999) 123-45-67" className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ct-telegram" className="text-sm">Telegram ID</Label>
            <Input id="ct-telegram" value={form.telegramId} onChange={(e) => set('telegramId', e.target.value)}
              placeholder="@username или числовой ID" className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ct-note" className="text-sm">Примечание</Label>
            <Textarea id="ct-note" value={form.note} onChange={(e) => set('note', e.target.value)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
