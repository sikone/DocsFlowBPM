'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { useStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import { DEFAULT_WORKING_HOURS } from '@/lib/sla'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

// Monday-first short labels
const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD in local timezone — consistent with sla.ts calculateDeadline */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Convert JS Sunday-based day (0=Sun…6=Sat) to ISO (1=Mon…7=Sun) */
function toIsoDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay
}

/** Get all Date objects for a given year/month (0-based month) */
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

// ---------------------------------------------------------------------------
// MonthGrid
// ---------------------------------------------------------------------------

interface MonthGridProps {
  year: number
  month: number
  workingDays: number[]
  holidaySet: Set<string>
  todayStr: string
}

function MonthGrid({ year, month, workingDays, holidaySet, todayStr }: MonthGridProps) {
  const days = getDaysInMonth(year, month)
  const firstIsoDay = toIsoDay(days[0].getDay())
  const leadingBlanks = firstIsoDay - 1 // cells before the 1st (Mon-start grid)

  return (
    <div>
      <p className="text-sm font-semibold text-center mb-3 text-foreground">{MONTH_NAMES[month]}</p>
      <div className="grid grid-cols-7 gap-px">
        {/* Weekday header row */}
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-[10px] text-center font-medium pb-1 ${
              i >= 5 ? 'text-rose-400 dark:text-rose-500' : 'text-muted-foreground'
            }`}
          >
            {label}
          </div>
        ))}

        {/* Leading blank cells */}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const dateStr = formatLocalDate(day)
          const isoDay = toIsoDay(day.getDay())
          const isScheduledWorking = workingDays.includes(isoDay)
          const isInHolidaySet = holidaySet.has(dateStr)

          // A day that would normally be worked but isdayoff says non-working
          const isOfficialHoliday = isScheduledWorking && isInHolidaySet
          // Regular weekend per the configured schedule
          const isWeekend = !isScheduledWorking
          // Transferred working day: scheduled as off but isdayoff says working (0)
          // We surface this so the admin can see it, but we don't auto-count it for SLA
          const isTransferred = !isScheduledWorking && holidaySet.size > 0 && !isInHolidaySet
          const isToday = dateStr === todayStr

          let cellCls =
            'relative text-[11px] text-center rounded cursor-default select-none h-7 flex items-center justify-center transition-colors'

          if (isOfficialHoliday) {
            cellCls += ' bg-rose-500 dark:bg-rose-600 text-white font-semibold'
          } else if (isWeekend) {
            cellCls += isTransferred
              ? ' bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
              : ' bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
          } else {
            cellCls += ' text-foreground hover:bg-muted/60'
          }

          if (isToday) {
            cellCls += ' ring-2 ring-emerald-400 ring-offset-1 dark:ring-offset-slate-900 font-bold'
          }

          const title = isOfficialHoliday
            ? 'Праздник / официальный нерабочий день — не учитывается в SLA'
            : isTransferred
              ? 'Перенесённый рабочий день (isdayoff.ru)'
              : undefined

          return (
            <div key={dateStr} className={cellCls} title={title}>
              {day.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function AdminCalendarPage() {
  const { token } = useStore()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [workingDays, setWorkingDays] = useState<number[]>(DEFAULT_WORKING_HOURS.workingDays)
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set())
  const [synced, setSynced] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  const todayStr = formatLocalDate(now)

  // Count holidays that actually fall on configured working days — these affect SLA
  const slaHolidayCount = React.useMemo(() => {
    let count = 0
    for (const dateStr of holidaySet) {
      const d = new Date(dateStr + 'T12:00:00') // noon to avoid TZ edge cases
      if (workingDays.includes(toIsoDay(d.getDay()))) count++
    }
    return count
  }, [holidaySet, workingDays])

  const loadHolidaysForYear = useCallback(
    async (y: number) => {
      if (!token) return
      setLoading(true)
      try {
        const res = await apiFetch<{ year: number; dates: string[]; synced: boolean }>(
          `/api/admin/holidays?year=${y}`,
          token,
        )
        setHolidaySet(new Set(res.dates))
        setSynced(res.synced)
      } catch {
        setHolidaySet(new Set())
        setSynced(false)
      } finally {
        setLoading(false)
      }
    },
    [token],
  )

  // Load working days config and holidays whenever year changes
  useEffect(() => {
    if (!token) return
    apiFetch<Record<string, string>>('/api/settings', token)
      .then((settings) => {
        if (settings.workingDays) {
          try {
            const parsed = JSON.parse(settings.workingDays) as number[]
            if (Array.isArray(parsed) && parsed.length > 0) setWorkingDays(parsed)
          } catch { /* keep default */ }
        }
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    loadHolidaysForYear(year)
  }, [year, loadHolidaysForYear])

  const handleSync = async () => {
    if (!token) return
    setSyncing(true)
    try {
      const res = await apiFetch<{ year: number; dates: string[]; count: number }>(
        '/api/admin/holidays',
        token,
        { method: 'POST', body: JSON.stringify({ year }) },
      )
      setHolidaySet(new Set(res.dates))
      setSynced(true)
      toast.success(`Загружено ${res.count} нерабочих дней за ${year} год`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка синхронизации'
      toast.error(msg)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-emerald-500" />
              Производственный календарь
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Праздничные и нерабочие дни исключаются из расчёта SLA шагов согласования
            </p>
          </div>

          {/* Year navigation + sync */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)} disabled={syncing}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xl font-bold w-16 text-center tabular-nums">{year}</span>
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)} disabled={syncing}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-8 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleSync} disabled={syncing || loading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Загрузка…' : 'Синхронизировать'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-center">
                Загрузить официальный производственный календарь России за {year} год с&nbsp;isdayoff.ru
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Legend + status ── */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-rose-500 dark:bg-rose-600 inline-block shrink-0" />
            Праздник / нерабочий по isdayoff.ru
          </span>
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-700 border inline-block shrink-0" />
            Выходной по расписанию
          </span>
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-300 inline-block shrink-0" />
            Перенесённый рабочий день
          </span>
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded border-2 border-emerald-400 inline-block shrink-0" />
            Сегодня
          </span>

          <Separator orientation="vertical" className="h-5 hidden sm:block" />

          {synced ? (
            <Badge variant="outline" className="text-emerald-600 border-emerald-400 dark:border-emerald-600">
              {slaHolidayCount} праздников на рабочие дни — не учитываются в SLA
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1">
              <Info className="w-3 h-3" />
              Нет данных за {year} г. — нажмите «Синхронизировать»
            </Badge>
          )}
        </div>

        {/* ── 12-month calendar grid ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Card key={i} className="p-4 h-52 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, month) => (
              <Card
                key={month}
                className={`p-4 transition-shadow hover:shadow-md ${
                  month === now.getMonth() && year === now.getFullYear()
                    ? 'ring-1 ring-emerald-400/50'
                    : ''
                }`}
              >
                <MonthGrid
                  year={year}
                  month={month}
                  workingDays={workingDays}
                  holidaySet={holidaySet}
                  todayStr={todayStr}
                />
              </Card>
            ))}
          </div>
        )}

        {/* ── Data source note ── */}
        <p className="text-xs text-muted-foreground text-right">
          Данные:{' '}
          <a
            href="https://isdayoff.ru"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            isdayoff.ru
          </a>{' '}
          — официальный производственный календарь РФ
        </p>
      </div>
    </TooltipProvider>
  )
}
