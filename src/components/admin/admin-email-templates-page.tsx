'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Plus, Save, RotateCcw, Trash2, ChevronRight, Info, Shield, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { useStore } from '@/lib/store';
import { TEMPLATE_VARIABLES } from '@/lib/email-template-defaults';

interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  isSystem: boolean;
  includeAttachments: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  includeAttachments: boolean;
}

export function AdminEmailTemplatesPage() {
  const { token } = useStore();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', description: '', subject: '', bodyHtml: '', includeAttachments: false });
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const selectTemplate = (tpl: EmailTemplate) => {
    setSelected(tpl);
    setIsNew(false);
    setError('');
    setPreview(false);
    setForm({
      name: tpl.name,
      description: tpl.description,
      subject: tpl.subject,
      bodyHtml: tpl.bodyHtml,
      includeAttachments: tpl.includeAttachments ?? false,
    });
  };

  const startNew = () => {
    setSelected(null);
    setIsNew(true);
    setError('');
    setPreview(false);
    setForm({ name: '', description: '', subject: '', bodyHtml: '', includeAttachments: false });
  };

  const isDirty = selected
    ? form.name !== selected.name ||
      form.description !== selected.description ||
      form.subject !== selected.subject ||
      form.bodyHtml !== selected.bodyHtml ||
      form.includeAttachments !== (selected.includeAttachments ?? false)
    : isNew && (form.name || form.subject || form.bodyHtml);

  const reset = () => {
    if (selected) {
      setForm({
        name: selected.name,
        description: selected.description,
        subject: selected.subject,
        bodyHtml: selected.bodyHtml,
        includeAttachments: selected.includeAttachments ?? false,
      });
    } else {
      setForm({ name: '', description: '', subject: '', bodyHtml: '', includeAttachments: false });
    }
    setError('');
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Введите название шаблона'); return; }
    if (!form.subject.trim()) { setError('Введите тему письма'); return; }
    if (!form.bodyHtml.trim()) { setError('HTML-тело не может быть пустым'); return; }

    setSaving(true);
    setError('');
    try {
      const url = isNew ? '/api/admin/email-templates' : `/api/admin/email-templates/${selected!.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Ошибка сохранения'); return; }
      await load();
      selectTemplate(data.template);
    } catch {
      setError('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/admin/email-templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelected(null);
      setIsNew(false);
      await load();
    } catch {
      setError('Ошибка удаления');
    }
  };

  const previewHtml = form.bodyHtml
    .replace(/\{\{DOCUMENT_TITLE\}\}/g, 'Договор оказания услуг №2024-001')
    .replace(/\{\{DOCUMENT_NUMBER_BLOCK\}\}/g, '<p style="margin:0 0 20px;font-size:13px;color:#64748b">Номер документа: <strong style="color:#334155">2024-001</strong></p>')
    .replace(/\{\{STEP_NAME\}\}/g, 'Согласование с директором')
    .replace(/\{\{ASSIGNEE_BLOCK\}\}/g, '<div style="margin-top:4px;font-size:13px;color:#64748b">Ответственный: <strong style="color:#334155">Иванов И.И.</strong></div>')
    .replace(/\{\{DEADLINE_HTML\}\}/g, '<div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:5px 10px;font-size:12px;color:#dc2626;font-weight:500"><span>⏰</span> Срок: 15.05.2026 18:00</div>')
    .replace(/\{\{FIELDS_HTML\}\}/g, '<div style="margin-bottom:24px"><div style="font-size:11px;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:8px">Поля документа</div><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden"><tr style="background:#fff"><td style="padding:8px 14px;color:#64748b;font-size:13px;width:40%;border-bottom:1px solid #f1f5f9">Контрагент</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9">ООО Ромашка</td></tr><tr style="background:#f8fafc"><td style="padding:8px 14px;color:#64748b;font-size:13px;width:40%;border-bottom:1px solid #f1f5f9">Сумма</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9">150 000,00 ₽</td></tr></table></div>')
    .replace(/\{\{COMMENTS_HTML\}\}/g, '')
    .replace(/\{\{DOC_URL\}\}/g, 'http://localhost:3000/?doc=example')
    .replace(/\{\{CTA_BUTTON_HTML\}\}/g, '<a href="#" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.02em;box-shadow:0 4px 14px rgba(16,185,129,0.35)">Перейти к документу &rarr;</a>')
    .replace(/\{\{QUICK_APPROVE_HTML\}\}/g, '<div style="margin-top:12px"><a href="#" style="display:inline-block;background:#fff;color:#059669;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;border:2px solid #10b981">&#10003; Согласовать без изменений</a></div>');

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Шаблоны e-mail</h1>
            <p className="text-sm text-muted-foreground mt-1">Управление шаблонами уведомлений</p>
          </div>
          <Button onClick={startNew} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Новый шаблон
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 min-h-[600px]">
          {/* Template list */}
          <div className="border rounded-xl bg-card overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Шаблоны</p>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>
              ) : (
                <div className="p-2 space-y-1">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-2 group ${
                        selected?.id === tpl.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Mail className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{tpl.name}</span>
                          {tpl.isSystem && (
                            <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{tpl.slug}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 text-muted-foreground mt-0.5 transition-opacity ${selected?.id === tpl.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Editor */}
          {(selected || isNew) ? (
            <div className="border rounded-xl bg-card overflow-hidden flex flex-col">
              {/* Editor header */}
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {isNew ? 'Новый шаблон' : selected?.name}
                  </span>
                  {selected?.isSystem && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">
                      системный
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setPreview(!preview)}
                  >
                    {preview ? 'Редактор' : 'Предпросмотр'}
                  </Button>
                  {isDirty && (
                    <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Сбросить
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={saving || !isDirty} className="gap-1.5">
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  {selected && !selected.isSystem && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Шаблон «{selected.name}» будет удалён. Это действие нельзя отменить.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => deleteTemplate(selected.id)}
                          >
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {error && (
                <div className="mx-4 mt-3 px-3 py-2 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="flex-1 overflow-auto">
                {preview ? (
                  <div className="p-4">
                    <div className="text-xs text-muted-foreground mb-2 font-medium">
                      Тема: <span className="text-foreground">{form.subject.replace(/\{\{DOCUMENT_TITLE\}\}/g, 'Договор оказания услуг №2024-001')}</span>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full h-[600px] border-0"
                        title="Email preview"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="tpl-name">Название</Label>
                        <Input
                          id="tpl-name"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Название шаблона"
                          disabled={selected?.isSystem}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="tpl-desc">Описание</Label>
                        <Input
                          id="tpl-desc"
                          value={form.description}
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Краткое описание назначения"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="tpl-attachments"
                        checked={form.includeAttachments}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, includeAttachments: !!v }))}
                      />
                      <Label htmlFor="tpl-attachments" className="flex items-center gap-1.5 cursor-pointer font-normal">
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                        Прикладывать вложения документа
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          К письму будут прикреплены последние версии всех файлов документа
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="tpl-subject">Тема письма</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Доступная переменная: {'{{DOCUMENT_TITLE}}'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="tpl-subject"
                        value={form.subject}
                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                        placeholder="Тема письма с {{DOCUMENT_TITLE}}"
                        className="font-mono text-sm"
                      />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="tpl-body">HTML-тело письма</Label>
                        <Textarea
                          id="tpl-body"
                          value={form.bodyHtml}
                          onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
                          className="font-mono text-xs leading-relaxed min-h-[420px] resize-y"
                          placeholder="<!DOCTYPE html>..."
                          spellCheck={false}
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Переменные</p>
                        <div className="space-y-1.5">
                          {TEMPLATE_VARIABLES.map((v) => (
                            <div
                              key={v.name}
                              className="text-xs border rounded-lg p-2 bg-muted/40 cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => {
                                const el = document.getElementById('tpl-body') as HTMLTextAreaElement | null;
                                if (!el) return;
                                const start = el.selectionStart;
                                const end = el.selectionEnd;
                                const newVal = form.bodyHtml.slice(0, start) + v.name + form.bodyHtml.slice(end);
                                setForm((f) => ({ ...f, bodyHtml: newVal }));
                                requestAnimationFrame(() => {
                                  el.focus();
                                  el.setSelectionRange(start + v.name.length, start + v.name.length);
                                });
                              }}
                            >
                              <code className="text-emerald-700 dark:text-emerald-400 font-mono">{v.name}</code>
                              <p className="text-muted-foreground mt-0.5">{v.description}</p>
                              {v.inSubject && (
                                <span className="text-[10px] text-blue-600">также в теме</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border rounded-xl bg-card flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Mail className="w-10 h-10 mx-auto opacity-20" />
                <p className="text-sm">Выберите шаблон для редактирования</p>
                <p className="text-xs">или создайте новый</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
