# Task 11 — Document Form UX Improvements

## Agent: Full-stack Developer

## Summary of Changes

### File Modified
- `/src/components/documents/document-form-view.tsx` — Complete rewrite with major UX improvements

### 1. Form Field Validation
- Added `validationErrors` and `touchedFields` state tracking
- Red asterisk (*) on required fields (already existed, preserved)
- **Inline error messages** with red X icon when saving with empty required fields
- **Dashed border indicator** on empty required fields that haven't been touched yet
- **Red border** on fields that have validation errors after attempted save
- Errors clear automatically when user starts editing the field
- Title field also validated as required
- Progress badge showing "X/Y обязательных" (filled/required count)

### 2. Auto-Save Mechanism
- Auto-save **enabled automatically for existing documents** (edit mode)
- After first manual save of a new document, auto-save is also enabled
- **Debounced 3 seconds** — saves after user stops typing
- **Auto-save status indicator** in header:
  - "Сохранение..." with spinner (amber)
  - "Сохранено" with checkmark (green)
  - "Не сохранено" with amber dot (amber)
  - Status resets to idle after 3 seconds of no changes
- Updates initial data ref on successful auto-save to avoid stale dirty state

### 3. Keyboard Shortcuts
- **Ctrl+S / Cmd+S** — Save document (with validation)
- **Ctrl+Enter / Cmd+Enter** — Save and send (change status to IN_PROGRESS)
- **Escape** — Go back (with unsaved changes confirmation)
- Tooltip hints shown on Save button and Back button

### 4. Unsaved Changes Dialog
- **Dirty state tracking** via `initialDataRef` comparing title, formData, and status
- AlertDialog shown when navigating away (Escape or Back button) with unsaved changes
- Two options: "Отменить изменения" (discard) and "Сохранить и выйти" (save and leave)
- No dialog when form is clean

### 5. Form Field UX Improvements
- **Focus ring animations**: Emerald-tinted focus rings (`ring-emerald-600/20`) on all form inputs
- **Section dividers**: Headings now have an extended line extending to the right
- **Hover effects**: Checkbox/Switch labels have hover color transitions
- **Scroll shadows**: Top and bottom gradient shadows appear when form content is scrollable
- **Responsive grid**: Form grids now use `grid-cols-1 sm:grid-cols-2/3` for better mobile layout
- **Backdrop blur**: Header has `bg-background/95 backdrop-blur-sm` for modern feel

### 6. Properties Sidebar Improvements
- **Document thumbnail card**: Color-coded header with document type icon, name, number, and status badge
- **Activity log timeline**: Fetches real activity logs from `/api/activity-log` API with `entityType=DOCUMENT&entityId=...`
  - Shows action-specific colored dots (green=create, blue=edit, amber=status change)
  - Displays user name and relative timestamps
  - Loading skeleton while fetching
  - Falls back to derived timeline from document data if no logs
- **Document Links section**: Placeholder card with icon and "Привязать документ" button
- **Sharing options**: Three placeholder buttons — Share link, Manage access, Export to PDF
- Better visual separation between cards

### 7. Mobile Improvements
- **Tab toggle**: Mobile shows "Форма" / "Свойства" tabs below header to switch between form and properties
- **Sticky save bar**: Bottom bar with auto-save status, Send button, and Save button (always visible while editing form)
- **Better touch targets**: Save/Submit buttons are `h-10` for comfortable touch
- **Required fields counter** shown in mobile tab
- **Safe area padding**: Bottom bar has `safe-area-bottom` class
- Desktop-only action buttons (Утвердить/Отклонить) hidden on mobile to save space

### 8. Empty Form State Improvements
- Enhanced empty state with larger icon in a rounded container
- **Tips card** (shown when form has fields) with:
  - Required fields explanation
  - Keyboard shortcuts reference (Ctrl+S, Ctrl+Enter, Esc)
  - Auto-save notification when enabled
  - Styled with amber lightbulb icon

### Technical Details
- **0 lint errors** (only pre-existing warning from login-page.tsx)
- All existing functionality preserved
- Uses existing shadcn/ui components (AlertDialog, Tooltip, Badge, Card, etc.)
- Theme-aware colors throughout
- Proper cleanup of timers and event listeners
