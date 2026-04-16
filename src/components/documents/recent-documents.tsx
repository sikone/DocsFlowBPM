'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

interface RecentDocument {
  id: string
  title: string
  status: string
  typeId: string
  type?: {
    id: string
    name: string
    icon: string
    color: string
  } | null
  viewedAt: string
}

interface RecentDocumentsProps {
  token: string | null
  onDocumentClick: (docId: string) => void
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  if (diffHour < 24) return `${diffHour} ч назад`
  if (diffDay < 7) return `${diffDay} дн назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function RecentDocuments({ token, onDocumentClick }: RecentDocumentsProps) {
  const [documents, setDocuments] = useState<RecentDocument[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecent = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/recent?token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to fetch recent documents:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchRecent()
  }, [fetchRecent])

  // Listen for refresh events
  useEffect(() => {
    const handler = () => fetchRecent()
    window.addEventListener('refresh-recent', handler)
    return () => window.removeEventListener('refresh-recent', handler)
  }, [fetchRecent])

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
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Недавно просмотренные
        </span>
        {documents.length > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
          >
            {documents.length}
          </Badge>
        )}
      </div>
      {documents.length === 0 ? (
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground/60 italic">Нет недавних документов</p>
        </div>
      ) : (
        <ScrollArea className="max-h-48">
          <div className="px-1 pb-1">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onDocumentClick(doc.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors group"
              >
                {doc.type?.icon ? (
                  <FileText
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: doc.type.color }}
                  />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0 text-left">
                  <span className="truncate block text-xs">{doc.title}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/50 shrink-0 flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTimeAgo(doc.viewedAt)}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
