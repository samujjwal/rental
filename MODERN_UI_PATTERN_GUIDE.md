# Modern Data-Driven UI/UX Pattern Guide

## Overview

This guide describes the new modern, reusable, data-driven UI pattern implemented for admin table/collection views. This pattern eliminates cognitive load, provides consistent user experience, and can be easily applied to all admin pages.

## Design Principles

### 1. **Data-Driven Architecture**

- All components receive data and configuration as props
- No hardcoded UI logic
- Single source of truth for data and behavior

### 2. **Zero Cognitive Load**

- Clear visual hierarchy
- Consistent patterns across pages
- Intuitive interactions
- Self-explanatory UI elements

### 3. **Modern Design**

- Clean, minimalist interface
- Proper use of white space
- Consistent color system
- Smooth transitions and animations

### 4. **Reusability**

- Components are fully generic
- Configuration-based customization
- Type-safe interfaces
- No page-specific logic in components

## Core Components

### 1. DataTable Component

**Location:** `/app/components/data-table/DataTable.tsx`

**Purpose:** Universal table component for displaying and interacting with data.

**Key Features:**

- ✅ Column configuration with custom renderers
- ✅ Row selection (single and bulk)
- ✅ Inline actions menu
- ✅ Bulk actions toolbar
- ✅ Column visibility toggle
- ✅ Responsive pagination
- ✅ Loading and empty states
- ✅ Sortable columns
- ✅ Clickable rows
- ✅ Custom row styling

**Usage Example:**

```tsx
<DataTable
  data={users}
  columns={columns}
  getRowId={(row) => row.id}
  actions={rowActions}
  bulkActions={bulkActions}
  pagination={paginationState}
  onPaginationChange={handlePaginationChange}
  enableSelection={true}
  onRowClick={(row) => navigate(`/details/${row.id}`)}
/>
```

### 2. FilterPanel Component

**Location:** `/app/components/data-table/FilterPanel.tsx`

**Purpose:** Universal filter component with preset management.

**Key Features:**

- ✅ Multiple filter types (text, select, boolean, date, number)
- ✅ Save/load filter presets
- ✅ URL state synchronization
- ✅ Quick clear all
- ✅ Active filter indicators
- ✅ Collapsible interface

**Usage Example:**

```tsx
<FilterPanel
  fields={filterFields}
  onFilterChange={handleFilterChange}
  presetStorageKey="admin-users-filters"
  showPresets={true}
/>
```

### 3. StatsGrid Component

**Location:** `/app/components/data-table/StatsGrid.tsx`

**Purpose:** Display key metrics and statistics.

**Key Features:**

- ✅ Trend indicators (up/down/neutral)
- ✅ Custom icons and colors
- ✅ Responsive grid layout
- ✅ Loading skeleton
- ✅ Clickable cards for drill-down

**Usage Example:**

```tsx
<StatsGrid
  stats={[
    {
      id: 'total',
      label: 'Total Items',
      value: 1234,
      icon: Users,
      color: 'blue',
      trend: { value: 12, label: 'vs last month', direction: 'up' },
    },
  ]}
/>
```

## Implementation Pattern

### Step 1: Define Your Data Types

```typescript
interface MyEntity {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  // ... other fields
}

interface LoaderData {
  entities: MyEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    active: number;
    // ... other stats
  };
}
```

### Step 2: Configure Statistics

```typescript
const stats: StatCard[] = [
  {
    id: 'total',
    label: 'Total Items',
    value: data.stats.total,
    icon: Database,
    color: 'blue',
    trend: {
      value: 12,
      label: 'vs last month',
      direction: 'up',
    },
  },
  // ... more stats
];
```

### Step 3: Configure Filters

```typescript
const filterFields: FilterField[] = [
  {
    id: 'search',
    label: 'Search',
    type: 'text',
    placeholder: 'Search...',
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'INACTIVE', label: 'Inactive' },
    ],
  },
  // ... more filters
];
```

### Step 4: Configure Table Columns

```typescript
const columns: ColumnDef<MyEntity>[] = [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ value }) => (
            <span className="font-medium">{value}</span>
        )
    },
    {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ value }) => (
            <Badge variant={value === 'ACTIVE' ? 'success' : 'default'}>
                {value}
            </Badge>
        )
    },
    // ... more columns
];
```

### Step 5: Configure Actions

```typescript
const actions: ActionDef<MyEntity>[] = [
  {
    id: 'view',
    label: 'View Details',
    icon: Eye,
    href: (row) => `/admin/entities/${row.id}`,
  },
  {
    id: 'edit',
    label: 'Edit',
    icon: Edit,
    href: (row) => `/admin/entities/${row.id}/edit`,
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    onClick: async (row) => {
      if (confirm('Delete this item?')) {
        await deleteEntity(row.id);
      }
    },
    variant: 'destructive',
  },
];

const bulkActions: BulkActionDef<MyEntity>[] = [
  {
    id: 'export',
    label: 'Export Selected',
    icon: Download,
    onClick: async (rows) => {
      await exportEntities(rows);
    },
  },
  {
    id: 'delete',
    label: 'Delete Selected',
    icon: Trash2,
    onClick: async (rows) => {
      await bulkDeleteEntities(rows);
    },
    variant: 'destructive',
    confirmMessage: 'Delete selected items?',
  },
];
```

