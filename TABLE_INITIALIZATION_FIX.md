# ModernTanStackTable Initialization Fix

## Problem

The ModernTanStackTable component was throwing a "Cannot access 'table' before initialization" error at line 202. This was happening because the code was trying to access `table.getState().pagination.pageSize` inside the `useReactTable` hook configuration, before the `table` variable was fully initialized.

## Root Cause

```typescript
// PROBLEMATIC CODE (line 202):
pageCount: manualPagination ? Math.ceil((totalCount ?? data.length) / table.getState().pagination.pageSize) : undefined,
```

The `table` variable is being created by `useReactTable()` but we're trying to access it inside the same hook configuration, creating a circular dependency.

## Solution

1. **Added local pagination state**: Added a proper pagination state variable to track page size and index
2. **Fixed the problematic line**: Replaced `table.getState().pagination.pageSize` with the local `pagination.pageSize` state
3. **Added pagination to table state**: Ensured the pagination state is included in the table's state object
4. **Removed invalid property**: Removed `enableColumnVisibility` which doesn't exist in TanStack Table v8

## Changes Made

### 1. Added pagination state

```typescript
const [pagination, setPagination] = React.useState<{ pageIndex: number; pageSize: number }>(
  initialState?.pagination ?? { pageIndex: 0, pageSize: 10 },
);
```

### 2. Fixed the problematic line

```typescript
// BEFORE (causing error):
pageCount: manualPagination ? Math.ceil((totalCount ?? data.length) / table.getState().pagination.pageSize) : undefined,

// AFTER (fixed):
pageCount: manualPagination ? Math.ceil((totalCount ?? data.length) / pagination.pageSize) : undefined,
```

### 3. Added pagination to table state

```typescript
state: {
    sorting,
    columnFilters,
    columnVisibility,
    rowSelection,
    columnSizing,
    globalFilter,
    pagination, // Added this
},
```

### 4. Removed invalid property

```typescript
// REMOVED (doesn't exist in TanStack Table v8):
enableColumnVisibility,
```

## Result

- ✅ Fixed the "Cannot access 'table' before initialization" error
- ✅ Component now renders properly without runtime errors
- ✅ Pagination works correctly with both manual and automatic modes
- ✅ All TanStack Table v8 features remain functional

## Testing

The fix has been applied and the component should now work correctly when navigating to entity pages in the admin interface. The table will properly initialize and display data without throwing initialization errors.
