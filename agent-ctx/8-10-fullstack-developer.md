# Task 8-10: Document Export/Print & UI Polish

## Summary

Implemented document export/print functionality and comprehensive UI polish including custom scrollbars, micro-animations, transitions, and print styles.

## Part 1: Document Export/Print

### Files Created:
- `/src/app/api/documents/export/route.ts` — New POST API endpoint
  - Accepts `{ ids: string[], format: "json"|"csv" }` body
  - JSON export: Returns pretty-printed document metadata with `Content-Disposition` header
  - CSV export: Returns CSV with BOM for Excel, columns: Название, Номер, Тип, Статус, Автор, Папка, Даты
  - Auth-protected, fetches from DB with type/folder/creator includes

### Files Modified:
- `/src/components/documents/document-form-view.tsx` — Added to header:
  - **Print button** (Printer icon) — Calls `window.print()`, marked `no-print` class
  - **Export JSON button** (Download icon) — Creates Blob from document data and triggers download, toast on success
  - Both buttons added in the action button area before Save, with tooltips

- `/src/components/dashboard/dashboard-layout.tsx` — Added to toolbar:
  - **Export dropdown** (Download icon trigger) with 3 options:
    - "Экспорт JSON" — POSTs filtered doc IDs to `/api/documents/export`, downloads result
    - "Экспорт CSV" — Same API with `format: 'csv'`, downloads CSV
    - "Печать списка" — Calls `window.print()`
  - Added `Download`, `Printer`, `FileJson` icon imports
  - Disabled when no documents match filters

## Part 2: UI Polish — Scrollbar Styles

### `/src/app/globals.css` — Added:
- **Global scrollbar**: `scrollbar-width: thin` + `scrollbar-color` for all elements (light/dark)
- **`.custom-scrollbar` class**: Webkit scrollbar styles (6px width, rounded thumb, transparent track, theme-aware colors)

### Applied `.custom-scrollbar` to:
- Sidebar folder tree ScrollArea (`dashboard-layout.tsx`)
- Document table containers (both table & grid views)
- Admin content area (`admin-layout.tsx`)
- Admin activity log table (`activity-log-page.tsx`)
- Properties sidebar in document form view (`document-form-view.tsx`)
- Admin nav ScrollArea (`admin-layout.tsx`)

## Part 3: Micro-animations & Transitions

### `/src/app/globals.css` — Added:
- `@keyframes fadeIn` — opacity 0→1, translateY 4px→0
- `@keyframes bellShake` — rotation shake animation for notifications
- `.animate-fade-in` utility class
- `.animate-bell-shake` utility class

### Applied `animate-fade-in` to:
- Main page wrapper (`page.tsx`)
- Dashboard main root (`dashboard-layout.tsx`)
- Admin layout root (`admin-layout.tsx`)
- Admin content area (`admin-layout.tsx`)
- Document form view root (`document-form-view.tsx`)
- Profile page root (`profile-page.tsx`)

### Button press effects:
- `active:scale-[0.98] transition-transform` on all primary emerald buttons
- Applied across dashboard (New Doc, Create Folder, Delete) and document form (Save, Save+Leave)

### Card hover lift:
- `transition-shadow hover:shadow-md` on all analytics cards (`dashboard-analytics.tsx`)
- All properties sidebar cards in document form view
- Quick action cards in dashboard

### Table row hover:
- `transition-colors hover:bg-muted/50` on document table rows
- Activity log table rows

### Badge animations:
- Export badge count in `activity-panel.tsx` already uses count display

## Part 4: Print Styles

### `/src/app/globals.css` — Added:
- `@media print` block:
  - `.no-print` — `display: none !important`
  - `body` — `background: white !important`
  - `*` — removes `box-shadow` and `text-shadow`

### Applied `no-print` class to:
- Dashboard sidebar, header, toolbar, status bar
- Document form header buttons (Print, Export JSON, Save)
- Ensures only document content is printable

## Lint Status
- 0 errors, 1 pre-existing warning (react-hook-form in login-page.tsx)
