// SLA and working-hours utilities

export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface SlaConfig {
  LOW: number
  MEDIUM: number
  HIGH: number
  CRITICAL: number
}

export interface WorkingHoursConfig {
  /** Hour (0-23) when working day starts */
  start: number
  /** Hour (0-23) when working day ends */
  end: number
  /** Working days: 1=Mon, 2=Tue, ..., 7=Sun */
  workingDays: number[]
}

export const DEFAULT_SLA: SlaConfig = { LOW: 48, MEDIUM: 24, HIGH: 8, CRITICAL: 4 }

export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  start: 8,
  end: 18,
  workingDays: [1, 2, 3, 4, 5],
}

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  LOW: 'Низкая',
  MEDIUM: 'Средняя',
  HIGH: 'Высокая',
  CRITICAL: 'Экстренная',
}

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  LOW: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600',
  MEDIUM: 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-700',
}

export const URGENCY_DOT_COLORS: Record<UrgencyLevel, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-sky-500',
  HIGH: 'bg-amber-500',
  CRITICAL: 'bg-rose-500',
}

/**
 * Format a local-time Date as YYYY-MM-DD for holiday set lookups.
 * Uses getFullYear/getMonth/getDate (local timezone) to match how
 * calculateDeadline advances `current` with setHours/setDate.
 */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Extract the full holiday set from SystemSettings.
 * Keys matching `holidays_YYYY` are JSON arrays of YYYY-MM-DD strings
 * (populated by syncing from isdayoff.ru via /api/admin/holidays).
 */
export function getHolidaysFromSettings(settings: Record<string, string>): Set<string> {
  const set = new Set<string>()
  for (const [key, value] of Object.entries(settings)) {
    if (/^holidays_\d{4}$/.test(key)) {
      try {
        const dates = JSON.parse(value) as string[]
        for (const d of dates) set.add(d)
      } catch { /* ignore corrupt entry */ }
    }
  }
  return set
}

/**
 * Parse working hours config from SystemSettings key-value store.
 * Falls back to DEFAULT_WORKING_HOURS for any missing values.
 */
export function getWorkingHoursConfig(settings: Record<string, string>): WorkingHoursConfig {
  const start = parseInt(settings.workHoursStart ?? '', 10)
  const end = parseInt(settings.workHoursEnd ?? '', 10)
  let workingDays: number[] = DEFAULT_WORKING_HOURS.workingDays
  if (settings.workingDays) {
    try {
      const parsed = JSON.parse(settings.workingDays)
      if (Array.isArray(parsed) && parsed.length > 0) workingDays = parsed
    } catch { /* fallback */ }
  }
  return {
    start: Number.isFinite(start) && start >= 0 && start < 24 ? start : DEFAULT_WORKING_HOURS.start,
    end: Number.isFinite(end) && end > 0 && end <= 24 ? end : DEFAULT_WORKING_HOURS.end,
    workingDays,
  }
}

/**
 * Parse SLA config from a JSON string stored on a step.
 * Falls back to defaultSla for any missing urgency levels.
 */
export function parseSlaConfig(json: string | null | undefined, defaultSla: SlaConfig = DEFAULT_SLA): SlaConfig {
  if (!json) return defaultSla
  try {
    const parsed = JSON.parse(json)
    return {
      LOW:      typeof parsed.LOW      === 'number' ? parsed.LOW      : defaultSla.LOW,
      MEDIUM:   typeof parsed.MEDIUM   === 'number' ? parsed.MEDIUM   : defaultSla.MEDIUM,
      HIGH:     typeof parsed.HIGH     === 'number' ? parsed.HIGH     : defaultSla.HIGH,
      CRITICAL: typeof parsed.CRITICAL === 'number' ? parsed.CRITICAL : defaultSla.CRITICAL,
    }
  } catch {
    return defaultSla
  }
}

/**
 * Calculate the deadline by adding `workingHours` of working time to `from`.
 * Skips:
 *   - days not in config.workingDays (weekends per schedule)
 *   - hours outside the configured start/end window
 *   - dates present in the `holidays` set (official non-working days from isdayoff.ru)
 */
