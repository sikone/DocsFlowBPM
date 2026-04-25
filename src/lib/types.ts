export type UserRole = 'ADMIN' | 'DIRECTOR' | 'CHIEF_ACCOUNTANT' | 'ADVANCED' | 'USER';

export interface Department {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string | null;
  active: boolean;
  isDepartmentHead?: boolean;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  icon: string;
  order: number;
  isSystem: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
  _count?: { documents: number };
}

export interface FormField {
  id: string;
  label: string;
  systemName?: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'switch' | 'email' | 'phone' | 'money' | 'heading' | 'separator' | 'counterparty' | 'computed';
  required: boolean;
  column: number;
  row: number;
  placeholder?: string;
  options?: string[];
  source?: 'options' | 'directory';
  directorySource?: string;
  prefix?: string;
  defaultValue?: string;
  width?: 'full' | 'half' | 'third';
  formula?: string;
  readonly?: boolean;
}

export interface DocumentType {
  id: string;
  name: string;
  systemName: string;
  description?: string;
  icon: string;
  color: string;
  active: boolean;
  formSchema: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTag {
  id: string;
  name: string;
  color: string;
}

export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Document {
  id: string;
  title: string;
  number?: string;
  typeId: string;
  folderId?: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  urgency: UrgencyLevel;
  data: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  type?: DocumentType;
  creator?: { id: string; name: string; email: string };
  tagLinks?: Array<{ id: string; tagId: string; tag: DocumentTag }>;
  myPendingStep?: { id: string; dueAt: string | null } | null;
}

export interface Counterparty {
  id: string;
  name: string;
  shortName?: string | null;
  inn: string;
  kpp?: string | null;
  ogrn?: string | null;
  legalAddress?: string | null;
  actualAddress?: string | null;
  postalAddress?: string | null;
  postalCode?: string | null;
  bankAccount?: string | null;
  bank?: string | null;
  bik?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  telegramId?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  counterparties?: Array<{ counterparty: { id: string; name: string; shortName?: string | null } }>;
}

export interface ApprovalRouteStep {
  id: string;
  routeId: string;
  order: number;
  name: string;
  userId?: string | null;
  user?: { id: string; name: string } | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  slaConfig?: string | null; // JSON SlaConfig
}

export interface ApprovalRoute {
  id: string;
  name: string;
  description?: string | null;
  steps: ApprovalRouteStep[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface ApprovalStepDecision {
  id: string;
  stepId: string;
  decision: 'APPROVED' | 'APPROVED_WITH_CHANGES' | 'REJECTED';
  comment?: string | null;
  decidedById: string;
  decidedBy: { id: string; name: string };
  createdAt: string;
}

export interface DocumentApprovalStep {
  id: string;
  approvalId: string;
  order: number;
  name: string;
  stepType: 'APPROVAL' | 'CONDITION';
  conditionConfig?: string | null;
  slaConfig?: string | null; // JSON SlaConfig
  dueAt?: string | null;
  userId?: string | null;
  user?: { id: string; name: string } | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  status: 'PENDING' | 'APPROVED' | 'APPROVED_WITH_CHANGES' | 'REJECTED' | 'SKIPPED';
  decidedById?: string | null;
  decidedBy?: { id: string; name: string } | null;
  comment?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  decisions?: ApprovalStepDecision[];
}

export interface DocumentApproval {
  id: string;
  documentId: string;
  routeId?: string | null;
  route?: { id: string; name: string } | null;
  status: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
  createdById: string;
  createdBy?: { id: string; name: string };
  steps: DocumentApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

export type AppView =
  | { page: 'login' }
  | { page: 'dashboard'; folderId?: string }
  | { page: 'new-document'; typeId: string; folderId?: string; title?: string; templateData?: string }
  | { page: 'edit-document'; documentId: string }
  | { page: 'admin' }
  | { page: 'admin-users' }
  | { page: 'admin-doc-types' }
  | { page: 'admin-doc-type-form'; typeId?: string }
  | { page: 'admin-processes' }
  | { page: 'admin-tasks' }
  | { page: 'admin-activity' }
  | { page: 'admin-tags' }
  | { page: 'admin-settings' }
  | { page: 'admin-counterparties' }
  | { page: 'admin-contacts' }
  | { page: 'admin-departments' }
  | { page: 'admin-approval-routes' }
  | { page: 'admin-deleted-objects' }
  | { page: 'profile' }
  | { page: 'reports' };

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  IN_PROGRESS: 'В работе',
  APPROVED: 'Утверждён',
  REJECTED: 'Отклонён',
  COMPLETED: 'Завершён',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  IN_PROGRESS: 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700',
  COMPLETED: 'bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-700',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  DIRECTOR: 'Директор',
  CHIEF_ACCOUNTANT: 'Главный бухгалтер',
  ADVANCED: 'Расширенный',
  USER: 'Обычный',
};

export const FIELD_TYPES: { value: FormField['type']; label: string }[] = [
  { value: 'text', label: 'Текстовое поле' },
  { value: 'textarea', label: 'Многострочный текст' },
  { value: 'number', label: 'Число' },
  { value: 'money', label: 'Денежная сумма' },
  { value: 'date', label: 'Дата' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Телефон' },
  { value: 'select', label: 'Выпадающий список' },
  { value: 'checkbox', label: 'Флажок' },
  { value: 'switch', label: 'Переключатель' },
  { value: 'heading', label: 'Заголовок' },
  { value: 'separator', label: 'Разделитель' },
  { value: 'counterparty', label: 'Контрагент' },
  { value: 'computed', label: 'Вычисляемое значение' },
];
