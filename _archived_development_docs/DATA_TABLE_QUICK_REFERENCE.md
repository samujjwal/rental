# Quick Reference: Reusable Data Table Pattern

## 1. Import Components

```typescript
import {
  DataTable,
  FilterPanel,
  StatsGrid,
  type ColumnDef,
  type ActionDef,
  type BulkActionDef,
  type FilterField,
  type StatCard,
  type PaginationState,
} from '~/components/data-table';
```

## 2. Define Stats (Optional)

```typescript
const stats: StatCard[] = [
  {
    id: 'total',
    label: 'Total Items',
    value: data.stats.total,
    icon: Database,
    color: 'blue',
    trend: { value: 12, label: 'vs last month', direction: 'up' },
  },
];
```

## 3. Define Filters

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
];
```

## 4. Define Columns

```typescript
const columns: ColumnDef<MyType>[] = [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ value, row }) => (
            <div className="font-medium">{value}</div>
        )
    }
];
```

## 5. Define Actions

```typescript
const actions: ActionDef<MyType>[] = [
  {
    id: 'view',
    label: 'View',
    icon: Eye,
    href: (row) => `/admin/items/${row.id}`,
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    onClick: async (row) => {
      await deleteItem(row.id);
    },
    variant: 'destructive',
  },
];

const bulkActions: BulkActionDef<MyType>[] = [
  {
    id: 'export',
    label: 'Export',
    icon: Download,
    onClick: async (rows) => {
      await exportItems(rows);
    },
  },
];
```

## 6. Render Components

```typescript
export default function MyPage() {
    const data = useLoaderData<LoaderData>();
    const navigate = useNavigate();
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    const pagination: PaginationState = {
        pageIndex: data.pagination.page - 1,
        pageSize: data.pagination.limit,
        totalRows: data.pagination.total,
        totalPages: data.pagination.totalPages,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Items</h1>
                    <p className="text-gray-600">Manage items</p>
                </div>
                <Button><Plus /> Add Item</Button>
            </div>

            {/* Stats */}
            <StatsGrid stats={stats} />

            {/* Filters */}
            <FilterPanel fields={filterFields} />

            {/* Table */}
            <DataTable
                data={data.items}
                columns={columns}
                getRowId={(row) => row.id}
                actions={actions}
                bulkActions={bulkActions}
                pagination={pagination}
                onPaginationChange={(p) => {
                    navigate(`?page=${p.pageIndex + 1}&limit=${p.pageSize}`);
                }}
                enableSelection={true}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
            />
        </div>
    );
}
```

## 7. Loader Structure

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '25');

  const data = await fetchItems({ page, limit });

  return {
    items: data.items,
    pagination: {
      page,
      limit,
      total: data.total,
      totalPages: Math.ceil(data.total / limit),
    },
    stats: {
      total: data.stats.total,
      // ... other stats
    },
  };
}
```

## Color Options

- `blue` - Primary, info
- `green` - Success, positive
- `yellow` - Warning
- `red` - Error, destructive
- `purple` - Special, admin
- `gray` - Neutral

## Filter Types

- `text` - Text input
- `select` - Dropdown
- `boolean` - Yes/No/All
- `date` - Date picker
- `number` - Number input

## That's It!

Copy this pattern for all admin pages. Customize as needed.
