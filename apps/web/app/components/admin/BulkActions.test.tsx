import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Trash2: (props: any) => <span data-testid="trash-icon" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
  Clock: (props: any) => <span data-testid="clock-icon" {...props} />,
}));

vi.mock('~/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onClose, onConfirm, title, message }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <span>{message}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

vi.mock('~/components/animations', () => ({
  FadeIn: ({ children }: any) => <div>{children}</div>,
}));

import { BulkActionsToolbar, useBulkSelection, BulkSelectCheckbox, ItemSelectCheckbox } from './BulkActions';

describe('BulkActionsToolbar', () => {
  const onClearSelection = vi.fn();
  const onDelete = vi.fn();
  const onStatusChange = vi.fn();

  beforeEach(() => {
    onClearSelection.mockClear();
    onDelete.mockClear();
    onStatusChange.mockClear();
  });

  it('returns null when selectedCount is 0', () => {
    const { container } = render(
      <BulkActionsToolbar selectedCount={0} onClearSelection={onClearSelection} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders selected count text', () => {
    render(
      <BulkActionsToolbar selectedCount={3} onClearSelection={onClearSelection} />
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('calls onClearSelection when clear button is clicked', () => {
    render(
      <BulkActionsToolbar selectedCount={2} onClearSelection={onClearSelection} />
    );
    // The X button for clearing selection
    const buttons = screen.getAllByRole('button');
    const clearBtn = buttons[buttons.length - 1]; // last button is clear
    fireEvent.click(clearBtn);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('renders delete button when onDelete provided', () => {
    render(
      <BulkActionsToolbar
        selectedCount={2}
        onClearSelection={onClearSelection}
        onDelete={onDelete}
      />
    );
    expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
  });

  it('opens confirm dialog on delete click', () => {
    render(
      <BulkActionsToolbar
        selectedCount={2}
        onClearSelection={onClearSelection}
        onDelete={onDelete}
      />
    );
    // Click delete button (the one with trash icon)
    const deleteBtn = screen.getByTestId('trash-icon').closest('button')!;
    fireEvent.click(deleteBtn);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Selected Items?')).toBeInTheDocument();
  });

  it('calls onDelete when confirm dialog is confirmed', () => {
    render(
      <BulkActionsToolbar
        selectedCount={2}
        onClearSelection={onClearSelection}
        onDelete={onDelete}
      />
    );
    const deleteBtn = screen.getByTestId('trash-icon').closest('button')!;
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders Change Status button when statuses provided', () => {
    render(
      <BulkActionsToolbar
        selectedCount={2}
        onClearSelection={onClearSelection}
        onStatusChange={onStatusChange}
        availableStatuses={[{ value: 'active', label: 'Active' }]}
      />
    );
    expect(screen.getByText('Change Status')).toBeInTheDocument();
  });

  it('shows status menu on Change Status click', () => {
    render(
      <BulkActionsToolbar
        selectedCount={2}
        onClearSelection={onClearSelection}
        onStatusChange={onStatusChange}
        availableStatuses={[
          { value: 'active', label: 'Active' },
          { value: 'suspended', label: 'Suspended' },
        ]}
      />
    );
    fireEvent.click(screen.getByText('Change Status'));
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('calls onStatusChange when a status is selected', () => {
    render(
      <BulkActionsToolbar
        selectedCount={2}
        onClearSelection={onClearSelection}
        onStatusChange={onStatusChange}
        availableStatuses={[{ value: 'active', label: 'Active' }]}
      />
    );
    fireEvent.click(screen.getByText('Change Status'));
    fireEvent.click(screen.getByText('Active'));
    expect(onStatusChange).toHaveBeenCalledWith('active');
  });

  it('shows delete message with correct pluralization', () => {
    render(
      <BulkActionsToolbar
        selectedCount={1}
        onClearSelection={onClearSelection}
        onDelete={onDelete}
      />
    );
    const deleteBtn = screen.getByTestId('trash-icon').closest('button')!;
    fireEvent.click(deleteBtn);
    expect(
      screen.getByText('Are you sure you want to delete 1 item? This action cannot be undone.')
    ).toBeInTheDocument();
  });
});

describe('useBulkSelection', () => {
  const items = [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
  ];

  it('starts with empty selection', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('selects an item', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.handleSelect('1'));
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.selectedCount).toBe(1);
  });

  it('deselects an item', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.handleSelect('1'));
    act(() => result.current.handleSelect('1'));
    expect(result.current.isSelected('1')).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('selects all items', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.handleSelectAll());
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.selectedCount).toBe(3);
  });

  it('deselects all when all are selected', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.handleSelectAll());
    act(() => result.current.handleSelectAll());
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('reports indeterminate state', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.handleSelect('1'));
    expect(result.current.isIndeterminate).toBe(true);
  });

  it('clears selection', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.handleSelectAll());
    act(() => result.current.clearSelection());
    expect(result.current.selectedCount).toBe(0);
  });

  it('returns selected items', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.handleSelect('2'));
    expect(result.current.getSelectedItems()).toEqual([{ id: '2', name: 'B' }]);
  });
});

describe('BulkSelectCheckbox', () => {
  it('renders checked checkbox', () => {
    render(<BulkSelectCheckbox checked={true} onChange={vi.fn()} />);
    const cb = screen.getByRole('checkbox');
    expect(cb).toBeChecked();
  });

  it('renders unchecked checkbox', () => {
    render(<BulkSelectCheckbox checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('calls onChange on click', () => {
    const onChange = vi.fn();
    render(<BulkSelectCheckbox checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('supports disabled state', () => {
    render(<BulkSelectCheckbox checked={false} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('has aria-label', () => {
    render(<BulkSelectCheckbox checked={false} onChange={vi.fn()} />);
    expect(screen.getByLabelText('select all items')).toBeInTheDocument();
  });
});

describe('ItemSelectCheckbox', () => {
  it('renders with custom aria-label', () => {
    render(<ItemSelectCheckbox checked={false} onChange={vi.fn()} ariaLabel="select row 1" />);
    expect(screen.getByLabelText('select row 1')).toBeInTheDocument();
  });

  it('defaults to "select item" aria-label', () => {
    render(<ItemSelectCheckbox checked={false} onChange={vi.fn()} />);
    expect(screen.getByLabelText('select item')).toBeInTheDocument();
  });

  it('stops click propagation', () => {
    const parentClick = vi.fn();
    const onChange = vi.fn();
    render(
      <div onClick={parentClick}>
        <ItemSelectCheckbox checked={false} onChange={onChange} />
      </div>
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });
});