### Step 6: Render the Page

```typescript
export default function EntitiesPage() {
    const data = useLoaderData<LoaderData>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    const pagination: PaginationState = {
        pageIndex: data.pagination.page - 1,
        pageSize: data.pagination.limit,
        totalRows: data.pagination.total,
        totalPages: data.pagination.totalPages,
    };

    const handlePaginationChange = ({ pageIndex, pageSize }) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', (pageIndex + 1).toString());
        params.set('limit', pageSize.toString());
        navigate(`?${params.toString()}`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Entities"
                description="Manage your entities"
                actions={<AddButton />}
            />

            {/* Stats */}
            <StatsGrid stats={stats} />

            {/* Filters */}
            <FilterPanel
                fields={filterFields}
                presetStorageKey="admin-entities-filters"
            />

            {/* Table */}
            <DataTable
                data={data.entities}
                columns={columns}
                getRowId={(row) => row.id}
                actions={actions}
                bulkActions={bulkActions}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                enableSelection={true}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                onRowClick={(row) => navigate(`/admin/entities/${row.id}`)}
            />
        </div>
    );
}
```

## UI/UX Best Practices

### Visual Hierarchy

1. **Page Title** - 2xl, bold, dark
2. **Section Headers** - lg, medium, dark
3. **Body Text** - sm/base, normal, gray-700
4. **Meta Text** - sm, gray-500

### Color System

- **Primary (Blue)** - Main actions, links
- **Success (Green)** - Positive states, confirmations
- **Warning (Yellow)** - Warnings, attention needed
- **Danger (Red)** - Destructive actions, errors
- **Purple** - Admin/special features
- **Gray** - Neutral states, disabled

### Spacing

- **Page Container** - space-y-6
- **Sections** - space-y-4
- **Cards** - p-6
- **Compact Elements** - p-4

### Interactive States

```css
/* Hover */
hover:bg-gray-50
hover:border-gray-300

/* Focus */
focus:outline-none
focus:ring-2
focus:ring-blue-500

/* Active */
bg-blue-50
border-blue-500

/* Disabled */
opacity-50
cursor-not-allowed
```

## Keyboard Navigation

All components support keyboard navigation:

- `Tab` - Navigate between elements
- `Enter` - Activate buttons/links
- `Space` - Toggle checkboxes
- `Escape` - Close modals/menus
- `Arrow Keys` - Navigate lists

## Responsive Design

All components are fully responsive:

- **Mobile (< 768px)** - Single column, collapsed filters
- **Tablet (768px - 1024px)** - 2 columns, expanded filters
- **Desktop (> 1024px)** - Full layout, all features visible

## Performance Optimization

1. **Memoization** - Use `useMemo` for computed values
2. **Callbacks** - Use `useCallback` for handlers
3. **Pagination** - Load only required data
4. **Lazy Loading** - Load heavy components on demand
5. **Debouncing** - Debounce search inputs

## Accessibility (A11Y)

- ✅ ARIA labels on all interactive elements
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ Proper focus management
- ✅ Color contrast compliance (WCAG AA)

## Migration Checklist

To migrate an existing admin page:

- [ ] Import new components from `~/components/data-table`
- [ ] Define data types and interfaces
- [ ] Configure statistics cards
- [ ] Configure filter fields
- [ ] Define table columns with custom renderers
- [ ] Configure row actions
- [ ] Configure bulk actions
- [ ] Set up pagination handlers
- [ ] Update loader to return proper data structure
- [ ] Remove old component imports
- [ ] Test all interactions
- [ ] Verify responsive behavior
- [ ] Test keyboard navigation
- [ ] Verify accessibility

## Examples

The following pages have been migrated to the new pattern:

1. **Users Management** (`/admin/users`)
   - Full implementation with all features
   - Filter presets
   - Bulk actions
   - Stats dashboard

## Future Enhancements

Planned improvements:

- [ ] Advanced sorting (multi-column)
- [ ] Column resizing
- [ ] Export to multiple formats
- [ ] Saved views
- [ ] Quick filters
- [ ] Inline editing
- [ ] Drag & drop reordering

## Support

For questions or issues with the new pattern:

1. Check this documentation
2. Review the users page implementation
3. Check component TypeScript definitions
4. Review the data-table component source

## Summary

This new pattern provides:

- ✅ **Consistency** - Same experience across all pages
- ✅ **Efficiency** - Faster development with reusable components
- ✅ **Maintainability** - Single source of truth for UI logic
- ✅ **Scalability** - Easy to extend and customize
- ✅ **User Experience** - Modern, intuitive interface
- ✅ **Developer Experience** - Type-safe, well-documented

Apply this pattern to all new admin pages for a consistent, professional experience.
