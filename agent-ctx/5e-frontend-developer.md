# Task 5-e: Frontend Developer — NotificationCenter Component

## Summary
Created `/src/components/notification-center.tsx` — an enhanced Notification Center that replaces the simple ActivityPanel popover with a richer slide-out Sheet panel.

## File Created
- **`/src/components/notification-center.tsx`** — Full notification center component

## What Was Implemented

### 1. Bell Icon Button
- Ghost button with Bell icon from lucide-react
- Unread count badge (destructive variant, max 99)
- `animate-bell-shake` CSS animation when unread notifications exist
- `animate-pulse-badge` on the badge when unread
- Tooltip showing "Уведомления"
- `sr-only` screen reader label

### 2. Sheet Slide-out Panel (Right Side)
- Uses shadcn `Sheet` component sliding from right
- Full-height panel with `sm:max-w-md` responsive width
- Proper `SheetHeader`, `SheetTitle`, `SheetDescription` for accessibility

### 3. Real-time Data Fetching
- Fetches from `/api/activity-log?token=${token}` on mount and on sheet open
- Periodic unread check every 30 seconds
- Handles both array and `{ logs, total }` response formats
- Uses localStorage (`nc_last_viewed`) to track last viewed time

### 4. Activity Items Display
- User avatar with deterministic color from initials
- Action description from `details` field
- Relative time in Russian (только что, X минут назад, etc.)
- Color-coded action dot per activity type
- Action icon per activity type
- Status badge for CHANGE_STATUS actions (with Russian status labels)

### 5. Filter Tabs
- Three tabs: "Все", "Документы", "Система"
- Uses shadcn `Tabs` component
- Documents tab filters: CREATE_DOCUMENT, EDIT_DOCUMENT, DELETE_DOCUMENT, CHANGE_STATUS
- System tab filters: LOGIN, CREATE_FOLDER, DELETE_FOLDER

### 6. Mark All as Read
- "Отметить все как прочитанные" button with CheckCheck icon
- Appears only when there are unread notifications
- Clears localStorage timestamp and resets unread state

### 7. Empty State
- "Нет уведомлений" with Inbox icon in a muted container
- Subtitle: "Новые события будут отображаться здесь"

### 8. Loading State
- 5 skeleton placeholders with avatar + text lines

### 9. Activity Type Color Coding
- CREATE_DOCUMENT: emerald
- DELETE_DOCUMENT: rose
- CHANGE_STATUS: amber
- LOGIN: blue
- CREATE_FOLDER: violet
- Default: slate

### 10. Props Interface
```tsx
interface NotificationCenterProps {
  token: string | null;
  onNavigate?: (view: AppView) => void;
}
```

## Lint Results
- No errors or warnings from the new file
- Pre-existing 3 errors in `src/app/api/seed/route.ts` (not touched)
