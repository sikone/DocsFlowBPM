'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useStore } from '@/lib/store';
import LoginPage from '@/components/auth/login-page';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import DocumentFormView from '@/components/documents/document-form-view';
import AdminLayout from '@/components/admin/admin-layout';
import ProfilePage from '@/components/profile-page';
import { ErrorBoundary } from '@/components/error-boundary';

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-emerald-500 animate-spin" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Загрузка системы...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {view.page === 'login' && <LoginPage />}
      {(view.page === 'new-document' || view.page === 'edit-document') && <DocumentFormView />}
      {(view.page === 'admin' || view.page.startsWith('admin-')) && <AdminLayout />}
      {view.page === 'dashboard' && <DashboardLayout />}
      {view.page === 'profile' && <ProfilePage />}
    </ErrorBoundary>
  );
}