export function calculateDeadline(
  from: Date,
  workingHours: number,
  config: WorkingHoursConfig,
  holidays: ReadonlySet<string> = new Set(),
): Date {
  if (workingHours <= 0) return from

  let remainingMs = workingHours * 3600 * 1000
  let current = new Date(from)

  // Returns true if `date` is a working day per schedule AND not a holiday.
  const isWorkingDay = (date: Date): boolean => {
    const jsDay = date.getDay()
    const isoDay = jsDay === 0 ? 7 : jsDay
    if (!config.workingDays.includes(isoDay)) return false
    return !holidays.has(formatLocalDate(date))
  }

  // Safety: max 365 iterations to prevent infinite loops on bad config
  let guard = 0
  while (remainingMs > 0 && guard++ < 365) {
    if (!isWorkingDay(current)) {
      current.setDate(current.getDate() + 1)
      current.setHours(config.start, 0, 0, 0)
      continue
    }

    const dayStart = new Date(current)
    dayStart.setHours(config.start, 0, 0, 0)
    const dayEnd = new Date(current)
    dayEnd.setHours(config.end, 0, 0, 0)

    // Before start of work today → jump to start
    if (current < dayStart) current = dayStart

    // At or after end of work today → go to next day
    if (current >= dayEnd) {
      current.setDate(current.getDate() + 1)
      current.setHours(config.start, 0, 0, 0)
      continue
    }

    const availableMs = dayEnd.getTime() - current.getTime()

    if (availableMs >= remainingMs) {
      return new Date(current.getTime() + remainingMs)
    }

    remainingMs -= availableMs
    current.setDate(current.getDate() + 1)
    current.setHours(config.start, 0, 0, 0)
  }

  return current
}

/**
 * Compute the dueAt Date for a step given the document urgency, the step's
 * slaConfig JSON string, system settings, and the moment the step becomes active.
 * Returns null if the step has no slaConfig (no SLA applies).
 * Automatically loads holiday data from settings (keys: holidays_YYYY).
 */
export function computeStepDueAt(
  urgency: string,
  slaConfigJson: string | null | undefined,
  settings: Record<string, string>,
  from: Date = new Date(),
): Date | null {
  if (!slaConfigJson) return null
  const sla = parseSlaConfig(slaConfigJson)
  const hours = sla[urgency as UrgencyLevel] ?? sla.MEDIUM
  const whConfig = getWorkingHoursConfig(settings)
  const holidays = getHolidaysFromSettings(settings)
  return calculateDeadline(from, hours, whConfig, holidays)
}

export type CountdownStatus = 'ok' | 'warning' | 'overdue'

export interface CountdownResult {
  text: string
  status: CountdownStatus
}

/**
 * Format a human-readable countdown (in Russian) to a deadline.
 * Returns status 'ok', 'warning' (< 2 working hours remaining), or 'overdue'.
 */
export function formatCountdown(dueAt: Date | string): CountdownResult {
  const deadline = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const diffMs = deadline.getTime() - Date.now()

  if (diffMs <= 0) {
    const over = -diffMs
    const h = Math.floor(over / 3600000)
    const m = Math.floor((over % 3600000) / 60000)
    const text = h > 0 ? `просрочено на ${h}ч ${m > 0 ? m + 'мин' : ''}`.trim() : `просрочено на ${m}мин`
    return { text, status: 'overdue' }
  }

  const totalMin = Math.floor(diffMs / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60

  let text: string
  if (h >= 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    text = rh > 0 ? `${d}д ${rh}ч` : `${d}д`
  } else if (h > 0) {
    text = m > 0 ? `${h}ч ${m}мин` : `${h}ч`
  } else {
    text = `${m}мин`
  }

  // Warning: less than 2 hours remaining
  const status: CountdownStatus = h < 2 ? 'warning' : 'ok'
  return { text, status }
}
