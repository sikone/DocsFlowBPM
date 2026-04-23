import { create } from 'zustand';
import type { User, AppView, Folder, DocumentType, Document } from '@/lib/types';

interface StoreState {
  // Auth
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Navigation
  view: AppView;

  // Recent pages for command palette
  recentPages: string[];

  // Data cache
  folders: Folder[];
  documentTypes: DocumentType[];
  documents: Document[];
  selectedFolderId: string | null;

  // UI
  sidebarCollapsed: boolean;

  // Auth actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;

  // Navigation
  navigate: (view: AppView) => void;
  goBack: () => void;

  // Recent pages
  addRecentPage: (page: string) => void;

  // Data actions
  setFolders: (folders: Folder[]) => void;
  setDocumentTypes: (types: DocumentType[]) => void;
  setDocuments: (docs: Document[]) => void;
  setSelectedFolder: (id: string | null) => void;

  // UI actions
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
}

const getInitialView = (): AppView => {
  if (typeof window === 'undefined') return { page: 'login' };
  const token = localStorage.getItem('auth_token');
  return token ? { page: 'dashboard' } : { page: 'login' };
};

const getInitialRecentPages = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('recent_pages');
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    }
  } catch { /* silent */ }
  return [];
};

export const useStore = create<StoreState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  view: { page: 'login' },
  recentPages: getInitialRecentPages(),
  folders: [],
  documentTypes: [],
  documents: [],
  selectedFolderId: null,
  sidebarCollapsed: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || 'Ошибка входа', isLoading: false });
        return false;
      }
      localStorage.setItem('auth_token', data.token);
      const docId = new URLSearchParams(window.location.search).get('doc');
      set({
        user: data.user,
        token: data.token,
        view: docId ? { page: 'edit-document', documentId: docId } : { page: 'dashboard' },
        isLoading: false,
      });
      return true;
    } catch {
      set({ error: 'Ошибка соединения с сервером', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    const { token } = get();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch { /* silent */ }
    }
    localStorage.removeItem('auth_token');
    set({
      user: null,
      token: null,
      view: { page: 'login' },
      folders: [],
      documents: [],
      documentTypes: [],
      selectedFolderId: null,
      error: null,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ view: { page: 'login' } });
      return;
    }
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/auth/me?token=${token}`);
      if (!res.ok) {
        localStorage.removeItem('auth_token');
        set({ view: { page: 'login' }, isLoading: false });
        return;
      }
      const data = await res.json();
      const docId = new URLSearchParams(window.location.search).get('doc');
      set({
        user: data.user,
        token,
        view: docId ? { page: 'edit-document', documentId: docId } : { page: 'dashboard' },
        isLoading: false,
      });
    } catch {
      set({ view: { page: 'login' }, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  navigate: (view: AppView) => {
    const state = get();
    // Derive a readable page label for recent pages
    const pageKey = view.page as string;
    const pageLabels: Record<string, string> = {
      'dashboard': 'Панель управления',
      'new-document': 'Новый документ',
      'edit-document': 'Редактирование документа',
      'admin': 'Панель администратора',
      'admin-users': 'Управление пользователями',
      'admin-doc-types': 'Типы документов',
      'admin-doc-type-form': 'Конструктор форм',
      'admin-processes': 'Процессы',
      'admin-tasks': 'Задачи',
      'admin-activity': 'Журнал активности',
      'profile': 'Профиль',
    };
    const label = pageLabels[pageKey] || pageKey;

    // Add to recent pages (deduplicated, max 5)
    const filtered = state.recentPages.filter((p) => p !== label);
    const newRecent = [label, ...filtered].slice(0, 5);

    set({ view, recentPages: newRecent });

    // Persist to localStorage
    try {
      localStorage.setItem('recent_pages', JSON.stringify(newRecent));
    } catch { /* silent */ }
  },

  addRecentPage: (page: string) => {
    const state = get();
    const filtered = state.recentPages.filter((p) => p !== page);
    const newRecent = [page, ...filtered].slice(0, 5);
    set({ recentPages: newRecent });
    try {
      localStorage.setItem('recent_pages', JSON.stringify(newRecent));
    } catch { /* silent */ }
  },

  goBack: () => {
    const { view } = get();
    if (view.page === 'edit-document' || view.page === 'new-document' || view.page === 'profile') {
      set({ view: { page: 'dashboard' } });
    } else if (view.page.startsWith('admin-')) {
      set({ view: { page: 'admin' } });
    } else {
      set({ view: { page: 'dashboard' } });
    }
  },

  setFolders: (folders: Folder[]) => set({ folders }),
  setDocumentTypes: (types: DocumentType[]) => set({ documentTypes: types }),
  setDocuments: (docs: Document[]) => set({ documents: docs }),
  setSelectedFolder: (id: string | null) => {
    set({ selectedFolderId: id, view: { page: 'dashboard', folderId: id || undefined } });
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
