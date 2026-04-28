---
Task ID: Phase 8 - QA, Bug Fixes, Tags Admin, Filters, Styling
Agent: Main Developer
Task: Agent-browser QA, critical bug fixes, tags admin, document tag picker, advanced filters, styling polish

## Current Project Status Assessment

Phase 8 focused on thorough QA using agent-browser, fixing critical runtime bugs, and adding significant new features. Three critical bugs were discovered and fixed: a TDZ (Temporal Dead Zone) error in DashboardLayout, a hydration error in the document table, and a TDZ error in DocumentFormView. After fixes, all features work correctly.

### Project Statistics:
- **21** custom component files (excluding UI library) — 1 new (admin-tags-page)
- **37** API routes — no new
- **13** Prisma database models — unchanged
- **~17,500+** lines of custom application code
- **0** lint errors
- **0** runtime errors (after fixes)

---

## Phase 8 Changes (Current Session):

### 1. Critical Bug Fixes (QA via agent-browser)

#### Bug 1: `Cannot access 'fetchData' before initialization` in DashboardLayout
- **Cause**: `handleDragEnd` callback (from Phase 7 DnD feature) referenced `fetchData` in its dependency array, but `fetchData` was defined ~160 lines later. JavaScript `const` declarations are in the TDZ until initialized.
- **Fix**: Moved `fetchData` definition (useCallback) to before `handleDragStart`/`handleDragEnd`, ensuring it's available for all callbacks that reference it.
- **File**: `/src/components/dashboard/dashboard-layout.tsx`

#### Bug 2: React Hydration Error — whitespace in `<tr>`
- **Cause**: Empty `<TableHead className="w-8" />` self-closing tags rendered as `<th></th>` with whitespace text nodes inside `<tr>`, causing React hydration mismatch.
- **Fix**: Added `<span className="sr-only">Перетащить</span>` and `<span className="sr-only">Действия</span>` inside the previously empty `<TableHead>` elements.
- **File**: `/src/components/dashboard/dashboard-layout.tsx`

#### Bug 3: `Cannot access 'handleSave' before initialization` in DocumentFormView
- **Cause**: The keyboard shortcuts `useEffect` (Ctrl+S, Ctrl+Enter, Escape) had `handleSave`, `handleSaveAndSend`, `handleBackWithCheck` in its dependency array, but these callbacks were defined ~200 lines later.
- **Fix**: Moved the keyboard shortcuts `useEffect` from line ~865 to after `handleSaveAndLeave` (line ~1142), ensuring all referenced callbacks are defined before the dependency array is evaluated.
- **File**: `/src/components/documents/document-form-view.tsx`

#### Bug 4: Tags not loading in Document Form Tag Picker
- **Cause**: `apiFetch` already unwraps the response envelope (`{ tags: [...] }` → `[...]`), but the code was accessing `res.tags` on the already-unwrapped array, getting `undefined`.
- **Fix**: Changed `setAllTags(res.tags || [])` to `setAllTags(res || [])` since `apiFetch` returns the unwrapped array directly.
- **File**: `/src/components/documents/document-form-view.tsx`

### 2. Tags Management Admin Page (Task ID: 3-a)
**Created**: `/src/components/admin/admin-tags-page.tsx`
- Full CRUD interface for document tags
- Table view with color swatch, name (as colored badge), document count, creator, creation date
- Create Tag dialog with name input + 9-color picker + hex input + live preview
- Edit Tag via dropdown action menu
- Delete Tag with confirmation dialog
- Real-time search/filter by tag name
- Context-aware empty states
- Toast notifications for all operations
- Responsive column hiding (document count sm+, creator md+, date lg+)
- Semantic tokens for full dark mode compatibility

**Modified files**:
- `/src/lib/types.ts` — Added `{ page: 'admin-tags' }` to AppView union
- `/src/lib/api.ts` — Added `'tags'` and `'tag'` to ENVELOPE_KEYS
- `/src/components/admin/admin-layout.tsx` — Added Tags nav item + routing

### 3. Document Tag Picker (Task ID: 4-a)
**Modified**: `/src/components/documents/document-form-view.tsx`
- "Теги" card section shown when editing existing documents
- Fetches all available tags via `GET /api/tags`
- Each tag rendered as a pill-shaped toggle button:
  - **Assigned**: vivid background in tag color (20% alpha), colored text, checkmark icon, shadow
  - **Unassigned**: dimmed `bg-muted/50` styling
