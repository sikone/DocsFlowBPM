export type UserRole = 'ADMIN' | 'ADVANCED' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string | null;
  active: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  icon: string;
  order: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
  _count?: { documents: number };
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'switch' | 'email' | 'phone' | 'money' | 'heading' | 'separator';
  required: boolean;
  column: number;
  row: number;
  placeholder?: string;
  options?: string[];
  prefix?: string;
  defaultValue?: string;
  width?: 'full' | 'half' | 'third';
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

export interface Document {
  id: string;
  title: string;
  number?: string;
  typeId: string;
  folderId?: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  data: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  type?: DocumentType;
  creator?: { id: string; name: string; email: string };
  tagLinks?: Array<{ id: string; tagId: string; tag: DocumentTag }>;
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
  | { page: 'profile' };

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
];
