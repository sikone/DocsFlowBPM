'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { Document, DocumentType, FormField } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import DocumentComments from '@/components/documents/document-comments';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  Check,
  Link2,
  Share2,
  Lightbulb,
  PanelRight,
  FormInput,
  Info,
  MessageSquare,
} from 'lucide-react';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface ValidationErrors {
  [fieldId: string]: string;
}

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved';

interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
}

// ────────────────────────────────────────────
// Field Renderer
// ────────────────────────────────────────────
function FormFieldRenderer({
  field,
  value,
  onChange,
  error,
  touched,
}: {
  field: FormField;
  value: string | boolean;
  onChange: (id: string, value: string | boolean) => void;
  error?: string;
  touched: boolean;
}) {
  const strValue = typeof value === 'string' ? value : '';
  const boolValue = typeof value === 'boolean' ? value : false;
  const hasError = touched && error;
  const isEmptyRequired = field.required && !value && value !== false;

  const inputClassName = hasError
    ? 'border-rose-400 focus-visible:ring-rose-400/30 focus-visible:border-rose-400'
    : isEmptyRequired
      ? 'border-dashed border-muted-foreground/30'
      : '';

  // Non-interactive field types
  if (field.type === 'heading') {
    return (
      <div className="col-span-full pt-4 pb-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {field.label}
          <span className="block flex-1 h-px bg-border/50" />
        </h3>
      </div>
    );
  }

  if (field.type === 'separator') {
    return <div className="col-span-full py-2"><Separator /></div>;
  }

  // Checkbox & Switch — label on the right
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2.5 py-2 group">
        <Checkbox
          id={`field-${field.id}`}
          checked={boolValue}
          onCheckedChange={(checked) => onChange(field.id, !!checked)}
          className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 transition-all"
        />
        <Label
          htmlFor={`field-${field.id}`}
          className="text-sm font-normal cursor-pointer select-none group-hover:text-foreground/80 transition-colors"
        >
          {field.label}
          {field.required && <span className="text-rose-500 ml-0.5">*</span>}
        </Label>
      </div>
    );
  }

  if (field.type === 'switch') {
    return (
      <div className="flex items-center gap-2.5 py-2 group">
        <Switch
          id={`field-${field.id}`}
          checked={boolValue}
          onCheckedChange={(checked) => onChange(field.id, !!checked)}
          className="data-[state=checked]:bg-emerald-600 transition-all"
        />
        <Label
          htmlFor={`field-${field.id}`}
          className="text-sm font-normal cursor-pointer select-none group-hover:text-foreground/80 transition-colors"
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
        <>
          <Textarea
            id={`field-${field.id}`}
            value={strValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={`resize-none min-h-[80px] transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${inputClassName}`}
          />
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </>
      )}

      {field.type === 'select' && (
        <>
          <Select
            value={strValue}
            onValueChange={(v) => onChange(field.id, v)}
          >
            <SelectTrigger className={`w-full transition-all duration-200 focus:ring-emerald-600/20 focus:border-emerald-600/50 ${inputClassName}`}>
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
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </>
      )}

      {field.type === 'money' && (
        <>
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
              className={`pl-7 transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${inputClassName}`}
            />
          </div>
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </>
      )}

      {field.type === 'number' && (
        <>
          <Input
            id={`field-${field.id}`}
            type="number"
            value={strValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={`transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${inputClassName}`}
          />
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </>
      )}

      {field.type === 'date' && (
        <>
          <Input
            id={`field-${field.id}`}
            type="date"
            value={strValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            className={`w-full transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${inputClassName}`}
          />
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </>
      )}

      {field.type === 'email' && (
        <>
          <Input
            id={`field-${field.id}`}
            type="email"
            value={strValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || 'email@example.com'}
            className={`transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${inputClassName}`}
          />
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </>
      )}

      {field.type === 'phone' && (
        <>
          <Input
            id={`field-${field.id}`}
            type="tel"
            value={strValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || '+7 (___) ___-__-__'}
            className={`transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${inputClassName}`}
          />
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </>
      )}

      {field.type === 'text' && (
        <>
          <Input
            id={`field-${field.id}`}
            type="text"
            value={strValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={`transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${inputClassName}`}
          />
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </>
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
  validationErrors,
  touchedFields,
}: {
  fields: FormField[];
  formData: Record<string, string | boolean>;
  onChange: (id: string, value: string | boolean) => void;
  validationErrors: ValidationErrors;
  touchedFields: Set<string>;
}) {
  const maxCol = Math.max(...fields.map((f) => f.column), 1);
  const colClass =
    maxCol >= 3 ? 'grid-cols-1 sm:grid-cols-3' : maxCol === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1';

  const isFullWidth = (f: FormField) => f.type === 'heading' || f.type === 'separator';
  const hasColumns = fields.some((f) => f.column > 0);

  if (!hasColumns) {
    return (
      <div className={`grid ${colClass} gap-x-4 gap-y-1`}>
        {fields.map((field) => (
          <FormFieldRenderer
            key={field.id}
            field={field}
            value={formData[field.id] ?? (field.defaultValue || '')}
            onChange={onChange}
            error={validationErrors[field.id]}
            touched={touchedFields.has(field.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${colClass} gap-x-4 gap-y-1`}>
      {fields
        .sort((a, b) => a.column - b.column)
        .map((field) => (
          <div key={field.id} className={isFullWidth(field) ? `col-span-full` : ''}>
            <FormFieldRenderer
              field={field}
              value={formData[field.id] ?? (field.defaultValue || '')}
              onChange={onChange}
              error={validationErrors[field.id]}
              touched={touchedFields.has(field.id)}
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
          className={`gap-1.5 text-xs font-medium ${STATUS_COLORS[currentStatus] || ''} border hover:opacity-90 transition-all duration-200 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
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

function getActionIcon(action: string) {
  const map: Record<string, string> = {
    CREATE_DOCUMENT: 'bg-emerald-500',
    EDIT_DOCUMENT: 'bg-sky-500',
    CHANGE_STATUS: 'bg-amber-500',
    DELETE_DOCUMENT: 'bg-rose-500',
  };
  return map[action] || 'bg-slate-400';
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE_DOCUMENT: 'Документ создан',
    EDIT_DOCUMENT: 'Документ изменён',
    CHANGE_STATUS: 'Статус изменён',
    DELETE_DOCUMENT: 'Документ удалён',
  };
  return map[action] || action;
}

// ────────────────────────────────────────────
// Auto-Save Status Indicator
// ────────────────────────────────────────────
function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  switch (status) {
    case 'saving':
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Сохранение...
        </span>
      );
    case 'saved':
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" />
          Сохранено
        </span>
      );
    case 'unsaved':
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Не сохранено
        </span>
      );
    default:
      return null;
  }
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
  const [loadingLocal, setLoadingLocal] = useState(true);

  // ── Comment count ──
  const [commentCount, setCommentCount] = useState(0);

  // ── Validation state ──
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // ── Auto-save state ──
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dirty tracking ──
  const initialDataRef = useRef<{ title: string; formData: Record<string, string | boolean>; status: string } | null>(null);

  // ── Unsaved changes dialog ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingActionRef = useRef<'discard' | 'save-and-leave' | null>(null);

  // ── Activity log ──
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // ── Mobile sidebar toggle ──
  const [mobileShowProperties, setMobileShowProperties] = useState(false);
  const [mobileTab, setMobileTab] = useState('form');

  // ── Form scroll ref for shadows ──
  const formScrollRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

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
        let fields: FormField[] = [];
        try {
          fields = JSON.parse(type.formSchema);
        } catch { /* empty schema */ }
        setFormFields(fields);

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
        initialDataRef.current = { title: `${type.name} — новый`, formData: { ...defaults }, status: 'DRAFT' };
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

        if (doc.type) {
          setDocType(doc.type);
          let fields: FormField[] = [];
          try {
            fields = JSON.parse(doc.type.formSchema);
          } catch { /* empty schema */ }
          setFormFields(fields);

          let dataObj: Record<string, string | boolean> = {};
          try {
            dataObj = JSON.parse(doc.data);
          } catch { /* empty data */ }

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
          // Enable auto-save for existing docs
          setAutoSaveEnabled(true);
          initialDataRef.current = { title: doc.title, formData: { ...dataObj }, status: doc.status };

          // Fetch activity logs
          loadActivityLogs(docId, token);
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
  }, [view.page, token]);

  // ── Load activity logs ──
  const loadActivityLogs = useCallback(async (docId: string, t: string) => {
    setLogsLoading(true);
    try {
      const res = await apiFetch<{ logs: ActivityLogEntry[]; total: number }>(
        `/api/activity-log?entityType=DOCUMENT&entityId=${docId}&limit=20`,
        t
      );
      setActivityLogs(res.logs || []);
    } catch {
      // Silent fail for activity logs
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // ── Dirty state check ──
  const isDirty = useMemo(() => {
    if (!initialDataRef.current) return false;
    const init = initialDataRef.current;
    if (init.title !== title) return true;
    if (init.status !== status) return true;
    // Compare form data
    const allKeys = new Set([...Object.keys(init.formData), ...Object.keys(formData)]);
    for (const key of allKeys) {
      if (JSON.stringify(init.formData[key]) !== JSON.stringify(formData[key])) {
        return true;
      }
    }
    return false;
  }, [title, status, formData]);

  // ── Auto-save with debounce ──
  useEffect(() => {
    if (!autoSaveEnabled || !document || !token || !isDirty || saving) return;

    // Clear previous timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setAutoSaveStatus('unsaved');

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await apiFetch(`/api/documents/${document.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({
            title,
            data: JSON.stringify(formData),
          }),
        });
        setAutoSaveStatus('saved');
        // Update initial data to new state
        initialDataRef.current = { title, formData: { ...formData }, status };
        // Update document object for the sidebar
        setDocument((prev) => prev ? { ...prev, title, data: JSON.stringify(formData) } : prev);

        // Reload activity logs
        loadActivityLogs(document.id, token);

        // Reset saved status after 3 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch {
        setAutoSaveStatus('unsaved');
        toast.error('Ошибка автосохранения');
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, formData, autoSaveEnabled, document, token, isDirty, saving, status]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCmd = e.metaKey || e.ctrlKey;

      if (isCmd && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (isCmd && e.key === 'Enter') {
        e.preventDefault();
        handleSaveAndSend();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleBackWithCheck();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAndSend, handleBackWithCheck]);

  // ── Scroll shadow detection ──
  useEffect(() => {
    const el = formScrollRef.current;
    if (!el) return;

    function handleScroll() {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowTopShadow(scrollTop > 8);
      setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 8);
    }

    el.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial state
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loadingLocal]);

  // ── Group fields by row ──
  const fieldsByRow = useMemo(() => {
    const rows = new Map<number, FormField[]>();
    formFields.forEach((field) => {
      const r = field.row || 0;
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r)!.push(field);
    });
    return Array.from(rows.entries())
      .sort(([a], [b]) => a - b)
      .map(([, fields]) => fields);
  }, [formFields]);

  // ── Validate required fields ──
  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};
    const touched = new Set(touchedFields);

    // Always mark title as checked
    if (!title.trim()) {
      errors['__title'] = 'Название обязательно';
      touched.add('__title');
    }

    formFields.forEach((field) => {
      if (field.required && (field.type === 'heading' || field.type === 'separator')) return;
      if (field.required) {
        const val = formData[field.id];
        if (val === undefined || val === '' || val === null) {
          errors[field.id] = 'Обязательное поле';
          touched.add(field.id);
        }
      }
    });

    setValidationErrors(errors);
    setTouchedFields(touched);
    return Object.keys(errors).length === 0;
  }, [formFields, formData, title, touchedFields]);

  // ── Handlers ──
  const handleFieldChange = useCallback((id: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    setTouchedFields((prev) => new Set(prev).add(id));
    // Clear error for this field on change
    setValidationErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    setTouchedFields((prev) => new Set(prev).add('__title'));
    setValidationErrors((prev) => {
      if (!prev['__title']) return prev;
      const next = { ...prev };
      delete next['__title'];
      return next;
    });
  }, []);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      if (newStatus === status) return;
      setStatus(newStatus);
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
          initialDataRef.current = { title, formData: { ...formData }, status: newStatus };
          loadActivityLogs(document.id, token);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Ошибка смены статуса');
          setStatus(status);
        } finally {
          setSaving(false);
        }
      }
    },
    [status, isNewDoc, document, token, title, formData, loadActivityLogs]
  );

  const handleSave = useCallback(async () => {
    if (!token) return;
    if (!validateForm()) {
      toast.error('Заполните обязательные поля');
      return;
    }
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
        setAutoSaveEnabled(true);
        initialDataRef.current = { title, formData: { ...formData }, status: 'DRAFT' };
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
        setAutoSaveStatus('saved');
        initialDataRef.current = { title, formData: { ...formData }, status };
        loadActivityLogs(document.id, token);
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [token, isNewDoc, view, title, formData, document, navigate, validateForm, status, loadActivityLogs]);

  const handleSaveAndSend = useCallback(async () => {
    if (!token) return;
    if (!validateForm()) {
      toast.error('Заполните обязательные поля');
      return;
    }
    setSaving(true);
    try {
      const targetStatus = status === 'DRAFT' ? 'IN_PROGRESS' : 'IN_PROGRESS';
      if (isNewDoc) {
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
        initialDataRef.current = { title, formData: { ...formData }, status: targetStatus };
        toast.success('Документ отправлен');
        loadActivityLogs(document.id, token);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }, [token, isNewDoc, view, title, formData, document, navigate, validateForm, status, loadActivityLogs]);

  const handleStatusAction = useCallback(
    async (targetStatus: string) => {
      if (!token) return;
      if (!validateForm()) {
        toast.error('Заполните обязательные поля');
        return;
      }
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
          initialDataRef.current = { title, formData: { ...formData }, status: targetStatus };
          toast.success(
            targetStatus === 'IN_PROGRESS'
              ? 'Документ отправлен'
              : targetStatus === 'APPROVED'
                ? 'Документ утверждён'
                : targetStatus === 'REJECTED'
                  ? 'Документ отклонён'
                  : 'Статус обновлён'
          );
          loadActivityLogs(document.id, token);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка');
      } finally {
        setSaving(false);
      }
    },
    [token, isNewDoc, view, title, formData, document, navigate, validateForm, loadActivityLogs]
  );

  // ── Back with dirty check ──
  const handleBackWithCheck = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      goBack();
    }
  }, [isDirty, goBack]);

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedDialog(false);
    goBack();
  }, [goBack]);

  const handleSaveAndLeave = useCallback(async () => {
    setShowUnsavedDialog(false);
    await handleSave();
    if (!isNewDoc || document) {
      goBack();
    }
  }, [handleSave, goBack, isNewDoc, document]);

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

  // ── Count required fields ──
  const requiredFields = formFields.filter(f => f.required && f.type !== 'heading' && f.type !== 'separator');
  const filledRequired = requiredFields.filter(f => {
    const val = formData[f.id];
    return val !== undefined && val !== '' && val !== null;
  });

  // ── Properties Sidebar Content ──
  const propertiesContent = (
    <div className="p-4 lg:p-5 space-y-4">
      {/* Document Type Card / Thumbnail */}
      <Card className="overflow-hidden">
        <div
          className="h-20 flex items-center justify-center relative"
          style={{ backgroundColor: `${docType.color}15` }}
        >
          <span className="text-4xl">{docType.icon}</span>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/20" />
        </div>
        <CardContent className="p-4 -mt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">{docType.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isNewDoc ? 'Новый документ' : `№ ${document?.number || '—'}`}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-xs shrink-0 ${STATUS_COLORS[status] || ''}`}
            >
              {STATUS_LABELS[status] || status}
            </Badge>
          </div>
        </CardContent>
      </Card>

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

          {/* Folder */}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Папка
            </span>
            <span className="text-sm font-medium truncate max-w-[140px]">{getFolderName()}</span>
          </div>

          {/* Creator */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Автор
            </span>
            <span className="text-sm font-medium truncate max-w-[140px]">
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

          <Separator />

          {/* Comments count */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Комментарии
            </span>
            <Badge variant="secondary" className="text-xs font-medium">
              {!isNewDoc ? commentCount : '—'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Document Links Card (placeholder) */}
      <Card className="py-4">
        <CardHeader className="pb-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Связанные документы
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex flex-col items-center py-3 text-center">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center mb-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Связанные документы появятся здесь</p>
            <Button variant="ghost" size="sm" className="mt-2 text-xs h-7 gap-1 text-muted-foreground">
              <Link2 className="h-3 w-3" />
              Привязать документ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sharing Card (placeholder) */}
      <Card className="py-4">
        <CardHeader className="pb-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Доступ и обмен
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9">
            <Share2 className="h-3.5 w-3.5" />
            Поделиться ссылкой
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9">
            <User className="h-3.5 w-3.5" />
            Управление доступом
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9">
            <FileText className="h-3.5 w-3.5" />
            Экспорт в PDF
          </Button>
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
          {logsLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2.5 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/20 mt-1.5" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-muted-foreground/10 rounded w-24" />
                    <div className="h-2.5 bg-muted-foreground/10 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : activityLogs.length > 0 ? (
            <div className="space-y-0">
              {activityLogs.map((log, i) => (
                <div key={log.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${getActionIcon(log.action)}`} />
                    {i < activityLogs.length - 1 && (
                      <div className="w-px flex-1 bg-border min-h-[20px]" />
                    )}
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-xs font-medium truncate">{getActionLabel(log.action)}</p>
                    {log.details && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{log.details}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      {log.user?.name}
                      <span>·</span>
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : document ? (
            <div className="space-y-0">
              {/* Fallback: derived from document data */}
              <div className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="w-px flex-1 bg-border" />
                </div>
                <div className="pb-3">
                  <p className="text-xs font-medium">Документ создан</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(document.createdAt)}
                  </p>
                </div>
              </div>

              {status !== 'DRAFT' && (
                <div className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${getStatusDotColor(status)}`} />
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

              {document.updatedAt !== document.createdAt && (
                <div className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
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
  );

  return (
    <div className="flex flex-col h-full">
      {/* ═══ Unsaved Changes Dialog ═══ */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              У вас есть несохранённые изменения. Вы хотите сохранить их перед выходом или отказаться от изменений?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardChanges}>
              Отменить изменения
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndLeave} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 mr-1.5" />
              Сохранить и выйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Top Header Bar ═══ */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b px-3 lg:px-6 py-2.5">
        <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
          {/* Back button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackWithCheck}
                className="shrink-0 h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Назад (Esc)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-0.5 hidden sm:block" />

          {/* Title (editable) */}
          <div className="flex-1 min-w-0 max-w-sm">
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className={`h-8 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent font-semibold transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${touchedFields.has('__title') && validationErrors['__title'] ? 'border-rose-400' : ''}`}
            />
            {touchedFields.has('__title') && validationErrors['__title'] && (
              <p className="text-[10px] text-rose-500 mt-0.5">{validationErrors['__title']}</p>
            )}
          </div>

          {/* Document number badge */}
          {document?.number && (
            <Badge variant="outline" className="text-xs font-mono shrink-0 hidden sm:flex">
              {document.number}
            </Badge>
          )}

          {/* Comment count indicator */}
          {document && commentCount > 0 && (
            <Badge variant="secondary" className="text-xs gap-1 shrink-0">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </Badge>
          )}

          {/* Status dropdown */}
          <StatusDropdown
            currentStatus={status}
            onStatusChange={handleStatusChange}
            disabled={isNewDoc}
          />

          {/* Auto-save indicator */}
          <div className="hidden sm:flex items-center">
            <AutoSaveIndicator status={autoSaveStatus} />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 lg:gap-2">
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
                <span className="hidden sm:inline">Отправить</span>
              </Button>
            )}

            {status === 'IN_PROGRESS' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusAction('APPROVED')}
                  disabled={saving}
                  className="gap-1.5 text-xs border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hidden sm:flex"
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
                  className="gap-1.5 text-xs border-rose-300 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hidden sm:flex"
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

            <Separator orientation="vertical" className="h-6 mx-0.5 hidden sm:block" />

            <Tooltip>
              <TooltipTrigger asChild>
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
                  <span className="hidden sm:inline">Сохранить</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ctrl+S</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full">
          {/* ── LEFT PANEL: Dynamic Form (2/3) ── */}
          <div className="flex-1 lg:w-2/3 flex flex-col overflow-hidden">
            {/* Mobile tab toggle */}
            <div className="lg:hidden flex border-b px-2 pt-1">
              <button
                onClick={() => setMobileTab('form')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  mobileTab === 'form'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                <FormInput className="h-3.5 w-3.5" />
                Форма
                {requiredFields.length > 0 && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 h-4 ml-1 ${
                      filledRequired.length === requiredFields.length
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    }`}
                  >
                    {filledRequired.length}/{requiredFields.length}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => setMobileTab('properties')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  mobileTab === 'properties'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                <PanelRight className="h-3.5 w-3.5" />
                Свойства
              </button>
            </div>

            {/* Form content */}
            <div
              ref={formScrollRef}
              className={`flex-1 overflow-y-auto relative ${mobileTab !== 'form' ? 'hidden lg:block' : ''}`}
            >
              {/* Scroll shadow top */}
              {showTopShadow && (
                <div className="sticky top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent pointer-events-none" />
              )}

              <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
                {/* Form type header */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center h-10 w-10 rounded-lg text-lg shrink-0"
                    style={{ backgroundColor: `${docType.color}20` }}
                  >
                    {docType.icon}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">
                      {isNewDoc ? 'Новый документ' : 'Редактирование'}
                    </h2>
                    <p className="text-xs text-muted-foreground">{docType.name}</p>
                  </div>
                  {requiredFields.length > 0 && (
                    <Badge
                      variant="secondary"
                      className={`ml-auto text-xs shrink-0 hidden sm:flex ${
                        filledRequired.length === requiredFields.length
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      }`}
                    >
                      {filledRequired.length === requiredFields.length ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <Info className="h-3 w-3 mr-1" />
                      )}
                      {filledRequired.length}/{requiredFields.length} обязательных
                    </Badge>
                  )}
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
                        validationErrors={validationErrors}
                        touchedFields={touchedFields}
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center text-muted-foreground space-y-4">
                        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                          <FileText className="h-8 w-8 opacity-40" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Форма не содержит полей</p>
                          <p className="text-xs mt-1">
                            Настройте поля в панели администратора
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Comments Section (only for existing documents) */}
                {!isNewDoc && document && (
                  <DocumentComments
                    documentId={document.id}
                    onCommentCountChange={setCommentCount}
                  />
                )}

                {/* Tips section */}
                {formFields.length > 0 && (
                  <Card className="bg-muted/50 border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0 mt-0.5">
                          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <p className="text-xs font-medium">Подсказки</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>• Поля с <span className="text-rose-500">*</span> — обязательны для заполнения</p>
                            <p>• <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">Ctrl+S</kbd> — сохранить документ</p>
                            <p>• <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">Ctrl+Enter</kbd> — сохранить и отправить</p>
                            <p>• <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">Esc</kbd> — вернуться назад</p>
                            {autoSaveEnabled && (
                              <p>• Автосохранение включено (каждые 3 сек. после изменений)</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Scroll shadow bottom */}
              {showBottomShadow && (
                <div className="sticky bottom-0 z-10 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              )}
            </div>

            {/* Mobile sticky save bar */}
            <div className="lg:hidden sticky bottom-0 bg-background border-t p-3 flex items-center gap-2 safe-area-bottom">
              <div className="flex-1">
                <AutoSaveIndicator status={autoSaveStatus} />
              </div>
              {status === 'DRAFT' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusAction('IN_PROGRESS')}
                  disabled={saving}
                  className="gap-1.5 text-xs h-10"
                >
                  <Send className="h-3.5 w-3.5" />
                  Отправить
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 h-10 px-5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Сохранить
              </Button>
            </div>

            {/* Mobile properties panel */}
            <div
              className={`flex-1 overflow-y-auto lg:hidden ${mobileTab !== 'properties' ? 'hidden' : ''}`}
            >
              {propertiesContent}
            </div>
          </div>

          {/* ── RIGHT PANEL: Properties Sidebar (1/3) — Desktop only ── */}
          <aside className="hidden lg:block w-1/3 border-l bg-muted/30 overflow-y-auto">
            <ScrollArea className="h-full">
              {propertiesContent}
            </ScrollArea>
          </aside>
        </div>
      </div>
    </div>
  );
}