- Optimistic UI: immediate toggle, API call in background, revert on error
- Syncs with document's `tagLinks` on load
- `transition-all duration-200` smooth transitions, `active:scale-95` press feedback

**Modified**: `/src/app/api/documents/[id]/route.ts`
- Added `tagLinks` include to GET and PUT handlers for single document

### 4. Advanced Document Filters (Task ID: 6-a)
**Modified**: `/src/components/dashboard/dashboard-layout.tsx`
- "Фильтры" button in toolbar (Filter icon) with active count badge
- Popover with 4 filter sections:
  - **Tags**: Multi-select toggle pills for each available tag
  - **Date Range**: Select dropdown (Все время, Сегодня, Эта неделя, Этот месяц, Этот год)
  - **Status**: Select dropdown (Все статусы, Черновик, В работе, Утверждён, Отклонён, Завершён)
  - **Creator**: Select dropdown populated from `GET /api/users`
- "Сбросить все" button to clear all filters
- Filters applied client-side in `filteredDocuments` useMemo
- Status dropdown in toolbar syncs bidirectionally with filter panel

### 5. Styling Improvements (Task ID: 6-a)

#### 5a. Animated Number Counters in Stats Summary Bar
**Modified**: `/src/components/dashboard/stats-summary-bar.tsx`
- `AnimatedNumber` component using `requestAnimationFrame` with ease-out cubic easing
- Numbers count up from 0 to their actual value on mount
- Staggered animation: 600ms delay + 150ms × card index

#### 5b. Document Type Color Bar in Table
- Added colored vertical bar (`w-1 h-6 rounded-full`) before the type icon in table cells
- Uses the document type's color property for the bar color

#### 5c. Sidebar Gradient Accent Line
- Added 2px gradient line (emerald-500 → cyan-400) at the top of the sidebar
- Applied to the sidebar logo wrapper

#### 5d. Dashboard Dot Pattern Background
**Modified**: `/src/app/globals.css`
- New `.dashboard-dot-pattern` class using `radial-gradient` dots
- Light mode: subtle gray dots
- Dark mode: slightly brighter dots
- Applied to `<main>` content area

#### 5e. Enhanced Footer
- Height h-7 → h-8
- `border-border/60` subtle top border
- gap-3 → gap-4 for better spacing
- `font-medium` on brand text
- Responsive hiding of less-important items on smaller screens

---

## QA Verification (agent-browser):

| Test | Method | Status |
|------|--------|--------|
| Lint (ESLint) | `bun run lint` | ✅ 0 errors |
| Login page | agent-browser snapshot | ✅ Renders correctly |
| Dashboard load | agent-browser navigate | ✅ All panels, data, tags visible |
| Document table | agent-browser snapshot | ✅ Tags, status dropdowns, drag handles |
| Admin panel | agent-browser navigate | ✅ All tabs including Теги |
| Tags management | agent-browser snapshot | ✅ CRUD table with search |
| Document edit | agent-browser navigate | ✅ Form renders, tag picker shows all tags |
| Filter popover | agent-browser click | ✅ Tags, status, date, creator filters |
| No runtime errors | dev.log check | ✅ All 200s, no errors |
| Hydration warnings | dev tools overlay | ✅ Resolved (was 1 issue) |

---

## Complete File Inventory:

### New Files (Phase 8):
- `/src/components/admin/admin-tags-page.tsx` — Tags management admin page

### Modified Files (Phase 8):
- `/src/components/dashboard/dashboard-layout.tsx` — TDZ fix, hydration fix, filters, styling
- `/src/components/documents/document-form-view.tsx` — Tag picker, TDZ fix, apiFetch fix
- `/src/components/dashboard/stats-summary-bar.tsx` — Animated number counters
- `/src/app/globals.css` — Dot pattern background class
- `/src/app/api/documents/[id]/route.ts` — tagLinks include
- `/src/lib/types.ts` — admin-tags AppView
- `/src/lib/api.ts` — tags/ttag envelope keys
- `/src/components/admin/admin-layout.tsx` — Tags nav + routing

### Database Models (13):
User, Folder, DocumentType, DocumentTemplate, Document, Session, ActivityLog, Comment, ProcessDefinition, Task, FavoriteDocument, DocumentTag, DocumentTagLink

### API Routes (37):
Unchanged from Phase 7.

