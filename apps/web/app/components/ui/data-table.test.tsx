import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lucide-react', () => ({
  ArrowUpDown: (props: Record<string, unknown>) => <svg data-testid="arrow-updown" {...props} />,
  ArrowUp: (props: Record<string, unknown>) => <svg data-testid="arrow-up" {...props} />,
  ArrowDown: (props: Record<string, unknown>) => <svg data-testid="arrow-down" {...props} />,
  ChevronLeft: (props: Record<string, unknown>) => <svg data-testid="chevron-left" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <svg data-testid="chevron-right" {...props} />,
  ChevronsLeft: (props: Record<string, unknown>) => <svg data-testid="chevrons-left" {...props} />,
  ChevronsRight: (props: Record<string, unknown>) => <svg data-testid="chevrons-right" {...props} />,
  Search: (props: Record<string, unknown>) => <svg data-testid="search-icon" {...props} />,
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  MoreVertical: (props: Record<string, unknown>) => <svg data-testid="more-icon" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <svg data-testid="refresh-icon" {...props} />,
  Download: (props: Record<string, unknown>) => <svg data-testid="download-icon" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader-icon" {...props} />,
}));

import { DataTable } from './data-table';

type Item = { id: string; name: string; value: number };

const columns = [
  { accessorKey: 'name' as const, header: 'Name' },
  { accessorKey: 'value' as const, header: 'Value' },
];

const data: Item[] = [
  { id: '1', name: 'Alpha', value: 10 },
  { id: '2', name: 'Beta', value: 20 },
  { id: '3', name: 'Charlie', value: 30 },
];

describe('DataTable', () => {
  it('renders table with data', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows default empty message', () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText('No data found.')).toBeInTheDocument();
  });

  it('shows search input when searchable', () => {
    render(<DataTable columns={columns} data={data} searchable />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('hides search input when searchable is false', () => {
    render(<DataTable columns={columns} data={data} searchable={false} />);
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('custom search placeholder', () => {
    render(<DataTable columns={columns} data={data} searchPlaceholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });

  it('filters data based on search input', () => {
    render(<DataTable columns={columns} data={data} />);
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('shows clear search button when searching', () => {
    render(<DataTable columns={columns} data={data} />);
    const search = screen.getByPlaceholderText('Search...');
    fireEvent.change(search, { target: { value: 'test' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears search on clear button click', () => {
    render(<DataTable columns={columns} data={data} />);
    const search = screen.getByPlaceholderText('Search...');
    fireEvent.change(search, { target: { value: 'Alpha' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders pagination controls', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Rows per page')).toBeInTheDocument();
    expect(screen.getByLabelText('First page')).toBeInTheDocument();
    expect(screen.getByLabelText('Last page')).toBeInTheDocument();
  });

  it('shows page info', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });

  it('renders loading indicator when loading', () => {
    render(<DataTable columns={columns} data={[]} loading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders refresh button when onRefresh provided', () => {
    render(<DataTable columns={columns} data={data} onRefresh={vi.fn()} />);
    expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh clicked', () => {
    const onRefresh = vi.fn();
    render(<DataTable columns={columns} data={data} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByLabelText('Refresh'));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders export button when onExport provided', () => {
    render(<DataTable columns={columns} data={data} onExport={vi.fn()} />);
    expect(screen.getByLabelText('Export')).toBeInTheDocument();
  });

  it('calls onExport when export clicked', () => {
    const onExport = vi.fn();
    render(<DataTable columns={columns} data={data} onExport={onExport} />);
    fireEvent.click(screen.getByLabelText('Export'));
    expect(onExport).toHaveBeenCalled();
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('shows selection checkboxes when selectable', () => {
    render(<DataTable columns={columns} data={data} selectable />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('renders toolbar actions', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        toolbarActions={<button>Bulk Delete</button>}
      />
    );
    expect(screen.getByText('Bulk Delete')).toBeInTheDocument();
  });

  it('renders page size select with options', () => {
    render(<DataTable columns={columns} data={data} pageSizeOptions={[5, 10, 25]} />);
    const select = screen.getByText('Rows per page').closest('div')!.querySelector('select')!;
    expect(select).toBeInTheDocument();
  });
});
