'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { Document, DocumentType, FormField, DocumentTag } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types';
import { URGENCY_LABELS, URGENCY_COLORS, URGENCY_DOT_COLORS, type UrgencyLevel } from '@/lib/sla';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import DocumentComments from '@/components/documents/document-comments';
import { DocumentAttachments } from '@/components/documents/document-attachments';
import { DocumentPermissionsDialog } from '@/components/documents/document-permissions-dialog';
import { DocumentApprovalPanel } from '@/components/documents/document-approval-panel';

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { evaluateFormula, formatFormulaResult, type FormulaResult } from '@/lib/formula-evaluator';
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
  ChevronsUpDown,
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
  Printer,
  Download,
  Tag,
  Calculator,
  Upload,
  Image,
  File,
  X,
  Pencil,
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
// Directory Select Field
// ────────────────────────────────────────────
interface DirectoryOption {
  value: string;
  label: string;
  sub?: string;
}

const DIRECTORY_APIS: Record<string, string> = {
  counterparties: '/api/counterparties',
  contacts: '/api/contacts',
};

function mapDirectoryData(source: string, data: Record<string, unknown[]>): DirectoryOption[] {
  if (source === 'counterparties') {
    const items = (data.counterparties ?? []) as Array<{ id: string; name: string; shortName?: string | null; inn: string }>;
    return items.map((c) => ({ value: c.id, label: c.shortName || c.name, sub: `ИНН ${c.inn}` }));
  }
  if (source === 'contacts') {
    const items = (data.contacts ?? []) as Array<{ id: string; name: string; phone?: string | null; email?: string | null }>;
    return items.map((c) => ({ value: c.id, label: c.name, sub: c.phone || c.email || undefined }));
  }
  return [];
}

