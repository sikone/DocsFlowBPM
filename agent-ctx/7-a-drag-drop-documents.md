# Task 7-a: Drag-and-Drop Documents to Folders

## Changes Made to `/src/components/dashboard/dashboard-layout.tsx`

### Summary
Added drag-and-drop capability allowing users to drag document rows (from table view) or document cards (from grid view) and drop them onto folders in the sidebar to move them. Uses `@dnd-kit/core` (already installed).

### Specific Changes (with line numbers)

#### 1. **Imports (Lines 4-5)**
- Added `DndContext`, `DragOverlay`, `useSensor`, `useSensors`, `PointerSensor`, `DragStartEvent`, `DragEndEvent`, `closestCenter`, `useDraggable` from `@dnd-kit/core`
- Added `useDroppable` from `@dnd-kit/core`

#### 2. **GripVertical icon (Line 146)**
- Added `GripVertical` to lucide-react imports for drag handle icon

#### 3. **DraggableGrip component (Lines 320-334)**
- New component using `useDraggable` hook from dnd-kit
- Renders a `GripVertical` icon as a drag handle
- Visible on row/card hover (`opacity-0 group-hover:opacity-50 hover:!opacity-100`)
- Hides when actively dragging (`isDragging` state)
- `cursor-grab` / `cursor-grabbing` styles
- `e.stopPropagation()` to prevent row click during drag

#### 4. **DroppableFolder component (Lines 336-343)**
- New component using `useDroppable` hook
- Wraps folder items with a droppable zone (id = folder.id)
- Highlights with emerald ring when a document is dragged over (`ring-2 ring-emerald-400`)
- Only shows highlight when `isDragging` prop is true (optimization)

#### 5. **Drag & Drop State in main component (Lines 430-480)**
- `activeDragDoc` state (Document | null) - tracks currently dragged document
- `dndSensors` - PointerSensor with 8px distance activation constraint
- `handleDragStart` - finds the document from the drag event's active id
- `handleDragEnd` - validates drop target is a folder, checks doc not already in that folder, calls `PUT /api/documents/[id]` with `{ folderId }`, shows success/error toast, refreshes data

#### 6. **FolderTreeNode - isDragging prop (Line 2624, 2639, 2650, 2755, 2758)**
- Added `isDragging?: boolean` to `FolderTreeNodeProps` interface
- Passed through to `DroppableFolder` wrapper and recursive children
- Folder content wrapped with `<DroppableFolder>` component

#### 7. **Sidebar FolderTreeNode usage (Line 1308)**
- Passed `isDragging={!!activeDragDoc}` to root-level FolderTreeNode

#### 8. **Document Table - Drag grip column (Lines 2829, 2905-2907)**
- Added empty `<TableHead className="w-8" />` column header for drag grip
- Added `<TableCell><DraggableGrip docId={doc.id} /></TableCell>` at start of each row

#### 9. **Document Grid - Drag grip on cards (Lines 3165-3171)**
- Added `<DraggableGrip>` positioned at bottom-right of each grid card
- Shows on hover with `opacity-0 group-hover:opacity-100 transition-opacity`

#### 10. **DndContext wrapper + DragOverlay (Lines 1407, 2623-2646)**
- Wrapped the entire return JSX with `<DndContext>` providing sensors and handlers
- Added `<DragOverlay>` with a card-like preview showing document type icon, title, and type name
- Overlay has `shadow-xl`, rounded corners, and `animate-in fade-in-0 zoom-in-95` animation

### API Used
- `PUT /api/documents/[id]?token=XXX` with body `{ folderId: "target-folder-id" }`
- Confirmed existing API route supports `folderId` update (validates folder exists)

### Lint Check
- `bun run lint` passes with 0 errors
