# Task 5-b: Backend Developer - Document Stats & Search API

## Files Created
1. `/src/app/api/documents/stats/route.ts` - Document Statistics API
2. `/src/app/api/documents/search/route.ts` - Full-text Search API

## Details

### Document Statistics API (`/api/documents/stats`)
- **Method**: GET
- **Auth**: Token via `extractToken` + `getAuthUser` (same pattern as existing routes)
- **Response fields**:
  - `totalDocuments` - Total count of all documents
  - `byStatus` - Documents grouped by status (DRAFT, IN_PROGRESS, APPROVED, REJECTED, COMPLETED)
  - `byType` - Array of `{name, count}` for each document type
  - `recentDocuments` - Documents created in last 24 hours
  - `documentsThisWeek` - Documents created since start of current week (Monday)
  - `documentsThisMonth` - Documents created since start of current month
  - `avgProcessingTimeHours` - Average time between creation and last update for COMPLETED/APPROVED docs
  - `topCreators` - Top 5 document creators by count

### Full-text Search API (`/api/documents/search`)
- **Method**: GET
- **Query params**: `token` (auth), `q` (required search query), `status` (optional), `typeId` (optional)
- **Search scope**: title, number, data (JSON string), creator name, type name
- **Uses**: Prisma `OR` with `contains` + `mode: 'insensitive'` for case-insensitive search
- **Response**: Array of documents with type, folder, and creator populated, limited to 50 results

### Auth Pattern
Both endpoints use the existing `extractToken` and `getAuthUser` helpers from `@/lib/auth`, consistent with all other API routes.

### Lint
✅ `bun run lint` passed with no errors.