function DirectorySelectField({
  field,
  directorySource,
  value,
  onChange,
  error,
  touched,
  showLabel = true,
}: {
  field: FormField;
  directorySource: string;
  value: string;
  onChange: (id: string, value: string) => void;
  error?: string;
  touched: boolean;
  showLabel?: boolean;
}) {
  const { token } = useStore();
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const hasError = touched && error;

  useEffect(() => {
    const apiPath = DIRECTORY_APIS[directorySource];
    if (!token || !apiPath) return;
    setLoading(true);
    fetch(`${apiPath}?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setOptions(mapDirectoryData(directorySource, d as Record<string, unknown[]>)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, directorySource]);

  const selected = options.find((o) => o.value === value);

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          (o.sub && o.sub.toLowerCase().includes(search.toLowerCase())),
      )
    : options;

  const triggerClass = [
    'w-full flex items-center justify-between h-9 px-3 rounded-md border text-sm transition-all duration-200',
    'bg-background hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600/50',
    hasError
      ? 'border-rose-400'
      : !value && field.required
        ? 'border-dashed border-muted-foreground/30'
        : 'border-input',
  ].join(' ');

  return (
    <div className="space-y-1.5">
      {showLabel && (
        <Label className="text-sm">
          {field.label}
          {field.required && <span className="text-rose-500 ml-0.5">*</span>}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={triggerClass} aria-expanded={open}>
            {loading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Загрузка...
              </span>
            ) : selected ? (
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{selected.label}</span>
                {selected.sub && (
                  <span className="text-muted-foreground text-xs shrink-0">{selected.sub}</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {field.placeholder || 'Выберите значение'}
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[260px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {filtered.length === 0 ? (
                <CommandEmpty>Ничего не найдено</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filtered.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => {
                        onChange(field.id, opt.value);
                        setSearch('');
                        setOpen(false);
                      }}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{opt.label}</span>
                        {opt.sub && (
                          <span className="text-xs text-muted-foreground truncate">{opt.sub}</span>
                        )}
                      </span>
                      {value === opt.value && (
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {hasError && (
        <p className="text-xs text-rose-500 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
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
  formulaError,
  computedHint,
}: {
  field: FormField;
  value: string | boolean;
  onChange: (id: string, value: string | boolean) => void;
  error?: string;
  touched: boolean;
  formulaError?: string | null;
  computedHint?: string;
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
          <span className="w-1 h-4 rounded-full bg-emerald-500" />
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
      <div className="space-y-2">
        <Label className="text-sm invisible select-none">_</Label>
        <div className="flex items-center gap-2.5 py-1 group">
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
      </div>
    );
  }

  if (field.type === 'switch') {
    return (
      <div className="space-y-2">
        <Label className="text-sm invisible select-none">_</Label>
        <div className="flex items-center gap-2.5 py-1 group">
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
      </div>
    );
  }

  if (field.type === 'computed') {
    const isEditable = field.readonly === false;
    const hasFormulaError = !!formulaError;
    const isEmpty = !strValue;

    if (isEditable) {
      // Editable: regular input, show computed suggestion below
      return (
        <div className="space-y-1.5">
          <Label htmlFor={`field-${field.id}`} className="text-sm flex items-center gap-1.5">
            {field.label}
            {field.required && <span className="text-rose-500 ml-0.5">*</span>}
            <span className="inline-flex items-center gap-0.5 text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              <Calculator className="w-2.5 h-2.5" />
              ред.
            </span>
          </Label>
          <div className="relative">
            {field.prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                {field.prefix}
              </span>
            )}
            <Input
              id={`field-${field.id}`}
              type="text"
              value={strValue}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={computedHint || ''}
              className={`transition-all duration-200 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600/50 ${field.prefix ? 'pl-7' : ''} ${hasError ? inputClassName : ''}`}
            />
          </div>
          {computedHint && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calculator className="w-3 h-3" />
              Расчётное: {computedHint}
            </p>
          )}
          {hasError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>
      );
    }

    // Readonly (default): display-only
    return (
      <div className="space-y-1.5">
        <Label className="text-sm flex items-center gap-1.5">
          {field.label}
          <span className="inline-flex items-center gap-0.5 text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            <Calculator className="w-2.5 h-2.5" />
            авто
          </span>
        </Label>
        <div className={`flex items-center h-9 px-3 rounded-md border text-sm select-none ${
          hasFormulaError
            ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/20'
            : 'bg-muted/40'
        }`}>
          {!hasFormulaError && field.prefix && (
            <span className="text-muted-foreground mr-1.5 shrink-0">{field.prefix}</span>
          )}
          {hasFormulaError ? (
            <span className="text-rose-500 text-xs flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              Ошибка: {formulaError}
            </span>
          ) : (
            <span className={`tabular-nums font-medium ${isEmpty ? 'text-muted-foreground' : 'text-foreground/80'}`}>
              {strValue || '—'}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (field.type === 'counterparty' || (field.type === 'select' && field.source === 'directory')) {
    return (
      <DirectorySelectField
        field={field}
        directorySource={field.directorySource || 'counterparties'}
        value={strValue}
        onChange={onChange}
        error={error}
        touched={touched}
      />
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
  formulaErrors,
  computedValues,
}: {
  fields: FormField[];
  formData: Record<string, string | boolean>;
  onChange: (id: string, value: string | boolean) => void;
  validationErrors: ValidationErrors;
  touchedFields: Set<string>;
  formulaErrors?: Record<string, string>;
  computedValues?: Record<string, string>;
}) {
  const getColSpan = (f: FormField): string => {
    if (f.type === 'heading' || f.type === 'separator') return 'col-span-6';
    if (f.width === 'third') return 'col-span-6 sm:col-span-2';
    if (f.width === 'half') return 'col-span-6 sm:col-span-3';
    return 'col-span-6';
  };

  return (
    <div className="grid grid-cols-6 gap-x-4 gap-y-1">
      {[...fields]
        .sort((a, b) => a.row - b.row || a.column - b.column)
        .map((field) => (
          <div key={field.id} className={getColSpan(field)}>
            <FormFieldRenderer
              field={field}
              value={formData[field.id] ?? (field.defaultValue || '')}
              onChange={onChange}
              error={validationErrors[field.id]}
              touched={touchedFields.has(field.id)}
              formulaError={formulaErrors?.[field.id]}
              computedHint={computedValues?.[field.id]}
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
          className={`gap-1.5 text-xs font-medium border hover:opacity-90 transition-all duration-200 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          disabled={disabled}
        >
          <span className={`h-2 w-2 rounded-full ${getStatusDotColor(currentStatus)}`} />
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
    APPROVAL_STARTED: 'bg-violet-500',
    APPROVAL_STEP_APPROVED: 'bg-emerald-500',
    APPROVAL_STEP_APPROVED_WITH_CHANGES: 'bg-amber-500',
    APPROVAL_STEP_REJECTED: 'bg-rose-500',
    APPROVAL_COMPLETED: 'bg-emerald-600',
  };
  return map[action] || 'bg-slate-400';
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE_DOCUMENT: 'Документ создан',
    EDIT_DOCUMENT: 'Документ изменён',
    CHANGE_STATUS: 'Статус изменён',
    DELETE_DOCUMENT: 'Документ удалён',
    APPROVAL_STARTED: 'Отправлен на согласование',
    APPROVAL_STEP_APPROVED: 'Шаг согласован',
    APPROVAL_STEP_APPROVED_WITH_CHANGES: 'Шаг согласован с изменениями',
    APPROVAL_STEP_REJECTED: 'Шаг отклонён',
    APPROVAL_COMPLETED: 'Согласование завершено',
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
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-saved-pulse" />
          Сохранено
        </span>
      );
    case 'unsaved':
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Не сохранено
        </span>
      );
    default:
      return null;
  }
}

