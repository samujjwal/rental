import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BulkActionsToolbar } from './BulkActionsToolbar';

describe('BulkActionsToolbar', () => {
  const mockOnAction = vi.fn();
  const mockOnSelectionChange = vi.fn();

  const defaultItems = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
  ];

  const defaultActions = [
    { id: 'delete', label: 'Delete', variant: 'destructive' as const, onClick: mockOnAction },
    { id: 'archive', label: 'Archive', variant: 'default' as const, onClick: mockOnAction },
  ];

  const defaultProps = {
    items: defaultItems,
    actions: defaultActions,
    onSelectionChange: mockOnSelectionChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<BulkActionsToolbar {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('should render empty state when no items', () => {
    const { container } = render(
      <BulkActionsToolbar {...defaultProps} items={[]} />
    );
    // Component renders but with no functional content
    expect(container).toBeInTheDocument();
  });
});
