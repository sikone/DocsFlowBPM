'use client'

import { useEffect, useState, useRef } from 'react'
import { FileText, Clock, CheckCircle2, TrendingUp } from 'lucide-react'

interface Stats {
  totalDocuments: number
  byStatus: Record<string, number>
  documentsThisWeek: number
}

interface StatsSummaryBarProps {
  token: string | null
}

// ─── Animated Number Counter ─────────────────────────────────────────
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const startTime = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    startTime.current = null

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const elapsed = timestamp - startTime.current
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return <span>{display}</span>
}

export default function StatsSummaryBar({ token }: StatsSummaryBarProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/documents/stats?token=${token}`)
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [token])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[72px] rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const statCards = [
    {
      label: 'Всего документов',
      value: stats.totalDocuments,
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'В работе',
      value: stats.byStatus?.IN_PROGRESS || 0,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: 'Утверждённых',
      value: stats.byStatus?.APPROVED || 0,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'За неделю',
      value: stats.documentsThisWeek || 0,
      icon: TrendingUp,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {statCards.map((card, idx) => (
        <div
          key={card.label}
          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow duration-200"
        >
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-lg ${card.bg}`}
          >
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground leading-none">
              {mounted ? (
                <AnimatedNumber
                  value={card.value}
                  duration={600 + idx * 150}
                />
              ) : (
                card.value
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {card.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
