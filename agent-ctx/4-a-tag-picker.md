# Task 4-a: Tag Picker in Document Form View

## Summary
Added a Tag Picker to the document editing form that allows users to assign/remove tags from existing documents with optimistic UI updates.

## Files Modified

### 1. `/src/app/api/documents/[id]/route.ts`
**Changes:** Added `tagLinks` include to both the GET and PUT handlers' Prisma queries.
- The GET handler now returns document with `tagLinks: { include: { tag: { select: { id, name, color } } } }`
- The PUT handler also includes the same tagLinks in the response
- This ensures the single document API provides tag data for the form to use

### 2. `/src/components/documents/document-form-view.tsx`
**Changes:**
- **Imports:** Added `DocumentTag` to type imports, added `Tag` icon from lucide-react
- **State:** Added 4 new state variables:
  - `allTags` - list of all available tags (fetched from GET /api/tags)
  - `assignedTagIds` - Set of currently assigned tag IDs (synced from document.tagLinks)
  - `tagsLoading` / `tagsSyncing` - loading states for operations
- **Effects:**
  - Fetches all available tags on mount via `GET /api/tags`
  - Syncs assigned tag IDs from `document.tagLinks` when document changes
- **Handler (`handleToggleTag`):**
  - Optimistic UI update (immediately toggles tag in Set)
  - Calls POST `/api/documents/[id]/tags` to add or DELETE `/api/documents/[id]/tags/[tagId]` to remove
  - Reverts on error with toast notification
  - Updates the document object to keep tagLinks in sync
- **UI Section (Tags Card):**
  - Only shown for existing documents (not new documents)
  - Card with header showing "Теги" label, Tag icon, and assigned count badge
  - Each tag rendered as a pill-shaped button with:
    - Colored dot using the tag's color
    - Assigned tags: vivid styling with tag color background (20% opacity), colored text, checkmark icon, shadow
    - Unassigned tags: dimmed with `bg-muted/50` and `text-muted-foreground`
    - `transition-all duration-200` for smooth hover/toggle animations
    - `active:scale-95` press feedback
  - Empty state message when no tags are available
  - Loading spinner on the syncing tag

## QA
- `bun run lint` — 0 errors
- Dev server compiled successfully with no errors