// ────────────────────────────────────────────
// Pending Attachments (before document is saved)
// ────────────────────────────────────────────
function PendingAttachments({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    Array.from(incoming).forEach((f) => {
      if (!next.some((e) => e.name === f.name && e.size === f.size)) next.push(f);
    });
    onChange(next);
  };

  const remove = (index: number) => onChange(files.filter((_, i) => i !== index));

  const getFileIcon = (f: File) => {
    if (f.type.startsWith('image/')) return <Image className="w-4 h-4 text-sky-500" />;
    if (f.type.includes('pdf')) return <FileText className="w-4 h-4 text-rose-500" />;
    return <File className="w-4 h-4 text-slate-400" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
          dragOver
            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
            : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
        <div className="flex flex-col items-center gap-1 text-center">
          <Upload className="w-5 h-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">Перетащите файл или нажмите</p>
          <p className="text-[10px] text-muted-foreground/60">Файлы загрузятся после сохранения</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}`}
              className="flex items-center gap-2 p-2 rounded-md border bg-muted/20 group"
            >
              {getFileIcon(f)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [urgency, setUrgency] = useState<string>('');
  const isLocked = status === 'COMPLETED';
  const [saving, setSaving] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(true);

  // ── Pending attachments (before document is saved) ──
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // ── Comment count ──
  const [commentCount, setCommentCount] = useState(0);

  // ── Right panel dialogs ──
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  // ── Pending approval step for current user ──
  const [userPendingStep, setUserPendingStep] = useState<{ approvalId: string; stepId: string; stepName: string } | null>(null);
  const [sendApproval, setSendApproval] = useState<(() => void) | null>(null);
  const handleSendReady = useCallback((fn: (() => void) | null) => {
    setSendApproval(fn ? () => fn : null);
  }, []);
  const [headerDecideOpen, setHeaderDecideOpen] = useState(false);
  const [headerDecideDecision, setHeaderDecideDecision] = useState<'APPROVED' | 'APPROVED_WITH_CHANGES' | 'REJECTED'>('APPROVED');
  const [headerDecideComment, setHeaderDecideComment] = useState('');
  const [headerDeciding, setHeaderDeciding] = useState(false);

  // ── Validation state ──
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // ── Auto-save state ──
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [savedVersion, setSavedVersion] = useState(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dirty tracking ──
  const initialDataRef = useRef<{ title: string; formData: Record<string, string | boolean>; status: string; urgency: string } | null>(null);

  // ── Unsaved changes dialog ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingActionRef = useRef<'discard' | 'save-and-leave' | null>(null);

  // ── Activity log ──
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // ── Mobile sidebar toggle ──
  const [mobileShowProperties, setMobileShowProperties] = useState(false);
  const [mobileTab, setMobileTab] = useState('form');

  // ── Tags picker state ──
  const [allTags, setAllTags] = useState<DocumentTag[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<Set<string>>(new Set());
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsSyncing, setTagsSyncing] = useState<string | null>(null);

  // ── Form scroll ref for shadows ──
  const formScrollRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  // ── Load all available tags ──
  useEffect(() => {
    if (!token) return;
    async function fetchTags() {
      try {
        const res = await apiFetch<(DocumentTag & { _count?: { documents: number } })[]>('/api/tags', token);
        setAllTags(res || []);
      } catch {
        // Tags are non-critical
      }
    }
    fetchTags();
  }, [token]);

  // ── Sync assigned tags from document ──
  useEffect(() => {
    if (document?.tagLinks) {
      setAssignedTagIds(new Set(document.tagLinks.map((link) => link.tag.id)));
    } else {
      setAssignedTagIds(new Set());
    }
  }, [document?.tagLinks]);

  // ── Toggle tag assignment ──
  const handleToggleTag = useCallback(async (tag: DocumentTag) => {
    if (!document || !token) return;
    const isAssigned = assignedTagIds.has(tag.id);

    // Optimistic update
    setAssignedTagIds((prev) => {
      const next = new Set(prev);
      if (isAssigned) {
        next.delete(tag.id);
      } else {
        next.add(tag.id);
      }
      return next;
    });
    setTagsSyncing(tag.id);

    try {
      if (isAssigned) {
        await apiFetch(`/api/documents/${document.id}/tags/${tag.id}`, token, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/documents/${document.id}/tags`, token, {
          method: 'POST',
          body: JSON.stringify({ tagId: tag.id }),
        });
      }
      // Update document object to stay in sync
      setDocument((prev) => {
        if (!prev) return prev;
        const links = prev.tagLinks || [];
        if (isAssigned) {
          return { ...prev, tagLinks: links.filter((l) => l.tag.id !== tag.id) };
        } else {
          return { ...prev, tagLinks: [...links, { id: `${prev.id}-${tag.id}`, tagId: tag.id, tag }] };
        }
      });
    } catch {
      // Revert on error
      setAssignedTagIds((prev) => {
        const next = new Set(prev);
        if (isAssigned) {
          next.add(tag.id);
        } else {
          next.delete(tag.id);
        }
        return next;
      });
      toast.error('Ошибка обновления тега');
    } finally {
      setTagsSyncing(null);
    }
  }, [document, token, assignedTagIds]);

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
        const preTitle = (view as { title?: string }).title;
        const templateData = (view as { templateData?: string }).templateData;
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

        // Merge template data on top of defaults
        if (templateData) {
          try {
            const parsed = JSON.parse(templateData);
            if (typeof parsed === 'object' && parsed !== null) {
              Object.entries(parsed).forEach(([key, value]) => {
                if (key in defaults) {
                  defaults[key] = value as string | boolean;
                }
              });
            }
          } catch { /* invalid template data, ignore */ }
        }

        setFormData(defaults);
        const initialTitle = preTitle || `${type.name} — новый`;
        setTitle(initialTitle);
        initialDataRef.current = { title: initialTitle, formData: { ...defaults }, status: 'DRAFT', urgency: '' };
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
        setUrgency(doc.urgency ?? 'MEDIUM');

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
          initialDataRef.current = { title: doc.title, formData: { ...dataObj }, status: doc.status, urgency: doc.urgency ?? 'MEDIUM' };

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
    if (init.urgency !== urgency) return true;
    // Compare form data
    const allKeys = new Set([...Object.keys(init.formData), ...Object.keys(formData)]);
    for (const key of allKeys) {
      if (JSON.stringify(init.formData[key]) !== JSON.stringify(formData[key])) {
        return true;
      }
    }
    return false;
  }, [title, status, formData, savedVersion]);

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
            urgency,
            data: JSON.stringify(allFormData),
          }),
        });
        setAutoSaveStatus('saved');
        // Update initial data to new state
        initialDataRef.current = { title, formData: { ...formData }, status, urgency };
        setSavedVersion((v) => v + 1);
        // Update document object for the sidebar
        setDocument((prev) => prev ? { ...prev, title, data: JSON.stringify(allFormData) } : prev);

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

  // ── Computed field values (derived from formData) ──
  const { computedValues, formulaErrors } = useMemo(() => {
    // Build lookup table with BOTH field IDs and systemNames as keys
    // so {summa} and {field_123_abc} both work in formulas
    const enriched: Record<string, unknown> = {};
    formFields.forEach((f) => {
      const raw = formData[f.id];
      // Normalize string numbers: remove spaces, replace comma → dot
      const norm =
        typeof raw === 'string' && raw.trim() !== ''
          ? raw.replace(/\s/g, '').replace(',', '.')
          : raw;
      // Register by field ID
      enriched[f.id] = norm ?? raw;
      // Also register by systemName (e.g. "summa")
      if (f.systemName) enriched[f.systemName] = norm ?? raw;
    });

    const values: Record<string, string> = {};
    const errors: Record<string, string> = {};

    formFields.forEach((field) => {
      if (field.type !== 'computed' || !field.formula) return;
      const result: FormulaResult = evaluateFormula(field.formula, enriched);
      if (result.error) {
        errors[field.id] = result.error;
      } else {
        values[field.id] = formatFormulaResult(result.value, field.prefix);
      }
    });

    return { computedValues: values, formulaErrors: errors };
  }, [formFields, formData]);

  // Only override readonly computed fields; editable computed fields keep user-typed value
  const allFormData = useMemo(() => {
    const result = { ...formData };
    formFields.forEach((f) => {
      if (f.type === 'computed' && f.readonly !== false && computedValues[f.id] !== undefined) {
        result[f.id] = computedValues[f.id];
      }
    });
    return result;
  }, [formData, computedValues, formFields]);

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
      if (field.required && (field.type === 'heading' || field.type === 'separator' || field.type === 'computed')) return;
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
              urgency,
              data: JSON.stringify(allFormData),
              status: newStatus,
            }),
          });
          toast.success(`Статус изменён на "${STATUS_LABELS[newStatus]}"`);
          initialDataRef.current = { title, formData: { ...formData }, status: newStatus, urgency };
          setSavedVersion((v) => v + 1);
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
    if (!urgency) {
      toast.error('Выберите срочность документа');
      return;
    }
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
            urgency,
            typeId: viewData.typeId,
            folderId: viewData.folderId || null,
            data: JSON.stringify(allFormData),
          }),
        });

        // Upload pending attachments
        if (pendingFiles.length > 0) {
          await Promise.allSettled(
            pendingFiles.map((file) => {
              const fd = new FormData();
              fd.append('file', file);
              return fetch(
                `/api/documents/${result.id}/attachments?token=${encodeURIComponent(token)}`,
                { method: 'POST', body: fd },
              );
            }),
          );
          setPendingFiles([]);
        }

        toast.success('Документ создан');
        setAutoSaveEnabled(true);
        initialDataRef.current = { title, formData: { ...formData }, status: 'DRAFT', urgency };
        setSavedVersion((v) => v + 1);
        navigate({ page: 'edit-document', documentId: result.id });
      } else if (document) {
        await apiFetch(`/api/documents/${document.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({
            title,
            urgency,
            data: JSON.stringify(allFormData),
          }),
        });
        toast.success('Документ сохранён');
        setAutoSaveStatus('saved');
        initialDataRef.current = { title, formData: { ...formData }, status, urgency };
        setSavedVersion((v) => v + 1);
        loadActivityLogs(document.id, token);
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [token, isNewDoc, view, title, urgency, formData, document, navigate, validateForm, status, loadActivityLogs, pendingFiles]);

  const handleSaveAndSend = useCallback(async () => {
    if (!token) return;
    if (!urgency) {
      toast.error('Выберите срочность документа');
      return;
    }
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
            urgency,
            typeId: viewData.typeId,
            folderId: viewData.folderId || null,
            data: JSON.stringify(allFormData),
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
            urgency,
            data: JSON.stringify(allFormData),
            status: targetStatus,
          }),
        });
        setStatus(targetStatus);
        initialDataRef.current = { title, formData: { ...formData }, status: targetStatus, urgency };
        setSavedVersion((v) => v + 1);
        toast.success('Документ отправлен');
        loadActivityLogs(document.id, token);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }, [token, isNewDoc, view, title, urgency, formData, document, navigate, validateForm, status, loadActivityLogs]);

  const handleStatusAction = useCallback(
    async (targetStatus: string) => {
      if (!token) return;
      if (!urgency) {
        toast.error('Выберите срочность документа');
        return;
      }
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
              urgency,
              typeId: viewData.typeId,
              folderId: viewData.folderId || null,
              data: JSON.stringify(allFormData),
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
              urgency,
              data: JSON.stringify(allFormData),
              status: targetStatus,
            }),
          });
          setStatus(targetStatus);
          initialDataRef.current = { title, formData: { ...formData }, status: targetStatus, urgency };
          setSavedVersion((v) => v + 1);
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
    [token, isNewDoc, view, title, urgency, formData, document, navigate, validateForm, loadActivityLogs]
  );

  // ── Header decide (Согласовать) ──
  const handleHeaderDecide = useCallback(async () => {
    if (!token || !userPendingStep) return;
    setHeaderDeciding(true);
    try {
      await apiFetch(
        `/api/approvals/${userPendingStep.approvalId}/steps/${userPendingStep.stepId}/decide`,
        token,
        { method: 'POST', body: JSON.stringify({ decision: headerDecideDecision, comment: headerDecideComment }) },
      );
      toast.success(headerDecideDecision === 'APPROVED' ? 'Шаг согласован' : headerDecideDecision === 'APPROVED_WITH_CHANGES' ? 'Согласовано с изменениями' : 'Шаг отклонён');
      setHeaderDecideOpen(false);
      setHeaderDecideComment('');
      setUserPendingStep(null);
      if (document) loadActivityLogs(document.id, token);
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка');
    } finally {
      setHeaderDeciding(false);
    }
  }, [token, userPendingStep, headerDecideDecision, headerDecideComment, document, loadActivityLogs]);

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
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Загрузка документа...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Пожалуйста, подождите</p>
          </div>
        </div>
      </div>
    );
  }

  if (!docType) return null;

  // ── Count required fields ──
  const requiredFields = formFields.filter(f => f.required && f.type !== 'heading' && f.type !== 'separator' && f.type !== 'computed');
  const filledRequired = requiredFields.filter(f => {
    const val = formData[f.id];
    return val !== undefined && val !== '' && val !== null;
  });

  // ── Properties Sidebar Content ──
  const propertiesContent = (
    <div className="p-4 lg:p-5 space-y-4 custom-scrollbar overflow-y-auto">
      {/* Document Type Card / Thumbnail */}
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
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
      <Card className="py-4 transition-shadow hover:shadow-md">
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

          {/* Urgency */}
          <Separator />
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 flex items-center justify-center">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${URGENCY_DOT_COLORS[urgency as UrgencyLevel] ?? 'bg-slate-300'}`} />
              </span>
              Срочность
              {!urgency && !isLocked && (
                <span className="text-[10px] text-rose-500 font-medium ml-auto">обязательно</span>
              )}
            </span>
            <div className={`grid grid-cols-2 gap-1 rounded-md transition-colors ${!urgency && !isLocked ? 'ring-1 ring-rose-300 dark:ring-rose-700 p-0.5' : ''}`}>
              {(Object.keys(URGENCY_LABELS) as UrgencyLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={isLocked}
                  onClick={() => setUrgency(level)}
                  className={`text-[11px] px-2 py-1 rounded border font-medium transition-colors truncate ${
                    urgency === level
                      ? URGENCY_COLORS[level]
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50'
                  }`}
                >
                  {URGENCY_LABELS[level]}
                </button>
              ))}
            </div>
            {!urgency && !isLocked && (
              <p className="text-[10px] text-rose-500">Выберите уровень срочности</p>
            )}
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

      {/* Attachments Card */}
      <Card className="py-4 transition-shadow hover:shadow-md">
        <CardHeader className="pb-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            Вложения
            {isNewDoc && pendingFiles.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {pendingFiles.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          {document?.id && token ? (
            <DocumentAttachments documentId={document.id} token={token} locked={isLocked} documentStatus={status} />
          ) : (
            <PendingAttachments files={pendingFiles} onChange={setPendingFiles} />
          )}
        </CardContent>
      </Card>

      {/* Approval Card */}
      {!isNewDoc && document?.id && token && user && (
        <Card className="py-4 transition-shadow hover:shadow-md">
          <CardContent className="px-4">
            <DocumentApprovalPanel
              documentId={document.id}
              documentTypeId={document.typeId}
              documentStatus={status}
              token={token}
              currentUserId={user.id}
              currentUserRole={user.role}
              currentUserDepartmentId={user.departmentId ?? null}
              onApprovalChange={() => {}}
              onUserPendingStep={setUserPendingStep}
              onSendReady={handleSendReady}
            />
          </CardContent>
        </Card>
      )}

      {/* Sharing Card */}
      <Card className="py-4 transition-shadow hover:shadow-md">
        <CardHeader className="pb-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Доступ и обмен
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs h-9"
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?doc=${document?.id ?? ''}`;
              navigator.clipboard.writeText(url).then(() => toast.success('Ссылка скопирована'));
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Поделиться ссылкой
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs h-9"
            disabled={isNewDoc}
            onClick={() => setPermissionsDialogOpen(true)}
          >
            <User className="h-3.5 w-3.5" />
            Управление доступом
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs h-9 no-print"
            onClick={() => window.print()}
          >
            <FileText className="h-3.5 w-3.5" />
            Экспорт в PDF
          </Button>
        </CardContent>
      </Card>

      {/* Permissions dialog */}
      {!isNewDoc && document?.id && token && (
        <DocumentPermissionsDialog
          documentId={document.id}
          token={token}
          open={permissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
        />
      )}

      {/* Action History Card */}
      <Card className="py-4 transition-shadow hover:shadow-md">
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
                      <p className="text-[11px] text-muted-foreground break-words mt-0.5">{log.details}</p>
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
    <div className="flex flex-col h-screen animate-fade-in">
      {/* ═══ Header Decide Dialog ═══ */}
      {headerDecideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setHeaderDecideOpen(false)} />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-2xl mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold">Согласование: {userPendingStep?.stepName}</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={headerDecideDecision === 'APPROVED' ? 'default' : 'outline'}
                className={headerDecideDecision === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700 flex-1' : 'flex-1'}
                onClick={() => setHeaderDecideDecision('APPROVED')}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Согласовать
              </Button>
              <Button
                size="sm"
                variant={headerDecideDecision === 'APPROVED_WITH_CHANGES' ? 'default' : 'outline'}
                className={headerDecideDecision === 'APPROVED_WITH_CHANGES' ? 'bg-amber-600 hover:bg-amber-700 flex-1' : 'flex-1 text-amber-600 border-amber-300'}
                onClick={() => setHeaderDecideDecision('APPROVED_WITH_CHANGES')}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                С изменениями
              </Button>
              <Button
                size="sm"
                variant={headerDecideDecision === 'REJECTED' ? 'default' : 'outline'}
                className={headerDecideDecision === 'REJECTED' ? 'bg-rose-600 hover:bg-rose-700 flex-1' : 'flex-1 text-rose-600 border-rose-200'}
                onClick={() => setHeaderDecideDecision('REJECTED')}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Отклонить
              </Button>
            </div>
            <Textarea
              value={headerDecideComment}
              onChange={(e) => setHeaderDecideComment(e.target.value)}
              placeholder="Комментарий (необязательно)..."
              rows={7}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setHeaderDecideOpen(false)}>Отмена</Button>
              <Button
                size="sm"
                disabled={headerDeciding}
                className={headerDecideDecision === 'REJECTED' ? 'bg-rose-600 hover:bg-rose-700 gap-1.5' : headerDecideDecision === 'APPROVED_WITH_CHANGES' ? 'bg-amber-600 hover:bg-amber-700 gap-1.5' : 'bg-emerald-600 hover:bg-emerald-700 gap-1.5'}
                onClick={handleHeaderDecide}
              >
                {headerDeciding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {headerDecideDecision === 'APPROVED' ? 'Согласовать' : headerDecideDecision === 'APPROVED_WITH_CHANGES' ? 'С изменениями' : 'Отклонить'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
            <AlertDialogAction onClick={handleSaveAndLeave} className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-transform">
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
              disabled={isLocked}
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
            disabled={isNewDoc || isLocked}
          />

          {/* Auto-save indicator */}
          <div className="hidden sm:flex items-center">
            <AutoSaveIndicator status={autoSaveStatus} />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 lg:gap-2">
            {status === 'DRAFT' && sendApproval && (
              <Button
                variant="outline"
                size="sm"
                onClick={sendApproval}
                disabled={saving}
                className="gap-1.5 text-xs"
              >
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Отправить</span>
              </Button>
            )}

            {userPendingStep && (
              <>
                <Button
                  size="sm"
                  onClick={() => { setHeaderDecideDecision('APPROVED'); setHeaderDecideComment(''); setHeaderDecideOpen(true); }}
                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 hidden sm:flex"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Согласовать
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setHeaderDecideDecision('APPROVED_WITH_CHANGES'); setHeaderDecideComment(''); setHeaderDecideOpen(true); }}
                  className="gap-1.5 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 hidden sm:flex"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  С изменениями
                </Button>
              </>
            )}

            <Separator orientation="vertical" className="h-6 mx-0.5 hidden sm:block" />

            {/* Print button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-1.5 text-xs no-print"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Печать</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Печать документа</TooltipContent>
            </Tooltip>

            {/* Export JSON button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!document) return;
                    const exportData = {
                      id: document.id,
                      title,
                      number: document.number,
                      type: docType?.name || null,
                      typeName: docType?.systemName || null,
                      status,
                      folderId: document.folderId || null,
                      creatorName: document.creator?.name || null,
                      creatorEmail: document.creator?.email || null,
                      data: formData,
                      createdAt: document.createdAt,
                      updatedAt: document.updatedAt,
                    };
                    const blob = new Blob(
                      [JSON.stringify(exportData, null, 2)],
                      { type: 'application/json' }
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${document.number || 'document'}_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Документ экспортирован', {
                      description: 'JSON-файл скачан.',
                    });
                  }}
                  disabled={!document}
                  className="gap-1.5 text-xs no-print"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">JSON</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Экспорт в JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || isLocked}
                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-transform no-print"
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all duration-300 ${
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
                    className={`text-[10px] px-1.5 py-0 h-4 ml-1 transition-colors ${
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all duration-300 ${
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
              className={`flex-1 overflow-y-auto relative transition-opacity duration-200 ${mobileTab !== 'form' ? 'hidden lg:block opacity-0' : 'opacity-100'}`}
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
                  <div className={isLocked ? 'pointer-events-none opacity-60 select-none' : undefined}>
                    <FormRowGroup
                      fields={formFields}
                      formData={allFormData}
                      onChange={handleFieldChange}
                      validationErrors={validationErrors}
                      touchedFields={touchedFields}
                      formulaErrors={formulaErrors}
                      computedValues={computedValues}
                    />
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

                {/* Tags Section (only for existing documents) */}
                {!isNewDoc && document && (
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3 px-4 pt-4">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5" />
                        Теги
                        {assignedTagIds.size > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                            {assignedTagIds.size}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {allTags.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          Нет доступных тегов
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {allTags.map((tag) => {
                            const isAssigned = assignedTagIds.has(tag.id);
                            const isSyncing = tagsSyncing === tag.id;
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                disabled={isSyncing}
                                onClick={() => handleToggleTag(tag)}
                                className={`
                                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                                  border transition-all duration-200 cursor-pointer select-none
                                  ${isAssigned
                                    ? 'border-transparent shadow-sm hover:shadow-md active:scale-95'
                                    : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                  }
                                  ${isSyncing ? 'opacity-50 pointer-events-none' : ''}
                                `}
                                style={
                                  isAssigned
                                    ? { backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}30` }
                                    : undefined
                                }
                              >
                                {isSyncing ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                )}
                                {tag.name}
                                {isAssigned && !isSyncing && (
                                  <Check className="h-3 w-3 opacity-70" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
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
              {status === 'DRAFT' && sendApproval && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendApproval}
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
                disabled={saving || isLocked}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-transform h-10 px-5"
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
