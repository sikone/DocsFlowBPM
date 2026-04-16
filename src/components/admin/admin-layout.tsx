'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  CheckSquare,
  Users,
  ArrowLeft,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
];

export default function AdminLayout() {
  const { user, view, navigate, logout } = useStore();

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
      case 'ADVANCED':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

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
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 flex flex-col shrink-0">
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
          <ScrollArea className="flex-1 py-4">
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
                    onClick={() => navigate(item.page)}
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
              onClick={() => navigate({ page: 'dashboard' })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-150"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              <span>Вернуться в систему</span>
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate({ page: 'admin' })}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>На главную</TooltipContent>
              </Tooltip>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Администрирование</h2>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${getRoleBadgeClass(user.role)}`}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  </div>
                  <Avatar className="h-9 w-9 border-2 border-slate-200">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <Separator orientation="vertical" className="h-8" />
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
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">{renderContent()}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
