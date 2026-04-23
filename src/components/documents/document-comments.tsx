'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/lib/types';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

import {
  MessageSquare,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  GitMerge,
  Check,
  Pencil,
  X,
} from 'lucide-react';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface CommentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Comment {
  id: string;
  content: string;
  documentId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: CommentUser;
}

interface ApprovalStepComment {
  id: string;
  stepName: string;
  decision: 'APPROVED' | 'APPROVED_WITH_CHANGES' | 'REJECTED';
  comment: string;
  decidedBy: { id: string; name: string };
  decidedAt: string;
}

// Unified item for the merged list
type FeedItem =
  | { kind: 'user'; data: Comment }
  | { kind: 'approval'; data: ApprovalStepComment };

interface DocumentCommentsProps {
  documentId: string | undefined;
  onCommentCountChange?: (count: number) => void;
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────
function getAvatarColor(name: string): string {
  const colors = [
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-violet-600',
    'bg-cyan-600',
    'bg-orange-600',
    'bg-pink-600',
    'bg-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

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
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
    case 'ADVANCED':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
}

// ────────────────────────────────────────────
// Comment Skeleton
// ────────────────────────────────────────────
function CommentSkeleton() {
  return (
    <div className="flex gap-3 p-3">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────
export default function DocumentComments({
  documentId,
  onCommentCountChange,
}: DocumentCommentsProps) {
  const { token, user } = useStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [approvalComments, setApprovalComments] = useState<ApprovalStepComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch comments + approval step comments ──
  const fetchComments = useCallback(async () => {
    if (!documentId || !token) return;
    try {
      setLoading(true);
      const [commentsData, approvalsData] = await Promise.all([
        apiFetch<{ comments: Comment[] }>(`/api/documents/${documentId}/comments`, token),
        apiFetch<{ approvals: any[] }>(`/api/documents/${documentId}/approvals`, token),
      ]);

      const commentList = Array.isArray(commentsData)
        ? commentsData
        : (commentsData as any).comments || [];
      setComments(commentList);
      onCommentCountChange?.(commentList.length);

      // Extract step comments from immutable decision history
      const stepComments: ApprovalStepComment[] = [];
      const approvals: any[] = (approvalsData as any).approvals || [];
      for (const approval of approvals) {
        for (const step of approval.steps ?? []) {
          for (const dec of step.decisions ?? []) {
            if (dec.comment) {
              stepComments.push({
                id: dec.id,
                stepName: step.name,
                decision: dec.decision,
                comment: dec.comment,
                decidedBy: dec.decidedBy,
                decidedAt: dec.createdAt,
              });
            }
          }
        }
      }
      setApprovalComments(stepComments);
    } catch {
      // Silent fail on load
    } finally {
      setLoading(false);
    }
  }, [documentId, token, onCommentCountChange]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // ── Submit comment ──
  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || !documentId || !token || submitting) return;
    setSubmitting(true);
    try {
      const result = await apiFetch<{ comment: Comment }>(
        `/api/documents/${documentId}/comments`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );
      const newCommentObj = (result as unknown as { comment: Comment }).comment;
      setComments((prev) => [newCommentObj, ...prev]);
      onCommentCountChange?.(comments.length + 1 + approvalComments.length);
      setNewComment('');
      toast.success('Комментарий добавлен');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка добавления комментария');
    } finally {
      setSubmitting(false);
    }
  }, [newComment, documentId, token, submitting, comments.length, onCommentCountChange]);

  // ── Delete comment ──
  const handleDelete = useCallback(async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    try {
      await apiFetch(
        `/api/comments/${deleteTarget.id}`,
        token,
        { method: 'DELETE' }
      );
      const newCount = comments.length - 1 + approvalComments.length;
      setComments((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      onCommentCountChange?.(newCount);
      setDeleteTarget(null);
      toast.success('Комментарий удалён');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, token, comments.length, onCommentCountChange]);

  // ── Handle textarea auto-resize ──
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  // ── Handle keyboard submit ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canDelete = (comment: Comment) => {
    return comment.userId === user?.id || user?.role === 'ADMIN';
  };

  // Merge and sort user comments + approval step comments by date desc
  const feedItems: FeedItem[] = [
    ...comments.map((c): FeedItem => ({ kind: 'user', data: c })),
    ...approvalComments.map((c): FeedItem => ({ kind: 'approval', data: c })),
  ].sort((a, b) => {
    const dateA = a.kind === 'user' ? a.data.createdAt : a.data.decidedAt;
    const dateB = b.kind === 'user' ? b.data.createdAt : b.data.decidedAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const totalCount = feedItems.length;

  if (!documentId) return null;

  return (
    <>
      <div className="border rounded-lg bg-card">
        {/* ── Collapsible ── */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Комментарии
                {totalCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 font-medium"
                  >
                    {totalCount}
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="max-h-96 overflow-y-auto">
              {/* Loading */}
              {loading && (
                <div className="divide-y">
                  <CommentSkeleton />
                  <CommentSkeleton />
                  <CommentSkeleton />
                </div>
              )}

              {/* Empty State */}
              {!loading && feedItems.length === 0 && (
                <div className="py-10 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Пока нет комментариев
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Оставьте первый комментарий к документу
                  </p>
                </div>
              )}

              {/* Unified feed */}
              {!loading && feedItems.length > 0 && (
                <div className="divide-y">
                  {feedItems.map((item) => {
                    if (item.kind === 'approval') {
                      const ac = item.data;
                      const decisionStyle =
                        ac.decision === 'APPROVED'
                          ? { bg: 'bg-emerald-50 dark:bg-emerald-950/20', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Согласован', Icon: Check }
                          : ac.decision === 'APPROVED_WITH_CHANGES'
                          ? { bg: 'bg-amber-50 dark:bg-amber-950/20', badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400', label: 'С изменениями', Icon: Pencil }
                          : { bg: 'bg-rose-50 dark:bg-rose-950/20', badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400', label: 'Отклонён', Icon: X };
                      return (
                        <div key={`approval-${ac.id}`} className={`flex gap-3 p-3 ${decisionStyle.bg}`}>
                          <div className="h-8 w-8 shrink-0 rounded-full bg-white dark:bg-slate-800 border flex items-center justify-center">
                            <GitMerge className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">
                                {ac.decidedBy.name}
                              </span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border flex items-center gap-1 ${decisionStyle.badge}`}>
                                <decisionStyle.Icon className="h-2.5 w-2.5" />
                                {decisionStyle.label}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">по шагу «{ac.stepName}»</span>
                              <span className="text-[11px] text-muted-foreground">·</span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatRelativeTime(ac.decidedAt)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words leading-relaxed">
                              {ac.comment}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const comment = item.data;
                    return (
                      <div
                        key={comment.id}
                        className="flex gap-3 p-3 group hover:bg-muted/30 transition-colors"
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback
                            className={`${getAvatarColor(comment.user.name)} text-white text-[11px] font-medium`}
                          >
                            {getInitials(comment.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {comment.user.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 border ${getRoleBadgeClass(comment.user.role)}`}
                            >
                              {ROLE_LABELS[comment.user.role] || comment.user.role}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatRelativeTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words leading-relaxed">
                            {comment.content}
                          </p>
                        </div>
                        {canDelete(comment) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            onClick={() => setDeleteTarget(comment)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t px-3 py-3">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={newComment}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Написать комментарий..."
                  rows={1}
                  className="resize-none min-h-[36px] max-h-[160px] text-sm flex-1"
                  disabled={submitting}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                Ctrl+Enter для отправки
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить комментарий?</AlertDialogTitle>
            <AlertDialogDescription>
              Комментарий будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
