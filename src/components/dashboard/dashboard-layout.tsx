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

// ─── Helper: get folder icon color ───────────────────────────────────
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
  return map[color] || 'text-slate-400';
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
  const [newFolderSubmitting, setNewFolderSubmitting] = useState(false);

  // ── Rename Dialog ───────────────────────────────────────────────────
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renameSubmitting, setRenameSubmitting] = useState(false);

  // ── Mobile Sidebar Sheet ────────────────────────────────────────────
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // ── Delete Document Dialog ──────────────────────────────────────────
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteDocTitle, setDeleteDocTitle] = useState('');
  const [deleteDocSubmitting, setDeleteDocSubmitting] = useState(false);

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

  // ── Handle new document creation ───────────────────────────────────
  const handleNewDocument = useCallback(
    (typeId: string) => {
      navigate({ page: 'new-document', typeId, folderId: selectedFolderId || undefined });
    },
    [navigate, selectedFolderId]
  );

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
        }),
      });
      if (res.ok) {
        setNewFolderOpen(false);
        setNewFolderName('');
        setNewFolderParentId(null);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create folder:', err);
    } finally {
      setNewFolderSubmitting(false);
    }
  }, [newFolderName, newFolderParentId, token, fetchData]);

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
        }),
      });
      if (res.ok) {
        setRenameFolderOpen(false);
        setRenameFolderId(null);
        setRenameFolderName('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to rename folder:', err);
    } finally {
      setRenameSubmitting(false);
    }
  }, [renameFolderId, renameFolderName, token, fetchData]);

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
      <ScrollArea className="flex-1">
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
    toggleExpand, handleDeleteFolder, user?.role, navigate,
  ]);

  // ══════════════════════════════════════════════════════════════════
  // ── RENDER ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* ════════ SIDEBAR (Desktop) ════════ */}
      <aside
        className={`
          ${sidebarCollapsed ? 'w-0 lg:w-16' : 'w-72'}
          hidden md:flex flex-col bg-slate-900 text-slate-100 border-r border-slate-700/50
          transition-all duration-300 ease-in-out overflow-hidden shrink-0
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
        <header className="flex items-center h-14 px-4 bg-white border-b shrink-0 z-30">
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
                className="pl-8 h-9 bg-gray-50 border-gray-200 text-sm"
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
                        className="pl-8 h-9 bg-gray-50 border-gray-200 text-sm"
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
                  className="flex items-center gap-2 h-9 px-2 hover:bg-gray-100"
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
        <main className="flex-1 overflow-auto">
          {/* ── Toolbar ── */}
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-2.5 flex items-center gap-2 flex-wrap">
            {/* New Document Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
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
              <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 dark:border-emerald-800/40 p-4 md:p-5 flex items-center gap-4">
                <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
                  <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Добро пожаловать, {userFirstName}!
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
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
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm hover:border-emerald-200 dark:hover:border-emerald-800 transition-all group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                      <FileSpreadsheet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Создать счёт
                    </span>
                  </button>
                )}
                {contractTypeId && (
                  <button
                    onClick={() => handleNewDocument(contractTypeId)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm hover:border-emerald-200 dark:hover:border-emerald-800 transition-all group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30">
                      <File className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Создать договор
                    </span>
                  </button>
                )}
                {memoTypeId && (
                  <button
                    onClick={() => handleNewDocument(memoTypeId)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm hover:border-emerald-200 dark:hover:border-emerald-800 transition-all group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30">
                      <ScrollText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Создать записку
                    </span>
                  </button>
                )}
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => navigate({ page: 'admin' })}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-sm hover:border-emerald-200 dark:hover:border-emerald-800 transition-all group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <ClipboardList className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Настройки
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

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
              />
            ) : (
              <DocumentGrid documents={filteredDocuments} onDocClick={handleDocClick} />
            )}
          </div>
        </main>

        {/* ════════ STATUS BAR ════════ */}
        <footer className="flex items-center justify-between h-7 px-4 bg-white border-t text-[11px] text-muted-foreground shrink-0">
          <div className="flex items-center gap-3">
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
          <div className="py-2">
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewFolderOpen(false);
                setNewFolderName('');
                setNewFolderParentId(null);
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || newFolderSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
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
          <div className="py-2">
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameFolderOpen(false);
                setRenameFolderId(null);
                setRenameFolderName('');
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleRenameFolder}
              disabled={!renameFolderName.trim() || renameSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
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
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteDocSubmitting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const docCount = folder._count?.documents ?? countDocsInFolder(folder.id);

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
            <FolderOpen className={`h-4 w-4 shrink-0 ${getFolderColor(folder.color)}`} />
          ) : (
            <Folder className={`h-4 w-4 shrink-0 ${getFolderColor(folder.color)}`} />
          )}
          <span className="truncate">{folder.name}</span>
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
        <div>
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
}

function DocumentTable({ documents, onDocClick, sortField, sortDir, onSort, onDeleteDoc }: DocumentTableProps) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronRight className="h-3 w-3 ml-1 opacity-30" />;
    return (
      <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
    );
  };

  if (documents.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80">
            <TableHead
              className="w-40 cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => onSort('title')}
            >
              <div className="flex items-center">
                Тип
                <SortIcon field="title" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => onSort('title')}
            >
              <div className="flex items-center">
                Название
                <SortIcon field="title" />
              </div>
            </TableHead>
            <TableHead className="w-32 hidden md:table-cell">Номер</TableHead>
            <TableHead
              className="w-36 cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => onSort('status')}
            >
              <div className="flex items-center">
                Статус
                <SortIcon field="status" />
              </div>
            </TableHead>
            <TableHead className="w-40 hidden lg:table-cell">Автор</TableHead>
            <TableHead
              className="w-32 hidden xl:table-cell cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => onSort('createdAt')}
            >
              <div className="flex items-center">
                Дата создания
                <SortIcon field="createdAt" />
              </div>
            </TableHead>
            <TableHead
              className="w-32 hidden xl:table-cell cursor-pointer select-none hover:bg-gray-100 transition-colors"
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
              className="cursor-pointer group"
              onClick={() => onDocClick(doc.id)}
            >
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
                    <AvatarFallback className="bg-gray-100 text-[10px] text-gray-600">
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
}

function DocumentGrid({ documents, onDocClick }: DocumentGridProps) {
  if (documents.length === 0) {
    return <EmptyState />;
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
            className="group bg-white dark:bg-gray-900 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
            style={{ borderTopColor: docColor }}
          >
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
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-600 dark:text-gray-400">
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
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-6">
        <Inbox className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">Документы не найдены</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm">
        В этой папке пока нет документов. Создайте новый документ, нажав кнопку «Новый
        документ».
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ── LOADING SKELETON ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
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
