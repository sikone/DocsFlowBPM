'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import type {
  DocumentRule, RuleCondition, RuleAction, RuleConditionOperator,
  User, DocumentType, Folder, DocumentTag, Counterparty,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Plus, Trash2, Pencil, GripVertical, Loader2,
  ListFilter, FolderInput, Tag, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const URGENCY_LABELS: Record<string, string> = {
  LOW: 'Низкая', MEDIUM: 'Средняя', HIGH: 'Высокая', CRITICAL: 'Критическая',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик', IN_PROGRESS: 'В работе', APPROVED: 'Утверждён',
  REJECTED: 'Отклонён', COMPLETED: 'Завершён',
};

type FieldKind = 'creatorId' | 'docTypeId' | 'urgency' | 'status' | 'counterparty' | 'field';

const FIELD_OPTIONS: { value: FieldKind; label: string }[] = [
  { value: 'creatorId',    label: 'Инициатор документа' },
  { value: 'docTypeId',    label: 'Тип документа' },
  { value: 'urgency',      label: 'Срочность' },
  { value: 'status',       label: 'Статус' },
  { value: 'counterparty', label: 'Контрагент (поле)' },
  { value: 'field',        label: 'Числовое/текстовое поле' },
];

const OPERATOR_LABELS: Record<RuleConditionOperator, string> = {
  eq: 'равно', neq: 'не равно',
  gt: '>', lt: '<', gte: '≥', lte: '≤',
  contains: 'содержит', startsWith: 'начинается с',
  isSet: 'заполнено', isEmpty: 'пусто',
};

function operatorsForKind(kind: FieldKind): RuleConditionOperator[] {
  switch (kind) {
    case 'creatorId':
    case 'docTypeId':
    case 'urgency':
    case 'status':
    case 'counterparty':
      return ['eq', 'neq'];
    case 'field':
      return ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'startsWith', 'isSet', 'isEmpty'];
  }
}

function kindFromField(field: string): FieldKind {
  if (field === 'creatorId') return 'creatorId';
  if (field === 'docTypeId') return 'docTypeId';
  if (field === 'urgency') return 'urgency';
  if (field === 'status') return 'status';
  if (field.startsWith('counterparty:')) return 'counterparty';
  if (field.startsWith('data.')) return 'field';
  return 'field';
}

function fieldToConditionField(kind: FieldKind, dataFieldName: string, counterpartyFieldName: string): string {
  if (kind === 'creatorId') return 'creatorId';
  if (kind === 'docTypeId') return 'docTypeId';
  if (kind === 'urgency') return 'urgency';
  if (kind === 'status') return 'status';
  if (kind === 'counterparty') return `counterparty:${counterpartyFieldName}`;
  return `data.${dataFieldName}`;
}

// counterparty: field stored as "counterparty:{fieldName}" → resolved to "data.{fieldName}" eq counterpartyId
function resolveConditionField(field: string): string {
  if (field.startsWith('counterparty:')) return `data.${field.slice(13)}`;
  return field;
}

function conditionSummary(
  c: RuleCondition,
  users: User[], types: DocumentType[], counterparties: Counterparty[],
): string {
  const field = c.field;
  const op = OPERATOR_LABELS[c.operator] ?? c.operator;
  const needsValue = c.operator !== 'isSet' && c.operator !== 'isEmpty';

  let fieldLabel = field;
  let valueLabel = c.value;

  if (field === 'creatorId') {
    fieldLabel = 'Инициатор';
    valueLabel = users.find((u) => u.id === c.value)?.name ?? c.value;
  } else if (field === 'docTypeId') {
    fieldLabel = 'Тип';
    valueLabel = types.find((t) => t.id === c.value)?.name ?? c.value;
  } else if (field === 'urgency') {
    fieldLabel = 'Срочность';
    valueLabel = URGENCY_LABELS[c.value] ?? c.value;
  } else if (field === 'status') {
    fieldLabel = 'Статус';
    valueLabel = STATUS_LABELS[c.value] ?? c.value;
  } else if (field.startsWith('counterparty:')) {
    fieldLabel = `Поле «${field.slice(13)}»`;
    valueLabel = counterparties.find((cp) => cp.id === c.value)?.name ?? c.value;
  } else if (field.startsWith('data.')) {
    fieldLabel = `Поле «${field.slice(5)}»`;
  }

  return needsValue ? `${fieldLabel} ${op} ${valueLabel}` : `${fieldLabel} ${op}`;
}

