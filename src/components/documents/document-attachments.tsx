'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, X, Download, Loader2, File, FileText, Image as ImageIcon,
  FileSpreadsheet, Presentation, ChevronDown, ChevronRight,
  Pencil, CircleDot, CheckCircle2, History, UserRound, Trash2, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  groupId: string;
  version: number;
  isLatest: boolean;
  deletedAt: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

interface AttachmentGroup {
  groupId: string;
  latest: Attachment;
  history: Attachment[];
  isDeleted: boolean;
}

interface Props {
  documentId: string;
  token: string;
  locked?: boolean;
  documentStatus?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин. назад`;
    if (diffHour < 24) return `${diffHour} ч. назад`;
    if (diffDay === 1) return 'вчера';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

function groupAttachments(list: Attachment[]): AttachmentGroup[] {
  const map = new Map<string, Attachment[]>();
  for (const att of list) {
    const arr = map.get(att.groupId) ?? [];
    arr.push(att);
    map.set(att.groupId, arr);
  }

  const groups: AttachmentGroup[] = [];
  for (const [groupId, items] of map.entries()) {
    const sorted = [...items].sort((a, b) => b.version - a.version);
    const latest = sorted[0];
    const isDeleted = items.every((a) => !!a.deletedAt);
    groups.push({ groupId, latest, history: sorted.slice(1), isDeleted });
  }

  // Active groups first, then deleted; within each group sort by createdAt desc
  groups.sort((a, b) => {
    if (a.isDeleted !== b.isDeleted) return a.isDeleted ? 1 : -1;
    return new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime();
  });
  return groups;
}

// Editable file types (Word, Excel, PowerPoint, LibreOffice, text)
const EDITABLE_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
]);

function isEditable(mimeType: string): boolean {
  return EDITABLE_MIME_TYPES.has(mimeType);
}

// ─── File icon ────────────────────────────────────────────────────────────────

function FileIcon({ mimeType, className = 'w-4 h-4' }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon className={`${className} text-sky-500`} />;
  if (mimeType.includes('pdf')) return <FileText className={`${className} text-rose-500`} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return <FileSpreadsheet className={`${className} text-emerald-600`} />;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return <Presentation className={`${className} text-orange-500`} />;
  if (mimeType.includes('word') || mimeType.includes('wordprocessingml') || mimeType.includes('opendocument.text'))
    return <FileText className={`${className} text-blue-500`} />;
  return <File className={`${className} text-slate-400`} />;
}

// ─── Version history row ──────────────────────────────────────────────────────

function HistoryRow({
  att,
  documentId,
  token,
  isDeleted,
}: {
  att: Attachment;
  documentId: string;
  token: string;
  isDeleted: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pl-8 pr-2 py-1.5 rounded hover:bg-muted/30 transition-colors group/hist">
      <span className="text-[10px] font-mono text-muted-foreground/60 w-5 shrink-0">v{att.version}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <UserRound className="w-3 h-3 text-muted-foreground/50 shrink-0" />
          <span className={`text-[11px] text-muted-foreground truncate ${isDeleted ? 'line-through opacity-50' : ''}`}>
            {att.uploadedBy.name}
          </span>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span className={`text-[10px] text-muted-foreground/60 ${isDeleted ? 'line-through opacity-50' : ''}`}>
            {formatDate(att.createdAt)}
          </span>
          <span className={`text-[10px] text-muted-foreground/40 ${isDeleted ? 'opacity-50' : ''}`}>
            {formatBytes(att.fileSize)}
          </span>
        </div>
      </div>
      {!isDeleted && (
        <a
          href={`/api/documents/${documentId}/attachments/${att.id}/download?token=${encodeURIComponent(token)}`}
          download={att.originalName}
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover/hist:opacity-100 transition-all"
          title="Скачать эту версию"
        >
          <Download className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentAttachments({ documentId, token, locked = false, documentStatus }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [restoringGroupId, setRestoringGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [watchingGroupId, setWatchingGroupId] = useState<string | null>(null);
  const [openingGroupId, setOpeningGroupId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const serverWatchAttIdRef = useRef<string | null>(null);

  const isDraft = documentStatus === 'DRAFT';

  // Stop server watcher on unmount (in-app navigation)
  useEffect(() => {
    return () => {
      const attId = serverWatchAttIdRef.current;
      if (attId) {
        fetch(
          `/api/documents/${documentId}/attachments/${attId}/open-local?token=${encodeURIComponent(token)}`,
          { method: 'DELETE', keepalive: true }
        ).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop server watcher on browser close / page refresh
  useEffect(() => {
    const handlePageHide = () => {
      const attId = serverWatchAttIdRef.current;
      if (!attId) return;
      fetch(
        `/api/documents/${documentId}/attachments/${attId}/open-local?token=${encodeURIComponent(token)}`,
        { method: 'DELETE', keepalive: true }
      ).catch(() => {});
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [documentId, token]);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/attachments?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAttachments(data.attachments ?? []);
    } catch {
      toast.error('Ошибка загрузки вложений');
    } finally {
      setLoading(false);
    }
  }, [documentId, token]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  // Poll for new versions AND check if server watcher is still active (detects editor close).
  useEffect(() => {
    if (!watchingGroupId) return;
    const attId = serverWatchAttIdRef.current;

    const poll = async () => {
      await fetchAttachments();
      // Auto-stop UI when the server watcher was terminated (e.g. editor lock file gone).
      if (attId) {
        try {
          const res = await fetch(
            `/api/documents/${documentId}/attachments/${attId}/watch-status?token=${encodeURIComponent(token)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (!data.active) {
              serverWatchAttIdRef.current = null;
              setWatchingGroupId(null);
            }
          }
        } catch { /* non-fatal */ }
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [watchingGroupId, fetchAttachments, documentId, token]);

  // ── Upload ────────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File, groupId?: string): Promise<Attachment | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (groupId) formData.append('groupId', groupId);

      const res = await fetch(
        `/api/documents/${documentId}/attachments?token=${encodeURIComponent(token)}`,
        { method: 'POST', body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка загрузки');
      }
      const data = await res.json();
      setAttachments((prev) => {
        const updated = prev.map((a) =>
          a.groupId === data.attachment.groupId ? { ...a, isLatest: false } : a
        );
        return [...updated, data.attachment];
      });
      return data.attachment;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки файла');
      return null;
    } finally {
      setUploading(false);
    }
  }, [documentId, token]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      uploadFile(f).then((att) => {
        if (att) toast.success(`${f.name} загружен`);
      });
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (group: AttachmentGroup) => {
    setDeletingGroupId(group.groupId);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/attachments/${group.latest.id}?token=${encodeURIComponent(token)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.softDeleted) {
        // Mark all versions in the group as deleted in local state
        const now = new Date().toISOString();
        setAttachments((prev) =>
          prev.map((a) => a.groupId === group.groupId ? { ...a, deletedAt: now } : a)
        );
        toast.success(`${group.latest.originalName} помечен как удалённый`);
      } else {
        // Hard deleted — remove from state entirely
        setAttachments((prev) => prev.filter((a) => a.groupId !== group.groupId));
        if (watchingGroupId === group.groupId) stopWatching();
        toast.success(`${group.latest.originalName} удалён`);
      }
    } catch {
      toast.error('Ошибка удаления файла');
    } finally {
      setDeletingGroupId(null);
    }
  };

  // ── Restore ───────────────────────────────────────────────────────────────

  const handleRestore = async (group: AttachmentGroup) => {
    setRestoringGroupId(group.groupId);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/attachments/${group.latest.id}/restore?token=${encodeURIComponent(token)}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error();
      setAttachments((prev) =>
        prev.map((a) => a.groupId === group.groupId ? { ...a, deletedAt: null } : a)
      );
      toast.success(`${group.latest.originalName} восстановлен`);
    } catch {
      toast.error('Ошибка восстановления файла');
    } finally {
      setRestoringGroupId(null);
    }
  };

  // ── File watcher ──────────────────────────────────────────────────────────

  const stopWatching = useCallback(async () => {
    const attId = serverWatchAttIdRef.current;
    if (attId) {
      serverWatchAttIdRef.current = null;
      setWatchingGroupId(null);
      try {
        await fetch(
          `/api/documents/${documentId}/attachments/${attId}/open-local?token=${encodeURIComponent(token)}`,
          { method: 'DELETE' }
        );
      } catch { /* non-fatal */ }
    }
  }, [documentId, token]);

  const handleOpenForEditing = useCallback(
    async (att: Attachment) => {
      setOpeningGroupId(att.groupId);
      try {
        const prevAttId = serverWatchAttIdRef.current;
        if (prevAttId) {
          serverWatchAttIdRef.current = null;
          setWatchingGroupId(null);
          fetch(
            `/api/documents/${documentId}/attachments/${prevAttId}/open-local?token=${encodeURIComponent(token)}`,
            { method: 'DELETE' }
          ).catch(() => {});
        }

        const res = await fetch(
          `/api/documents/${documentId}/attachments/${att.id}/open-local?token=${encodeURIComponent(token)}`,
          { method: 'POST' }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Ошибка открытия файла');
        }

        serverWatchAttIdRef.current = att.id;
        setWatchingGroupId(att.groupId);

        toast.success('Файл открывается в приложении. Изменения загружаются автоматически.', {
          duration: 5000,
        });
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Не удалось открыть файл');
      } finally {
        setOpeningGroupId(null);
      }
    },
    [documentId, token]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const groups = groupAttachments(attachments);
  const activeGroups = groups.filter((g) => !g.isDeleted);
  const deletedGroups = groups.filter((g) => g.isDeleted);

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const renderGroup = (group: AttachmentGroup) => {
    const { groupId, latest, history, isDeleted } = group;
    const isWatching = watchingGroupId === groupId;
    const isOpening = openingGroupId === groupId;
    const isDeleting = deletingGroupId === groupId;
    const isExpanded = expandedGroups.has(groupId);
    const hasHistory = history.length > 0;
    const canEdit = isEditable(latest.mimeType) && !locked && !isDeleted;

    return (
      <div
        key={groupId}
        className={`rounded-lg border transition-colors ${
          isDeleted
            ? 'border-border/40 bg-muted/5 opacity-60'
            : isWatching
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/10'
            : 'border-border bg-muted/10 hover:bg-muted/30'
        }`}
      >
        {/* Latest version row */}
        <div className="flex items-start gap-2 p-2">
          {/* Expand toggle / file icon */}
          <button
            className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => hasHistory && toggleExpand(groupId)}
            disabled={!hasHistory}
          >
            {hasHistory ? (
              isExpanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />
            ) : (
              <FileIcon mimeType={latest.mimeType} />
            )}
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {hasHistory && <FileIcon mimeType={latest.mimeType} className="w-3.5 h-3.5 shrink-0" />}
              <p className={`text-xs font-medium truncate max-w-[180px] ${isDeleted ? 'line-through text-muted-foreground' : ''}`}>
                {latest.originalName}
              </p>

              {/* Version badge */}
              {latest.version > 1 && (
                <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground leading-none">
                  v{latest.version}
                </span>
              )}

              {/* Status badge */}
              {isDeleted ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium leading-none shrink-0">
                  <Trash2 className="w-2.5 h-2.5" />
                  удалено
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium leading-none shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  последняя
                </span>
              )}

              {/* Watching badge */}
              {isWatching && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium leading-none shrink-0 animate-pulse">
                  <CircleDot className="w-2.5 h-2.5" />
                  отслеживается
                </span>
              )}
            </div>

            {/* Meta line */}
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <UserRound className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <span className={`text-[11px] text-muted-foreground ${isDeleted ? 'line-through' : ''}`}>
                {latest.uploadedBy.name}
              </span>
              <span className="text-[10px] text-muted-foreground/50">·</span>
              <span className={`text-[10px] text-muted-foreground/60 ${isDeleted ? 'line-through' : ''}`}>
                {formatDate(latest.createdAt)}
              </span>
              {!isDeleted && (
                <>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground/40">{formatBytes(latest.fileSize)}</span>
                </>
              )}
              {hasHistory && (
                <>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <button
                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    onClick={() => toggleExpand(groupId)}
                  >
                    <History className="w-2.5 h-2.5" />
                    {history.length} {history.length === 1 ? 'версия' : history.length < 5 ? 'версии' : 'версий'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          {isDeleted ? (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => handleRestore(group)}
                disabled={restoringGroupId === groupId}
                className="p-1.5 rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                title="Восстановить вложение"
              >
                {restoringGroupId === groupId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Open for editing */}
              {canEdit && (
                <button
                  onClick={() => isWatching ? stopWatching() : handleOpenForEditing(latest)}
                  disabled={isOpening}
                  className={`p-1.5 rounded transition-colors text-xs flex items-center gap-1 ${
                    isWatching
                      ? 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950/30'
                      : 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20'
                  }`}
                  title={isWatching ? 'Остановить отслеживание' : 'Открыть для редактирования'}
                >
                  {isOpening ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Pencil className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {/* Download */}
              <a
                href={`/api/documents/${documentId}/attachments/${latest.id}/download?token=${encodeURIComponent(token)}`}
                download={latest.originalName}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Скачать"
              >
                <Download className="w-3.5 h-3.5" />
              </a>

              {/* Delete */}
              {!locked && (
                <button
                  onClick={() => handleDelete(group)}
                  disabled={isDeleting}
                  className="p-1.5 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  title={isDraft ? 'Удалить вложение' : 'Пометить как удалённое'}
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Version history */}
        {isExpanded && hasHistory && (
          <div className="border-t border-border/50 pb-1 pt-0.5">
            {history.map((att) => (
              <HistoryRow key={att.id} att={att} documentId={documentId} token={token} isDeleted={isDeleted} />
            ))}
          </div>
        )}

        {/* Watching footer */}
        {isWatching && (
          <div className="border-t border-amber-200 dark:border-amber-800 px-3 py-1.5 flex items-center justify-between">
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Файл открыт локально — изменения загружаются автоматически
            </p>
            <button
              onClick={stopWatching}
              className="text-[10px] text-amber-600 hover:text-amber-800 dark:hover:text-amber-300 font-medium transition-colors ml-3 shrink-0"
            >
              Завершить
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      {!locked && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
            dragOver
              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
              : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-1 text-center">
            {uploading ? (
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground/50" />
            )}
            <p className="text-xs text-muted-foreground">
              {uploading ? 'Загрузка...' : 'Перетащите файл или нажмите'}
            </p>
          </div>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-1">Нет вложений</p>
      ) : (
        <div className="space-y-1">
          {activeGroups.map(renderGroup)}

          {/* Deleted groups section */}
          {deletedGroups.length > 0 && (
            <>
              {activeGroups.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 border-t border-border/40" />
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">удалённые</span>
                  <div className="flex-1 border-t border-border/40" />
                </div>
              )}
              {deletedGroups.map(renderGroup)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
