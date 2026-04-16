'use client';

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useStore } from '@/lib/store';
import type { Folder, Document, DocumentType } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS, ROLE_LABELS } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
import { toast } from 'sonner';

import ActivityPanel from '@/components/activity-panel';
import DashboardAnalytics from '@/components/dashboard/dashboard-analytics';
import {
  FileText,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  RefreshCw,
  LogOut,
  Settings,
  Menu,
  Grid,
  List,
  MoreVertical,
  Pencil,
  Trash2,
  File,
  FilePlus,
  Home,
  User,
  LayoutGrid,
  Inbox,
  Sun,
  Moon,
  FileSpreadsheet,
  ScrollText,
  ClipboardList,
  Download,
  Printer,
  FileJson,
  CheckSquare,
  Square,
  Minus,
  FileDown,
  FolderInput,
  X,
  ArrowRightLeft,
  Copy,
  Palette,
} from 'lucide-react';

// ─── Theme Toggle Component ─────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Helper: format date ─────────────────────────────────────────────
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── Helper: relative time ───────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'только что';
    if (diffMin < 60) {
      const last = diffMin % 10;
      const suffix = last === 1 ? 'у' : last >= 2 && last <= 4 ? 'ы' : '';
      return `${diffMin} минут${suffix} назад`;
    }
    if (diffHours < 24) {
      const last = diffHours % 10;
      const suffix = last === 1 ? '' : last >= 2 && last <= 4 ? 'а' : 'ов';
      return `${diffHours} час${suffix} назад`;
    }
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) {
      const last = diffDays % 10;
      const suffix = last === 1 ? 'ень' : last >= 2 && last <= 4 ? 'ня' : 'ней';
      return `${diffDays} д${suffix} назад`;
    }
    return formatDate(dateStr);
  } catch {
    return '—';
  }
}

// ─── Helper: get folder icon color from hex ─────────────────────────
function getFolderColor(color: string): string {
  const map: Record<string, string> = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    violet: 'text-violet-400',
    cyan: 'text-cyan-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400',
    slate: 'text-slate-400',
  };
  // If it's a named color, map it; otherwise assume it's a hex and use inline style
  if (map[color]) return map[color];
  // Return empty string — caller will use inline style
  return '';
}

// ─── Helper: get doc type icon ───────────────────────────────────────
function getDocTypeIcon(systemName: string) {
  const iconMap: Record<string, React.ReactNode> = {
    INCOMING_LETTER: <FileText className="h-4 w-4" />,
    OUTGOING_LETTER: <FileText className="h-4 w-4" />,
    CONTRACT: <File className="h-4 w-4" />,
    ORDER: <FilePlus className="h-4 w-4" />,
    ACT: <File className="h-4 w-4" />,
    PROTOCOL: <FileText className="h-4 w-4" />,
    MEMO: <FileText className="h-4 w-4" />,
    REPORT: <FileText className="h-4 w-4" />,
  };
  return iconMap[systemName] || <File className="h-4 w-4" />;
}

// ─── Predefined folder colors ──────────────────────────────────────
const FOLDER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#64748b', // slate
] as const;

