---
Task ID: 3-a
Agent: Recent Documents Feature Developer
Task: Create "Recently Viewed Documents" feature — API route + sidebar component

## Files Created

### 1. `/src/app/api/documents/recent/route.ts`
- **POST** handler: Records a document view by creating an `ActivityLog` entry with `action: 'VIEW_DOCUMENT'`
  - Requires token auth (via `extractToken` + `getAuthUser` from `@/lib/auth`)
  - Accepts `{ documentId: string }` in request body
  - Validates document exists before logging
  - Returns `{ success: true }` on success
- **GET** handler: Returns the user's 10 most recently viewed unique documents
  - Queries `ActivityLog` where `action = 'VIEW_DOCUMENT'` for the authenticated user
  - Fetches last 200 log entries, deduplicates by `entityId`, keeps first 10 unique
  - Includes document type info (`icon`, `color`, `name`)
  - Returns array with `viewedAt` ISO timestamp per document

### 2. `/src/components/documents/recent-documents.tsx`
- `'use client'` component following same pattern as `favorites-panel.tsx`
- Props: `token: string | null`, `onDocumentClick: (docId: string) => void`
- Section title: "Недавно просмотренные" with document count badge
- Each item shows: document type icon (colored), truncated title, relative time ("5 мин назад")
- Click navigates to document edit via `onDocumentClick`
- **Uses semantic tokens only** — no hardcoded colors (slate-*, gray-*)
  - `text-muted-foreground`, `text-foreground`, `hover:bg-accent/50`, `bg-background`
- Loading state: 3 Skeleton rows
- Empty state: "Нет недавних документов" italic text
- `ScrollArea` with `max-h-48` for scrollable list
- Listens for `refresh-recent` custom events for external refresh triggers
- Helper function `formatTimeAgo()` for Russian relative time display

## Design Decisions
- Reuses existing `ActivityLog` model — no schema changes needed
- `formatTimeAgo()` handles: "только что", "X мин назад", "X ч назад", "X дн назад", and date fallback
- Document type icon colored via inline `style={{ color: doc.type.color }}` — works in both light/dark modes
- Component is self-contained and ready for integration into the sidebar (similar to `FavoritesPanel`)

## Verification
- `bun run lint` — ✅ 0 errors
