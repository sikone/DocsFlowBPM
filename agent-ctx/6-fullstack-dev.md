# Task ID: 6 - Full-stack Developer
## Agent: Full-stack Developer
## Task: Replace placeholder Processes and Tasks pages in admin panel with real functional pages

### Summary of Changes

#### Files Created:
1. **`/src/app/api/processes/route.ts`** — GET (list) and POST (create) API routes for process definitions
2. **`/src/app/api/processes/[id]/route.ts`** — PUT (update) and DELETE API routes for process definitions
3. **`/src/app/api/tasks/route.ts`** — GET (list with filters) and POST (create) API routes for tasks
4. **`/src/app/api/tasks/[id]/route.ts`** — PUT (update with status/priority/reassign) and DELETE API routes for tasks
5. **`/src/components/admin/admin-processes-page.tsx`** — Full processes management page with:
   - Table view with name, description, version, status badge, step count, actions
   - Create/Edit dialog with name, description, system name, and visual step builder
   - Step builder with type selector, role selector, reorder up/down, delete
   - Status badges (ACTIVE=emerald, DRAFT=amber, ARCHIVED=slate)
   - Steps preview with timeline visualization
   - Search/filter functionality
6. **`/src/components/admin/admin-tasks-page.tsx`** — Full tasks management page with:
   - Statistics cards (pending, overdue, completed this week, total)
   - Filter bar (status, priority, assignee)
   - Table with title, type/status/priority badges, assignee avatar, due date, document link, actions
   - Create task dialog
   - Quick actions: mark complete, cancel, reassign (with sub-menu)
   - Overdue row highlighting

#### Files Modified:
1. **`/prisma/schema.prisma`** — Added ProcessDefinition and Task models with relations to User and Document
2. **`/src/components/admin/admin-pages.tsx`** — Replaced PlaceholderProcesses and PlaceholderTasks with re-exports from new component files

### Database Schema Changes:
- **ProcessDefinition**: id, name, description, systemName (unique), version, status, steps (JSON), timestamps
- **Task**: id, title, description, type, status, priority, documentId, assignedToId, createdById, dueDate, completedAt, timestamps, relations to Document, User (assigned & creator)

### API Design:
- All routes use existing auth pattern (extractToken, getAuthUser, isAdmin)
- Processes: full CRUD with systemName uniqueness check, status validation
- Tasks: CRUD with status/priority validation, assignee verification, auto-set completedAt on COMPLETED status

### Lint Status:
- 0 errors, 1 pre-existing warning (react-hook-form in login-page.tsx)
- Dev server compiles successfully
