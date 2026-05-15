'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useStore } from '@/lib/store';
import LoginPage from '@/components/auth/login-page';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import DocumentFormView from '@/components/documents/document-form-view';
import AdminLayout from '@/components/admin/admin-layout';
import ProfilePage from '@/components/profile-page';
import ReportsPage from '@/components/reports/reports-page';
import RulesPage from '@/components/rules-page';
import { ErrorBoundary } from '@/components/error-boundary';
import CommandPalette from '@/components/command-palette';

function useMounted() {
  return useSyncExternalStore(
    (cb) => { cb(); return () => {} },
    () => true,
    () => false,
  );
}

export default function Home() {
  const { view, user, checkAuth } = useStore();
  const mounted = useMounted();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      checkAuth();
    }
  }, [checkAuth]);

  // Show loading spinner only before initial auth check completes
  if (!mounted || (!user && view.page !== 'login')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-border border-t-emerald-500 animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Загрузка системы...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">
        {view.page === 'login' && <LoginPage />}
        {(view.page === 'new-document' || view.page === 'edit-document') && <DocumentFormView />}
        {(view.page === 'admin' || view.page.startsWith('admin-')) && <AdminLayout />}
        {view.page === 'dashboard' && <DashboardLayout />}
        {view.page === 'profile' && <ProfilePage />}
        {view.page === 'reports' && <ReportsPage />}
        {view.page === 'rules' && <RulesPage />}
      </div>
      {/* Command palette renders on top of everything */}
      <CommandPalette />
    </ErrorBoundary>
  );
}
