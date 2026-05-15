/**
 * Utilities for working-calendar holiday data.
 * Parses isdayoff.ru API responses and provides date formatting helpers.
 */

/**
 * Parse isdayoff.ru API response string into an array of non-working date strings.
 * The API returns one character per calendar day of the year:
 *   '0' = working day, '1' = non-working day (holiday or weekend)
 * Returns ALL non-working dates (including regular weekends).
 * SLA logic filters out weekends separately via workingDays config.
 */
export function parseIsDayOffData(data: string, year: number): string[] {
  const result: string[] = []
  for (let i = 0; i < data.length; i++) {
    if (data[i] === '1') {
      // Use UTC constructor to avoid DST edge cases when building the date
      const date = new Date(Date.UTC(year, 0, i + 1))
      result.push(formatUtcDate(date))
    }
  }
  return result
}

/**
 * Format a Date as YYYY-MM-DD using its UTC components.
 * Used when building holiday arrays from the isdayoff.ru API.
 */
export function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
