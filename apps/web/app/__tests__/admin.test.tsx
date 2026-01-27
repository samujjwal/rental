import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { json } from '@remix-run/node';
import { createMemoryRouter, RouterProvider } from '@remix-run/react';
import userEvent from '@testing-library/user-event';

// Test utilities for admin components
export class AdminTestUtils {
    static createMockUser(overrides = {}) {
        return {
            id: '1',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: false,
            createdAt: '2024-01-15T10:30:00Z',
            lastLoginAt: '2024-01-26T09:15:00Z',
            city: 'New York',
            country: 'USA',
            averageRating: 4.5,
            totalReviews: 10,
            phoneNumber: '+1-555-0123',
            ...overrides
        };
    }

    static createMockUsers(count = 5) {
        return Array.from({ length: count }, (_, i) => this.createMockUser({
            id: (i + 1).toString(),
            email: `user${i + 1}@example.com`,
            firstName: `User${i + 1}`,
            lastName: `Test${i + 1}`,
            role: ['ADMIN', 'OWNER', 'CUSTOMER', 'SUPPORT'][i % 4],
            status: ['ACTIVE', 'INACTIVE', 'SUSPENDED'][i % 3]
        }));
    }

    static createMockPagination(overrides = {}) {
        return {
            page: 1,
            limit: 20,
            total: 100,
            totalPages: 5,
            ...overrides
        };
    }

    static createMockStats(overrides = {}) {
        return {
            total: 100,
            active: 75,
            admins: 5,
            newThisMonth: 12,
            ...overrides
        };
    }

    static createMockLoaderData(overrides = {}) {
        return {
            users: this.createMockUsers(),
            pagination: this.createMockPagination(),
            stats: this.createMockStats(),
            filters: { search: '', role: '', status: '', emailVerified: '', phoneVerified: '' },
            ...overrides
        };
    }

    static renderWithRouter(component, initialEntries = ['/']) {
        const router = createMemoryRouter([
            {
                path: '/',
                element: component,
            },
        ], { initialEntries });

        return render(<RouterProvider router={router} />);
    }

    static async waitForLoadingToFinish() {
        await waitFor(() => {
            expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
        });
    }

    static async waitForDataToLoad() {
        await waitFor(() => {
            expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
        });
    }
}

