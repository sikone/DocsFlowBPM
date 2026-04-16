'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store';
import type { Document, DocumentType, FormField } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  User,
  FolderOpen,
  Clock,
  ChevronDown,
  Loader2,
  MoreVertical,
} from 'lucide-react';

// ────────────────────────────────────────────
// Helper: fetch wrapper
// ────────────────────────────────────────────
async function apiFetch<T>(
  url: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const separator = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${separator}token=${encodeURIComponent(token)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ────────────────────────────────────────────
// Field Renderer
// ────────────────────────────────────────────
function FormFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean;
  onChange: (id: string, value: string | boolean) => void;
}) {
  const strValue = typeof value === 'string' ? value : '';
  const boolValue = typeof value === 'boolean' ? value : false;

  // Non-interactive field types
  if (field.type === 'heading') {
    return (
      <div className="col-span-full pt-2 pb-1">
        <h3 className="text-sm font-semibold text-slate-800">{field.label}</h3>
      </div>
    );
  }

  if (field.type === 'separator') {
    return <div className="col-span-full py-1"><Separator /></div>;
  }

  // Checkbox & Switch — label on the right
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <Checkbox
          id={`field-${field.id}`}
          checked={boolValue}
          onCheckedChange={(checked) => onChange(field.id, !!checked)}
          className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
        />
        <Label
          htmlFor={`field-${field.id}`}
          className="text-sm font-normal cursor-pointer select-none"
        >
          {field.label}
          {field.required && <span className="text-rose-500 ml-0.5">*</span>}
        </Label>
      </div>
    );
  }

  if (field.type === 'switch') {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <Switch
          id={`field-${field.id}`}
          checked={boolValue}
          onCheckedChange={(checked) => onChange(field.id, !!checked)}
          className="data-[state=checked]:bg-emerald-600"
        />
        <Label
          htmlFor={`field-${field.id}`}
          className="text-sm font-normal cursor-pointer select-none"
        >
          {field.label}
          {field.required && <span className="text-rose-500 ml-0.5">*</span>}
        </Label>
      </div>
    );
  }

  // All other field types — label above input
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`field-${field.id}`} className="text-sm">
        {field.label}
        {field.required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>

      {field.type === 'textarea' && (
        <Textarea
          id={`field-${field.id}`}
          value={strValue}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="resize-none min-h-[80px]"
        />
      )}

      {field.type === 'select' && (
        <Select
          value={strValue}
          onValueChange={(v) => onChange(field.id, v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={field.placeholder || 'Выберите значение'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'money' && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            {field.prefix || '\u20BD'}
          </span>
          <Input
            id={`field-${field.id}`}
            type="text"
            value={strValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || '0,00'}
            className="pl-7"
          />
        </div>
      )}

      {field.type === 'number' && (
        <Input
          id={`field-${field.id}`}
          type="number"
          value={strValue}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder}
        />
      )}

      {field.type === 'date' && (
        <Input
          id={`field-${field.id}`}
          type="date"
          value={strValue}
          onChange={(e) => onChange(field.id, e.target.value)}
          className="w-full"
        />
      )}

      {field.type === 'email' && (
        <Input
          id={`field-${field.id}`}
          type="email"
          value={strValue}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder || 'email@example.com'}
        />
      )}

      {field.type === 'phone' && (
        <Input
          id={`field-${field.id}`}
          type="tel"
          value={strValue}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder || '+7 (___) ___-__-__'}
        />
      )}

      {field.type === 'text' && (
        <Input
          id={`field-${field.id}`}
          type="text"
          value={strValue}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Row Group Renderer (multi-column grid)
// ────────────────────────────────────────────
function FormRowGroup({
  fields,
  formData,
  onChange,
}: {
  fields: FormField[];
  formData: Record<string, string | boolean>;
  onChange: (id: string, value: string | boolean) => void;
}) {
  const maxCol = Math.max(...fields.map((f) => f.column), 1);
  const colClass =
    maxCol >= 3 ? 'grid-cols-3' : maxCol === 2 ? 'grid-cols-2' : 'grid-cols-1';

  // Calculate column spans for heading/separator
  const isFullWidth = (f: FormField) => f.type === 'heading' || f.type === 'separator';

  // Place fields in grid cells based on column, or sequential if no columns
  const hasColumns = fields.some((f) => f.column > 0);

  if (!hasColumns) {
    return (
      <div className={`grid ${colClass} gap-4`}>
        {fields.map((field) => (
          <FormFieldRenderer
            key={field.id}
            field={field}
            value={formData[field.id] ?? (field.defaultValue || '')}
            onChange={onChange}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${colClass} gap-4`}>
      {fields
        .sort((a, b) => a.column - b.column)
        .map((field) => (
          <div key={field.id} className={isFullWidth(field) ? `col-span-${maxCol}` : ''}>
            <FormFieldRenderer
              field={field}
              value={formData[field.id] ?? (field.defaultValue || '')}
              onChange={onChange}
            />
          </div>
        ))}
    </div>
  );
}

// ────────────────────────────────────────────
// Status Dropdown
// ────────────────────────────────────────────
const STATUSES = [
  'DRAFT',
  'IN_PROGRESS',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
] as const;

function StatusDropdown({
  currentStatus,
  onStatusChange,
  disabled,
}: {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 text-xs font-medium ${STATUS_COLORS[currentStatus] || ''} border hover:opacity-90 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          disabled={disabled}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {STATUS_LABELS[currentStatus] || currentStatus}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Изменить статус</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => onStatusChange(s)}
            className={`gap-2 ${s === currentStatus ? 'bg-accent' : ''}`}
          >
            <span className={`h-2 w-2 rounded-full ${getStatusDotColor(s)}`} />
            {STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getStatusDotColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-400',
    IN_PROGRESS: 'bg-sky-500',
    APPROVED: 'bg-emerald-500',
    REJECTED: 'bg-rose-500',
    COMPLETED: 'bg-violet-500',
  };
  return map[status] || 'bg-slate-400';
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────
export default function DocumentFormView() {
  const { user, token, view, navigate, goBack, setLoading } = useStore();

  // ── Local State ──
  const [isNewDoc, setIsNewDoc] = useState(false);
  const [docType, setDocType] = useState<DocumentType | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [loading, setLoadingLocal] = useState(true);

  // ── Detect mode ──
  useEffect(() => {
    if (view.page === 'new-document') {
      setIsNewDoc(true);
      setStatus('DRAFT');
    } else if (view.page === 'edit-document') {
      setIsNewDoc(false);
    }
  }, [view.page]);

  // ── Load data ──
  useEffect(() => {
    if (!token) return;

    async function loadForNew() {
      try {
        setLoadingLocal(true);
        const typeId = (view as { typeId: string }).typeId;
        const types: DocumentType[] = await apiFetch('/api/document-types', token);
        const type = types.find((t) => t.id === typeId);
        if (!type) {
          toast.error('Тип документа не найден');
          goBack();
          return;
        }
        setDocType(type);
        // Parse form schema
        let fields: FormField[] = [];
        try {
          fields = JSON.parse(type.formSchema);
        } catch { /* empty schema */ }
        setFormFields(fields);

        // Set defaults
        const defaults: Record<string, string | boolean> = {};
        fields.forEach((f) => {
          if (f.defaultValue !== undefined && f.defaultValue !== '') {
            defaults[f.id] = f.defaultValue;
          } else if (f.type === 'checkbox' || f.type === 'switch') {
            defaults[f.id] = false;
          } else {
            defaults[f.id] = '';
          }
        });
        setFormData(defaults);
        setTitle(`${type.name} — новый`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoadingLocal(false);
      }
    }

    async function loadForEdit() {
      try {
        setLoadingLocal(true);
        const docId = (view as { documentId: string }).documentId;
        const doc: Document = await apiFetch(`/api/documents/${docId}`, token);
        setDocument(doc);
        setTitle(doc.title);
        setStatus(doc.status);

        // Set doc type
        if (doc.type) {
          setDocType(doc.type);
          let fields: FormField[] = [];
          try {
            fields = JSON.parse(doc.type.formSchema);
          } catch { /* empty schema */ }
          setFormFields(fields);

          // Pre-populate form data
          let dataObj: Record<string, string | boolean> = {};
          try {
            dataObj = JSON.parse(doc.data);
          } catch { /* empty data */ }

          // Fill in defaults for any fields missing in saved data
          fields.forEach((f) => {
            if (dataObj[f.id] === undefined) {
              if (f.defaultValue !== undefined && f.defaultValue !== '') {
                dataObj[f.id] = f.defaultValue;
              } else if (f.type === 'checkbox' || f.type === 'switch') {
                dataObj[f.id] = false;
              } else {
                dataObj[f.id] = '';
              }
            }
          });
          setFormData(dataObj);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка загрузки документа');
        goBack();
      } finally {
        setLoadingLocal(false);
      }
    }

    if (view.page === 'new-document') {
      loadForNew();
    } else if (view.page === 'edit-document') {
      loadForEdit();
    }
  }, [view.page, token, view, goBack]);

  // ── Group fields by row ──
  const fieldsByRow = useMemo(() => {
    const rows = new Map<number, FormField[]>();
    formFields.forEach((field) => {
      const r = field.row || 0;
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r)!.push(field);
    });
    // Sort rows by row number
    return Array.from(rows.entries())
      .sort(([a], [b]) => a - b)
      .map(([, fields]) => fields);
  }, [formFields]);

  // ── Handlers ──
  const handleFieldChange = useCallback((id: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      if (newStatus === status) return;
      setStatus(newStatus);
      // Auto-save with new status when editing
      if (!isNewDoc && document && token) {
        try {
          setSaving(true);
          await apiFetch(`/api/documents/${document.id}`, token, {
            method: 'PUT',
            body: JSON.stringify({
              title,
              data: JSON.stringify(formData),
              status: newStatus,
            }),
          });
          toast.success(`Статус изменён на "${STATUS_LABELS[newStatus]}"`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Ошибка смены статуса');
          setStatus(status); // Revert
        } finally {
          setSaving(false);
        }
      }
    },
    [status, isNewDoc, document, token, title, formData]
  );

  const handleSave = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    try {
      if (isNewDoc) {
        const viewData = view as { typeId: string; folderId?: string };
        const result: Document = await apiFetch('/api/documents', token, {
          method: 'POST',
          body: JSON.stringify({
            title,
            typeId: viewData.typeId,
            folderId: viewData.folderId || null,
            data: JSON.stringify(formData),
          }),
        });
        toast.success('Документ создан');
        // Navigate to edit mode
        navigate({ page: 'edit-document', documentId: result.id });
      } else if (document) {
        await apiFetch(`/api/documents/${document.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({
            title,
            data: JSON.stringify(formData),
          }),
        });
        toast.success('Документ сохранён');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [token, isNewDoc, view, title, formData, document, navigate]);

  const handleStatusAction = useCallback(
    async (targetStatus: string) => {
      if (!token) return;
      setSaving(true);
      try {
        if (isNewDoc) {
          // Save first, then set status
          const viewData = view as { typeId: string; folderId?: string };
          const result: Document = await apiFetch('/api/documents', token, {
            method: 'POST',
            body: JSON.stringify({
              title,
              typeId: viewData.typeId,
              folderId: viewData.folderId || null,
              data: JSON.stringify(formData),
              status: targetStatus,
            }),
          });
          toast.success('Документ создан и отправлен');
          navigate({ page: 'edit-document', documentId: result.id });
        } else if (document) {
          await apiFetch(`/api/documents/${document.id}`, token, {
            method: 'PUT',
            body: JSON.stringify({
              title,
              data: JSON.stringify(formData),
              status: targetStatus,
            }),
          });
          setStatus(targetStatus);
          toast.success(
            targetStatus === 'IN_PROGRESS'
              ? 'Документ отправлен'
              : targetStatus === 'APPROVED'
                ? 'Документ утверждён'
                : targetStatus === 'REJECTED'
                  ? 'Документ отклонён'
                  : 'Статус обновлён'
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка');
      } finally {
        setSaving(false);
      }
    },
    [token, isNewDoc, view, title, formData, document, navigate]
  );

  // ── Helpers ──
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getFolderName = (): string => {
    if (!document?.folderId) {
      if (view.page === 'new-document' && (view as { folderId?: string }).folderId) {
        const folders = useStore.getState().folders;
        const folder = folders.find(
          (f) => f.id === (view as { folderId: string }).folderId
        );
        return folder?.name || 'Не указана';
      }
      return 'Не указана';
    }
    const folders = useStore.getState().folders;
    const folder = folders.find((f) => f.id === document.folderId);
    return folder?.name || 'Не указана';
  };

  // ── Loading state ──
  if (loadingLocal) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-sm text-muted-foreground">Загрузка документа...</p>
        </div>
      </div>
    );
  }

  if (!docType) return null;

  return (
    <div className="flex flex-col h-full">
      {/* ═══ Top Header Bar ═══ */}
      <header className="sticky top-0 z-20 bg-white border-b px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="shrink-0 h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

          {/* Title (editable) */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="max-w-sm h-8 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent font-semibold"
          />

          {/* Document number badge */}
          {document?.number && (
            <Badge variant="outline" className="text-xs font-mono shrink-0">
              {document.number}
            </Badge>
          )}

          {/* Status dropdown */}
          <StatusDropdown
            currentStatus={status}
            onStatusChange={handleStatusChange}
            disabled={isNewDoc}
          />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {status === 'DRAFT' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusAction('IN_PROGRESS')}
                disabled={saving}
                className="gap-1.5 text-xs"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Отправить
              </Button>
            )}

            {status === 'IN_PROGRESS' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusAction('APPROVED')}
                  disabled={saving}
                  className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  Утвердить
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusAction('REJECTED')}
                  disabled={saving}
                  className="gap-1.5 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  Отклонить
                </Button>
              </>
            )}

            <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Сохранить
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full">
          {/* ── LEFT PANEL: Dynamic Form (2/3) ── */}
          <div className="flex-1 lg:w-2/3 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
              {/* Form type header */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center h-10 w-10 rounded-lg text-lg"
                  style={{ backgroundColor: `${docType.color}20` }}
                >
                  {docType.icon}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {isNewDoc ? 'Новый документ' : 'Редактирование'}
                  </h2>
                  <p className="text-xs text-muted-foreground">{docType.name}</p>
                </div>
              </div>

              <Separator />

              {/* Dynamic form fields */}
              {formFields.length > 0 ? (
                <div className="space-y-5">
                  {fieldsByRow.map((rowFields, rowIndex) => (
                    <FormRowGroup
                      key={rowIndex}
                      fields={rowFields}
                      formData={formData}
                      onChange={handleFieldChange}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Форма не содержит полей</p>
                      <p className="text-xs mt-1">
                        Настройте поля в панели администратора
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL: Properties Sidebar (1/3) ── */}
          <aside className="w-full lg:w-1/3 border-t lg:border-t-0 lg:border-l bg-gray-50/60 overflow-y-auto">
            <ScrollArea className="h-full">
              <div className="p-4 lg:p-5 space-y-4">
                {/* Document Properties Card */}
                <Card className="py-4">
                  <CardHeader className="pb-3 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Свойства документа
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 space-y-3.5">
                    {/* Type */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Тип
                      </span>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span>{docType.icon}</span>
                        <span>{docType.name}</span>
                      </div>
                    </div>

                    {/* Number */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Номер
                      </span>
                      <span className="text-sm font-mono font-medium">
                        {document?.number || (
                          <span className="text-muted-foreground italic">Автоматически</span>
                        )}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Статус
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_COLORS[status] || ''}`}
                      >
                        {STATUS_LABELS[status] || status}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Folder */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FolderOpen className="h-3.5 w-3.5" />
                        Папка
                      </span>
                      <span className="text-sm font-medium">{getFolderName()}</span>
                    </div>

                    {/* Creator */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Автор
                      </span>
                      <span className="text-sm font-medium">
                        {document?.creator?.name || user?.name || 'Не указан'}
                      </span>
                    </div>

                    <Separator />

                    {/* Created date */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Создан
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {document?.createdAt ? formatDate(document.createdAt) : '—'}
                      </span>
                    </div>

                    {/* Updated date */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Обновлён
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {document?.updatedAt ? formatDate(document.updatedAt) : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Action History Card */}
                <Card className="py-4">
                  <CardHeader className="pb-3 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      История действий
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4">
                    {document ? (
                      <div className="space-y-3">
                        {/* Creation event */}
                        <div className="flex gap-2.5">
                          <div className="flex flex-col items-center">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5" />
                            <div className="w-px flex-1 bg-border" />
                          </div>
                          <div className="pb-3">
                            <p className="text-xs font-medium">Документ создан</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(document.createdAt)}
                            </p>
                          </div>
                        </div>

                        {/* Status change events (derived from status) */}
                        {status !== 'DRAFT' && (
                          <div className="flex gap-2.5">
                            <div className="flex flex-col items-center">
                              <div
                                className={`h-2 w-2 rounded-full mt-1.5 ${getStatusDotColor(status)}`}
                              />
                              <div className="w-px flex-1 bg-border" />
                            </div>
                            <div className="pb-3">
                              <p className="text-xs font-medium">
                                Статус: {STATUS_LABELS[status]}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {document.updatedAt !== document.createdAt
                                  ? formatDate(document.updatedAt)
                                  : formatDate(document.createdAt)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Last update */}
                        {document.updatedAt !== document.createdAt && (
                          <div className="flex gap-2.5">
                            <div className="flex flex-col items-center">
                              <div className="h-2 w-2 rounded-full bg-slate-300 mt-1.5" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                Последнее изменение
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatDate(document.updatedAt)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        История появится после сохранения
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </aside>
        </div>
      </div>
    </div>
  );
}