function actionSummary(a: RuleAction, folders: Folder[], tags: DocumentTag[]): string {
  if (a.type === 'moveToFolder') {
    const f = folders.find((fl) => fl.id === a.folderId);
    return `→ Папка «${f?.name ?? '?'}»`;
  }
  if (a.type === 'addTag') {
    const t = tags.find((tg) => tg.id === a.tagId);
    return `→ Тег «${t?.name ?? '?'}»`;
  }
  return '';
}

// ── flat folder list for picker ───────────────────────────────────────
function flattenFolders(folders: Folder[], indent = 0): Array<Folder & { indent: number }> {
  const result: Array<Folder & { indent: number }> = [];
  const roots = folders.filter((f) => !f.parentId);
  function walk(list: Folder[], depth: number) {
    for (const f of list) {
      result.push({ ...f, indent: depth });
      walk(folders.filter((c) => c.parentId === f.id), depth + 1);
    }
  }
  walk(roots, indent);
  return result;
}

// ── ConditionRow ─────────────────────────────────────────────────────

interface ConditionRowProps {
  cond: RuleCondition;
  users: User[];
  types: DocumentType[];
  counterparties: Counterparty[];
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}

function ConditionRow({ cond, users, types, counterparties, onChange, onRemove }: ConditionRowProps) {
  const kind = kindFromField(cond.field);
  const [dataFieldName, setDataFieldName] = useState(
    cond.field.startsWith('data.') ? cond.field.slice(5) : '',
  );
  const [counterpartyFieldName, setCounterpartyFieldName] = useState(
    cond.field.startsWith('counterparty:') ? cond.field.slice(13) : '',
  );

  function setKind(k: FieldKind) {
    const defaultOp = operatorsForKind(k)[0];
    const field = fieldToConditionField(k, dataFieldName || 'fieldName', counterpartyFieldName || 'kontragent');
    onChange({ ...cond, field, operator: defaultOp, value: '' });
  }

  function setOperator(op: RuleConditionOperator) {
    onChange({ ...cond, operator: op });
  }

  function setValue(value: string) {
    onChange({ ...cond, value });
  }

  function setDataField(name: string) {
    setDataFieldName(name);
    onChange({ ...cond, field: `data.${name}` });
  }

  function setCounterpartyField(name: string) {
    setCounterpartyFieldName(name);
    onChange({ ...cond, field: `counterparty:${name}` });
  }

  const ops = operatorsForKind(kind);
  const needsValue = cond.operator !== 'isSet' && cond.operator !== 'isEmpty';

  return (
    <div className="flex flex-wrap items-start gap-2 p-3 bg-muted/40 rounded-lg border border-border/50">
      {/* Field kind */}
      <div className="min-w-[180px]">
        <Select value={kind} onValueChange={(v) => setKind(v as FieldKind)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Extra field name input for 'field' and 'counterparty' kinds */}
      {kind === 'field' && (
        <Input
          className="h-8 text-sm w-36"
          placeholder="Системное имя поля"
          value={dataFieldName}
          onChange={(e) => setDataField(e.target.value)}
        />
      )}
      {kind === 'counterparty' && (
        <Input
          className="h-8 text-sm w-36"
          placeholder="Имя поля (напр. kontragent)"
          value={counterpartyFieldName}
          onChange={(e) => setCounterpartyField(e.target.value)}
        />
      )}

      {/* Operator */}
      <div className="min-w-[120px]">
        <Select value={cond.operator} onValueChange={(v) => setOperator(v as RuleConditionOperator)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ops.map((op) => (
              <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Value */}
      {needsValue && (
        <div className="flex-1 min-w-[160px]">
          {kind === 'creatorId' && (
            <Select value={cond.value} onValueChange={setValue}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите пользователя" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {kind === 'docTypeId' && (
            <Select value={cond.value} onValueChange={setValue}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите тип" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {kind === 'urgency' && (
            <Select value={cond.value} onValueChange={setValue}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Срочность" /></SelectTrigger>
              <SelectContent>
                {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {kind === 'status' && (
            <Select value={cond.value} onValueChange={setValue}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {kind === 'counterparty' && (
            <Select value={cond.value} onValueChange={setValue}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите контрагента" /></SelectTrigger>
              <SelectContent>
                {counterparties.map((cp) => (
                  <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {kind === 'field' && (
            <Input
              className="h-8 text-sm"
              placeholder="Значение"
              value={cond.value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </div>
      )}

      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── ActionRow ────────────────────────────────────────────────────────

interface ActionRowProps {
  action: RuleAction;
  folders: Folder[];
  tags: DocumentTag[];
  onChange: (a: RuleAction) => void;
  onRemove: () => void;
}

function ActionRow({ action, folders, tags, onChange, onRemove }: ActionRowProps) {
  const flat = flattenFolders(folders);

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border/50">
      <div className="min-w-[180px]">
        <Select
          value={action.type}
          onValueChange={(v) => onChange({ ...action, type: v as RuleAction['type'], folderId: undefined, tagId: undefined })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="moveToFolder">Переместить в папку</SelectItem>
            <SelectItem value="addTag">Добавить тег</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {action.type === 'moveToFolder' && (
        <div className="flex-1 min-w-[200px]">
          <Select value={action.folderId ?? ''} onValueChange={(v) => onChange({ ...action, folderId: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите папку" /></SelectTrigger>
            <SelectContent>
              {flat.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <span style={{ paddingLeft: f.indent * 12 }}>{f.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {action.type === 'addTag' && (
        <div className="flex-1 min-w-[200px]">
          <Select value={action.tagId ?? ''} onValueChange={(v) => onChange({ ...action, tagId: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Выберите тег" /></SelectTrigger>
            <SelectContent>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── RuleEditor dialog ─────────────────────────────────────────────────

type RuleDraft = Omit<DocumentRule, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string };

interface RuleEditorProps {
  rule: RuleDraft;
  users: User[];
  types: DocumentType[];
  folders: Folder[];
  tags: DocumentTag[];
  counterparties: Counterparty[];
  onSave: (rule: RuleDraft) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function RuleEditor({ rule, users, types, folders, tags, counterparties, onSave, onClose, saving }: RuleEditorProps) {
  const [draft, setDraft] = useState(rule);

  function addCondition() {
    setDraft((d) => ({
      ...d,
      conditions: [...d.conditions, { id: uid(), field: 'creatorId', operator: 'eq', value: '' }],
    }));
  }

  function updateCondition(idx: number, c: RuleCondition) {
    setDraft((d) => ({ ...d, conditions: d.conditions.map((x, i) => (i === idx ? c : x)) }));
  }

  function removeCondition(idx: number) {
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, i) => i !== idx) }));
  }

  function addAction() {
    setDraft((d) => ({
      ...d,
      actions: [...d.actions, { id: uid(), type: 'moveToFolder' }],
    }));
  }

  function updateAction(idx: number, a: RuleAction) {
    setDraft((d) => ({ ...d, actions: d.actions.map((x, i) => (i === idx ? a : x)) }));
  }

  function removeAction(idx: number) {
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, i) => i !== idx) }));
  }

  // Resolve counterparty: fields before saving
  function prepareForSave() {
    return {
      ...draft,
      conditions: draft.conditions.map((c) => ({
        ...c,
        field: resolveConditionField(c.field),
      })),
    };
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{draft.id ? 'Редактировать правило' : 'Новое правило'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-5 py-2">
        {/* Name */}
        <div className="space-y-1.5">
          <Label>Название правила</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Например: Счета от ООО «Ромашка» → папка «Счета»"
          />
        </div>

        <Separator />

        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Условия</Label>
              <Select
                value={draft.conditionLogic}
                onValueChange={(v) => setDraft((d) => ({ ...d, conditionLogic: v as 'AND' | 'OR' }))}
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">И (все)</SelectItem>
                  <SelectItem value="OR">ИЛИ (любое)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addCondition}>
              <Plus className="h-3 w-3" />
              Добавить условие
            </Button>
          </div>

          {draft.conditions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
              Нет условий — правило сработает на любой документ
            </p>
          )}

          {draft.conditions.map((c, i) => (
            <ConditionRow
              key={c.id}
              cond={c}
              users={users}
              types={types}
              counterparties={counterparties}
              onChange={(upd) => updateCondition(i, upd)}
              onRemove={() => removeCondition(i)}
            />
          ))}
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Действия</Label>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addAction}>
              <Plus className="h-3 w-3" />
              Добавить действие
            </Button>
          </div>

          {draft.actions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
              Добавьте хотя бы одно действие
            </p>
          )}

          {draft.actions.map((a, i) => (
            <ActionRow
              key={a.id}
              action={a}
              folders={folders}
              tags={tags}
              onChange={(upd) => updateAction(i, upd)}
              onRemove={() => removeAction(i)}
            />
          ))}
        </div>

        <Separator />

        {/* Options */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Остановить обработку следующих правил</Label>
            <p className="text-xs text-muted-foreground">Как «Стоп» в Outlook — если это правило сработало, остальные не проверяются</p>
          </div>
          <Switch
            checked={draft.stopOnMatch}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, stopOnMatch: v }))}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
        <Button
          onClick={() => onSave(prepareForSave())}
          disabled={saving || !draft.name.trim() || draft.actions.length === 0}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Panel component (embeddable, no page chrome) ─────────────────────

export function RulesPanel() {
  const { token } = useStore();

  const [rules, setRules] = useState<DocumentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reference data
  const [users, setUsers] = useState<User[]>([]);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<DocumentTag[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);

  // UI state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DocumentRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRule | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const authQ = `token=${encodeURIComponent(token ?? '')}`;

  const fetchRules = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rules?${authQ}`);
      const json = await res.json();
      setRules(json.rules ?? []);
    } finally {
      setLoading(false);
    }
  }, [token, authQ]);

  // Load reference data in parallel
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`/api/users?${authQ}`).then((r) => r.json()),
      fetch(`/api/document-types?${authQ}`).then((r) => r.json()),
      fetch(`/api/folders?${authQ}`).then((r) => r.json()),
      fetch(`/api/tags?${authQ}`).then((r) => r.json()),
      fetch(`/api/counterparties?${authQ}&limit=500`).then((r) => r.json()),
    ]).then(([u, t, f, tg, cp]) => {
      setUsers(u.users ?? []);
      setTypes((t.types ?? []).filter((x: DocumentType) => x.active));
      // flatten folder tree to flat list
      const flattenTree = (nodes: Folder[]): Folder[] =>
        nodes.flatMap((n) => [n, ...flattenTree((n as Folder & { children?: Folder[] }).children ?? [])]);
      setFolders(flattenTree(f.folders ?? f ?? []));
      setTags(tg.tags ?? []);
      setCounterparties(cp.counterparties ?? []);
    }).catch(() => {});
  }, [token, authQ]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // ── open editor ──────────────────────────────────────────────────
  function openNew() {
    setEditingRule(null);
    setEditorOpen(true);
  }

  function openEdit(rule: DocumentRule) {
    // Reverse-resolve data.{fieldName} back to counterparty: if it was stored that way
    // We store counterparty fields as data.{name} after resolution,
    // so in the editor we show them as plain 'field' conditions
    setEditingRule(rule);
    setEditorOpen(true);
  }

  // ── save ─────────────────────────────────────────────────────────
  async function handleSave(draft: Omit<DocumentRule, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    setSaving(true);
    try {
      const method = draft.id ? 'PUT' : 'POST';
      const url = draft.id ? `/api/rules/${draft.id}?${authQ}` : `/api/rules?${authQ}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      toast.success(draft.id ? 'Правило обновлено' : 'Правило создано');
      setEditorOpen(false);
      fetchRules();
    } catch {
      toast.error('Не удалось сохранить правило');
    } finally {
      setSaving(false);
    }
  }

  // ── delete ───────────────────────────────────────────────────────
  async function handleDelete(rule: DocumentRule) {
    try {
      const res = await fetch(`/api/rules/${rule.id}?${authQ}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Правило удалено');
      setDeleteTarget(null);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch {
      toast.error('Не удалось удалить правило');
    }
  }

  // ── toggle active ────────────────────────────────────────────────
  async function toggleActive(rule: DocumentRule) {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
    try {
      await fetch(`/api/rules/${rule.id}?${authQ}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      });
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: rule.active } : r)));
      toast.error('Не удалось изменить статус правила');
    }
  }

  // ── move up / down ───────────────────────────────────────────────
  async function moveRule(idx: number, dir: -1 | 1) {
    const next = [...rules];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const reordered = next.map((r, i) => ({ ...r, order: i }));
    setRules(reordered);
    await Promise.all(
      reordered.map((r) =>
        fetch(`/api/rules/${r.id}?${authQ}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: r.order }),
        })
      )
    ).catch(() => toast.error('Ошибка при изменении порядка'));
  }

  const blankRule = {
    name: '', active: true, order: 0, stopOnMatch: false,
    conditionLogic: 'AND' as const, conditions: [], actions: [],
  };

  return (
    <div className="space-y-4">
      {/* New rule button */}
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Новое правило
        </Button>
      </div>

      <div className="space-y-4">
        {/* Info banner */}
        <div className="flex gap-2.5 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sm text-sky-800 dark:text-sky-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Правила применяются автоматически при создании нового документа.
            Правила выполняются сверху вниз — используйте кнопки ▲▼ для изменения порядка.
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Загрузка правил…
          </div>
        )}

        {/* Empty state */}
        {!loading && rules.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
            <ListFilter className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium mb-1">Правил пока нет</p>
            <p className="text-sm">Создайте первое правило, чтобы автоматически раскладывать входящие документы</p>
            <Button variant="outline" className="mt-4 gap-1.5" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Создать правило
            </Button>
          </div>
        )}

        {/* Rules list */}
        {rules.map((rule, idx) => {
          const expanded = expandedId === rule.id;
          return (
            <Card key={rule.id} className={`transition-all ${rule.active ? '' : 'opacity-60'}`}>
              <CardContent className="p-0">
                {/* Rule header row */}
                <div className="flex items-center gap-2 px-4 py-3">
                  {/* Order controls */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveRule(idx, -1)}
                      disabled={idx === 0}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveRule(idx, 1)}
                      disabled={idx === rules.length - 1}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

                  {/* Name + badges */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : rule.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{rule.name}</span>
                      {!rule.active && <Badge variant="outline" className="text-[10px] py-0">Отключено</Badge>}
                      {rule.stopOnMatch && <Badge variant="outline" className="text-[10px] py-0 border-amber-400 text-amber-600">Стоп</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {rule.conditions.length} усл. · {rule.actions.length} действ.
                      </span>
                    </div>
                  </div>

                  {/* Active toggle */}
                  <Switch
                    checked={rule.active}
                    onCheckedChange={() => toggleActive(rule)}
                    className="shrink-0"
                  />

                  {/* Edit */}
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEdit(rule)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  {/* Delete */}
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(rule)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                    {/* Conditions */}
                    {rule.conditions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                          Условия ({rule.conditionLogic === 'AND' ? 'все' : 'любое'})
                        </p>
                        <div className="space-y-1">
                          {rule.conditions.map((c) => (
                            <div key={c.id} className="text-sm flex items-center gap-1.5 text-foreground/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                              {conditionSummary(c, users, types, counterparties)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {rule.actions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Действия</p>
                        <div className="space-y-1">
                          {rule.actions.map((a) => (
                            <div key={a.id} className="text-sm flex items-center gap-1.5 text-foreground/80">
                              {a.type === 'moveToFolder'
                                ? <FolderInput className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                : <Tag className="h-3.5 w-3.5 text-violet-600 shrink-0" />}
                              {actionSummary(a, folders, tags)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rule editor dialog */}
      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o && !saving) setEditorOpen(false); }}>
        <RuleEditor
          key={editingRule?.id ?? 'new'}
          rule={editingRule ?? blankRule}
          users={users}
          types={types}
          folders={folders}
          tags={tags}
          counterparties={counterparties}
          onSave={handleSave}
          onClose={() => setEditorOpen(false)}
          saving={saving}
        />
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить правило?</AlertDialogTitle>
            <AlertDialogDescription>
              Правило <span className="font-medium">«{deleteTarget?.name}»</span> будет удалено безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Full-page wrapper (standalone route) ──────────────────────────────

export default function RulesPage() {
  const { navigate } = useStore();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate({ page: 'dashboard' })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <ListFilter className="h-5 w-5 text-emerald-600" />
            <h1 className="text-base font-semibold">Правила обработки документов</h1>
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <RulesPanel />
      </div>
    </div>
  );
}