---

## Unresolved Issues / Risks:
1. No visual BPMN 2.0 process editor yet (processes managed via form-based UI)
2. No real-time WebSocket notifications (activity polling every 30s)
3. No file upload/attachment support
4. No document versioning/history
5. No calendar view for deadlines and due dates
6. Full-text search is ASCII case-insensitive only in SQLite
7. No batch tag operations (tag/untag multiple documents at once)

## Recommendations for Next Phase:
1. **File Attachments** — Upload, preview, download for documents
2. **Document Versioning** — Version history with diff comparison
3. **Calendar View** — Document deadlines and task due dates
4. **BPMN Visual Process Editor** — Canvas-based drag-and-drop process designer
5. **Real-time Notifications** — WebSocket push for task assignments, status changes
6. **Dashboard Widgets** — Customizable dashboard with drag-and-drop widgets
7. **Export to PDF** — Server-side PDF generation for documents
8. **User Avatars** — Allow users to upload profile pictures
9. **Batch Operations Enhancement** — Tag/untag multiple documents at once
10. **Mobile Responsiveness** — Further polish for tablet/mobile views


Что делает скрипт:

Основное	Генерирует Document + ActivityLog + DocumentTagLink
Справочники	Читает реальных пользователей, типы документов, папки, теги из БД
Данные форм	Заполняет поле data по formSchema каждого типа (text, date, money, select…)
Заголовки	25 шаблонов договоров/актов/приказов с номером и датой
Статусы	Реалистичное распределение: больше IN_PROGRESS/APPROVED, меньше REJECTED
Производительность	Пакетные INSERT по 500 строк
Использование:


# Установить зависимости (один раз)
pip install psycopg2-binary

# 10 000 документов (по умолчанию)
python generate_documents.py

# 50 000 документов + цепочки согласования
python generate_documents.py --count 50000 --with-approvals

# Удалить всё сгенерированное
python generate_documents.py --clean


.env.local (Next.js)	CRON_SECRET=my-secret-123
Терминал перед запуском Python	set CRON_SECRET=my-secret-123 (Windows CMD) или $env:CRON_SECRET="my-secret-123" (PowerShell)
Запуск скрипта:


# вариант 1 — через env-переменную
set CRON_SECRET=my-secret-123
python sla_cron.py

# вариант 2 — через аргументы
python sla_cron.py --url http://localhost:3000 --secret my-secret-123 --interval 30

# вариант 3 — продакшен
python sla_cron.py --url https://your-app.vercel.app --secret my-secret-123


ready:
#Редактирование карточки пользователем без прав, баг - готово
#Добавление контрагентов контактов обычным пользователям по клику на поле. - готово
#Добавит шаг в процесс согласования - права на документ (кому нибудь выдать) - готово
#Подсвечивать срочные не срочные документы и подсвечивать просроченные задания- готово
#разобраться с папками и уведомлениями - работает
#уведомление о просроченном задании за час до просрочки - готово
#Посмотреть что там по редактированию документа, автоматически завершать редактирование при закрытии - частично работает
#Окончательное удаление или восстановление вложений - готово
#Заполнение контрагента по ИНН автоматически - готово
Роут согласования в зависимости от типа или галочки в документе. - не нужно какое то гавно
#Добавить кнопку обновления для документа - готово
#Синхронизация с AD - готово
#Довести до ума фильтры логирования. Там какая то хуйня сейчас. - готово
#Уведомление в почту с приложеным документом - готово
#Апрув прям из почты - готово
#Убрать из истории документа событие просмотра - готово
#Сделать кликабельное уведомление. - готово
#Реализовать механизм замещающего сотрудника на время отпуска, командировки, болезни - готово
#Реализовать механизм выхода сотрудника по времени - проверить в понедельник - готово
#Разобраться с папками уже окончательно

==============================================
todo:
Финальное подписание документа, в электронном виде или на бумаге - подписание по ЭЦП готово

Сделать правила маршрутизации между папка индивидуально для каждого пользователя, конструктр правил.
Делать word из шаблона


Отправление в почту контрагенту на основе контакта
Оптимизации для производительности:
1) Индексы
2) Редис
Авторизация через keycloak (JWT токены сначала наверное)
Начать блок задачи
Сделать роудмап
Прикрутить АИ ассистента (не приоритетно)
Сверка документов АИ ассистентом (не приоритетно)
