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

export const useStore = create<StoreState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  view: { page: 'login' },
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
      set({
        user: data.user,
        token: data.token,
        view: { page: 'dashboard' },
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
      set({
        user: data.user,
        token,
        view: { page: 'dashboard' },
        isLoading: false,
      });
    } catch {
      set({ view: { page: 'login' }, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  navigate: (view: AppView) => set({ view }),

  goBack: () => {
    const { view } = get();
    if (view.page === 'edit-document' || view.page === 'new-document') {
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
