import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Plus: (props: Record<string, unknown>) => <svg data-testid="plus-icon" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  ChevronUp: (props: Record<string, unknown>) => <svg data-testid="chevron-up" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <svg data-testid="refresh-icon" {...props} />,
  Download: (props: Record<string, unknown>) => <svg data-testid="download-icon" {...props} />,
  Eye: (props: Record<string, unknown>) => <svg data-testid="eye-icon" {...props} />,
  Pencil: (props: Record<string, unknown>) => <svg data-testid="pencil-icon" {...props} />,
  Trash2: (props: Record<string, unknown>) => <svg data-testid="trash-icon" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader-icon" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <svg data-testid="alert-icon" {...props} />,
  ChevronLeft: (props: Record<string, unknown>) => <svg data-testid="chevron-left" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <svg data-testid="chevron-right" {...props} />,
}));

vi.mock('./SmartSearch', () => ({
  SmartSearch: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="smart-search"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

vi.mock('./FilterChips', () => ({
  FilterChips: ({ filters }: any) => (
    <div data-testid="filter-chips" data-count={filters.length} />
  ),
}));

vi.mock('./DataViews', () => ({
  CardView: ({ data: d }: any) => <div data-testid="card-view">{d.length} items</div>,
  ListView: ({ data: d }: any) => <div data-testid="list-view">{d.length} items</div>,
  ViewModeToggle: ({ value, onChange }: any) => (
    <button data-testid="view-mode-toggle" onClick={() => onChange('cards')}>{value}</button>
  ),
}));

vi.mock('./ResponsiveLayout', () => ({
  useResponsiveMode: () => 'desktop',
}));

vi.mock('~/components/admin/BulkActions', () => ({
  BulkActionsToolbar: ({ selectedCount }: any) => (
    <div data-testid="bulk-actions" data-selected={selectedCount} />
  ),
}));

import { EnhancedDataTable } from './EnhancedDataTable';

type Row = { id: string; name: string; value: number };

const columns: any[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'value', header: 'Value' },
];

const data: Row[] = [
  { id: '1', name: 'Alpha', value: 10 },
  { id: '2', name: 'Beta', value: 20 },
  { id: '3', name: 'Charlie', value: 30 },
];

describe('EnhancedDataTable', () => {
  it('renders with title', () => {
    render(<EnhancedDataTable data={data} columns={columns} title="Users" />);
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<EnhancedDataTable data={data} columns={columns} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<EnhancedDataTable data={data} columns={columns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    const { container } = render(<EnhancedDataTable data={[]} columns={columns} />);
    const tbody = container.querySelector('tbody');
    expect(tbody?.children.length ?? 0).toBe(0);
  });

  it('shows loading bar when loading', () => {
    const { container } = render(<EnhancedDataTable data={[]} columns={columns} loading />);
    // Loading bar is a div with animate class
    const loadingBar = container.querySelector('[class*="animate"]');
    expect(loadingBar).toBeTruthy();
  });

  it('shows error message', () => {
    render(<EnhancedDataTable data={[]} columns={columns} error="Failed to load" />);
    expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<EnhancedDataTable data={data} columns={columns} enableSearch />);
    expect(screen.getByTestId('smart-search')).toBeInTheDocument();
  });

  it('hides search when disabled', () => {
    render(<EnhancedDataTable data={data} columns={columns} enableSearch={false} />);
    expect(screen.queryByTestId('smart-search')).not.toBeInTheDocument();
  });

  it('renders view mode toggle', () => {
    render(<EnhancedDataTable data={data} columns={columns} enableViewModes />);
    expect(screen.getByTestId('view-mode-toggle')).toBeInTheDocument();
  });

  it('renders Add New button when onAdd provided', () => {
    render(<EnhancedDataTable data={data} columns={columns} onAdd={vi.fn()} />);
    expect(screen.getByText('Add New')).toBeInTheDocument();
  });

  it('calls onAdd when Add New clicked', () => {
    const onAdd = vi.fn();
    render(<EnhancedDataTable data={data} columns={columns} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('Add New'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('renders refresh button when onRefresh provided', () => {
    render(<EnhancedDataTable data={data} columns={columns} onRefresh={vi.fn()} />);
    expect(screen.getByTitle('Refresh')).toBeInTheDocument();
  });

  it('renders export button when onExport provided', () => {
    render(<EnhancedDataTable data={data} columns={columns} onExport={vi.fn()} />);
    expect(screen.getByTitle('Export')).toBeInTheDocument();
  });

  it('renders advanced options toggle', () => {
    render(<EnhancedDataTable data={data} columns={columns} enableAdvancedMode />);
    expect(screen.getByText(/Show Advanced Options/)).toBeInTheDocument();
  });

  it('toggles advanced options on click', () => {
    render(<EnhancedDataTable data={data} columns={columns} enableAdvancedMode />);
    fireEvent.click(screen.getByText(/Show Advanced Options/));
    expect(screen.getByText(/Hide Advanced Options/)).toBeInTheDocument();
    expect(screen.getByText('Table Statistics')).toBeInTheDocument();
  });

  it('renders bulk actions toolbar', () => {
    render(<EnhancedDataTable data={data} columns={columns} />);
    expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
  });

  it('renders pagination info', () => {
    render(<EnhancedDataTable data={data} columns={columns} />);
    expect(screen.getByText(/1-3 of 3/)).toBeInTheDocument();
  });

  it('renders filter chips component', () => {
    render(<EnhancedDataTable data={data} columns={columns} enableFilters />);
    expect(screen.getByTestId('filter-chips')).toBeInTheDocument();
  });
});
