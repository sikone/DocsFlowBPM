# Task 4: Add Dark Mode Support with Theme Toggle

## Status: Completed

## Changes Made

### 1. `/home/z/my-project/src/app/layout.tsx`
- Imported `ThemeProvider` from `next-themes`
- Wrapped `{children}` with `<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>`
- `suppressHydrationWarning` was already present on `<html>` tag (required by next-themes)

### 2. `/home/z/my-project/src/components/dashboard/dashboard-layout.tsx`
- Imported `useTheme` from `next-themes`
- Added `Sun`, `Moon` to lucide-react imports
- Created a `ThemeToggle` helper component that:
  - Uses `useTheme()` to get/set theme
  - Uses `useSyncExternalStore` for safe SSR hydration (avoids React Compiler's `set-state-in-effect` lint error)
  - Shows Moon icon in light mode, Sun icon in dark mode
  - Styled as ghost button (h-9 w-9) matching other header buttons
  - Has tooltip showing "Тёмная тема" / "Светлая тема"
  - Renders a static Sun icon placeholder during SSR to prevent hydration mismatch
- Placed `<ThemeToggle />` in the header between the Notification Bell and the vertical Separator

### 3. `/home/z/my-project/src/components/admin/admin-layout.tsx`
- Imported `useSyncExternalStore` from React, `useTheme` from `next-themes`
- Added `Sun`, `Moon` to lucide-react imports
- Added `theme`, `setTheme`, and `mounted` state inside `AdminLayout` component
- Added a theme toggle button in the header between the vertical separator and the logout button
- Button conditionally renders Sun/Moon icons based on current theme
- Has tooltip showing "Тёмная тема" / "Светлая тема"

## Issues Encountered & Resolved

1. **React Compiler `set-state-in-effect` lint error**: Initially used the common `useState` + `useEffect` pattern for mounted detection. The React Compiler in Next.js 16 flagged `setMounted(true)` inside `useEffect` as an error (`react-hooks/set-state-in-effect`). Fixed by switching to `useSyncExternalStore(() => () => {}, () => true, () => false)` which provides the same hydration-safe behavior without triggering the lint rule.

2. **Pre-existing warning**: There's an unrelated warning in `login-page.tsx` about React Hook Form's `watch()` function being incompatible with the React Compiler memoization. This was not introduced by our changes.

## Verification
- ESLint passes with 0 errors (1 pre-existing warning unrelated to our changes)
- Dev server compiles successfully
- No runtime errors in dev log