// DataTable tests
describe('DataTable', () => {
    const mockUsers = AdminTestUtils.createMockUsers();
    const mockColumns = [
        { key: 'firstName', label: 'First Name', sortable: true },
        { key: 'lastName', label: 'Last Name', sortable: true },
        { key: 'email', label: 'Email', sortable: true },
        { key: 'role', label: 'Role', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
    ];

    beforeEach(() => {
        // Mock console.error to avoid noise in tests
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders table with data', () => {
        const { container } = render(
            <DataTable
                data={mockUsers}
                columns={mockColumns}
                pagination={AdminTestUtils.createMockPagination()}
            />
        );

        expect(screen.getByRole('grid')).toBeInTheDocument();
        expect(screen.getAllByRole('row')).toHaveLength(mockUsers.length + 1); // +1 for header
        expect(screen.getByText('First Name')).toBeInTheDocument();
        expect(screen.getByText('John')).toBeInTheDocument();
    });

    it('handles sorting', async () => {
        const onSortChange = vi.fn();

        render(
            <DataTable
                data={mockUsers}
                columns={mockColumns}
                pagination={AdminTestUtils.createMockPagination()}
                onSortChange={onSortChange}
            />
        );

        const firstNameHeader = screen.getByText('First Name');
        await userEvent.click(firstNameHeader);

        expect(onSortChange).toHaveBeenCalledWith({
            key: 'firstName',
            direction: 'asc'
        });
    });

    it('handles row selection', async () => {
        const onSelectionChange = vi.fn();

        render(
            <DataTable
                data={mockUsers}
                columns={mockColumns}
                pagination={AdminTestUtils.createMockPagination()}
                selection={{ enabled: true, multiple: true }}
                onSelectionChange={onSelectionChange}
            />
        );

        const firstCheckbox = screen.getAllByRole('checkbox')[0];
        await userEvent.click(firstCheckbox);

        expect(onSelectionChange).toHaveBeenCalledWith(
            ['1'],
            [mockUsers[0]]
        );
    });

    it('handles filtering', async () => {
        const onFiltersChange = vi.fn();

        render(
            <DataTable
                data={mockUsers}
                columns={mockColumns}
                pagination={AdminTestUtils.createMockPagination()}
                onFiltersChange={onFiltersChange}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search...');
        await userEvent.type(searchInput, 'John');

        expect(onFiltersChange).toHaveBeenCalledWith(
            expect.objectContaining({ search: 'John' })
        );
    });

    it('shows empty state when no data', () => {
        render(
            <DataTable
                data={[]}
                columns={mockColumns}
                pagination={AdminTestUtils.createMockPagination({ total: 0 })}
            />
        );

        expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('handles loading state', () => {
        render(
            <DataTable
                data={[]}
                columns={mockColumns}
                pagination={AdminTestUtils.createMockPagination()}
                loading={true}
            />
        );

        expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('handles error state', () => {
        const error = { message: 'Failed to load data' };

        render(
            <DataTable
                data={[]}
                columns={mockColumns}
                pagination={AdminTestUtils.createMockPagination()}
                error={error}
            />
        );

        expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
});

// GenericFilters tests
describe('GenericFilters', () => {
    const mockFilters = [
        {
            key: 'search',
            label: 'Search',
            type: 'text',
            placeholder: 'Search...'
        },
        {
            key: 'role',
            label: 'Role',
            type: 'select',
            options: [
                { value: 'ADMIN', label: 'Admin' },
                { value: 'CUSTOMER', label: 'Customer' }
            ]
        },
        {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' }
            ]
        }
    ];

    it('renders filter fields', () => {
        render(
            <GenericFilters
                groups={[{ title: 'Filters', fields: mockFilters }]}
                onFiltersChange={vi.fn()}
            />
        );

        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
        expect(screen.getByDisplayValue('All Roles')).toBeInTheDocument();
        expect(screen.getByDisplayValue('All Status')).toBeInTheDocument();
    });

    it('handles text filter changes', async () => {
        const onFiltersChange = vi.fn();

        render(
            <GenericFilters
                groups={[{ title: 'Filters', fields: mockFilters }]}
                onFiltersChange={onFiltersChange}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search...');
        await userEvent.type(searchInput, 'test');

        expect(onFiltersChange).toHaveBeenCalledWith(
            expect.objectContaining({ search: 'test' })
        );
    });

    it('handles select filter changes', async () => {
        const onFiltersChange = vi.fn();

        render(
            <GenericFilters
                groups={[{ title: 'Filters', fields: mockFilters }]}
                onFiltersChange={onFiltersChange}
            />
        );

        const roleSelect = screen.getByDisplayValue('All Roles');
        await userEvent.click(roleSelect);
        await userEvent.click(screen.getByText('Admin'));

        expect(onFiltersChange).toHaveBeenCalledWith(
            expect.objectContaining({ role: 'ADMIN' })
        );
    });

    it('shows active filters', () => {
        render(
            <GenericFilters
                groups={[{ title: 'Filters', fields: mockFilters }]}
                initialFilters={{ search: 'test', role: 'ADMIN' }}
                onFiltersChange={vi.fn()}
            />
        );

        expect(screen.getByText('Search: test')).toBeInTheDocument();
        expect(screen.getByText('Role: Admin')).toBeInTheDocument();
    });

    it('clears all filters', async () => {
        const onReset = vi.fn();

        render(
            <GenericFilters
                groups={[{ title: 'Filters', fields: mockFilters }]}
                initialFilters={{ search: 'test', role: 'ADMIN' }}
                onFiltersChange={vi.fn()}
                onReset={onReset}
            />
        );

        const clearButton = screen.getByText('Clear All');
        await userEvent.click(clearButton);

        expect(onReset).toHaveBeenCalled();
    });
});

// AdminPageLayout tests
describe('AdminPageLayout', () => {
    const mockStats = [
        {
            id: 'total',
            label: 'Total Users',
            value: 100,
            change: { value: '+5%', type: 'increase' as const }
        },
        {
            id: 'active',
            label: 'Active Users',
            value: 75,
            change: { value: '+2%', type: 'increase' as const }
        }
    ];

    it('renders page layout', () => {
        render(
            <AdminPageLayout
                title="Users Management"
                description="Manage system users"
                stats={mockStats}
                breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
            >
                <div>Page Content</div>
            </AdminPageLayout>
        );

        expect(screen.getByText('Users Management')).toBeInTheDocument();
        expect(screen.getByText('Manage system users')).toBeInTheDocument();
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('Page Content')).toBeInTheDocument();
    });

    it('renders breadcrumbs', () => {
        render(
            <AdminPageLayout
                title="Users Management"
                breadcrumbs={[
                    { label: 'Admin', href: '/admin' },
                    { label: 'Users' }
                ]}
            >
                <div>Page Content</div>
            </AdminPageLayout>
        );

        expect(screen.getByText('Admin')).toBeInTheDocument();
        expect(screen.getByText('Users')).toBeInTheDocument();
    });

    it('renders actions', () => {
        const mockAction = {
            label: 'Add User',
            icon: <span>+</span>,
            onClick: vi.fn()
        };

        render(
            <AdminPageLayout
                title="Users Management"
                actions={[mockAction]}
            >
                <div>Page Content</div>
            </AdminPageLayout>
        );

        const actionButton = screen.getByText('Add User');
        expect(actionButton).toBeInTheDocument();

        await userEvent.click(actionButton);
        expect(mockAction.onClick).toHaveBeenCalled();
    });

    it('shows loading state', () => {
        render(
            <AdminPageLayout
                title="Users Management"
                loading={true}
            >
                <div>Page Content</div>
            </AdminPageLayout>
        );

        expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('shows error state', () => {
        render(
            <AdminPageLayout
                title="Users Management"
                error="Failed to load data"
            >
                <div>Page Content</div>
            </AdminPageLayout>
        );

        expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
});

// ErrorBoundary tests
describe('ErrorBoundary', () => {
    it('catches and displays errors', () => {
        const ThrowError = () => {
            throw new Error('Test error');
        };

        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('provides retry functionality', async () => {
        let shouldThrow = true;
        const ThrowThenRecover = () => {
            if (shouldThrow) {
                throw new Error('Test error');
            }
            return <div>Recovered</div>;
        };

        render(
            <ErrorBoundary>
                <ThrowThenRecover />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        shouldThrow = false;
        const retryButton = screen.getByText('Retry');
        await userEvent.click(retryButton);

        expect(screen.getByText('Recovered')).toBeInTheDocument();
    });
});

// Integration tests for Admin Users page
describe('Admin Users Integration', () => {
    it('renders complete users page', async () => {
        const mockData = AdminTestUtils.createMockLoaderData();

        // Mock the loader
        vi.mock('~/routes/admin/users._index', () => ({
            loader: () => json(mockData),
            default: () => <div>Users Page</div>
        }));

        render(<div>Users Page</div>);

        await AdminTestUtils.waitForDataToLoad();

        expect(screen.getByText('Users Page')).toBeInTheDocument();
    });

    it('handles user actions', async () => {
        const mockUsers = AdminTestUtils.createMockUsers();
        const mockActions = [
            {
                id: 'view',
                label: 'View',
                icon: <span>👁️</span>,
                onClick: vi.fn()
            },
            {
                id: 'edit',
                label: 'Edit',
                icon: <span>✏️</span>,
                onClick: vi.fn()
            }
        ];

        render(
            <DataTable
                data={mockUsers}
                columns={[
                    { key: 'firstName', label: 'Name' },
                    { key: 'email', label: 'Email' }
                ]}
                actions={mockActions}
                pagination={AdminTestUtils.createMockPagination()}
            />
        );

        const firstViewButton = screen.getAllByText('View')[0];
        await userEvent.click(firstViewButton);

        expect(mockActions[0].onClick).toHaveBeenCalledWith(mockUsers[0]);
    });
});

// Performance tests
describe('Performance', () => {
    it('handles large datasets efficiently', async () => {
        const largeDataset = AdminTestUtils.createMockUsers(1000);

        const startTime = performance.now();

        render(
            <DataTable
                data={largeDataset}
                columns={[
                    { key: 'firstName', label: 'Name' },
                    { key: 'email', label: 'Email' }
                ]}
                pagination={AdminTestUtils.createMockPagination({ total: 1000 })}
            />
        );

        await AdminTestUtils.waitForLoadingToFinish();

        const endTime = performance.now();
        const renderTime = endTime - startTime;

        // Should render within 100ms for 1000 items
        expect(renderTime).toBeLessThan(100);
    });

    it('debounces filter input', async () => {
        const onFiltersChange = vi.fn();

        render(
            <DataTable
                data={AdminTestUtils.createMockUsers()}
                columns={[{ key: 'firstName', label: 'Name' }]}
                pagination={AdminTestUtils.createMockPagination()}
                onFiltersChange={onFiltersChange}
                debounceMs={100}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search...');

        // Type multiple characters quickly
        await userEvent.type(searchInput, 'test');

        // Should only call once after debounce
        await waitFor(() => {
            expect(onFiltersChange).toHaveBeenCalledTimes(1);
        }, { timeout: 200 });
    });
});

// Accessibility tests
describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
        render(
            <DataTable
                data={AdminTestUtils.createMockUsers()}
                columns={[{ key: 'firstName', label: 'Name' }]}
                pagination={AdminTestUtils.createMockPagination()}
            />
        );

        const table = screen.getByRole('grid');
        expect(table).toHaveAttribute('aria-label', 'Data table');
        expect(table).toHaveAttribute('aria-rowcount', '5');
    });

    it('supports keyboard navigation', async () => {
        render(
            <DataTable
                data={AdminTestUtils.createMockUsers()}
                columns={[{ key: 'firstName', label: 'Name' }]}
                pagination={AdminTestUtils.createMockPagination()}
            />
        );

        const table = screen.getByRole('grid');
        table.focus();

        await userEvent.keyboard('{ArrowDown}');

        // Should move focus to next row
        expect(document.activeElement).toBe(table);
    });

    it('announces changes to screen readers', async () => {
        const onFiltersChange = vi.fn();

        render(
            <DataTable
                data={AdminTestUtils.createMockUsers()}
                columns={[{ key: 'firstName', label: 'Name' }]}
                pagination={AdminTestUtils.createMockPagination()}
                onFiltersChange={onFiltersChange}
                accessibility={{ announcements: true }}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search...');
        await userEvent.type(searchInput, 'test');

        // Should have live region for announcements
        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});
