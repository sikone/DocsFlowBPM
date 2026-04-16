# Task 7 — Document Duplication & Folder Management Improvements

## Summary

All four parts completed successfully with 0 lint errors.

## Changes Made

### Part 1: Document Duplication
- **New API Route**: `POST /api/documents/[id]/duplicate/route.ts`
  - Copies the document with title `Копия — {original_title}`
  - Same type, folder, and form data
  - Status reset to DRAFT
  - New auto-generated number (TYPE-YYYY-NNN)
  - Logs the duplication as a CREATE_DOCUMENT activity
- **UI**: Added "Дублировать" menu item with Copy icon to both DocumentTable and DocumentGrid row action dropdowns
- **Handler**: `handleDuplicateDoc` in dashboard-layout — calls the API, shows toast "Документ скопирован", navigates to the new document in edit mode
- **Loading state**: `duplicatingDocId` tracks which document is being duplicated, disabling the menu item

### Part 2: Folder Color Picker
- **New Component**: `ColorPicker` — renders 9 predefined colored circles (blue, emerald, amber, rose, violet, cyan, orange, pink, slate)
- **State**: `newFolderColor` and `renameFolderColor` with default `#3b82f6`
- **New Folder Dialog**: Added color picker row with Palette icon label
- **Rename Folder Dialog**: Added color picker row; pre-fills current folder color on open
- **API Integration**: `handleCreateFolder` and `handleRenameFolder` now send `color` to the API
- **FolderTreeNode**: Updated `getFolderColor` to support hex colors via inline style; folder icon uses actual color from DB

### Part 3: Folder Document Count Badge
- **Recursive counting**: Changed FolderTreeNode to use `countDocsInFolder(folder.id)` instead of `folder._count.documents` (which was only direct count)
- **Color circle**: Added a small colored circle (`w-2 h-2 rounded-full`) next to each folder name showing its assigned color
- **Badge**: Existing badge shows recursive document count only when > 0

### Part 4: Create Document Dialog Enhancement
- **New Dialog**: "Новый документ" dialog with:
  - Title input (pre-filled with "{type name} — новый")
  - Folder selector dropdown with color dots next to each folder
  - Default folder set to current selected folder
- **Flow**: Clicking a doc type in the toolbar or quick actions now opens this dialog instead of navigating directly
- **AppView type**: Added optional `title` field to `new-document` view
- **DocumentFormView**: Updated to read pre-set title from view params

## Files Modified
- `src/app/api/documents/[id]/duplicate/route.ts` — NEW
- `src/components/dashboard/dashboard-layout.tsx` — Major changes
- `src/components/documents/document-form-view.tsx` — Minor change (pre-title)
- `src/lib/types.ts` — AppView type update
- `src/components/admin/admin-pages.tsx` — Pre-existing lint fix

## Verification
- `bun run lint` → 0 errors, 0 warnings
- Dev server compiles successfully
