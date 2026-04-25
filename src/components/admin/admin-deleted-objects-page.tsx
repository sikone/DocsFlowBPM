'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  File, FileText, FileSpreadsheet, Presentation,
  Image as ImageIcon, Loader2, RotateCcw, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useStore } from '@/lib/store';

interface DeletedAttachment {
  groupId: string;
  attachmentId: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  deletedAt: string;
  versionCount: number;
  document: { id: string; title: string; number?: string | null };
  uploadedBy: { id: string; name: string };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function versionWord(n: number): string {
  if (n === 1) return '1 версия';
  if (n < 5) return `${n} версии`;
  return `${n} версий`;
}

function countWord(n: number, one: string, few: string, many: string): string {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} ${one}`;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} ${few}`;
  return `${n} ${many}`;
}

function AttachmentFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-sky-500 shrink-0" />;
  if (mimeType.includes('pdf')) return <FileText className="w-4 h-4 text-rose-500 shrink-0" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return <Presentation className="w-4 h-4 text-orange-500 shrink-0" />;
  if (mimeType.includes('word') || mimeType.includes('wordprocessingml') || mimeType.includes('opendocument.text'))
    return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
  return <File className="w-4 h-4 text-slate-400 shrink-0" />;
}

export function AdminDeletedObjectsPage() {
  const { token } = useStore();
  const [attachments, setAttachments] = useState<DeletedAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deleted-attachments?token=${encodeURIComponent(token ?? '')}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAttachments(data.attachments ?? []);
    } catch {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  const toggleSelect = (groupId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === attachments.length ? new Set() : new Set(attachments.map((a) => a.groupId)));
  };

  const handleRestore = async () => {
    if (selected.size === 0 || processing) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/deleted-attachments?token=${encodeURIComponent(token ?? '')}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Восстановлено: ${countWord(data.restored, 'вложение', 'вложения', 'вложений')}`);
      setSelected(new Set());
      await fetchAttachments();
    } catch {
      toast.error('Ошибка восстановления');
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (selected.size === 0 || processing) return;
    setProcessing(true);
    setShowConfirmDelete(false);
    try {
      const res = await fetch(`/api/admin/deleted-attachments?token=${encodeURIComponent(token ?? '')}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Удалено навсегда: ${countWord(data.deleted, 'вложение', 'вложения', 'вложений')}`);
      setSelected(new Set());
      await fetchAttachments();
    } catch {
      toast.error('Ошибка удаления');
    } finally {
      setProcessing(false);
    }
  };

  const allSelected = attachments.length > 0 && selected.size === attachments.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Удалённые объекты</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Управление мягко удалёнными объектами — восстановление или необратимое удаление
        </p>
      </div>

      <Tabs defaultValue="attachments">
        <TabsList>
          <TabsTrigger value="attachments">
            Вложения
            {attachments.length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium leading-none">
                {attachments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attachments" className="mt-4">
          <div className="rounded-lg border bg-card">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm text-muted-foreground">
                {loading
                  ? 'Загрузка...'
                  : countWord(attachments.length, 'вложение', 'вложения', 'вложений')}
                {selected.size > 0 && (
                  <span className="ml-2 text-foreground font-medium">
                    · выбрано: {selected.size}
                  </span>
                )}
              </p>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRestore}
                    disabled={processing}
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:border-emerald-800"
                  >
                    {processing ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Восстановить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowConfirmDelete(true)}
                    disabled={processing}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:border-rose-800"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Удалить навсегда
                  </Button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : attachments.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                <Trash2 className="w-8 h-8 opacity-20" />
                <p className="text-sm">Нет удалённых вложений</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    className="shrink-0"
                  />
                  <span className="flex-1">Вложение</span>
                  <span className="w-40 hidden sm:block">Документ</span>
                  <span className="w-28 hidden md:block">Дата удаления</span>
                  <span className="w-16 hidden lg:block text-right">Размер</span>
                </div>

                {attachments.map((att) => (
                  <div
                    key={att.groupId}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors ${
                      selected.has(att.groupId) ? 'bg-muted/30' : ''
                    }`}
                    onClick={() => toggleSelect(att.groupId)}
                  >
                    <Checkbox
                      checked={selected.has(att.groupId)}
                      onCheckedChange={() => toggleSelect(att.groupId)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <AttachmentFileIcon mimeType={att.mimeType} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{att.originalName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {att.uploadedBy.name}
                          {att.versionCount > 1 && (
                            <span className="ml-1 opacity-70">· {versionWord(att.versionCount)}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="w-40 hidden sm:block min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {att.document.number ? `№${att.document.number} ` : ''}
                        {att.document.title}
                      </p>
                    </div>

                    <div className="w-28 hidden md:block">
                      <p className="text-[10px] text-muted-foreground">{formatDate(att.deletedAt)}</p>
                    </div>

                    <div className="w-16 hidden lg:block text-right">
                      <p className="text-[10px] text-muted-foreground">{formatBytes(att.fileSize)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Необратимое удаление</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалено {countWord(selected.size, 'вложение', 'вложения', 'вложений')} вместе
              со всеми версиями файлов на диске. Это действие невозможно отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
