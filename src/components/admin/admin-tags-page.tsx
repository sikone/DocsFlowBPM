'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreHorizontal,
  Tags,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

// ── Tag data types ──
interface TagWithMeta {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  creator?: { id: string; name: string } | null;
  _count?: { documents: number };
}

interface TagFormData {
  name: string;
  color: string;
}

const DEFAULT_TAG_FORM: TagFormData = {
  name: '',
  color: '#10b981',
};

const TAG_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#6b7280',
];

export function AdminTagsPage() {
  const { token } = useStore();
  const [tags, setTags] = useState<TagWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagWithMeta | null>(null);
  const [form, setForm] = useState<TagFormData>(DEFAULT_TAG_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Load tags ──
  const loadTags = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<TagWithMeta[]>('/api/tags', token);
      setTags(data);
    } catch {
      toast.error('Не удалось загрузить теги');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // ── Open create dialog ──
  const openCreate = () => {
    setEditingTag(null);
    setForm(DEFAULT_TAG_FORM);
    setDialogOpen(true);
  };

  // ── Open edit dialog ──
  const openEdit = (tag: TagWithMeta) => {
    setEditingTag(tag);
    setForm({ name: tag.name, color: tag.color });
    setDialogOpen(true);
  };

  // ── Save (create or update) ──
  const handleSave = async () => {
    if (!token || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editingTag) {
        await apiFetch(`/api/tags/${editingTag.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({ name: form.name.trim(), color: form.color }),
        });
        toast.success('Тег обновлён');
      } else {
        await apiFetch('/api/tags', token, {
          method: 'POST',
          body: JSON.stringify({ name: form.name.trim(), color: form.color }),
        });
        toast.success('Тег создан');
      }
      setDialogOpen(false);
      loadTags();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка сохранения';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (tagId: string) => {
    if (!token) return;
    setDeletingId(tagId);
    try {
      await apiFetch(`/api/tags/${tagId}`, token, { method: 'DELETE' });
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      toast.success('Тег удалён');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка удаления';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Filtered tags ──
  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Теги</h1>
          <p className="text-muted-foreground mt-1">
            Управление тегами для классификации документов
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Создать тег
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию тега..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tags table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Цвет</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Документов
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Создал
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Дата создания
                  </TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center">
                        <Tags className="w-10 h-10 text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-sm">
                          {search
                            ? 'Теги не найдены'
                            : 'Теги пока не созданы'}
                        </p>
                        {!search && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 gap-2"
                            onClick={openCreate}
                          >
                            <Plus className="w-4 h-4" />
                            Создать первый тег
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((tag) => (
                    <TableRow key={tag.id}>
                      {/* Color swatch */}
                      <TableCell>
                        <div
                          className="w-6 h-6 rounded-full border border-border/50 shadow-sm"
                          style={{ backgroundColor: tag.color }}
                        />
                      </TableCell>
                      {/* Name with tag preview */}
                      <TableCell className="font-medium">
                        <Badge
                          className="text-xs font-medium border-0"
                          style={{
                            backgroundColor: tag.color + '18',
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </Badge>
                      </TableCell>
                      {/* Document count */}
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {tag._count?.documents ?? 0}
                        </span>
                      </TableCell>
                      {/* Creator */}
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {tag.creator?.name || '—'}
                        </span>
                      </TableCell>
                      {/* Created date */}
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {tag.createdAt
                            ? new Date(tag.createdAt).toLocaleDateString('ru-RU')
                            : '—'}
                        </span>
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEdit(tag)}
                              className="gap-2"
                            >
                              <Pencil className="w-4 h-4" />
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="gap-2 text-rose-600 focus:text-rose-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Удалить
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Удалить тег?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Вы уверены, что хотите удалить тег &quot;
                                    {tag.name}&quot;?{tag._count && tag._count.documents > 0 && (
                                      <>
                                        <br />
                                        <span className="font-medium text-rose-600">
                                          Тег привязан к {tag._count.documents}{' '}
                                          {tag._count.documents === 1
                                            ? 'документу'
                                            : tag._count.documents < 5
                                              ? 'документам'
                                              : 'документам'}
                                        </span>
                                        . Связи будут удалены.
                                      </>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-rose-600 hover:bg-rose-700"
                                    onClick={() => handleDelete(tag.id)}
                                    disabled={deletingId === tag.id}
                                  >
                                    {deletingId === tag.id && (
                                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    )}
                                    Удалить
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {!loading && tags.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Всего тегов: {tags.length} &middot; Показано: {filtered.length}
        </p>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? 'Редактировать тег' : 'Новый тег'}
            </DialogTitle>
            <DialogDescription>
              {editingTag
                ? 'Измените название или цвет тега'
                : 'Задайте название и выберите цвет для нового тега'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="tag-name">Название</Label>
              <Input
                id="tag-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Например: Срочно, Важно, На проверке"
                autoFocus
              />
            </div>

            {/* Color picker */}
            <div className="space-y-3">
              <Label>Цвет</Label>
              <div className="flex flex-wrap gap-2.5">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={`relative w-9 h-9 rounded-full transition-all duration-150 hover:scale-110 ${
                      form.color === color
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-emerald-500 scale-110'
                        : 'ring-1 ring-border/50'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Цвет ${color}`}
                  >
                    {form.color === color && (
                      <Check
                        className="w-4 h-4 absolute inset-0 m-auto text-white drop-shadow-sm"
                        strokeWidth={3}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom color input */}
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full border border-border/50 shrink-0"
                  style={{ backgroundColor: form.color }}
                />
                <Input
                  value={form.color}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value }))
                  }
                  placeholder="#000000"
                  className="flex-1 font-mono text-sm"
                  maxLength={7}
                />
                {form.color !== DEFAULT_TAG_FORM.color &&
                  form.color !== editingTag?.color && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          color: editingTag?.color || DEFAULT_TAG_FORM.color,
                        }))
                      }
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
              </div>
            </div>

            {/* Preview */}
            {form.name.trim() && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Предпросмотр
                </Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Badge
                    className="text-xs font-medium border-0"
                    style={{
                      backgroundColor: form.color + '18',
                      color: form.color,
                    }}
                  >
                    {form.name}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingTag ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
