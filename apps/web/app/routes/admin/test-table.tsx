import React from 'react';
import { Box, Typography } from '@mui/material';
import { DataTableWrapper } from '~/components/admin/DataTableWrapper';
import type { MRT_ColumnDef } from 'material-react-table';

// Test data with proper column structure
const testEntityConfig = {
    name: 'User',
    pluralName: 'Users',
    slug: 'users',
    description: 'Test users table',
    columns: [
        {
            accessorKey: 'id',
            id: 'id',
            header: 'ID',
            size: 80,
            enableSorting: true,
            enableColumnFilter: true,
        },
        {
            accessorKey: 'email',
            id: 'email',
            header: 'Email',
            size: 200,
            enableSorting: true,
            enableColumnFilter: true,
        },
        {
            accessorKey: 'firstName',
            id: 'firstName',
            header: 'First Name',
            size: 120,
            enableSorting: true,
            enableColumnFilter: true,
        },
        {
            accessorKey: 'status',
            id: 'status',
            header: 'Status',
            size: 100,
            enableSorting: true,
            enableColumnFilter: true,
            Cell: ({ cell }: any) => {
                const value = cell.getValue();
                const colorMap: Record<string, any> = {
                    ACTIVE: 'success',
                    INACTIVE: 'default',
                    PENDING: 'warning',
                };
                return (
                    <Box component="span">
                        <span
                            style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                backgroundColor:
                                    value === 'ACTIVE' ? '#4caf50' :
                                        value === 'INACTIVE' ? '#9e9e9e' :
                                            '#ff9800',
                                color: 'white',
                            }}
                        >
                            {String(value)}
                        </span>
                    </Box>
                );
            },
        },
    ] as MRT_ColumnDef<any>[],
    enableRowSelection: true,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableSorting: true,
    enablePagination: true,
};

const testData = [
    { id: 1, email: 'john@example.com', firstName: 'John', status: 'ACTIVE' },
    { id: 2, email: 'jane@example.com', firstName: 'Jane', status: 'INACTIVE' },
    { id: 3, email: 'bob@example.com', firstName: 'Bob', status: 'PENDING' },
];

const testState = {
    pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
    sorting: [{ field: 'id', direction: 'asc' as const }],
    filters: {},
    search: '',
    selectedIds: [],
};

export default function TestTablePage() {
    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3 }}>
                Test Table - Column ID Fix Verification
            </Typography>

            <DataTableWrapper
                entityConfig={testEntityConfig}
                data={testData}
                loading={false}
                error={null}
                state={testState}
                onStateChange={() => { }}
                onCreate={() => alert('Create clicked')}
                onEdit={(record) => alert(`Edit: ${record.firstName}`)}
                onView={(record) => alert(`View: ${record.firstName}`)}
                onDelete={(record) => alert(`Delete: ${record.firstName}`)}
                onRefresh={() => alert('Refresh clicked')}
                onExport={() => alert('Export clicked')}
            />
        </Box>
    );
}
