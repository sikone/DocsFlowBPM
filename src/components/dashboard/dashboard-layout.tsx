'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent, DragEndEvent, closestCenter, useDraggable } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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

import NotificationCenter from '@/components/notification-center';
import DashboardAnalytics from '@/components/dashboard/dashboard-analytics';
import StatsSummaryBar from '@/components/dashboard/stats-summary-bar';
import KeyboardShortcutsDialog from '@/components/keyboard-shortcuts-dialog';
import FavoritesPanel from '@/components/documents/favorites-panel';
import RecentDocuments from '@/components/documents/recent-documents';
import WelcomeBanner from '@/components/dashboard/welcome-banner';
import {
  FileText,
  FolderOpen,
  Folder as FolderIcon,
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
  Check,
  CheckSquare,
  Square,
  Minus,
  FileDown,
  FolderInput,
  X,
  ArrowRightLeft,
  Copy,
  Palette,
  Database,
  Zap,
  Loader2,
  Star,
  GripVertical,
  Filter,
  Calendar,
  Tag,
  Archive,
  BarChart3,
  AlertTriangle,
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

// ─── Draggable Doc Grip Handle ──────────────────────────────────────
function DraggableGrip({ docId }: { docId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: docId });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center justify-center w-6 h-6 shrink-0 cursor-grab active:cursor-grabbing transition-opacity duration-150 ${isDragging ? 'opacity-0' : 'opacity-0 group-hover:opacity-50 hover:!opacity-100'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// ─── Droppable Folder Wrapper ────────────────────────────────────────
function DroppableFolder({ folderId, children, isDragging }: { folderId: string; children: React.ReactNode; isDragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: folderId });
  return (
    <div ref={setNodeRef} className={`rounded-md transition-all duration-200 ${isOver && isDragging ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900 bg-emerald-500/10' : ''}`}>
      {children}
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

  // ── Quick Status Change ────────────────────────────────────────────
  const [statusChangingDocId, setStatusChangingDocId] = useState<string | null>(null);

  // ── Favorites State ────────────────────────────────────────────────
  const [favoriteDocIds, setFavoriteDocIds] = useState<Set<string>>(new Set());

  // ── Advanced Filters ───────────────────────────────────────────────
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [filterDateRange, setFilterDateRange] = useState<string>('all');
  const [filterCreatorId, setFilterCreatorId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color: string }>>([]);

  // ── Pagination ─────────────────────────────────────────────────────
  const [docsPage, setDocsPage] = useState(1);
  const [docsTotal, setDocsTotal] = useState(0);
  const PAGE_SIZE = 50;
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string }>>([]);

  // ── Server Search ──────────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState<'local' | 'server'>('local');
  const [serverSearchResults, setServerSearchResults] = useState<Document[]>([]);
  const [serverSearching, setServerSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Templates ──────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    typeId: string;
    data: string;
    icon: string;
    color: string;
    type?: { id: string; name: string; systemName: string };
  }>>([]);

  // ── Flatten nested folder tree into a flat array ──────────────────
  const flattenFolders = useCallback((nodes: Folder[]): Folder[] => {
    const result: Folder[] = [];
    const traverse = (list: Folder[]) => {
      for (const node of list) {
        result.push(node);
        if (node.children?.length) traverse(node.children);
      }
    };
    traverse(nodes);
    return result;
  }, []);

  // ── Build API params for document list ─────────────────────────────
  const buildDocsParams = useCallback((page: number, overrideFolderId?: string | null) => {
    const params = new URLSearchParams({ token: token || '', page: String(page), limit: String(PAGE_SIZE), sortField, sortDir });
    const fid = overrideFolderId !== undefined ? overrideFolderId : selectedFolderId;
    // Inbox folder (isSystem, order=0) means "all documents" — don't pass folderId
    const inboxFolder = folders.find((f) => f.isSystem && f.order === 0);
    if (fid && fid !== inboxFolder?.id) params.set('folderId', fid);
    const effectiveStatus = filterStatus !== 'ALL' ? filterStatus : statusFilter !== 'ALL' ? statusFilter : null;
    if (effectiveStatus) params.set('status', effectiveStatus);
    if (filterCreatorId !== 'all') params.set('creatorId', filterCreatorId);
    if (filterTags.size > 0) params.set('tagIds', Array.from(filterTags).join(','));
    if (filterDateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let startDate: Date;
      switch (filterDateRange) {
        case 'today': startDate = today; break;
        case 'week': { const dow = today.getDay() || 7; startDate = new Date(today); startDate.setDate(today.getDate() - dow + 1); break; }
        case 'month': startDate = new Date(today.getFullYear(), today.getMonth(), 1); break;
        case 'year': startDate = new Date(today.getFullYear(), 0, 1); break;
        default: startDate = new Date(0);
      }
      params.set('dateFrom', startDate.toISOString());
    }
    return params;
  }, [token, folders, selectedFolderId, filterStatus, statusFilter, filterCreatorId, filterTags, filterDateRange, sortField, sortDir, PAGE_SIZE]);

  // ── Fetch only documents (paginated) ──────────────────────────────
  const fetchDocs = useCallback(async (page: number, overrideFolderId?: string | null) => {
    if (!token) return;
    setRefreshing(true);
    try {
      const params = buildDocsParams(page, overrideFolderId);
      const res = await fetch(`/api/documents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setDocsTotal(data.total ?? 0);
        setDocsPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setRefreshing(false);
    }
  }, [token, buildDocsParams, setDocuments]);

  // ── Fetch data on mount ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const [foldersRes, typesRes] = await Promise.all([
        fetch(`/api/folders?token=${token}`),
        fetch(`/api/document-types?token=${token}`),
      ]);

      let inboxId: string | null = null;
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        const tree: Folder[] = Array.isArray(foldersData) ? foldersData : foldersData.folders || [];
        const flat = flattenFolders(tree);
        setFolders(flat);
        // Auto-select inbox on first load
        if (!selectedFolderId) {
          const inbox = flat.find((f) => f.isSystem && f.order === 0);
          if (inbox) { setSelectedFolder(inbox.id); inboxId = inbox.id; }
        }
      }
      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setDocumentTypes(Array.isArray(typesData) ? typesData : typesData.types || []);
      }

      // Fetch first page of documents with current (or newly set inbox) folder
      const params = buildDocsParams(1, inboxId ?? selectedFolderId);
      const docsRes = await fetch(`/api/documents?${params}`);
      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data.documents || []);
        setDocsTotal(data.total ?? 0);
        setDocsPage(1);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, setFolders, setDocuments, setDocumentTypes, setLoading, flattenFolders, selectedFolderId, setSelectedFolder, buildDocsParams]);

  // ── Re-fetch page 1 when filters or folder change ─────────────────
  const filtersKey = [
    selectedFolderId, filterStatus, statusFilter, filterCreatorId,
    [...filterTags].sort().join(','), filterDateRange, sortField, sortDir,
  ].join('|');
  const prevFiltersKeyRef = useRef('');
  useEffect(() => {
    if (!token) return;
    if (prevFiltersKeyRef.current === '') { prevFiltersKeyRef.current = filtersKey; return; }
    if (prevFiltersKeyRef.current === filtersKey) return;
    prevFiltersKeyRef.current = filtersKey;
    fetchDocs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, token]);

  // ── Drag & Drop State ───────────────────────────────────────────────
  const [activeDragDoc, setActiveDragDoc] = useState<Document | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const docId = event.active.id as string;
    const doc = documents.find((d) => d.id === docId) || null;
    setActiveDragDoc(doc);
  }, [documents]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragDoc(null);

    if (!over || !token) return;
    const docId = active.id as string;
    const targetFolderId = over.id as string;

    // Don't move if dropped on itself or not on a folder
    if (docId === targetFolderId) return;
    const targetFolder = folders.find((f) => f.id === targetFolderId);
    if (!targetFolder) return;

    // Don't move if already in this folder
    const doc = documents.find((d) => d.id === docId);
    if (doc?.folderId === targetFolderId) return;

    try {
      const res = await fetch(`/api/documents/${docId}?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId }),
      });
      if (res.ok) {
        toast.success('Документ перемещён', {
          description: `«${doc?.title}» перемещён в «${targetFolder.name}».`,
        });
        fetchData();
      } else {
        toast.error('Ошибка перемещения', {
          description: 'Не удалось переместить документ.',
        });
      }
    } catch {
      toast.error('Ошибка соединения', {
        description: 'Не удалось подключиться к серверу.',
      });
    }
  }, [token, folders, documents, fetchData]);

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
  // Filters/sorting are applied server-side. Here we only handle local text search
  // on the current page and the server-search mode.
  const filteredDocuments = useMemo(() => {
    if (searchMode === 'server' && serverSearchResults.length > 0) return serverSearchResults;
    if (searchMode === 'server' && serverSearching) return [];

    if (searchMode === 'local' && docSearch.trim()) {
      const q = docSearch.toLowerCase();
      return documents.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.number?.toLowerCase().includes(q) ||
          d.type?.name.toLowerCase().includes(q) ||
          d.creator?.name.toLowerCase().includes(q)
      );
    }

    return documents;
  }, [documents, docSearch, searchMode, serverSearchResults, serverSearching]);

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

  // ── Debounced server search ────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchMode !== 'server' || !docSearch.trim() || docSearch.trim().length < 3) {
      setServerSearchResults([]);
      setServerSearching(false);
      return;
    }

    setServerSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      if (!token) return;
      try {
        const res = await fetch(
          `/api/documents/search?q=${encodeURIComponent(docSearch.trim())}&token=${token}`
        );
        if (res.ok) {
          const data = await res.json();
          setServerSearchResults(data.documents || []);
        }
      } catch {
        setServerSearchResults([]);
      } finally {
        setServerSearching(false);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [docSearch, searchMode, token]);

  // ── Fetch templates on mount ───────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`/api/templates?token=${token}`)
      .then((res) => {
        if (res.ok) return res.json();
        return { templates: [] };
      })
      .then((data) => {
        setTemplates(data.templates || []);
      })
      .catch(() => {
        setTemplates([]);
      });
  }, [token]);

  // ── Fetch tags & users for filters ─────────────────────────────────
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`/api/tags?token=${token}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/users?token=${token}`).then((r) => r.ok ? r.json() : []),
    ]).then(([tagsData, usersData]) => {
      const tags = Array.isArray(tagsData) ? tagsData : tagsData?.tags || [];
      const users = Array.isArray(usersData) ? usersData : usersData?.users || [];
      setAvailableTags(tags.map((t: any) => ({ id: t.id, name: t.name, color: t.color || '#64748b' })));
      setAvailableUsers(users.map((u: any) => ({ id: u.id, name: u.name })));
    }).catch(() => {});
  }, [token]);

  // ── Active filter count ────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterTags.size > 0) count++;
    if (filterDateRange !== 'all') count++;
    if (filterCreatorId !== 'all') count++;
    if (filterStatus !== 'ALL') count++;
    return count;
  }, [filterTags, filterDateRange, filterCreatorId, filterStatus]);

  // ── Reset all filters ──────────────────────────────────────────────
  const resetAllFilters = useCallback(() => {
    setFilterTags(new Set());
    setFilterDateRange('all');
    setFilterCreatorId('all');
    setFilterStatus('ALL');
    setStatusFilter('ALL');
  }, []);

  // ── Toggle tag in filter set ───────────────────────────────────────
  const toggleFilterTag = useCallback((tagId: string) => {
    setFilterTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

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
      // Record document view for recently viewed feature
      if (token) {
        fetch(`/api/documents/recent?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docId }),
        }).catch(() => {});
      }
      navigate({ page: 'edit-document', documentId: docId });
    },
    [navigate, token]
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

  // ── Handle quick status change (inline in table) ────────────────────
  const handleQuickStatusChange = useCallback(async (docId: string, newStatus: string) => {
    if (!token) return;
    setStatusChangingDocId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const statusLabel = STATUS_LABELS[newStatus] || newStatus;
        toast.success('Статус обновлён', {
          description: `Статус документа изменён на «${statusLabel}».`,
        });
        fetchData();
      } else {
        toast.error('Ошибка обновления', {
          description: 'Не удалось изменить статус документа.',
        });
      }
    } catch {
      toast.error('Ошибка соединения', {
        description: 'Не удалось подключиться к серверу.',
      });
    } finally {
      setStatusChangingDocId(null);
    }
  }, [token, fetchData]);

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

  // ── Fetch favorites ─────────────────────────────────────────────────
  const fetchFavorites = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/documents/favorites?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        const ids = Array.isArray(data)
          ? data.map((f: any) => f.documentId).filter(Boolean)
          : [];
        setFavoriteDocIds(new Set(ids));
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchFavorites();
    const handler = () => fetchFavorites();
    window.addEventListener('refresh-favorites', handler);
    return () => window.removeEventListener('refresh-favorites', handler);
  }, [fetchFavorites]);

  // ── Handle toggle favorite ─────────────────────────────────────────
  const handleToggleFavorite = useCallback(
    async (docId: string) => {
      if (!token) return;
      const isFav = favoriteDocIds.has(docId);
      // Optimistic update
      setFavoriteDocIds((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.delete(docId);
        } else {
          next.add(docId);
        }
        return next;
      });
      try {
        if (isFav) {
          await fetch(`/api/documents/favorites/${docId}?token=${token}`, { method: 'DELETE' });
        } else {
          await fetch(`/api/documents/favorites?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: docId }),
          });
        }
        // Notify FavoritesPanel to refresh
        window.dispatchEvent(new Event('refresh-favorites'));
      } catch (err) {
        // Revert on error
        setFavoriteDocIds((prev) => {
          const next = new Set(prev);
          if (isFav) {
            next.add(docId);
          } else {
            next.delete(docId);
          }
          return next;
        });
        toast.error('Ошибка', {
          description: isFav ? 'Не удалось удалить из избранного' : 'Не удалось добавить в избранное',
        });
      }
    },
    [token, favoriteDocIds]
  );

  // ── Sidebar content (shared between desktop & mobile) ───────────────
  const sidebarContent = useMemo(() => (
    <>
      {/* ── Logo ── */}
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-cyan-400" />
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

          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Папки
            </span>
            <button
              onClick={() => { setNewFolderParentId(null); setNewFolderOpen(true); }}
              className="text-slate-500 hover:text-white transition-colors"
              title="Новая папка"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

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
              isDragging={!!activeDragDoc}
            />
          ))}
        </div>
      </ScrollArea>

      <Separator />

      {/* ── Favorites Panel ── */}
      <FavoritesPanel
        token={token}
        onDocumentClick={(docId) => {
          navigate({ page: 'edit-document', documentId: docId });
          setMobileSheetOpen(false);
        }}
      />

      <Separator />

      {/* ── Recent Documents Panel ── */}
      <RecentDocuments
        token={token}
        onDocumentClick={(docId) => {
          navigate({ page: 'edit-document', documentId: docId });
          setMobileSheetOpen(false);
        }}
      />

      <Separator />

      {/* ── Sidebar Footer ── */}
      <div className="p-3 space-y-1">
        <Button
          variant="ghost"
          onClick={() => {
            navigate({ page: 'profile' });
            setMobileSheetOpen(false);
          }}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent h-9 text-sm"
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
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent h-9 text-sm"
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
    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
          <div className="flex-1 max-w-md mx-4 hidden lg:flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder={
                  searchMode === 'server'
                    ? 'Поиск в данных (мин. 3 символа)...'
                    : 'Быстрый поиск...'
                }
                className="pl-8 h-9 bg-muted border-border text-sm"
              />
              {serverSearching && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={searchMode === 'server' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => {
                    setSearchMode((m) => (m === 'local' ? 'server' : 'local'));
                    setDocSearch('');
                    setServerSearchResults([]);
                  }}
                >
                  {searchMode === 'server' ? (
                    <Database className="h-4 w-4" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {searchMode === 'server' ? 'Быстрый поиск' : 'Поиск в данных'}
              </TooltipContent>
            </Tooltip>
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
                        {searchMode === 'server' && docSearch ? (
                          <Database className="h-4 w-4" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Поиск документов</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="px-2 py-1.5 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        placeholder={
                          searchMode === 'server'
                            ? 'Поиск в данных (мин. 3 символа)...'
                            : 'Поиск документов...'
                        }
                        className="pl-8 h-9 bg-muted border-border text-sm"
                        autoFocus
                      />
                      {serverSearching && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={searchMode === 'local' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => {
                          setSearchMode('local');
                          setDocSearch('');
                          setServerSearchResults([]);
                        }}
                      >
                        <Zap className="h-3 w-3" />
                        Быстрый
                      </Button>
                      <Button
                        variant={searchMode === 'server' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => {
                          setSearchMode('server');
                          setDocSearch('');
                          setServerSearchResults([]);
                        }}
                      >
                        <Database className="h-3 w-3" />
                        В данных
                      </Button>
                    </div>
                    {searchMode === 'server' && docSearch.trim().length > 0 && docSearch.trim().length < 3 && (
                      <p className="text-[11px] text-muted-foreground">Введите минимум 3 символа для поиска</p>
                    )}
                    {searchMode === 'server' && !serverSearching && serverSearchResults.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">{serverSearchResults.length} результатов</p>
                    )}
                    {searchMode === 'server' && !serverSearching && docSearch.trim().length >= 3 && serverSearchResults.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">Ничего не найдено</p>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Notification Center */}
            <NotificationCenter token={token} onNavigate={navigate} />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Keyboard Shortcuts */}
            <KeyboardShortcutsDialog />

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
        <main className="flex-1 overflow-auto animate-fade-in dashboard-dot-pattern flex flex-col">
          {/* ── Welcome Banner ── */}
          {!isLoading && (
            <div className="px-4 pt-4 pb-0">
              <WelcomeBanner user={user} />
            </div>
          )}

          {/* ── Toolbar ── */}
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-2.5 flex items-center gap-2 flex-wrap no-print [&>*]:shrink-0">
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
            <div className="hidden md:flex items-center border rounded-md">
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
                <DropdownMenuItem onClick={() => { setStatusFilter('ALL'); setFilterStatus('ALL'); }}>
                  Все статусы
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => { setStatusFilter(key); setFilterStatus(key); }}
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

            {/* Advanced Filters */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={activeFilterCount > 0 ? 'default' : 'outline'} className={`h-9 gap-2 text-sm relative ${activeFilterCount > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}>
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Фильтры</span>
                  {activeFilterCount > 0 && (
                    <Badge className="ml-0 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-white/20 text-white text-[10px] font-bold">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="start">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Фильтры
                    </h3>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={resetAllFilters}>
                        Сбросить
                      </Button>
                    )}
                  </div>

                  <Separator />

                  {/* Tags Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      Теги
                    </label>
                    {availableTags.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Нет доступных тегов</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {availableTags.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => toggleFilterTag(tag.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all border ${
                              filterTags.has(tag.id)
                                ? 'border-foreground/30 shadow-sm'
                                : 'border-border opacity-60 hover:opacity-100'
                            }`}
                            style={{
                              backgroundColor: filterTags.has(tag.id) ? `${tag.color}20` : 'transparent',
                              color: tag.color,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                            {filterTags.has(tag.id) && <X className="h-3 w-3 ml-0.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Date Range Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Период
                    </label>
                    <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="За весь период" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">За весь период</SelectItem>
                        <SelectItem value="today">Сегодня</SelectItem>
                        <SelectItem value="week">Эта неделя</SelectItem>
                        <SelectItem value="month">Этот месяц</SelectItem>
                        <SelectItem value="year">Этот год</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      Статус
                    </label>
                    <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setStatusFilter(v); }}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Все статусы" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Все статусы</SelectItem>
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                key === 'DRAFT' ? 'bg-slate-400'
                                  : key === 'IN_PROGRESS' ? 'bg-sky-500'
                                  : key === 'APPROVED' ? 'bg-emerald-500'
                                  : key === 'REJECTED' ? 'bg-rose-500'
                                  : 'bg-violet-500'
                              }`} />
                              {label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Creator Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      Автор
                    </label>
                    <Select value={filterCreatorId} onValueChange={setFilterCreatorId}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Все авторы" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все авторы</SelectItem>
                        <SelectSeparator />
                        {availableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 text-sm hidden md:flex">
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
                <Button variant="outline" className="h-9 gap-2 text-sm hidden md:flex">
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

            {/* Reports */}
            <Button
              variant="outline"
              className="h-9 gap-2 text-sm hidden md:flex"
              onClick={() => navigate({ page: 'reports' })}
            >
              <BarChart3 className="h-4 w-4" />
              Отчёты
            </Button>

            {/* Document count + Pagination */}
            <div className="ml-auto shrink-0 flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5">
                <Badge variant="secondary" className="font-normal text-xs bg-muted text-muted-foreground hover:bg-muted px-2 py-0.5">
                  {docsTotal}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {docsTotal === 1
                    ? 'документ'
                    : docsTotal >= 2 && docsTotal <= 4
                    ? 'документа'
                    : 'документов'}
                </span>
              </div>
              {docsTotal > PAGE_SIZE && searchMode !== 'server' && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    disabled={docsPage <= 1 || refreshing}
                    onClick={() => fetchDocs(docsPage - 1)}
                  >
                    ←
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums px-1">
                    {docsPage} / {Math.ceil(docsTotal / PAGE_SIZE)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    disabled={docsPage >= Math.ceil(docsTotal / PAGE_SIZE) || refreshing}
                    onClick={() => fetchDocs(docsPage + 1)}
                  >
                    →
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ── Quick Actions ── */}
          {!isLoading && (invoiceTypeId || contractTypeId || memoTypeId || user?.role === 'ADMIN') && (
            <div className="px-4 pt-3 pb-3">
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

          {/* ── Stats Summary Bar & Analytics — only for ADMIN and DIRECTOR ── */}
          {(user?.role === 'ADMIN' || user?.role === 'DIRECTOR') && (
            <>
              <div className="px-4 pt-3">
                <StatsSummaryBar token={token} />
              </div>
              <DashboardAnalytics token={token} />
            </>
          )}

          {/* ── Document Content ── */}
          <div className="p-4 flex-1">
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
                favoriteDocIds={favoriteDocIds}
                onToggleFavorite={handleToggleFavorite}
                statusChangingDocId={statusChangingDocId}
                onStatusChange={handleQuickStatusChange}
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
                favoriteDocIds={favoriteDocIds}
                onToggleFavorite={handleToggleFavorite}
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
        <footer className="flex items-center justify-between h-8 px-5 bg-background border-t border-border/60 text-[11px] text-muted-foreground shrink-0 no-print">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              DocFlow BPM v1.1
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span className="hidden sm:inline">
              {selectedFolderId
                ? `Папка: ${folderPath.map((f) => f.name).join(' / ')}`
                : 'Все документы'}
            </span>
            <Separator orientation="vertical" className="h-3 hidden sm:block" />
            <span>
              {documents.length} из {docsTotal.toLocaleString('ru')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">&copy; {new Date().getFullYear()}</span>
            <Separator orientation="vertical" className="h-3 hidden sm:block" />
            <span className="hidden md:inline">{user?.name}</span>
            <Separator orientation="vertical" className="h-3 hidden md:block" />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый документ</DialogTitle>
            <DialogDescription>
              Создайте документ с нуля или из шаблона.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="type" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="type" className="flex-1">Тип документа</TabsTrigger>
              <TabsTrigger value="template" className="flex-1 gap-1.5">
                Из шаблона
                {templates.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{templates.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Document Type (current behavior) */}
            <TabsContent value="type">
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
                  <Select value={newDocFolderId || '__none__'} onValueChange={(v) => setNewDocFolderId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите папку" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
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
            </TabsContent>

            {/* Tab 2: From Template */}
            <TabsContent value="template">
              <div className="py-2 space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Папка</label>
                  <Select value={newDocFolderId || '__none__'} onValueChange={(v) => setNewDocFolderId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите папку" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
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

                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">Шаблоны не найдены</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Шаблоны можно создать в разделе администрирования
                      </p>
                    </div>
                  ) : (
                    templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => {
                          setNewDocDialogOpen(false);
                          navigate({
                            page: 'new-document',
                            typeId: tpl.typeId,
                            folderId: newDocFolderId || undefined,
                            title: tpl.name,
                            templateData: tpl.data,
                          });
                        }}
                        className="w-full flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all text-left group"
                      >
                        <div
                          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                          style={{
                            backgroundColor: `${tpl.color || '#6b7280'}15`,
                            color: tpl.color || '#6b7280',
                          }}
                        >
                          {getDocTypeIcon(tpl.type?.systemName || '')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                            {tpl.name}
                          </p>
                          {tpl.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {tpl.description}
                            </p>
                          )}
                          {tpl.type && (
                            <Badge variant="secondary" className="text-[10px] mt-1.5">
                              {tpl.type.name}
                            </Badge>
                          )}
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ════════ DRAG OVERLAY ════════ */}
      <DragOverlay dropAnimation={null}>
        {activeDragDoc ? (
          <div className="bg-card rounded-lg border shadow-xl p-3 max-w-xs flex items-center gap-3 animate-in fade-in-0 zoom-in-95 duration-100">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
              style={{
                backgroundColor: `${activeDragDoc.type?.color || '#64748b'}15`,
                color: activeDragDoc.type?.color || '#64748b',
              }}
            >
              {getDocTypeIcon(activeDragDoc.type?.systemName || '')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{activeDragDoc.title}</p>
              {activeDragDoc.type?.name && (
                <p className="text-xs text-muted-foreground truncate">{activeDragDoc.type.name}</p>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
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
  isDragging?: boolean;
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
  isDragging,
}: FolderTreeNodeProps) {
  const children = getChildren(folder.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const docCount = countDocsInFolder(folder.id);
  const folderColorClass = getFolderColor(folder.color);
  const folderInlineColor = folderColorClass ? undefined : folder.color || '#64748b';

  return (
    <DroppableFolder folderId={folder.id} isDragging={!!isDragging}>
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
          {folder.icon === 'inbox' ? (
            <Inbox className={`h-4 w-4 shrink-0 ${folderColorClass}`} style={folderInlineColor ? { color: folderInlineColor } : undefined} />
          ) : folder.icon === 'archive' ? (
            <Archive className={`h-4 w-4 shrink-0 ${folderColorClass}`} style={folderInlineColor ? { color: folderInlineColor } : undefined} />
          ) : isExpanded || isSelected ? (
            <FolderOpen className={`h-4 w-4 shrink-0 ${folderColorClass}`} style={folderInlineColor ? { color: folderInlineColor } : undefined} />
          ) : (
            <FolderIcon className={`h-4 w-4 shrink-0 ${folderColorClass}`} style={folderInlineColor ? { color: folderInlineColor } : undefined} />
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
              {!folder.isSystem && (
                <>
                  <DropdownMenuItem onClick={() => onRename(folder)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Переименовать
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(folder.id)} variant="destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Удалить
                  </DropdownMenuItem>
                </>
              )}
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
              isDragging={isDragging}
            />
          ))}
        </div>
      )}
    </DroppableFolder>
  );
}

// Returns true when the row/card should be highlighted red:
// the current user has a pending step AND (urgency is CRITICAL OR dueAt is ≤1h away / overdue)
function isUrgentHighlight(doc: Document): boolean {
  if (!doc.myPendingStep) return false
  if (doc.urgency === 'CRITICAL') return true
  const { dueAt } = doc.myPendingStep
  if (!dueAt) return false
  return new Date(dueAt).getTime() <= Date.now() + 60 * 60 * 1000
}

function urgentHighlightReason(doc: Document): string {
  if (!doc.myPendingStep) return ''
  if (doc.urgency === 'CRITICAL') return 'Экстренный документ'
  const { dueAt } = doc.myPendingStep
  if (!dueAt) return ''
  return new Date(dueAt).getTime() < Date.now() ? 'Срок SLA истёк' : 'Осталось менее 1 часа по SLA'
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
  favoriteDocIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  statusChangingDocId: string | null;
  onStatusChange: (docId: string, newStatus: string) => void;
}

function DocumentTable({
  documents, onDocClick, sortField, sortDir, onSort, onDeleteDoc,
  onDuplicateDoc, duplicatingDocId,
  selectMode, selectedIds, allVisibleSelected, someVisibleSelected,
  onToggleSelectAll, onToggleDocSelection,
  favoriteDocIds, onToggleFavorite,
  statusChangingDocId, onStatusChange,
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
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead className="w-8"><span className="sr-only">Перетащить</span></TableHead>
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
            <TableHead className="w-28 hidden lg:table-cell">Теги</TableHead>
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
            <TableHead className="w-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Star className="h-3.5 w-3.5 mx-auto text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent>Избранное</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="w-10"><span className="sr-only">Действия</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const urgent = isUrgentHighlight(doc)
            const urgentReason = urgent ? urgentHighlightReason(doc) : ''
            return (
            <TableRow
              key={doc.id}
              className={`cursor-pointer group transition-all duration-150 hover:bg-muted/50 even:bg-muted/20 ${selectMode && selectedIds.has(doc.id) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''} ${urgent ? 'bg-rose-50/80 dark:bg-rose-950/20' : ''}`}
              onClick={() => onDocClick(doc.id)}
            >
              <TableCell>
                <DraggableGrip docId={doc.id} />
              </TableCell>
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
                  <span
                    className="w-1 h-6 rounded-full shrink-0"
                    style={{ backgroundColor: doc.type?.color || '#64748b' }}
                  />
                  <span style={{ color: doc.type?.color || '#64748b' }}>
                    {getDocTypeIcon(doc.type?.systemName || '')}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {doc.type?.name || '—'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {urgent && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      </TooltipTrigger>
                      <TooltipContent>{urgentReason}</TooltipContent>
                    </Tooltip>
                  )}
                  <span className={`font-medium text-sm group-hover:text-emerald-700 transition-colors truncate block max-w-xs ${urgent ? 'text-rose-700 dark:text-rose-400' : ''}`}>
                    {doc.title}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-sm text-muted-foreground font-mono">
                  {doc.number || '—'}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {doc.tagLinks && doc.tagLinks.length > 0 ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    {doc.tagLinks.slice(0, 2).map((link) => (
                      <span
                        key={link.tagId}
                        className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-border/50"
                        style={{
                          backgroundColor: link.tag.color + '18',
                          color: link.tag.color,
                        }}
                      >
                        {link.tag.name}
                      </span>
                    ))}
                    {doc.tagLinks.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{doc.tagLinks.length - 2}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground/40">—</span>
                )}
              </TableCell>
              <TableCell>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-0.5 focus:outline-none group/status rounded-md hover:opacity-80 transition-all animate-in fade-in-0">
                        {statusChangingDocId === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin text-muted-foreground" />
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-medium cursor-pointer hover:shadow-sm transition-all ${STATUS_COLORS[doc.status] || ''}`}
                          >
                            {STATUS_LABELS[doc.status] || doc.status}
                          </Badge>
                        )}
                        <ChevronDown className="h-3 w-3 text-muted-foreground/50 group-hover/status:text-muted-foreground transition-colors" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => onStatusChange(doc.id, key)}
                          disabled={statusChangingDocId === doc.id}
                          className="gap-2"
                        >
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
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
                          <span>{label}</span>
                          {key === doc.status && (
                            <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
              <TableCell>
                <div onClick={(e) => e.stopPropagation()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onToggleFavorite(doc.id)}
                      >
                        <Star
                          className={`h-4 w-4 transition-colors ${
                            favoriteDocIds.has(doc.id)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-muted-foreground/40 hover:text-amber-400'
                          }`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {favoriteDocIds.has(doc.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          );
          })}
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
  favoriteDocIds: Set<string>;
  onToggleFavorite: (id: string) => void;
}

