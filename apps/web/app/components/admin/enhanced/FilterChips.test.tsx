import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChips, type FilterChip } from './FilterChips';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Plus: ({ className }: any) => <span data-testid="plus-icon" className={className}>+</span>,
  Filter: ({ className }: any) => <span data-testid="filter-icon" className={className}>F</span>,
  X: ({ className }: any) => <span data-testid="x-icon" className={className}>x</span>,
  Calendar: ({ className }: any) => <span data-testid="calendar-icon" className={className}>C</span>,
  Type: ({ className }: any) => <span data-testid="type-icon" className={className}>T</span>,
  List: ({ className }: any) => <span data-testid="list-icon" className={className}>L</span>,
  Hash: ({ className }: any) => <span data-testid="hash-icon" className={className}>#</span>,
}));

const mockFilter: FilterChip = {
  id: 'f1',
  field: 'status',
  label: 'Status: Active',
  type: 'text',
  value: 'active',
  color: 'primary',
};

const mockFilter2: FilterChip = {
  id: 'f2',
  field: 'price',
  label: 'Price: 100',
  type: 'number',
  value: 100,
  operator: 'gt',
  color: 'success',
};

describe('FilterChips', () => {
  const defaultProps = {
    filters: [] as FilterChip[],
    onFilterAdd: vi.fn(),
    onFilterRemove: vi.fn(),
    onFilterUpdate: vi.fn(),
  };

  it('renders "Add Filter" button when no filters', () => {
    render(<FilterChips {...defaultProps} />);
    expect(screen.getByText('Add Filter')).toBeInTheDocument();
  });

  it('does not show "Filters:" label when empty', () => {
    render(<FilterChips {...defaultProps} />);
    expect(screen.queryByText('Filters:')).not.toBeInTheDocument();
  });

  it('shows "Filters:" label when filters exist', () => {
    render(<FilterChips {...defaultProps} filters={[mockFilter]} />);
    expect(screen.getByText('Filters:')).toBeInTheDocument();
  });

  it('renders filter chip labels', () => {
    render(<FilterChips {...defaultProps} filters={[mockFilter, mockFilter2]} />);
    expect(screen.getByText(/Status: Active/)).toBeInTheDocument();
    expect(screen.getByText(/Price: 100/)).toBeInTheDocument();
  });

  it('shows operator label for non-equals operators', () => {
    render(<FilterChips {...defaultProps} filters={[mockFilter2]} />);
    // gt operator shows as ">"
    expect(screen.getByText(/\(>\)/)).toBeInTheDocument();
  });

  it('calls onFilterRemove when chip X is clicked', () => {
    const onFilterRemove = vi.fn();
    render(
      <FilterChips {...defaultProps} filters={[mockFilter]} onFilterRemove={onFilterRemove} />
    );
    // Find the X button inside the chip (the one nearest to the chip text)
    const removeButtons = screen.getAllByRole('button');
    // First button should be the chip remove button
    const chipRemoveBtn = removeButtons.find(
      (btn) => btn.closest('span')?.textContent?.includes('Status: Active')
    );
    expect(chipRemoveBtn).toBeTruthy();
    fireEvent.click(chipRemoveBtn!);
    expect(onFilterRemove).toHaveBeenCalledWith('f1');
  });

  it('shows "Clear All" button when filters exist', () => {
    render(<FilterChips {...defaultProps} filters={[mockFilter]} />);
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('does not show "Clear All" when no filters', () => {
    render(<FilterChips {...defaultProps} />);
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
  });

  it('calls onFilterRemove for all filters when "Clear All" is clicked', () => {
    const onFilterRemove = vi.fn();
    render(
      <FilterChips
        {...defaultProps}
        filters={[mockFilter, mockFilter2]}
        onFilterRemove={onFilterRemove}
      />
    );
    fireEvent.click(screen.getByText('Clear All'));
    expect(onFilterRemove).toHaveBeenCalledTimes(2);
    expect(onFilterRemove).toHaveBeenCalledWith('f1');
    expect(onFilterRemove).toHaveBeenCalledWith('f2');
  });

  it('hides "Add Filter" when maxFilters reached', () => {
    render(
      <FilterChips {...defaultProps} filters={[mockFilter]} maxFilters={1} />
    );
    expect(screen.queryByText('Add Filter')).not.toBeInTheDocument();
  });

  it('opens add filter dialog on "Add Filter" click', () => {
    render(
      <FilterChips
        {...defaultProps}
        availableFields={[{ field: 'name', label: 'Name', type: 'text' }]}
      />
    );
    fireEvent.click(screen.getByText('Add Filter'));
    expect(screen.getByText('Select field...')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add Filter' })).toBeInTheDocument();
  });

  it('closes dialog on Cancel click', () => {
    render(
      <FilterChips
        {...defaultProps}
        availableFields={[{ field: 'name', label: 'Name', type: 'text' }]}
      />
    );
    fireEvent.click(screen.getByText('Add Filter'));
    expect(screen.getByRole('heading', { name: 'Add Filter' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Add Filter' })).not.toBeInTheDocument();
  });

  it('applies correct color class for success chip', () => {
    const { container } = render(
      <FilterChips {...defaultProps} filters={[mockFilter2]} />
    );
    const chip = container.querySelector('.border-green-400\\/40');
    expect(chip).toBeTruthy();
  });
});
