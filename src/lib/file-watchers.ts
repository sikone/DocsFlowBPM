import fsSync from 'fs'

interface WatcherEntry {
  tmpPath: string
  documentId: string
}

declare global {
  // eslint-disable-next-line no-var
  var __fileWatchers: Map<string, WatcherEntry> | undefined
}

function getWatchers(): Map<string, WatcherEntry> {
  if (!global.__fileWatchers) global.__fileWatchers = new Map()
  return global.__fileWatchers
}

export function registerWatcher(key: string, entry: WatcherEntry): void {
  getWatchers().set(key, entry)
}

export function stopWatcher(key: string): void {
  const watchers = getWatchers()
  const entry = watchers.get(key)
  if (!entry) return
  try { fsSync.unwatchFile(entry.tmpPath) } catch { /* ignore */ }
  watchers.delete(key)
}

export function getWatcherEntry(key: string): WatcherEntry | undefined {
  return getWatchers().get(key)
}
