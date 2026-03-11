import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

// Mock animation components
vi.mock('~/components/animations', () => ({
  ModalAnimation: ({ children }: any) => <div data-testid="modal-animation">{children}</div>,
  BackdropAnimation: ({ onClick }: any) => <div data-testid="backdrop" onClick={onClick} />,
}));

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Delete Item',
    message: 'Are you sure you want to delete?',
  };

  it('returns null when not open', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete?')).toBeInTheDocument();
  });

  it('shows default button texts', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('uses custom button text', () => {
    render(
      <ConfirmDialog {...defaultProps} confirmText="Delete" cancelText="Nevermind" />,
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Nevermind')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when isLoading is true', () => {
    render(<ConfirmDialog {...defaultProps} isLoading />);
    const cancelBtn = screen.getByText('Cancel').closest('button');
    const confirmBtn = screen.getByText('Confirm').closest('button');
    expect(cancelBtn).toBeDisabled();
    expect(confirmBtn).toBeDisabled();
  });

  it('shows AlertTriangle icon when confirmColor is error and showIcon is true', () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} confirmColor="error" showIcon />,
    );
    // AlertTriangle renders as an SVG with text-red-500
    expect(container.querySelector('.text-red-500')).not.toBeNull();
  });

  it('does not show icon when showIcon is false', () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} confirmColor="error" showIcon={false} />,
    );
    expect(container.querySelector('.text-red-500')).toBeNull();
  });
});
