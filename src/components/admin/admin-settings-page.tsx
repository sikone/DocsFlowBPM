'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Save, FolderOpen, SlidersHorizontal, Clock, Timer, Network, Eye, EyeOff, RefreshCw, Plug, Mail, Send, Inbox } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { DEFAULT_SLA, DEFAULT_WORKING_HOURS, URGENCY_LABELS, type UrgencyLevel } from '@/lib/sla';

const URGENCY_LEVELS: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const WEEK_DAYS = [
  { iso: 1, label: 'Пн' },
  { iso: 2, label: 'Вт' },
  { iso: 3, label: 'Ср' },
  { iso: 4, label: 'Чт' },
  { iso: 5, label: 'Пт' },
  { iso: 6, label: 'Сб' },
  { iso: 7, label: 'Вс' },
];

export function AdminSettingsPage() {
  const { token } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // File storage
  const [uploadPath, setUploadPath] = useState('');

  // Working hours
  const [workStart, setWorkStart] = useState(String(DEFAULT_WORKING_HOURS.start).padStart(2, '0') + ':00');
  const [workEnd, setWorkEnd]     = useState(String(DEFAULT_WORKING_HOURS.end).padStart(2, '0') + ':00');
  const [workingDays, setWorkingDays] = useState<number[]>(DEFAULT_WORKING_HOURS.workingDays);

  // Default SLA hours per urgency (used when a step has no individual slaConfig)
  const [slaHours, setSlaHours] = useState<Record<UrgencyLevel, number>>({ ...DEFAULT_SLA });

  // Email / SMTP / POP3
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpPasswordPlaceholder, setSmtpPasswordPlaceholder] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [pop3Host, setPop3Host] = useState('');
  const [pop3Port, setPop3Port] = useState('995');
  const [pop3Secure, setPop3Secure] = useState(true);
  const [pop3User, setPop3User] = useState('');
  const [pop3Password, setPop3Password] = useState('');
  const [pop3PasswordPlaceholder, setPop3PasswordPlaceholder] = useState('');
  const [showPop3Password, setShowPop3Password] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Active Directory
  const [adEnabled, setAdEnabled] = useState(false);
  const [adUrl, setAdUrl] = useState('');
  const [adBaseDn, setAdBaseDn] = useState('');
  const [adBindDn, setAdBindDn] = useState('');
  const [adBindPassword, setAdBindPassword] = useState('');
  const [adBindPasswordPlaceholder, setAdBindPasswordPlaceholder] = useState('');
  const [adGroup, setAdGroup] = useState('G_Test_DocsFlow');
  const [showAdPassword, setShowAdPassword] = useState(false);
  const [adTesting, setAdTesting] = useState(false);
  const [adSyncing, setAdSyncing] = useState(false);
  const [adTestResult, setAdTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<Record<string, string>>('/api/settings', token)
      .then((settings) => {
        setUploadPath(settings.uploadPath ?? './storage/uploads');

        const start = parseInt(settings.workHoursStart ?? '', 10);
        const end   = parseInt(settings.workHoursEnd   ?? '', 10);
        setWorkStart((Number.isFinite(start) ? start : DEFAULT_WORKING_HOURS.start).toString().padStart(2, '0') + ':00');
        setWorkEnd(  (Number.isFinite(end)   ? end   : DEFAULT_WORKING_HOURS.end  ).toString().padStart(2, '0') + ':00');

        if (settings.workingDays) {
          try { setWorkingDays(JSON.parse(settings.workingDays)); } catch { /* fallback */ }
        }

        const merged = { ...DEFAULT_SLA };
        for (const level of URGENCY_LEVELS) {
          const key = `slaDefault${level}` as string;
          const val = parseInt(settings[key] ?? '', 10);
          if (Number.isFinite(val) && val > 0) merged[level] = val;
        }
        setSlaHours(merged);

        // Email
        setEmailEnabled(settings.emailEnabled === 'true');
        setSmtpHost(settings.smtpHost ?? '');
        setSmtpPort(settings.smtpPort ?? '587');
        setSmtpSecure(settings.smtpSecure === 'true');
        setSmtpUser(settings.smtpUser ?? '');
        setSmtpFrom(settings.smtpFrom ?? '');
        setSmtpFromName(settings.smtpFromName ?? '');
        if (settings.smtpPassword) setSmtpPasswordPlaceholder('••••••••');
        setPop3Host(settings.pop3Host ?? '');
        setPop3Port(settings.pop3Port ?? '995');
        setPop3Secure(settings.pop3Secure !== 'false');
        setPop3User(settings.pop3User ?? '');
        if (settings.pop3Password) setPop3PasswordPlaceholder('••••••••');

        // Active Directory
        setAdEnabled(settings.adEnabled === 'true');
        setAdUrl(settings.adUrl ?? '');
        setAdBaseDn(settings.adBaseDn ?? '');
        setAdBindDn(settings.adBindDn ?? '');
        setAdGroup(settings.adGroup ?? 'G_Test_DocsFlow');
        // Show placeholder if password was previously saved
        if (settings.adBindPassword) setAdBindPasswordPlaceholder('••••••••');
      })
      .catch(() => toast.error('Ошибка загрузки настроек'))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleDay = (iso: number) =>
    setWorkingDays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()
    );

  const handleSave = async () => {
    if (!token) return;
    const startH = parseInt(workStart.split(':')[0], 10);
    const endH   = parseInt(workEnd.split(':')[0],   10);
    if (!Number.isFinite(startH) || !Number.isFinite(endH) || startH >= endH) {
      toast.error('Время начала должно быть меньше времени окончания');
      return;
    }
    if (workingDays.length === 0) {
      toast.error('Выберите хотя бы один рабочий день');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {
        uploadPath: uploadPath.trim() || './storage/uploads',
        workHoursStart: String(startH),
        workHoursEnd:   String(endH),
        workingDays: JSON.stringify(workingDays),
        emailEnabled: String(emailEnabled),
        smtpHost: smtpHost.trim(),
        smtpPort: smtpPort.trim() || '587',
        smtpSecure: String(smtpSecure),
        smtpUser: smtpUser.trim(),
        smtpFrom: smtpFrom.trim(),
        smtpFromName: smtpFromName.trim(),
        pop3Host: pop3Host.trim(),
        pop3Port: pop3Port.trim() || '995',
        pop3Secure: String(pop3Secure),
        pop3User: pop3User.trim(),
        adEnabled: String(adEnabled),
        adUrl: adUrl.trim(),
        adBaseDn: adBaseDn.trim(),
        adBindDn: adBindDn.trim(),
        adGroup: adGroup.trim() || 'G_Test_DocsFlow',
      };
      if (smtpPassword) body.smtpPassword = smtpPassword;
      if (pop3Password) body.pop3Password = pop3Password;
      // Only overwrite password if user typed a new one
      if (adBindPassword) body.adBindPassword = adBindPassword;
      for (const level of URGENCY_LEVELS) {
        body[`slaDefault${level}`] = String(slaHours[level]);
      }
      await apiFetch('/api/settings', token, { method: 'PUT', body: JSON.stringify(body) });
      if (smtpPassword) { setSmtpPassword(''); setSmtpPasswordPlaceholder('••••••••'); }
      if (pop3Password)  { setPop3Password('');  setPop3PasswordPlaceholder('••••••••'); }
      if (adBindPassword) {
        setAdBindPassword('');
        setAdBindPasswordPlaceholder('••••••••');
      }
      toast.success('Настройки сохранены');
    } catch {
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleEmailTest = async () => {
    if (!token) return;
    setEmailTesting(true);
    setEmailTestResult(null);
    try {
      const res = await fetch(`/api/admin/email-test?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmailTo.trim(),
          host: smtpHost.trim(),
          port: parseInt(smtpPort, 10) || 587,
          secure: smtpSecure,
          smtpUser: smtpUser.trim(),
          password: smtpPassword || undefined,
          from: smtpFrom.trim(),
          fromName: smtpFromName.trim() || undefined,
        }),
      });
      const json = await res.json();
      setEmailTestResult(json);
    } catch {
      setEmailTestResult({ success: false, message: 'Ошибка запроса' });
    } finally {
      setEmailTesting(false);
    }
  };

  const handleAdTest = async () => {
    if (!token) return;
    setAdTesting(true);
    setAdTestResult(null);
    try {
      const res = await fetch(`/api/admin/ad-test?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: adUrl.trim(),
          baseDn: adBaseDn.trim(),
          bindDn: adBindDn.trim(),
          bindPassword: adBindPassword || undefined,
          group: adGroup.trim() || 'G_Test_DocsFlow',
        }),
      });
      const json = await res.json();
      setAdTestResult(json);
    } catch {
      setAdTestResult({ success: false, message: 'Ошибка запроса' });
    } finally {
      setAdTesting(false);
    }
  };

  const handleAdSync = async () => {
    if (!token) return;
    setAdSyncing(true);
    try {
      const res = await fetch(`/api/admin/ad-sync?token=${encodeURIComponent(token)}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка синхронизации');
      toast.success(`Синхронизация завершена: создано ${json.created}, обновлено ${json.updated}${json.skipped ? `, пропущено ${json.skipped}` : ''}${json.errors?.length ? `, ошибок: ${json.errors.length}` : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setAdSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <SlidersHorizontal className="w-6 h-6 text-emerald-500" />
          Настройки системы
        </h1>
        <p className="text-slate-500 mt-1">Конфигурация приложения</p>
      </div>

      {/* File storage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-500" />
            Хранилище файлов
          </CardTitle>
          <CardDescription>
            Папка для хранения вложений документов.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upload-path">Путь к папке загрузок</Label>
            <Input
              id="upload-path"
              value={uploadPath}
              onChange={(e) => setUploadPath(e.target.value)}
              placeholder="./storage/uploads"
              className="font-mono"
            />
            <p className="text-xs text-slate-400">
              Абсолютный или относительный путь от корня проекта.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Working hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-500" />
            Рабочее время
          </CardTitle>
          <CardDescription>
            Используется для расчёта дедлайнов SLA — часы вне рабочего времени не учитываются.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1.5">
              <Label htmlFor="work-start">Начало рабочего дня</Label>
              <Input
                id="work-start"
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="work-end">Конец рабочего дня</Label>
              <Input
                id="work-end"
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Рабочие дни</Label>
            <div className="flex gap-2 flex-wrap">
              {WEEK_DAYS.map(({ iso, label }) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => toggleDay(iso)}
                  className={`w-10 h-10 rounded-md text-sm font-medium border transition-colors ${
                    workingDays.includes(iso)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-background text-muted-foreground border-border hover:border-emerald-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default SLA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="w-4 h-4 text-amber-500" />
            SLA по умолчанию
          </CardTitle>
          <CardDescription>
            Используется, когда у шага согласования нет собственной SLA матрицы.
            Значения в рабочих часах.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Срочность</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Описание</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Рабочих часов</th>
                </tr>
              </thead>
              <tbody>
                {URGENCY_LEVELS.map((level, idx) => (
                  <tr key={level} className={`border-b border-border/50 last:border-0 ${idx % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium">{URGENCY_LABELS[level]}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {level === 'LOW'      && 'Стандартные задачи без спешки'}
                      {level === 'MEDIUM'   && 'Обычный рабочий приоритет'}
                      {level === 'HIGH'     && 'Срочные задачи, требуют внимания сегодня'}
                      {level === 'CRITICAL' && 'Экстренные — максимальный приоритет'}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={slaHours[level]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (Number.isFinite(val) && val > 0)
                            setSlaHours((prev) => ({ ...prev, [level]: val }));
                        }}
                        className="w-20 h-7 text-sm text-right rounded border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 ml-auto block"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-500" />
            Электронная почта
          </CardTitle>
          <CardDescription>
            Настройки почтового сервера для отправки уведомлений о действиях с документами.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              id="email-enabled"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
              className="data-[state=checked]:bg-emerald-600"
            />
            <Label htmlFor="email-enabled" className="cursor-pointer">
              Включить отправку уведомлений по e-mail
            </Label>
          </div>

          {/* SMTP */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Send className="w-3.5 h-3.5 text-blue-500" />
              SMTP — исходящая почта
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="smtp-host">Адрес сервера</Label>
                <Input
                  id="smtp-host"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.company.local"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp-port">Порт</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp-user">Логин</Label>
                <Input
                  id="smtp-user"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="docsflow@company.local"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp-pass">Пароль</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="smtp-pass"
                    type={showSmtpPassword ? 'text' : 'password'}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder={smtpPasswordPlaceholder || 'Введите пароль'}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setShowSmtpPassword((v) => !v)}
                  >
                    {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {smtpPasswordPlaceholder && !smtpPassword && (
                  <p className="text-xs text-muted-foreground">Пароль сохранён. Оставьте поле пустым, чтобы не менять.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp-from">E-mail отправителя</Label>
                <Input
                  id="smtp-from"
                  type="email"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder="noreply@company.local"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp-from-name">Имя отправителя</Label>
                <Input
                  id="smtp-from-name"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                  placeholder="DocsFlow"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="smtp-secure"
                checked={smtpSecure}
                onCheckedChange={setSmtpSecure}
                className="data-[state=checked]:bg-emerald-600"
              />
              <Label htmlFor="smtp-secure" className="cursor-pointer text-sm">
                SSL/TLS (порт 465) — отключите для STARTTLS (порт 587)
              </Label>
            </div>
          </div>

          <Separator />

          {/* POP3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Inbox className="w-3.5 h-3.5 text-blue-500" />
              POP3 — входящая почта
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pop3-host">Адрес сервера</Label>
                <Input
                  id="pop3-host"
                  value={pop3Host}
                  onChange={(e) => setPop3Host(e.target.value)}
                  placeholder="pop3.company.local"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pop3-port">Порт</Label>
                <Input
                  id="pop3-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={pop3Port}
                  onChange={(e) => setPop3Port(e.target.value)}
                  placeholder="995"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pop3-user">Логин</Label>
                <Input
                  id="pop3-user"
                  value={pop3User}
                  onChange={(e) => setPop3User(e.target.value)}
                  placeholder="docsflow@company.local"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pop3-pass">Пароль</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="pop3-pass"
                    type={showPop3Password ? 'text' : 'password'}
                    value={pop3Password}
                    onChange={(e) => setPop3Password(e.target.value)}
                    placeholder={pop3PasswordPlaceholder || 'Введите пароль'}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setShowPop3Password((v) => !v)}
                  >
                    {showPop3Password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {pop3PasswordPlaceholder && !pop3Password && (
                  <p className="text-xs text-muted-foreground">Пароль сохранён. Оставьте поле пустым, чтобы не менять.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="pop3-secure"
                checked={pop3Secure}
                onCheckedChange={setPop3Secure}
                className="data-[state=checked]:bg-emerald-600"
              />
              <Label htmlFor="pop3-secure" className="cursor-pointer text-sm">
                SSL/TLS (порт 995)
              </Label>
            </div>
          </div>

          <Separator />

          {/* Test send */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Send className="w-3.5 h-3.5 text-blue-500" />
              Проверка отправки
            </div>
            <div className="flex gap-2 flex-wrap items-start">
              <div className="flex-1 min-w-48 space-y-1.5">
                <Label htmlFor="test-email-to">E-mail получателя</Label>
                <Input
                  id="test-email-to"
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="admin@company.local"
                />
              </div>
              <div className="flex flex-col justify-end space-y-1.5">
                <Label className="invisible select-none">.</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 whitespace-nowrap"
                  disabled={emailTesting || !testEmailTo.trim() || !smtpHost.trim() || !smtpFrom.trim()}
                  onClick={handleEmailTest}
                >
                  {emailTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Отправить тестовый e-mail
                </Button>
              </div>
            </div>
            {emailTestResult && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md border ${
                emailTestResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
                  : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400'
              }`}>
                <Badge variant="outline" className={`text-xs shrink-0 ${emailTestResult.success ? 'border-emerald-400 text-emerald-600' : 'border-rose-400 text-rose-600'}`}>
                  {emailTestResult.success ? 'OK' : 'Ошибка'}
                </Badge>
                {emailTestResult.message}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Directory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="w-4 h-4 text-violet-500" />
            Active Directory
          </CardTitle>
          <CardDescription>
            Синхронизация пользователей из группы AD. Авторизация выполняется через LDAP bind.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="ad-enabled"
              checked={adEnabled}
              onCheckedChange={setAdEnabled}
              className="data-[state=checked]:bg-emerald-600"
            />
            <Label htmlFor="ad-enabled" className="cursor-pointer">
              Включить синхронизацию с AD
            </Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ad-url">URL сервера</Label>
              <Input
                id="ad-url"
                value={adUrl}
                onChange={(e) => setAdUrl(e.target.value)}
                placeholder="ldap://192.168.1.1:389"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-group">Группа синхронизации</Label>
              <Input
                id="ad-group"
                value={adGroup}
                onChange={(e) => setAdGroup(e.target.value)}
                placeholder="G_Test_DocsFlow"
                className="font-mono text-sm"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="ad-base-dn">Base DN</Label>
              <Input
                id="ad-base-dn"
                value={adBaseDn}
                onChange={(e) => setAdBaseDn(e.target.value)}
                placeholder="DC=company,DC=local"
                className="font-mono text-sm"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="ad-bind-dn">Bind DN (сервисный аккаунт)</Label>
              <Input
                id="ad-bind-dn"
                value={adBindDn}
                onChange={(e) => setAdBindDn(e.target.value)}
                placeholder="CN=svc_docsflow,OU=ServiceAccounts,DC=company,DC=local"
                className="font-mono text-sm"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="ad-bind-pass">Пароль сервисного аккаунта</Label>
              <div className="flex gap-1.5">
                <Input
                  id="ad-bind-pass"
                  type={showAdPassword ? 'text' : 'password'}
                  value={adBindPassword}
                  onChange={(e) => setAdBindPassword(e.target.value)}
                  placeholder={adBindPasswordPlaceholder || 'Введите пароль'}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setShowAdPassword((v) => !v)}
                >
                  {showAdPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {adBindPasswordPlaceholder && !adBindPassword && (
                <p className="text-xs text-muted-foreground">Пароль сохранён. Оставьте поле пустым, чтобы не менять.</p>
              )}
            </div>
          </div>

          {adTestResult && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md border ${
              adTestResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
                : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400'
            }`}>
              <Badge variant="outline" className={`text-xs shrink-0 ${adTestResult.success ? 'border-emerald-400 text-emerald-600' : 'border-rose-400 text-rose-600'}`}>
                {adTestResult.success ? 'OK' : 'Ошибка'}
              </Badge>
              {adTestResult.message}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={adTesting || !adUrl || !adBaseDn || !adBindDn || (!adBindPassword && !adBindPasswordPlaceholder)}
              onClick={handleAdTest}
            >
              {adTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Проверить подключение
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={adSyncing || !adEnabled}
              onClick={handleAdSync}
              title={!adEnabled ? 'Включите синхронизацию для запуска' : undefined}
            >
              {adSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Синхронизировать сейчас
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}
