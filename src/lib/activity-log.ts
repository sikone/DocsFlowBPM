import { db } from '@/lib/db'

/**
 * Log an activity event to the audit trail.
 * This is a fire-and-forget operation — errors are silently ignored.
 */
export async function logActivity(params: {
  userId: string
  action: string
  entityType?: string
  entityId?: string
  details?: string
}): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        details: params.details || null,
      },
    })
  } catch {
    // Silent fail — activity logging should not break main operations
  }
}

/**
 * Request browser notification permission.
 * Best-effort — returns current permission status, wrapped in try/catch.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unavailable'> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unavailable'
    }
    if (Notification.permission === 'granted') {
      return 'granted'
    }
    if (Notification.permission === 'denied') {
      return 'denied'
    }
    const permission = await Notification.requestPermission()
    return permission
  } catch {
    return 'unavailable'
  }
}

/**
 * Check if browser notifications are available and granted.
 */
export function isNotificationGranted(): boolean {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }
    return Notification.permission === 'granted'
  } catch {
    return false
  }
}

/**
 * Show a desktop notification if permission is granted.
 * Best-effort — silently fails if not available.
 */
export function showDesktopNotification(title: string, options?: NotificationOptions): void {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }
    if (Notification.permission === 'granted') {
      // Only show if the page is not focused (tab is in background)
      if (document.hidden) {
        new Notification(title, {
          icon: '/favicon.ico',
          ...options,
        })
      }
    }
  } catch {
    // Silently fail
  }
}
