'use client';

import React, { useState, useMemo, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  CheckSquare,
  Users,
  Tags,
  ArrowLeft,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Activity,
  Menu,
  SlidersHorizontal,
  Building2,
  UserRound,
  Building,
  Trash2,
  CalendarDays,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStore } from '@/lib/store';
import { ROLE_LABELS } from '@/lib/types';
import type { AppView } from '@/lib/types';
import {
  AdminDashboard,
  AdminUsers,
  AdminDocTypes,
  AdminDocTypeForm,
  PlaceholderProcesses,
  PlaceholderTasks,
} from '@/components/admin/admin-pages';
import { ActivityLogPage } from '@/components/admin/activity-log-page';
import { AdminTagsPage } from '@/components/admin/admin-tags-page';
import { AdminSettingsPage } from '@/components/admin/admin-settings-page';
import { AdminCounterpartiesPage } from '@/components/admin/admin-counterparties-page';
import { AdminContactsPage } from '@/components/admin/admin-contacts-page';
import { AdminDepartmentsPage } from '@/components/admin/admin-departments-page';
import { AdminDeletedObjectsPage } from '@/components/admin/admin-deleted-objects-page';
import { AdminCalendarPage } from '@/components/admin/admin-calendar-page';
import { AdminEmailTemplatesPage } from '@/components/admin/admin-email-templates-page';

const NAV_ITEMS: {
  label: string;
  icon: React.ElementType;
  page: AppView;
}[] = [
  { label: 'Дашборд', icon: LayoutDashboard, page: { page: 'admin' } },
  { label: 'Типы документов', icon: FileText, page: { page: 'admin-doc-types' } },
  { label: 'Процессы', icon: GitBranch, page: { page: 'admin-processes' } },
  { label: 'Задачи', icon: CheckSquare, page: { page: 'admin-tasks' } },
  { label: 'Пользователи', icon: Users, page: { page: 'admin-users' } },
  { label: 'Теги', icon: Tags, page: { page: 'admin-tags' } },
  { label: 'Журнал', icon: Activity, page: { page: 'admin-activity' } },
  { label: 'Контрагенты', icon: Building2, page: { page: 'admin-counterparties' } },
  { label: 'Контакты', icon: UserRound, page: { page: 'admin-contacts' } },
  { label: 'Отделы', icon: Building, page: { page: 'admin-departments' } },
  { label: 'Календарь', icon: CalendarDays, page: { page: 'admin-calendar' } },
  { label: 'Шаблоны e-mail', icon: Mail, page: { page: 'admin-email-templates' } },
  { label: 'Настройки', icon: SlidersHorizontal, page: { page: 'admin-settings' } },
  { label: 'Удалённые объекты', icon: Trash2, page: { page: 'admin-deleted-objects' } },
];

export default function AdminLayout() {
  const { user, view, navigate, logout } = useStore();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const currentPage = view.page;

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'DIRECTOR':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'CHIEF_ACCOUNTANT':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ADVANCED':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleNavigate = (page: AppView) => {
    navigate(page);
    setMobileSheetOpen(false);
  };

  // ── Shared sidebar content (used in both desktop aside & mobile sheet) ──
  const sidebarContent = useMemo(() => (
    <>
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">DocFlow BPM</h1>
            <p className="text-slate-400 text-xs">Панель администратора</p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-700/50" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4 custom-scrollbar">
        <nav className="px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.page.page === 'admin'
                ? currentPage === 'admin'
                : currentPage === item.page.page;

            return (
              <button
                key={item.page.page}
                onClick={() => handleNavigate(item.page)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'
                  }`}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-emerald-400/60" />
                )}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom section */}
      <div className="p-3 mt-auto">
        <Separator className="bg-slate-700/50 mb-3" />
        <button
          onClick={() => handleNavigate({ page: 'dashboard' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-150"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          <span>Вернуться в систему</span>
        </button>
      </div>
    </>
  ), [currentPage, handleNavigate]);

  const renderContent = () => {
    switch (currentPage) {
      case 'admin':
        return <AdminDashboard />;
      case 'admin-users':
        return <AdminUsers />;
      case 'admin-doc-types':
        return <AdminDocTypes />;
      case 'admin-doc-type-form':
        return <AdminDocTypeForm />;
      case 'admin-processes':
        return <PlaceholderProcesses />;
      case 'admin-tasks':
        return <PlaceholderTasks />;
      case 'admin-activity':
        return <ActivityLogPage />;
      case 'admin-tags':
        return <AdminTagsPage />;
      case 'admin-settings':
        return <AdminSettingsPage />;
      case 'admin-counterparties':
        return <AdminCounterpartiesPage />;
      case 'admin-contacts':
        return <AdminContactsPage />;
      case 'admin-departments':
        return <AdminDepartmentsPage />;
      case 'admin-deleted-objects':
        return <AdminDeletedObjectsPage />;
      case 'admin-calendar':
        return <AdminCalendarPage />;
      case 'admin-email-templates':
        return <AdminEmailTemplatesPage />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-muted/40 overflow-hidden animate-fade-in">
        {/* ═══ Desktop Sidebar ═══ */}
        <aside className="hidden md:flex w-64 bg-slate-900 flex-col shrink-0">
          {sidebarContent}
        </aside>

        {/* ═══ Mobile Sidebar (Sheet) ═══ */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-slate-900 border-slate-700/50">
            <div className="flex flex-col h-full">
              <SheetHeader className="sr-only">
                <SheetTitle>Навигация</SheetTitle>
                <SheetDescription>Меню администратора</SheetDescription>
              </SheetHeader>
              {sidebarContent}
            </div>
          </SheetContent>
        </Sheet>

        {/* ═══ Main area ═══ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 bg-background border-b flex items-center justify-between px-4 md:px-6 shrink-0">
            <div className="flex items-center gap-3">
              {/* Hamburger menu — mobile only */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 md:hidden"
                onClick={() => setMobileSheetOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate({ page: 'admin' })}
                    className="p-2 rounded-lg hover:bg-accent transition-colors hidden md:block"
                  >
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>На главную</TooltipContent>
              </Tooltip>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Администрирование</h2>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${getRoleBadgeClass(user.role)}`}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  </div>
                  <Avatar className="h-9 w-9 border-2 border-border">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <Separator orientation="vertical" className="h-8 hidden sm:block" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                      {mounted && theme === 'dark' ? (
                        <Sun className="w-4 h-4" />
                      ) : (
                        <Moon className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {mounted && theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-slate-400 hover:text-rose-600"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Выйти</TooltipContent>
                </Tooltip>
              </div>
            )}
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
            <div className="max-w-7xl mx-auto animate-fade-in">{renderContent()}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
