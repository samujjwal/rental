# Integration Guide: Enhanced Admin Components

## Overview

This guide walks through integrating the new enhanced admin components into the existing system, replacing the legacy `ModernTanStackTable` and `ModernTanStackForm` components.

## Step 1: Theme Integration (✅ DONE)

The root component has been updated to use the enhanced MUI theme:

```typescript
// apps/web/app/root.tsx
import theme from '~/theme/muiTheme';

<ThemeProvider theme={theme}>
  <CssBaseline />
  <Outlet />
</ThemeProvider>
```

## Step 2: Entity Page Integration

Update `/apps/web/app/routes/admin/entities/[entity].tsx` to use `EnhancedDataTable`:

### Before (Legacy):

```typescript
import { ModernTanStackTable } from '~/components/admin/ModernTanStackTable';

<ModernTanStackTable
  data={data}
  columns={columns}
  onRowEdit={handleEdit}
/>
```

### After (Enhanced):

```typescript
import { EnhancedDataTable } from '~/components/admin/enhanced';

<EnhancedDataTable
  data={data}
  columns={columns}
  title={entityConfig?.displayName}
  enableSearch
  enableFilters
  enableViewModes
  enableSelection
  totalCount={apiPagination.total}
  pageIndex={pagination.pageIndex}
  pageSize={pagination.pageSize}
  onPaginationChange={(p) => setPagination(p)}
  sorting={sorting}
  onSortingChange={setSorting}
  columnFilters={columnFilters}
  onColumnFiltersChange={setColumnFilters}
  globalFilter={globalFilter}
  onGlobalFilterChange={setGlobalFilter}
  rowSelection={rowSelection}
  onRowSelectionChange={setRowSelection}
  loading={loading}
  error={error}
  onAdd={handleAdd}
  onRefresh={refresh}
  onRowEdit={handleEdit}
  onRowDelete={handleDelete}
  onRowView={handleView}
  availableFilterFields={filterFields}
  searchSuggestions={searchSuggestions}
/>
```

## Step 3: Form Integration

Update form pages to use `EnhancedForm`:

### Before (Legacy):

```typescript
import { ModernTanStackForm } from '~/components/admin/ModernTanStackForm';

<ModernTanStackForm
  fields={fields}
  onSubmit={handleSubmit}
/>
```

### After (Enhanced):

```typescript
import { EnhancedForm, type FormStep } from '~/components/admin/enhanced';

const steps: FormStep[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    fields: basicFields,
  },
  {
    id: 'details',
    title: 'Additional Details',
    fields: detailFields,
  },
];

<EnhancedForm
  steps={steps}
  layout="steps"
  initialData={initialData}
  mode={isEditing ? 'edit' : 'create'}
  onSubmit={handleSubmit}
  enableAutoSave
  autoSaveInterval={3000}
  onAutoSave={handleAutoSave}
/>
```

## Step 4: Keyboard Shortcuts (Optional)

Add keyboard shortcuts to admin pages:

```typescript
import { KeyboardShortcuts, type KeyboardShortcut } from '~/components/admin/enhanced';

const shortcuts: KeyboardShortcut[] = [
  {
    key: 'n',
    ctrlKey: true,
    description: 'Create new record',
    action: () => navigate('/admin/create'),
    category: 'Actions',
  },
  {
    key: 'f',
    ctrlKey: true,
    description: 'Focus search',
    action: () => searchRef.current?.focus(),
    category: 'Navigation',
  },
];

<KeyboardShortcuts shortcuts={shortcuts} />
```

## Step 5: Export Functionality (Optional)

Add export button to tables:

```typescript
import { ExportData } from '~/components/admin/enhanced';

<ExportData
  data={data}
  columns={columns.map(col => ({ id: col.id, header: col.header }))}
  filename={`${entity}-export`}
/>
```

## Migration Checklist

- [ ] Update root.tsx with enhanced theme
- [ ] Update entity page to use EnhancedDataTable
- [ ] Update form pages to use EnhancedForm
- [ ] Add keyboard shortcuts to admin pages
- [ ] Test all features on mobile, tablet, desktop
- [ ] Remove legacy ModernTanStackTable component
- [ ] Remove legacy ModernTanStackForm component
- [ ] Update documentation

## Component Mapping

| Legacy Component    | Enhanced Component             | Location                      |
| ------------------- | ------------------------------ | ----------------------------- |
| ModernTanStackTable | EnhancedDataTable              | `~/components/admin/enhanced` |
| ModernTanStackForm  | EnhancedForm                   | `~/components/admin/enhanced` |
| N/A                 | SmartSearch                    | `~/components/admin/enhanced` |
| N/A                 | FilterChips                    | `~/components/admin/enhanced` |
| N/A                 | DataViews (CardView, ListView) | `~/components/admin/enhanced` |
| N/A                 | KeyboardShortcuts              | `~/components/admin/enhanced` |
| N/A                 | ExportData                     | `~/components/admin/enhanced` |

## Cleanup: Files to Remove

After migration is complete, these legacy files can be removed:

1. `/apps/web/app/components/admin/ModernTanStackTable.tsx` - Replaced by EnhancedDataTable
2. `/apps/web/app/components/admin/ModernTanStackForm.tsx` - Replaced by EnhancedForm

## Testing Checklist

### Desktop (1920px+)

- [ ] Table view displays correctly
- [ ] Search works
- [ ] Filters work
- [ ] Sorting works
- [ ] Pagination works
- [ ] Row selection works
- [ ] Keyboard shortcuts work

### Tablet (768px - 1024px)

- [ ] Auto-switches to list view
- [ ] Touch interactions work
- [ ] Responsive layout works
- [ ] All features accessible

### Mobile (320px - 767px)

- [ ] Auto-switches to card view
- [ ] Touch-friendly spacing
- [ ] Responsive layout works
- [ ] All features accessible

## Troubleshooting

### Theme not applying

- Ensure `ThemeProvider` wraps the entire app in `root.tsx`
- Check that `muiTheme.ts` is properly imported

### Components not found

- Verify barrel export in `~/components/admin/enhanced/index.ts`
- Check import paths use `~` alias

### Styles not working

- Ensure `CssBaseline` is included in root component
- Check that design tokens are properly imported

## Support

For issues or questions, refer to:

- `FINAL_IMPLEMENTATION_SUMMARY.md` - Complete feature documentation
- `COMPREHENSIVE_IMPLEMENTATION_COMPLETE.md` - Architecture overview
- Component files for detailed prop documentation