// ─── Color Picker Component ────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FOLDER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`w-7 h-7 rounded-full transition-all duration-150 hover:scale-110 ${
            value === color
              ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
              : 'opacity-70 hover:opacity-100'
          }`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          aria-label={color}
        />
      ))}
    </div>
  );
}

// ─── Sort config ─────────────────────────────────────────────────────
type SortField = 'createdAt' | 'updatedAt' | 'title' | 'status';
type SortDir = 'asc' | 'desc';

// ─── Main Component ─────────────────────────────────────────────────
export default function DashboardLayout() {
  const {
    user,
    token,
    view,
    folders,
    documents,
    documentTypes,
    sidebarCollapsed,
    selectedFolderId,
    isLoading,
    navigate,
    logout,
    toggleSidebar,
    setSelectedFolder,
    setFolders,
    setDocuments,
    setDocumentTypes,
    setLoading,
  } = useStore();

  // ── Local UI state ──────────────────────────────────────────────────
  const [folderSearch, setFolderSearch] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [refreshing, setRefreshing] = useState(false);

  // ── New Folder Dialog ───────────────────────────────────────────────
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
  const [newFolderSubmitting, setNewFolderSubmitting] = useState(false);

  // ── Rename Dialog ───────────────────────────────────────────────────
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renameFolderColor, setRenameFolderColor] = useState('#3b82f6');
  const [renameSubmitting, setRenameSubmitting] = useState(false);

  // ── Mobile Sidebar Sheet ────────────────────────────────────────────
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // ── Delete Document Dialog ──────────────────────────────────────────
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteDocTitle, setDeleteDocTitle] = useState('');
  const [deleteDocSubmitting, setDeleteDocSubmitting] = useState(false);

  // ── Bulk Selection State ────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Bulk Delete Dialog ─────────────────────────────────────────────
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0, active: false });

  // ── Bulk Status Dialog ─────────────────────────────────────────────
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('');
  const [bulkStatusSubmitting, setBulkStatusSubmitting] = useState(false);

  // ── Bulk Move Dialog ───────────────────────────────────────────────
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState<string>('');
  const [bulkMoveSubmitting, setBulkMoveSubmitting] = useState(false);

  // ── New Document Dialog ────────────────────────────────────────────
  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);
  const [newDocTypeId, setNewDocTypeId] = useState<string>('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocFolderId, setNewDocFolderId] = useState<string>('');
  const [newDocSubmitting, setNewDocSubmitting] = useState(false);

  // ── Duplicating Document ───────────────────────────────────────────
  const [duplicatingDocId, setDuplicatingDocId] = useState<string | null>(null);

  // ── Folder path for breadcrumb ──────────────────────────────────────
  const folderPath = useMemo(() => {
    const path: Folder[] = [];
    let current = folders.find((f) => f.id === selectedFolderId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined;
    }
    return path;
  }, [folders, selectedFolderId]);

  // ── Filtered folders (for search) ──────────────────────────────────
  const filteredFolders = useMemo(() => {
    if (!folderSearch.trim()) return folders;
    const q = folderSearch.toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, folderSearch]);

  // ── Root folders (top-level) ───────────────────────────────────────
  const rootFolders = useMemo(() => {
    return filteredFolders.filter((f) => !f.parentId);
  }, [filteredFolders]);

  // ── Get children of a folder ───────────────────────────────────────
  const getChildren = useCallback(
    (parentId: string) => {
      return filteredFolders.filter((f) => f.parentId === parentId);
    },
    [filteredFolders]
  );

  // ── Filtered & sorted documents ────────────────────────────────────
  const filteredDocuments = useMemo(() => {
    let docs = [...documents];

    // Filter by folder
    if (selectedFolderId) {
      docs = docs.filter((d) => d.folderId === selectedFolderId);
    }

    // Filter by status
    if (statusFilter !== 'ALL') {
      docs = docs.filter((d) => d.status === statusFilter);
    }

    // Filter by search
    if (docSearch.trim()) {
      const q = docSearch.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.number?.toLowerCase().includes(q) ||
          d.type?.name.toLowerCase().includes(q) ||
          d.creator?.name.toLowerCase().includes(q)
      );
    }

    // Sort
    docs.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title, 'ru');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
        default:
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return docs;
  }, [documents, selectedFolderId, statusFilter, docSearch, sortField, sortDir]);

  // ── Count docs in folder (recursive) ───────────────────────────────
  const countDocsInFolder = useCallback(
    (folderId: string): number => {
      const direct = documents.filter((d) => d.folderId === folderId).length;
      const children = folders.filter((f) => f.parentId === folderId);
      const childCount = children.reduce((sum, c) => sum + countDocsInFolder(c.id), 0);
      return direct + childCount;
    },
    [documents, folders]
  );

  // ── Toggle folder expand ───────────────────────────────────────────
  const toggleExpand = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // ── Fetch data on mount ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const [foldersRes, docsRes, typesRes] = await Promise.all([
        fetch(`/api/folders?token=${token}`),
        fetch(`/api/documents?token=${token}`),
        fetch(`/api/document-types?token=${token}`),
      ]);

      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(Array.isArray(foldersData) ? foldersData : foldersData.folders || []);
      }
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(Array.isArray(docsData) ? docsData : docsData.documents || []);
      }
      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setDocumentTypes(Array.isArray(typesData) ? typesData : typesData.types || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, setFolders, setDocuments, setDocumentTypes, setLoading]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, []);

  // ── Handle folder select ───────────────────────────────────────────
  const handleFolderSelect = useCallback(
    (folderId: string) => {
      setSelectedFolder(folderId);
      toggleExpand(folderId);
    },
    [setSelectedFolder, toggleExpand]
  );

  // ── Handle "All Documents" (clear selection) ───────────────────────
  const handleAllDocuments = useCallback(() => {
    setSelectedFolder(null);
  }, [setSelectedFolder]);

  // ── Handle new document creation (opens dialog) ───────────────────
  const handleNewDocument = useCallback(
    (typeId: string) => {
      const docType = documentTypes.find((dt) => dt.id === typeId);
      setNewDocTypeId(typeId);
      setNewDocTitle(docType ? `${docType.name} — новый` : 'Новый документ');
      setNewDocFolderId(selectedFolderId || '');
      setNewDocDialogOpen(true);
    },
    [documentTypes, selectedFolderId]
  );

  // ── Handle confirm new document from dialog ─────────────────────────
  const handleConfirmNewDocument = useCallback(() => {
    if (!newDocTypeId) return;
    setNewDocDialogOpen(false);
    navigate({
      page: 'new-document',
      typeId: newDocTypeId,
      folderId: newDocFolderId || undefined,
      title: newDocTitle,
    });
  }, [newDocTypeId, newDocFolderId, newDocTitle, navigate]);

  // ── Handle document row click ──────────────────────────────────────
  const handleDocClick = useCallback(
    (docId: string) => {
      navigate({ page: 'edit-document', documentId: docId });
    },
    [navigate]
  );

  // ── Handle create folder ───────────────────────────────────────────
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || !token) return;
    setNewFolderSubmitting(true);
    try {
      const res = await fetch(`/api/folders?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: newFolderParentId,
          color: newFolderColor,
        }),
      });
      if (res.ok) {
        setNewFolderOpen(false);
        setNewFolderName('');
        setNewFolderParentId(null);
        setNewFolderColor('#3b82f6');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create folder:', err);
    } finally {
      setNewFolderSubmitting(false);
    }
  }, [newFolderName, newFolderParentId, newFolderColor, token, fetchData]);

  // ── Handle rename folder ───────────────────────────────────────────
  const handleRenameFolder = useCallback(async () => {
    if (!renameFolderId || !renameFolderName.trim() || !token) return;
    setRenameSubmitting(true);
    try {
      const res = await fetch(`/api/folders/${renameFolderId}?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: renameFolderName.trim(),
          color: renameFolderColor,
        }),
      });
      if (res.ok) {
        setRenameFolderOpen(false);
        setRenameFolderId(null);
        setRenameFolderName('');
        setRenameFolderColor('#3b82f6');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to rename folder:', err);
    } finally {
      setRenameSubmitting(false);
    }
  }, [renameFolderId, renameFolderName, renameFolderColor, token, fetchData]);

  // ── Handle delete folder ───────────────────────────────────────────
  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (!token) return;
      try {
        const res = await fetch(`/api/folders/${folderId}?token=${token}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          if (selectedFolderId === folderId) {
            setSelectedFolder(null);
          }
          fetchData();
        }
      } catch (err) {
        console.error('Failed to delete folder:', err);
      }
    },
    [token, selectedFolderId, setSelectedFolder, fetchData]
  );

  // ── Toggle sort direction ──────────────────────────────────────────
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField]
  );

  // ── User initials ──────────────────────────────────────────────────
  const userInitials = useMemo(() => {
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [user]);

  // ── Active document types for creation ─────────────────────────────
  const activeDocTypes = useMemo(
    () => documentTypes.filter((dt) => dt.active),
    [documentTypes]
  );

  // ── Quick action doc type IDs ───────────────────────────────────────
  const invoiceTypeId = useMemo(
    () => documentTypes.find((dt) => dt.systemName === 'ORDER')?.id,
    [documentTypes]
  );
  const contractTypeId = useMemo(
    () => documentTypes.find((dt) => dt.systemName === 'CONTRACT')?.id,
    [documentTypes]
  );
  const memoTypeId = useMemo(
    () => documentTypes.find((dt) => dt.systemName === 'MEMO')?.id,
    [documentTypes]
  );

  // ── User first name ────────────────────────────────────────────────
  const userFirstName = useMemo(() => {
    if (!user?.name) return 'Пользователь';
    return user.name.split(' ')[0];
  }, [user]);

  // ── Handle delete document ──────────────────────────────────────────
  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      if (!token) return;
      setDeleteDocSubmitting(true);
      try {
        const res = await fetch(`/api/documents/${docId}?token=${token}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          toast.success('Документ удалён', {
            description: '«' + deleteDocTitle + '» успешно удалён из системы.',
          });
          setDocuments(documents.filter((d) => d.id !== docId));
          fetchData();
        } else {
          toast.error('Ошибка удаления', {
            description: 'Не удалось удалить документ. Попробуйте ещё раз.',
          });
        }
      } catch {
        toast.error('Ошибка соединения', {
          description: 'Не удалось подключиться к серверу.',
        });
      } finally {
        setDeleteDocSubmitting(false);
        setDeleteDocId(null);
        setDeleteDocTitle('');
      }
    },
    [token, deleteDocTitle, documents, setDocuments, fetchData]
  );

  // ── Handle duplicate document ──────────────────────────────────────
  const handleDuplicateDoc = useCallback(
    async (docId: string) => {
      if (!token) return;
      setDuplicatingDocId(docId);
      try {
        const res = await fetch(`/api/documents/${docId}/duplicate?token=${token}`, {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json();
          const newDoc = data.document;
          toast.success('Документ скопирован', {
            description: `«${newDoc.title}» создан.`,
          });
          fetchData();
          // Navigate to the new document in edit mode
          navigate({ page: 'edit-document', documentId: newDoc.id });
        } else {
          toast.error('Ошибка копирования', {
            description: 'Не удалось скопировать документ.',
          });
        }
      } catch {
        toast.error('Ошибка соединения', {
          description: 'Не удалось подключиться к серверу.',
        });
      } finally {
        setDuplicatingDocId(null);
      }
    },
    [token, fetchData, navigate]
  );

  // ── Toggle select mode ───────────────────────────────────────────
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (!prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  // ── Toggle document selection ───────────────────────────────────────
  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  // ── Toggle select all visible documents ─────────────────────────────
  const toggleSelectAll = useCallback(() => {
    const visibleIds = filteredDocuments.map((d) => d.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  }, [filteredDocuments, selectedIds]);

  // ── Clear selection ─────────────────────────────────────────────────
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  // ── Check if a document is selected ─────────────────────────────────
  const isDocSelected = useCallback(
    (docId: string) => selectedIds.has(docId),
    [selectedIds]
  );

  // ── Check if all visible are selected (for indeterminate) ────────────
  const allVisibleSelected = useMemo(
    () => filteredDocuments.length > 0 && filteredDocuments.every((d) => selectedIds.has(d.id)),
    [filteredDocuments, selectedIds]
  );
  const someVisibleSelected = useMemo(
    () => filteredDocuments.some((d) => selectedIds.has(d.id)),
    [filteredDocuments, selectedIds]
  );

  // ── Handle bulk delete ───────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkDeleteProgress({ current: 0, total: ids.length, active: true });
    try {
      const res = await fetch(`/api/documents/bulk-delete?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        toast.success('Документы удалены', {
          description: `Успешно удалено ${ids.length} документов.`,
        });
        setDocuments(documents.filter((d) => !ids.includes(d.id)));
        setSelectedIds(new Set());
        setSelectMode(false);
        fetchData();
      } else {
        toast.error('Ошибка удаления', {
          description: 'Не удалось удалить выбранные документы.',
        });
      }
    } catch {
      toast.error('Ошибка соединения', {
        description: 'Не удалось подключиться к серверу.',
      });
    } finally {
      setBulkDeleteProgress({ current: 0, total: 0, active: false });
      setBulkDeleteOpen(false);
    }
  }, [token, selectedIds, documents, setDocuments, fetchData]);

  // ── Handle bulk status change ───────────────────────────────────────
  const handleBulkStatusChange = useCallback(async () => {
    if (!token || selectedIds.size === 0 || !bulkStatusValue) return;
    const ids = Array.from(selectedIds);
    setBulkStatusSubmitting(true);
    try {
      const res = await fetch(`/api/documents/bulk-status?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: bulkStatusValue }),
      });
      if (res.ok) {
        const statusLabel = STATUS_LABELS[bulkStatusValue] || bulkStatusValue;
        toast.success('Статус обновлён', {
          description: `Статус ${ids.length} документов изменён на «${statusLabel}».`,
        });
        setSelectedIds(new Set());
        setSelectMode(false);
        setBulkStatusOpen(false);
        setBulkStatusValue('');
        fetchData();
      } else {
        toast.error('Ошибка обновления', {
          description: 'Не удалось изменить статус документов.',
        });
      }
    } catch {
      toast.error('Ошибка соединения', {
        description: 'Не удалось подключиться к серверу.',
      });
    } finally {
      setBulkStatusSubmitting(false);
    }
  }, [token, selectedIds, bulkStatusValue, fetchData]);

  // ── Handle bulk move to folder ──────────────────────────────────────
  const handleBulkMove = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const targetFolder = bulkMoveFolderId === '__none__' ? null : bulkMoveFolderId;
    setBulkMoveSubmitting(true);
    try {
      const res = await fetch(`/api/documents/bulk-move?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, folderId: targetFolder }),
      });
      if (res.ok) {
        const folderName = targetFolder
          ? folders.find((f) => f.id === targetFolder)?.name || 'папке'
          : 'корневой каталог';
        toast.success('Документы перемещены', {
          description: `${ids.length} документов перемещены в ${folderName}.`,
        });
        setSelectedIds(new Set());
        setSelectMode(false);
        setBulkMoveOpen(false);
        setBulkMoveFolderId('');
        fetchData();
      } else {
        toast.error('Ошибка перемещения', {
          description: 'Не удалось переместить документы.',
        });
      }
    } catch {
      toast.error('Ошибка соединения', {
        description: 'Не удалось подключиться к серверу.',
      });
    } finally {
      setBulkMoveSubmitting(false);
    }
  }, [token, selectedIds, bulkMoveFolderId, folders, fetchData]);

  // ── Keyboard shortcut: Escape to clear selection ─────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (selectMode || selectedIds.size > 0)) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectMode, selectedIds.size, clearSelection]);

  // ── Sidebar content (shared between desktop & mobile) ───────────────
  const sidebarContent = useMemo(() => (
    <>
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 shrink-0">
          <FileText className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-base font-bold tracking-tight text-white truncate">
            DocFlow BPM
          </span>
          <span className="text-[11px] text-slate-400 truncate">
            Система управления
          </span>
        </div>
      </div>

      {/* ── Folder Search ── */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
            placeholder="Поиск папок..."
            className="pl-8 h-8 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 text-sm focus-visible:ring-emerald-600/50 focus-visible:border-emerald-600/50"
          />
        </div>
      </div>

      <Separator className="bg-slate-700/50" />

      {/* ── Folder Tree ── */}
      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="py-2">
          {/* All Documents */}
          <button
            onClick={() => {
              handleAllDocuments();
              setMobileSheetOpen(false);
            }}
            className={
              `w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
              ${!selectedFolderId
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`
            }
          >
            <Home className="h-4 w-4 shrink-0" />
            <span className="truncate">Все документы</span>
            <Badge
              variant="secondary"
              className="ml-auto text-[10px] px-1.5 py-0 bg-slate-700 text-slate-300 hover:bg-slate-700"
            >
              {documents.length}
            </Badge>
          </button>

          {rootFolders.length > 0 && (
            <div className="px-3 py-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Папки
              </span>
            </div>
          )}

          {/* ── Recursive Folder Rendering ── */}
          {rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              folder={folder}
              depth={0}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              getChildren={getChildren}
              countDocsInFolder={countDocsInFolder}
              onToggleExpand={toggleExpand}
              onSelectFolder={(id) => {
                handleFolderSelect(id);
                setMobileSheetOpen(false);
              }}
              onRename={(f) => {
                setRenameFolderId(f.id);
                setRenameFolderName(f.name);
                setRenameFolderColor(f.color || '#3b82f6');
                setRenameFolderOpen(true);
              }}
              onDelete={handleDeleteFolder}
              onNewSubfolder={(parentId) => {
                setNewFolderParentId(parentId);
                setNewFolderOpen(true);
              }}
              collapsed={false}
            />
          ))}
        </div>
      </ScrollArea>

      <Separator className="bg-slate-700/50" />

      {/* ── Sidebar Footer ── */}
      <div className="p-3 space-y-1">
        <Button
          variant="ghost"
          onClick={() => {
            setNewFolderParentId(null);
            setNewFolderOpen(true);
          }}
          className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-slate-800 h-9 text-sm"
        >
          <Plus className="h-4 w-4" />
          Новая папка
        </Button>

        <Button
          variant="ghost"
          onClick={() => {
            navigate({ page: 'profile' });
            setMobileSheetOpen(false);
          }}
          className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-slate-800 h-9 text-sm"
        >
          <User className="h-4 w-4 shrink-0" />
          Мой профиль
        </Button>

        {user?.role === 'ADMIN' && (
          <Button
            variant="ghost"
            onClick={() => {
              navigate({ page: 'admin' });
              setMobileSheetOpen(false);
            }}
            className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-slate-800 h-9 text-sm"
          >
            <Settings className="h-4 w-4 shrink-0" />
            Настройки
          </Button>
        )}
      </div>
    </>
  ), [
    folderSearch, selectedFolderId, documents, rootFolders, expandedFolders,
    getChildren, countDocsInFolder, handleAllDocuments, handleFolderSelect,
    toggleExpand, handleDeleteFolder, user?.role, navigate, setNewFolderOpen,
    setNewFolderParentId, setMobileSheetOpen,
  ]);

  // ══════════════════════════════════════════════════════════════════
  // ── RENDER ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-muted/40 animate-fade-in">
      {/* ════════ SIDEBAR (Desktop) ════════ */}
      <aside
        className={`
          ${sidebarCollapsed ? 'w-0 lg:w-16' : 'w-72'}
          hidden md:flex flex-col bg-slate-900 text-slate-100 border-r border-slate-700/50
          transition-all duration-300 ease-in-out overflow-hidden shrink-0 no-print
        `}
      >
        {!sidebarCollapsed && sidebarContent}
        {sidebarCollapsed && (
          <div className="flex items-center justify-center py-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        )}
      </aside>

      {/* ════════ MOBILE SIDEBAR (Sheet) ════════ */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-slate-900 border-slate-700/50">
          <div className="flex flex-col h-full">
            <SheetHeader className="sr-only">
              <SheetTitle>Навигация</SheetTitle>
              <SheetDescription>Меню навигации</SheetDescription>
            </SheetHeader>
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>

      {/* ════════ MAIN AREA ════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ════════ HEADER ════════ */}
        <header className="flex items-center h-14 px-4 bg-background border-b shrink-0 z-30 no-print">
          {/* Left: Hamburger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 md:hidden"
              onClick={() => setMobileSheetOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAllDocuments();
                    }}
                    className="text-sm"
                  >
                    <Home className="h-3.5 w-3.5 mr-1" />
                    Документы
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {folderPath.map((folder) => (
                  <React.Fragment key={folder.id}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {folder.id === selectedFolderId ? (
                        <BreadcrumbPage className="text-sm font-medium">
                          {folder.name}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedFolder(folder.id);
                          }}
                          className="text-sm"
                        >
                          {folder.name}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Mobile breadcrumb fallback */}
            <div className="sm:hidden text-sm font-medium truncate">
              {selectedFolderId
                ? folderPath.map((f) => f.name).join(' / ')
                : 'Все документы'}
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md mx-4 hidden lg:block">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Поиск документов..."
                className="pl-8 h-9 bg-muted border-border text-sm"
              />
            </div>
          </div>

          {/* Right: Notifications + User Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile search toggle */}
            <div className="lg:hidden">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Search className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Поиск документов</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-72">
                  <div className="px-2 py-1.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        placeholder="Поиск документов..."
                        className="pl-8 h-9 bg-muted border-border text-sm"
                        autoFocus
                      />
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Notification Panel */}
            <ActivityPanel />

            {/* Theme Toggle */}
            <ThemeToggle />

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 h-9 px-2 hover:bg-accent"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-emerald-600 text-white text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start text-left">
                    <span className="text-sm font-medium leading-tight">{user?.name}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      {user?.role ? ROLE_LABELS[user.role] : ''}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <Badge
                      variant="outline"
                      className="w-fit text-[10px] mt-0.5"
                    >
                      {user?.role ? ROLE_LABELS[user.role] : ''}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate({ page: 'profile' })}>
                    <User className="mr-2 h-4 w-4" />
                    Мой профиль
                  </DropdownMenuItem>
                  {user?.role === 'ADMIN' && (
                    <DropdownMenuItem onClick={() => navigate({ page: 'admin' })}>
                      <Settings className="mr-2 h-4 w-4" />
                      Настройки
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} variant="destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ════════ CONTENT AREA ════════ */}
        <main className="flex-1 overflow-auto animate-fade-in">
          {/* ── Toolbar ── */}
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-2.5 flex items-center gap-2 flex-wrap no-print">
            {/* New Document Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Новый документ</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Тип документа</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {activeDocTypes.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    Нет доступных типов
                  </div>
                ) : (
                  activeDocTypes.map((dt) => (
                    <DropdownMenuItem
                      key={dt.id}
                      onClick={() => handleNewDocument(dt.id)}
                      className="gap-2"
                    >
                      <span style={{ color: dt.color }}>{getDocTypeIcon(dt.systemName)}</span>
                      <span>{dt.name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={fetchData}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Обновить</TooltipContent>
            </Tooltip>

            {/* Select Mode Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={selectMode ? 'default' : 'outline'}
                  size="icon"
                  className={`h-9 w-9 ${selectMode ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                  onClick={toggleSelectMode}
                >
                  {selectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{selectMode ? 'Отменить выбор' : 'Выбрать документы'}</TooltipContent>
            </Tooltip>

            {selectMode && selectedIds.size > 0 && (
              <Badge variant="secondary" className="h-6 gap-1 px-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {selectedIds.size}
              </Badge>
            )}

            <Separator orientation="vertical" className="h-6" />

            {/* View Toggle */}
            <div className="flex items-center border rounded-md">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 rounded-r-none"
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Таблица</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 rounded-l-none"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Сетка</TooltipContent>
              </Tooltip>
            </div>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 text-sm">
                  <span className="hidden sm:inline">
                    {statusFilter === 'ALL'
                      ? 'Все статусы'
                      : STATUS_LABELS[statusFilter] || statusFilter}
                  </span>
                  <span className="sm:hidden">
                    {statusFilter === 'ALL' ? 'Статус' : STATUS_LABELS[statusFilter] || ''}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={() => setStatusFilter('ALL')}>
                  Все статусы
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className="gap-2"
                  >
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        key === 'DRAFT'
                          ? 'bg-slate-400'
                          : key === 'IN_PROGRESS'
                          ? 'bg-sky-500'
                          : key === 'APPROVED'
                          ? 'bg-emerald-500'
                          : key === 'REJECTED'
                          ? 'bg-rose-500'
                          : 'bg-violet-500'
                      }`}
                    />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 text-sm">
                  Сортировка
                  <span className="text-muted-foreground text-xs">
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Сортировать по</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleSort('updatedAt')}>
                  Дата обновления {sortField === 'updatedAt' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort('createdAt')}>
                  Дата создания {sortField === 'createdAt' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort('title')}>
                  Название {sortField === 'title' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort('status')}>
                  Статус {sortField === 'status' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 text-sm">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Экспорт</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Экспорт документов</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      const ids = filteredDocuments.map((d) => d.id);
                      const res = await fetch('/api/documents/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', token: token || '' },
                        body: JSON.stringify({ ids, format: 'json' }),
                      });
                      if (!res.ok) throw new Error('Export failed');
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `documents_${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Экспорт JSON завершён');
                    } catch { toast.error('Ошибка экспорта'); }
                  }}
                  disabled={filteredDocuments.length === 0}
                  className="gap-2"
                >
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                  Экспорт JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      const ids = filteredDocuments.map((d) => d.id);
                      const res = await fetch('/api/documents/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', token: token || '' },
                        body: JSON.stringify({ ids, format: 'csv' }),
                      });
                      if (!res.ok) throw new Error('Export failed');
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `documents_${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Экспорт CSV завершён');
                    } catch { toast.error('Ошибка экспорта'); }
                  }}
                  disabled={filteredDocuments.length === 0}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  Экспорт CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => window.print()}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4 text-muted-foreground" />
                  Печать списка
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Document count */}
            <div className="ml-auto text-sm text-muted-foreground">
              {filteredDocuments.length}{' '}
              {filteredDocuments.length === 1
                ? 'документ'
                : filteredDocuments.length >= 2 && filteredDocuments.length <= 4
                ? 'документа'
                : 'документов'}
            </div>
          </div>

          {/* ── Welcome Banner ── */}
          {!isLoading && (
            <div className="px-4 pt-4 pb-0">
              <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/20 dark:border-emerald-800/40 p-4 md:p-5 flex items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-200/30 to-transparent rounded-bl-full" />
                <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0 shadow-sm">
                  <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 relative">
                  <h2 className="text-base md:text-lg font-semibold text-foreground">
                    Добро пожаловать, {userFirstName}!
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    У вас {documents.length}{' '}
                    {documents.length === 1
                      ? 'документ'
                      : documents.length >= 2 && documents.length <= 4
                      ? 'документа'
                      : 'документов'} в системе
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Quick Actions ── */}
          {!isLoading && (
            <div className="px-4 pt-3 pb-0">
              <div className="flex flex-wrap gap-3">
                {invoiceTypeId && (
                  <button
                    onClick={() => handleNewDocument(invoiceTypeId)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-card border border-border rounded-lg hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                      <FileSpreadsheet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Создать счёт
                    </span>
                  </button>
                )}
                {contractTypeId && (
                  <button
                    onClick={() => handleNewDocument(contractTypeId)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-card border border-border rounded-lg hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30">
                      <File className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Создать договор
                    </span>
                  </button>
                )}
                {memoTypeId && (
                  <button
                    onClick={() => handleNewDocument(memoTypeId)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-card border border-border rounded-lg hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30">
                      <ScrollText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Создать записку
                    </span>
                  </button>
                )}
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => navigate({ page: 'admin' })}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-card border border-border rounded-lg hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Настройки
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Analytics Panel ── */}
          <DashboardAnalytics />

          {/* ── Document Content ── */}
          <div className="p-4">
            {isLoading ? (
              <LoadingSkeleton />
            ) : viewMode === 'table' ? (
              <DocumentTable
                documents={filteredDocuments}
                onDocClick={handleDocClick}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onDeleteDoc={(id, title) => {
                  setDeleteDocId(id);
                  setDeleteDocTitle(title);
                }}
                onDuplicateDoc={handleDuplicateDoc}
                duplicatingDocId={duplicatingDocId}
                selectMode={selectMode}
                selectedIds={selectedIds}
                allVisibleSelected={allVisibleSelected}
                someVisibleSelected={someVisibleSelected}
                onToggleSelectAll={toggleSelectAll}
                onToggleDocSelection={toggleDocSelection}
              />
            ) : (
              <DocumentGrid
                documents={filteredDocuments}
                onDocClick={handleDocClick}
                onDuplicateDoc={handleDuplicateDoc}
                duplicatingDocId={duplicatingDocId}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleDocSelection={toggleDocSelection}
              />
            )}

            {/* ── Floating Selection Bar ── */}
            {selectMode && selectedIds.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom-2 duration-200">
                <div className="mx-auto max-w-3xl px-4 pb-4">
                  <div className="bg-card border border-t shadow-lg rounded-t-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          {selectedIds.size}
                        </span>
                      </div>
                      <span className="text-foreground">
                        {selectedIds.size === 1
                          ? 'документ выбран'
                          : selectedIds.size < 5
                          ? 'документа выбрано'
                          : 'документов выбрано'}
                      </span>
                    </div>

                    <div className="h-5 w-px bg-border" />

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={() => setBulkDeleteOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Удалить</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-foreground hover:bg-accent"
                        onClick={() => {
                          setBulkStatusValue('');
                          setBulkStatusOpen(true);
                        }}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Статус</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-foreground hover:bg-accent"
                        onClick={() => {
                          setBulkMoveFolderId('');
                          setBulkMoveOpen(true);
                        }}
                      >
                        <FolderInput className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Переместить</span>
                      </Button>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-muted-foreground cursor-not-allowed opacity-60"
                        disabled
                        onClick={() => {
                          toast.info('Экспорт будет доступен в следующей версии');
                        }}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Экспорт</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Экспорт будет доступен в следующей версии</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={clearSelection}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ════════ STATUS BAR ════════ */}
        <footer className="flex items-center justify-between h-7 px-4 bg-background border-t text-[11px] text-muted-foreground shrink-0 no-print">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              DocFlow BPM v1.1
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span>
              {selectedFolderId
                ? `Папка: ${folderPath.map((f) => f.name).join(' / ')}`
                : 'Все документы'}
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span>
              {filteredDocuments.length} из {documents.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>&copy; {new Date().getFullYear()}</span>
            <Separator orientation="vertical" className="h-3" />
            <span>{user?.name}</span>
            <Separator orientation="vertical" className="h-3" />
            <span>{new Date().toLocaleTimeString('ru-RU')}</span>
          </div>
        </footer>
      </div>

      {/* ════════ NEW FOLDER DIALOG ════════ */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Создать папку</DialogTitle>
            <DialogDescription>
              {newFolderParentId
                ? `Создать новую подпапку в «${folders.find((f) => f.id === newFolderParentId)?.name}»`
                : 'Создать новую папку в корне'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Название папки</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Название папки"
                className="h-10"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Цвет
              </label>
              <ColorPicker value={newFolderColor} onChange={setNewFolderColor} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewFolderOpen(false);
                setNewFolderName('');
                setNewFolderParentId(null);
                setNewFolderColor('#3b82f6');
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || newFolderSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-transform"
            >
              {newFolderSubmitting ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ RENAME FOLDER DIALOG ════════ */}
      <Dialog open={renameFolderOpen} onOpenChange={setRenameFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Переименовать папку</DialogTitle>
            <DialogDescription>Введите новое название для папки</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Название папки</label>
              <Input
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
                placeholder="Название папки"
                className="h-10"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameFolder();
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Цвет
              </label>
              <ColorPicker value={renameFolderColor} onChange={setRenameFolderColor} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameFolderOpen(false);
                setRenameFolderId(null);
                setRenameFolderName('');
                setRenameFolderColor('#3b82f6');
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleRenameFolder}
              disabled={!renameFolderName.trim() || renameSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-transform"
            >
              {renameSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ DELETE DOCUMENT CONFIRMATION ════════ */}
      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => { if (!open) setDeleteDocId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить документ «<span className="font-medium">{deleteDocTitle}</span>»?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDocSubmitting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocId && handleDeleteDocument(deleteDocId)}
              disabled={deleteDocSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white active:scale-[0.98] transition-transform"
            >
              {deleteDocSubmitting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════ BULK DELETE DIALOG ════════ */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить документы?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить <span className="font-medium">{selectedIds.size} документов</span>?
              Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          {bulkDeleteProgress.active && (
            <div className="py-2 space-y-2">
              <Progress value={(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Удаление {bulkDeleteProgress.current} из {bulkDeleteProgress.total}...
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleteProgress.active}>
              Отмена
            </Button>
            <Button
              onClick={handleBulkDelete}
              disabled={bulkDeleteProgress.active}
              className="bg-rose-600 hover:bg-rose-700 text-white active:scale-[0.98] transition-transform"
            >
              {bulkDeleteProgress.active ? 'Удаление...' : `Удалить (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ BULK STATUS DIALOG ════════ */}
      <Dialog open={bulkStatusOpen} onOpenChange={(open) => { if (!open) { setBulkStatusOpen(false); setBulkStatusValue(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить статус</DialogTitle>
            <DialogDescription>
              Выберите новый статус для <span className="font-medium">{selectedIds.size} документов</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setBulkStatusOpen(false); setBulkStatusValue(''); }}
              disabled={bulkStatusSubmitting}
            >
              Отмена
            </Button>
            <Button
              onClick={handleBulkStatusChange}
              disabled={!bulkStatusValue || bulkStatusSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkStatusSubmitting ? 'Применение...' : 'Применить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ BULK MOVE DIALOG ════════ */}
      <Dialog open={bulkMoveOpen} onOpenChange={(open) => { if (!open) { setBulkMoveOpen(false); setBulkMoveFolderId(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Переместить в папку</DialogTitle>
            <DialogDescription>
              Выберите папку для перемещения <span className="font-medium">{selectedIds.size} документов</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={bulkMoveFolderId} onValueChange={setBulkMoveFolderId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите папку" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">Без папки (удалить привязку)</span>
                </SelectItem>
                <SelectSeparator />
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setBulkMoveOpen(false); setBulkMoveFolderId(''); }}
              disabled={bulkMoveSubmitting}
            >
              Отмена
            </Button>
            <Button
              onClick={handleBulkMove}
              disabled={!bulkMoveFolderId || bulkMoveSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkMoveSubmitting ? 'Перемещение...' : 'Переместить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ NEW DOCUMENT DIALOG ════════ */}
      <Dialog open={newDocDialogOpen} onOpenChange={setNewDocDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый документ</DialogTitle>
            <DialogDescription>
              Укажите название и папку для нового документа.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Название документа</label>
              <Input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Название документа"
                className="h-10"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmNewDocument();
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Папка</label>
              <Select value={newDocFolderId} onValueChange={setNewDocFolderId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите папку" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <span className="text-muted-foreground">Без папки</span>
                  </SelectItem>
                  <SelectSeparator />
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: folder.color || '#64748b' }}
                        />
                        {folder.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewDocDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleConfirmNewDocument}
              disabled={!newDocTitle.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-transform"
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ── FOLDER TREE NODE ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
interface FolderTreeNodeProps {
  folder: Folder;
  depth: number;
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  getChildren: (parentId: string) => Folder[];
  countDocsInFolder: (folderId: string) => number;
  onToggleExpand: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (id: string) => void;
  onNewSubfolder: (parentId: string) => void;
  collapsed?: boolean;
}

function FolderTreeNode({
  folder,
  depth,
  selectedFolderId,
  expandedFolders,
  getChildren,
  countDocsInFolder,
  onToggleExpand,
  onSelectFolder,
  onRename,
  onDelete,
  onNewSubfolder,
}: FolderTreeNodeProps) {
  const children = getChildren(folder.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const docCount = countDocsInFolder(folder.id);
  const folderColorClass = getFolderColor(folder.color);
  const folderInlineColor = folderColorClass ? undefined : folder.color || '#64748b';

  return (
    <div>
      <div
        className={`
          group flex items-center gap-1.5 pr-2 text-sm transition-colors cursor-pointer
          ${isSelected
            ? 'bg-slate-800 text-white'
            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }
        `}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {/* Expand/Collapse arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(folder.id);
          }}
          className="flex items-center justify-center w-4 h-4 shrink-0"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </button>

        {/* Folder icon */}
        <button
          onClick={() => onSelectFolder(folder.id)}
          className="flex items-center gap-1.5 flex-1 min-w-0 py-1.5"
        >
          {isExpanded || isSelected ? (
            <FolderOpen className={`h-4 w-4 shrink-0 ${folderColorClass}`} style={folderInlineColor ? { color: folderInlineColor } : undefined} />
          ) : (
            <Folder className={`h-4 w-4 shrink-0 ${folderColorClass}`} style={folderInlineColor ? { color: folderInlineColor } : undefined} />
          )}
          <span className="truncate">{folder.name}</span>
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: folder.color || '#64748b' }}
          />
          {docCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-auto text-[10px] px-1.5 py-0 bg-slate-700 text-slate-400 hover:bg-slate-700 shrink-0"
            >
              {docCount}
            </Badge>
          )}
        </button>

        {/* Context menu trigger */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-500 hover:text-white hover:bg-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onNewSubfolder(folder.id)}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Подпапка
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(folder)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Переименовать
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(folder.id)} variant="destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="folder-tree-enter">
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              getChildren={getChildren}
              countDocsInFolder={countDocsInFolder}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
              onRename={onRename}
              onDelete={onDelete}
              onNewSubfolder={onNewSubfolder}
              collapsed={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ── DOCUMENT TABLE ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
interface DocumentTableProps {
  documents: Document[];
  onDocClick: (id: string) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  onDeleteDoc: (id: string, title: string) => void;
  onDuplicateDoc: (id: string) => void;
  duplicatingDocId: string | null;
  selectMode: boolean;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleDocSelection: (id: string) => void;
}

function DocumentTable({
  documents, onDocClick, sortField, sortDir, onSort, onDeleteDoc,
  onDuplicateDoc, duplicatingDocId,
  selectMode, selectedIds, allVisibleSelected, someVisibleSelected,
  onToggleSelectAll, onToggleDocSelection,
}: DocumentTableProps) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronRight className="h-3 w-3 ml-1 opacity-30" />;
    return (
      <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
    );
  };

  if (documents.length === 0) {
    return <EmptyState isSearch />;
  }

  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden custom-scrollbar max-h-96 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60">
            {selectMode && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={onToggleSelectAll}
                  className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 data-[state=indeterminate]:bg-emerald-600 data-[state=indeterminate]:border-emerald-600"
                />
              </TableHead>
            )}
            <TableHead
              className="w-40 cursor-pointer select-none hover:bg-muted transition-colors"
              onClick={() => onSort('title')}
            >
              <div className="flex items-center">
                Тип
                <SortIcon field="title" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer select-none hover:bg-muted transition-colors"
              onClick={() => onSort('title')}
            >
              <div className="flex items-center">
                Название
                <SortIcon field="title" />
              </div>
            </TableHead>
            <TableHead className="w-32 hidden md:table-cell">Номер</TableHead>
            <TableHead
              className="w-36 cursor-pointer select-none hover:bg-muted transition-colors"
              onClick={() => onSort('status')}
            >
              <div className="flex items-center">
                Статус
                <SortIcon field="status" />
              </div>
            </TableHead>
            <TableHead className="w-40 hidden lg:table-cell">Автор</TableHead>
            <TableHead
              className="w-32 hidden xl:table-cell cursor-pointer select-none hover:bg-muted transition-colors"
              onClick={() => onSort('createdAt')}
            >
              <div className="flex items-center">
                Дата создания
                <SortIcon field="createdAt" />
              </div>
            </TableHead>
            <TableHead
              className="w-32 hidden xl:table-cell cursor-pointer select-none hover:bg-muted transition-colors"
              onClick={() => onSort('updatedAt')}
            >
              <div className="flex items-center">
                Обновлён
                <SortIcon field="updatedAt" />
              </div>
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow
              key={doc.id}
              className={`cursor-pointer group transition-colors hover:bg-muted/50 even:bg-muted/20 ${selectMode && selectedIds.has(doc.id) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}
              onClick={() => onDocClick(doc.id)}
            >
              {selectMode && (
                <TableCell>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(doc.id)}
                      onCheckedChange={() => onToggleDocSelection(doc.id)}
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                  </div>
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-2">
                  <span style={{ color: doc.type?.color || '#64748b' }}>
                    {getDocTypeIcon(doc.type?.systemName || '')}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {doc.type?.name || '—'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-medium text-sm group-hover:text-emerald-700 transition-colors truncate block max-w-xs">
                  {doc.title}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-sm text-muted-foreground font-mono">
                  {doc.number || '—'}
                </span>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-medium ${STATUS_COLORS[doc.status] || ''}`}
                >
                  {STATUS_LABELS[doc.status] || doc.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                      {doc.creator?.name
                        ?.split(' ')
                        .map((w) => w[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground truncate">
                    {doc.creator?.name || '—'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <span className="text-sm text-muted-foreground">
                  {formatDate(doc.createdAt)}
                </span>
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(doc.updatedAt)}
                </span>
              </TableCell>
              <TableCell>
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => onDocClick(doc.id)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Редактировать
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDuplicateDoc(doc.id)}
                        disabled={duplicatingDocId === doc.id}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Дублировать
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteDoc(doc.id, doc.title)}
                        variant="destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ── DOCUMENT GRID ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
interface DocumentGridProps {
  documents: Document[];
  onDocClick: (id: string) => void;
  onDuplicateDoc: (id: string) => void;
  duplicatingDocId: string | null;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleDocSelection: (id: string) => void;
}

function DocumentGrid({
  documents, onDocClick, onDuplicateDoc, duplicatingDocId, selectMode, selectedIds, onToggleDocSelection,
}: DocumentGridProps) {
  if (documents.length === 0) {
    return <EmptyState isSearch />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {documents.map((doc) => {
        const docColor = doc.type?.color || '#64748b';
        const creatorInitials = doc.creator?.name
          ?.split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || '?';

        return (
          <div
            key={doc.id}
            onClick={() => onDocClick(doc.id)}
            className={`group card-shine bg-card rounded-xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden relative ${selectMode && selectedIds.has(doc.id) ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
            style={{ borderTopColor: docColor }}
          >
            {/* Selection Checkbox */}
            {selectMode && (
              <div
                className="absolute top-2.5 right-2.5 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedIds.has(doc.id)}
                  onCheckedChange={() => onToggleDocSelection(doc.id)}
                  className="bg-background/80 backdrop-blur-sm data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
              </div>
            )}

            {/* More menu */}
            <div
              className="absolute top-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onDocClick(doc.id)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Редактировать
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDuplicateDoc(doc.id)}
                    disabled={duplicatingDocId === doc.id}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Дублировать
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Top gradient stripe */}
            <div
              className="h-[2px] w-full"
              style={{ background: `linear-gradient(90deg, ${docColor}, ${docColor}88)` }}
            />

            <div className="p-4">
              {/* Top row: type icon + status badge */}
              <div className="flex items-center justify-between mb-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                  style={{
                    backgroundColor: `${docColor}15`,
                    color: docColor,
                  }}
                >
                  {getDocTypeIcon(doc.type?.systemName || '')}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium ${STATUS_COLORS[doc.status] || ''}`}
                >
                  {STATUS_LABELS[doc.status] || doc.status}
                </Badge>
              </div>

              {/* Title + number */}
              <h3 className="text-sm font-semibold truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                {doc.title}
              </h3>
              {doc.number && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{doc.number}</p>
              )}

              {/* Type name */}
              {doc.type?.name && (
                <p className="text-xs text-muted-foreground mt-1.5">{doc.type.name}</p>
              )}

              {/* Bottom row: author + updated time */}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                      {creatorInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">
                    {doc.creator?.name || '—'}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                  {formatRelativeTime(doc.updatedAt)}
                </span>
              </div>

            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ── EMPTY STATE ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
function EmptyState({ isSearch = false }: { isSearch?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative mb-6">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/60">
          {isSearch ? (
            <Search className="h-10 w-10 text-muted-foreground/60" />
          ) : (
            <Inbox className="h-10 w-10 text-muted-foreground/60" />
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
          <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {isSearch ? 'Ничего не найдено' : 'Документы не найдены'}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        {isSearch
          ? 'Попробуйте изменить поисковый запрос или фильтр для поиска документов.'
          : 'В этой папке пока нет документов. Создайте новый документ, нажав кнопку «Новый документ» в панели инструментов.'}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ── LOADING SKELETON ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
function LoadingSkeleton() {
  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden custom-scrollbar max-h-96 overflow-y-auto">
      {/* Toolbar skeleton */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32 hidden lg:block" />
          <Skeleton className="h-4 w-24 hidden xl:block" />
          <Skeleton className="h-4 w-24 hidden xl:block" />
        </div>

        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 py-3 border-b last:border-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1 max-w-xs" />
            <Skeleton className="h-4 w-16 hidden md:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-28 hidden lg:block" />
            <Skeleton className="h-4 w-20 hidden xl:block" />
            <Skeleton className="h-4 w-24 hidden xl:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
