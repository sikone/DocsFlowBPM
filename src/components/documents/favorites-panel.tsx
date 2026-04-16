'use client'

import { useEffect, useState, useCallback } from 'react'
import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import type { Document } from '@/lib/types'

interface FavoritesPanelProps {
  token: string | null
  onDocumentClick: (docId: string) => void
}

export default function FavoritesPanel({ token, onDocumentClick }: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFavorites = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/favorites?token=${token}`)
      if (res.ok) {
        const data = await res.json()
        // The API returns favorite objects with nested document
        const docs = Array.isArray(data)
          ? data.map((f: any) => f.document).filter(Boolean)
          : []
        setFavorites(docs)
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  // Expose refresh method via custom event
  useEffect(() => {
    const handler = () => fetchFavorites()
    window.addEventListener('refresh-favorites', handler)
    return () => window.removeEventListener('refresh-favorites', handler)
  }, [fetchFavorites])

  if (loading) {
    return (
      <div className="px-3 py-2 space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7 w-full rounded" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Избранное
        </span>
        {favorites.length > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >
            {favorites.length}
          </Badge>
        )}
      </div>
      {favorites.length === 0 ? (
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground/60 italic">Нет избранных документов</p>
        </div>
      ) : (
        <ScrollArea className="max-h-48">
          <div className="px-1 pb-1">
            {favorites.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onDocumentClick(doc.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-md transition-colors group"
              >
                <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