function DocumentGrid({
  documents, onDocClick, onDuplicateDoc, duplicatingDocId, selectMode, selectedIds, onToggleDocSelection,
  favoriteDocIds, onToggleFavorite,
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
        const urgent = isUrgentHighlight(doc);
        const urgentReason = urgent ? urgentHighlightReason(doc) : '';

        return (
          <div
            key={doc.id}
            onClick={() => onDocClick(doc.id)}
            className={`group card-shine bg-card rounded-xl border shadow-sm hover:shadow-xl hover:shadow-muted/30 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden relative ${urgent ? 'border-rose-400 dark:border-rose-700 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-300 dark:ring-rose-800' : 'border-border/60 hover:border-border'} ${selectMode && selectedIds.has(doc.id) ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
            style={{ borderTopColor: urgent ? '#f43f5e' : docColor }}
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

            {/* Drag grip */}
            <div
              className="absolute bottom-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <DraggableGrip docId={doc.id} />
            </div>

            {/* Favorite button */}
            <div
              className="absolute top-2.5 left-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                    onClick={() => onToggleFavorite(doc.id)}
                  >
                    <Star
                      className={`h-3.5 w-3.5 transition-colors ${
                        favoriteDocIds.has(doc.id)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-muted-foreground/40 hover:text-amber-400'
                      }`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {favoriteDocIds.has(doc.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                </TooltipContent>
              </Tooltip>
            </div>

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
                    backgroundColor: urgent ? '#fef2f2' : `${docColor}15`,
                    color: urgent ? '#f43f5e' : docColor,
                  }}
                >
                  {getDocTypeIcon(doc.type?.systemName || '')}
                </div>
                <div className="flex items-center gap-1.5">
                  {urgent && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>{urgentReason}</TooltipContent>
                    </Tooltip>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${STATUS_COLORS[doc.status] || ''}`}
                  >
                    {STATUS_LABELS[doc.status] || doc.status}
                  </Badge>
                </div>
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
    <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4 animate-scale-in">
      <div className="relative mb-6">
        <div className="flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-muted to-muted/60">
          {isSearch ? (
            <Search className="h-12 w-12 text-muted-foreground/50" />
          ) : (
            <Inbox className="h-12 w-12 text-muted-foreground/50" />
          )}
        </div>
        {!isSearch && (
          <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shadow-sm">
            <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
        {isSearch && (
          <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shadow-sm">
            <Search className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {isSearch ? 'Ничего не найдено' : 'Папка пуста'}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-5">
        {isSearch
          ? 'Попробуйте изменить поисковый запрос или фильтр для поиска документов.'
          : 'В этой папке пока нет документов. Начните работу, создав первый документ.'}
      </p>
      {!isSearch && (
        <p className="text-xs text-muted-foreground/60 text-center max-w-xs">
          Используйте кнопку «+» на панели инструментов выше или выберите шаблон из быстрых действий
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ── LOADING SKELETON ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
function LoadingSkeleton() {
  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
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
