'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

import {
  Shield,
  UserCircle,
  LogOut,
  FilePlus2,
  FileSignature,
  FileText,
  FolderPlus,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react';

// ─── Command type ───────────────────────────────────────────────
interface CommandEntry {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  group: 'navigation' | 'actions' | 'recent';
  onSelect: () => void;
}

// ─── Main Component ─────────────────────────────────────────────
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { user, view, navigate, logout, documentTypes, recentPages, setFolders, setDocumentTypes, setDocuments } = useStore();

  // ── Build command list ──
  const buildCommands = useCallback((): CommandEntry[] => {
    const commands: CommandEntry[] = [];

    // Navigation group
    if (user) {
      if (user.role === 'ADMIN') {
        commands.push({
          id: 'nav-admin',
          label: 'Перейти на панель администратора',
          icon: <Shield className="h-4 w-4" />,
          shortcut: '',
          group: 'navigation',
          onSelect: () => { navigate({ page: 'admin' }); setOpen(false); },
        });
      }
      commands.push({
        id: 'nav-profile',
        label: 'Перейти к профилю',
        icon: <UserCircle className="h-4 w-4" />,
        shortcut: '',
        group: 'navigation',
        onSelect: () => { navigate({ page: 'profile' }); setOpen(false); },
      });
      commands.push({
        id: 'nav-logout',
        label: 'Выйти из системы',
        icon: <LogOut className="h-4 w-4" />,
        shortcut: '',
        group: 'navigation',
        onSelect: () => { logout(); setOpen(false); },
      });
    }

    // Actions group
    if (user) {
      const invoiceType = documentTypes.find((dt) => dt.systemName === 'invoice');
      const contractType = documentTypes.find((dt) => dt.systemName === 'contract');
      const memoType = documentTypes.find((dt) => dt.systemName === 'memo');

      if (invoiceType) {
        commands.push({
          id: 'create-invoice',
          label: 'Создать счёт',
          icon: <FilePlus2 className="h-4 w-4" />,
          shortcut: '',
          group: 'actions',
          onSelect: () => { navigate({ page: 'new-document', typeId: invoiceType.id }); setOpen(false); },
        });
      }
      if (contractType) {
        commands.push({
          id: 'create-contract',
          label: 'Создать договор',
          icon: <FileSignature className="h-4 w-4" />,
          shortcut: '',
          group: 'actions',
          onSelect: () => { navigate({ page: 'new-document', typeId: contractType.id }); setOpen(false); },
        });
      }
      if (memoType) {
        commands.push({
          id: 'create-memo',
          label: 'Создать служебную записку',
          icon: <FileText className="h-4 w-4" />,
          shortcut: '',
          group: 'actions',
          onSelect: () => { navigate({ page: 'new-document', typeId: memoType.id }); setOpen(false); },
        });
      }
      commands.push({
        id: 'create-folder',
        label: 'Создать папку',
        icon: <FolderPlus className="h-4 w-4" />,
        shortcut: '',
        group: 'actions',
        onSelect: () => {
          // Navigate to dashboard to show folder creation context
          navigate({ page: 'dashboard' });
          setOpen(false);
          // Dispatch a custom event that the dashboard can listen to
          window.dispatchEvent(new CustomEvent('docflow:create-folder'));
        },
      });
      commands.push({
        id: 'refresh-data',
        label: 'Обновить данные',
        icon: <RefreshCw className="h-4 w-4" />,
        shortcut: '',
        group: 'actions',
        onSelect: async () => {
          const token = useStore.getState().token;
          if (!token) return;
          setOpen(false);
          try {
            const [foldersRes, typesRes, docsRes] = await Promise.all([
              fetch(`/api/folders?token=${encodeURIComponent(token)}`),
              fetch(`/api/document-types?token=${encodeURIComponent(token)}`),
              fetch(`/api/documents?token=${encodeURIComponent(token)}`),
            ]);
            if (foldersRes.ok) {
              const foldersData = await foldersRes.json();
              useStore.getState().setFolders(foldersData.folders || []);
            }
            if (typesRes.ok) {
              const typesData = await typesRes.json();
              useStore.getState().setDocumentTypes(typesData.types || []);
            }
            if (docsRes.ok) {
              const docsData = await docsRes.json();
              useStore.getState().setDocuments(docsData.documents || []);
            }
            window.dispatchEvent(new CustomEvent('docflow:data-refreshed'));
          } catch { /* silent */ }
        },
      });
    }

    // Recent group — mapped back to page navigation
    const pageLabelToPage: Record<string, () => void> = {
      'Панель управления': () => navigate({ page: 'dashboard' }),
      'Панель администратора': () => navigate({ page: 'admin' }),
      'Управление пользователями': () => navigate({ page: 'admin-users' }),
      'Типы документов': () => navigate({ page: 'admin-doc-types' }),
      'Конструктор форм': () => navigate({ page: 'admin-doc-type-form' }),
      'Процессы': () => navigate({ page: 'admin-processes' }),
      'Задачи': () => navigate({ page: 'admin-tasks' }),
      'Журнал активности': () => navigate({ page: 'admin-activity' }),
      'Профиль': () => navigate({ page: 'profile' }),
      'Новый документ': () => {
        const types = useStore.getState().documentTypes;
        if (types.length > 0) {
          navigate({ page: 'new-document', typeId: types[0].id });
        }
      },
      'Редактирование документа': () => { /* can't navigate without ID */ },
    };

    for (const page of recentPages) {
      const action = pageLabelToPage[page];
      if (action) {
        commands.push({
          id: `recent-${page}`,
          label: page,
          icon: <Clock className="h-4 w-4" />,
          shortcut: '',
          group: 'recent',
          onSelect: () => { action(); setOpen(false); },
        });
      }
    }

    return commands;
  }, [user, navigate, logout, documentTypes, recentPages, setFolders, setDocumentTypes, setDocuments]);

  // ── Keyboard shortcut: Cmd+K / Ctrl+K ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Don't render when on login page
  if (!user || view.page === 'login') return null;

  const commands = buildCommands();
  const navigationCommands = commands.filter((c) => c.group === 'navigation');
  const actionCommands = commands.filter((c) => c.group === 'actions');
  const recentCommands = commands.filter((c) => c.group === 'recent');

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Командная панель"
      description="Поиск команд и навигация"
    >
      <CommandInput placeholder="Найти команду или перейти..." />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>

        {/* Recent pages */}
        {recentCommands.length > 0 && (
          <>
            <CommandGroup heading="Недавние">
              {recentCommands.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  onSelect={cmd.onSelect}
                >
                  {cmd.icon}
                  <span>{cmd.label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        {navigationCommands.length > 0 && (
          <CommandGroup heading="Навигация">
            {navigationCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={cmd.onSelect}
                className={cmd.id === 'nav-logout' ? 'text-rose-600 dark:text-rose-400' : ''}
              >
                {cmd.icon}
                <span>{cmd.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Actions */}
        {actionCommands.length > 0 && (
          <CommandGroup heading="Действия">
            {actionCommands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={cmd.onSelect}
              >
                {cmd.icon}
                <span>{cmd.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer hint */}
      <div className="border-t px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px]">↑↓</kbd>
          навигация
        </span>
        <span className="flex items-center gap-1">
          <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px]">↵</kbd>
          выбрать
        </span>
        <span className="flex items-center gap-1">
          <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px]">Esc</kbd>
          закрыть
        </span>
      </div>
    </CommandDialog>
  );
}
