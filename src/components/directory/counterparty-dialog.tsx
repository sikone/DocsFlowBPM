'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { Counterparty } from '@/lib/types';
import { toast } from 'sonner';

interface CounterpartyForm {
  name: string; shortName: string; inn: string; kpp: string; ogrn: string;
  legalAddress: string; actualAddress: string; postalAddress: string; postalCode: string;
  bankAccount: string; bank: string; bik: string; active: boolean;
}

const EMPTY: CounterpartyForm = {
  name: '', shortName: '', inn: '', kpp: '', ogrn: '',
  legalAddress: '', actualAddress: '', postalAddress: '', postalCode: '',
  bankAccount: '', bank: '', bik: '', active: true,
};

function fromCounterparty(c: Counterparty): CounterpartyForm {
  return {
    name: c.name, shortName: c.shortName ?? '', inn: c.inn, kpp: c.kpp ?? '',
    ogrn: c.ogrn ?? '', legalAddress: c.legalAddress ?? '', actualAddress: c.actualAddress ?? '',
    postalAddress: c.postalAddress ?? '', postalCode: c.postalCode ?? '',
    bankAccount: c.bankAccount ?? '', bank: c.bank ?? '', bik: c.bik ?? '', active: c.active,
  };
}

function Field({ label, id, value, onChange, placeholder, maxLength }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength} className="h-9 text-sm" />
    </div>
  );
}

export interface CounterpartyDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  editing?: Counterparty | null;
  onSaved?: (counterparty: Counterparty) => void;
  children?: React.ReactNode;
}

export function CounterpartyDialog({
  open, onOpenChange, token, editing = null, onSaved, children,
}: CounterpartyDialogProps) {
  const [form, setForm] = useState<CounterpartyForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);

  const handleFill = async () => {
    if (!token || filling) return;
    const inn = form.inn.trim();
    if (!/^\d{10}(\d{2})?$/.test(inn)) {
      toast.error('Введите корректный ИНН (10 или 12 цифр)');
      return;
    }
    setFilling(true);
    try {
      const res = await fetch(`/api/dadata/counterparty?inn=${encodeURIComponent(inn)}&token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка запроса');
      setForm((f) => ({
        ...f,
        name: json.name || f.name,
        shortName: json.shortName || f.shortName,
        kpp: json.kpp || f.kpp,
        ogrn: json.ogrn || f.ogrn,
        legalAddress: json.legalAddress || f.legalAddress,
        postalCode: json.postalCode || f.postalCode,
      }));
      toast.success('Данные заполнены по ИНН');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось получить данные');
    } finally {
      setFilling(false);
    }
  };

  useEffect(() => {
    setForm(editing ? fromCounterparty(editing) : EMPTY);
  }, [editing, open]);

  const set = <K extends keyof CounterpartyForm>(key: K, value: CounterpartyForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!token || !form.name.trim() || !form.inn.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(), shortName: form.shortName.trim() || null,
        inn: form.inn.trim(), kpp: form.kpp.trim() || null, ogrn: form.ogrn.trim() || null,
        legalAddress: form.legalAddress.trim() || null, actualAddress: form.actualAddress.trim() || null,
        postalAddress: form.postalAddress.trim() || null, postalCode: form.postalCode.trim() || null,
        bankAccount: form.bankAccount.trim() || null, bank: form.bank.trim() || null,
        bik: form.bik.trim() || null, active: form.active,
      };
      const url = editing ? `/api/counterparties/${editing.id}` : '/api/counterparties';
      const res = await fetch(`${url}?token=${encodeURIComponent(token)}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка сохранения');
      toast.success(editing ? 'Контрагент обновлён' : 'Контрагент добавлен');
      onOpenChange(false);
      onSaved?.(json.counterparty);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать контрагента' : 'Новый контрагент'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Измените данные контрагента' : 'Заполните реквизиты нового контрагента'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Основная информация</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Полное наименование *" id="cp-name" value={form.name}
                  onChange={(v) => set('name', v)} placeholder="ООО «Название компании»" />
              </div>
              <Field label="Краткое наименование" id="cp-shortName" value={form.shortName}
                onChange={(v) => set('shortName', v)} placeholder="ООО «Название»" />
              <div className="flex items-center gap-3 pt-6">
                <Switch id="cp-active" checked={form.active} onCheckedChange={(v) => set('active', v)}
                  className="data-[state=checked]:bg-emerald-600" />
                <Label htmlFor="cp-active" className="text-sm cursor-pointer">Активен</Label>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Регистрационные данные</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-inn" className="text-sm">ИНН *</Label>
                <div className="flex gap-1.5">
                  <Input id="cp-inn" value={form.inn} onChange={(e) => set('inn', e.target.value)}
                    placeholder="1234567890" maxLength={12} className="h-9 text-sm font-mono" />
                  <Button type="button" variant="outline" size="sm"
                    className="h-9 px-3 shrink-0 gap-1.5 text-xs"
                    disabled={filling || !/^\d{10}(\d{2})?$/.test(form.inn.trim())}
                    onClick={handleFill}
                    title="Заполнить данные по ИНН">
                    {filling
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Wand2 className="w-3.5 h-3.5" />}
                    {!filling && <span>Заполнить</span>}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="КПП" id="cp-kpp" value={form.kpp} onChange={(v) => set('kpp', v)}
                  placeholder="123456789" maxLength={9} />
                <Field label="ОГРН" id="cp-ogrn" value={form.ogrn} onChange={(v) => set('ogrn', v)}
                  placeholder="1234567890123" maxLength={15} />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Адреса</p>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Юридический адрес" id="cp-legal" value={form.legalAddress}
                onChange={(v) => set('legalAddress', v)} placeholder="123456, г. Москва, ул. Примерная, д. 1" />
              <Field label="Фактический адрес" id="cp-actual" value={form.actualAddress}
                onChange={(v) => set('actualAddress', v)} placeholder="Совпадает с юридическим или иной адрес" />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3">
                  <Field label="Почтовый адрес" id="cp-postal" value={form.postalAddress}
                    onChange={(v) => set('postalAddress', v)} placeholder="г. Москва, ул. Почтовая, д. 2" />
                </div>
                <Field label="Индекс" id="cp-postalCode" value={form.postalCode}
                  onChange={(v) => set('postalCode', v)} placeholder="123456" maxLength={6} />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Банковские реквизиты</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Расчётный счёт" id="cp-bankAccount" value={form.bankAccount}
                onChange={(v) => set('bankAccount', v)} placeholder="40702810000000000000" maxLength={20} />
              <Field label="БИК" id="cp-bik" value={form.bik} onChange={(v) => set('bik', v)}
                placeholder="044525225" maxLength={9} />
              <div className="sm:col-span-2">
                <Field label="Наименование банка" id="cp-bank" value={form.bank}
                  onChange={(v) => set('bank', v)} placeholder="ПАО Сбербанк" />
              </div>
            </div>
          </div>

          {children}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.inn.trim()} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
