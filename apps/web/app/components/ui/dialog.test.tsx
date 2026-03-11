import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  X: (props: any) => <span data-testid="x-icon" {...props} />,
}));

import { Dialog, DialogFooter } from './dialog';

describe('Dialog', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    document.body.style.overflow = '';
  });

  it('renders null when open is false', () => {
    const { container } = render(
      <Dialog open={false} onClose={onClose}>
        <p>Content</p>
      </Dialog>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders children when open', () => {
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Dialog content</p>
      </Dialog>
    );
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(
      <Dialog open={true} onClose={onClose} title="My Title">
        <p>Body</p>
      </Dialog>
    );
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Title').tagName).toBe('H2');
  });

  it('renders description', () => {
    render(
      <Dialog open={true} onClose={onClose} title="T" description="A description">
        <p>Body</p>
      </Dialog>
    );
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('has role="dialog" and aria-modal', () => {
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('sets aria-labelledby when title is provided', () => {
    render(
      <Dialog open={true} onClose={onClose} title="Hello">
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
  });

  it('sets aria-describedby when description is provided', () => {
    render(
      <Dialog open={true} onClose={onClose} title="T" description="Desc">
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description');
  });

  it('does not set aria-labelledby without title', () => {
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
  });

  it('renders close button with aria-label', () => {
    render(
      <Dialog open={true} onClose={onClose} title="T">
        <p>Body</p>
      </Dialog>
    );
    const closeBtn = screen.getByLabelText('Close dialog');
    expect(closeBtn).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(
      <Dialog open={true} onClose={onClose} title="T">
        <p>Body</p>
      </Dialog>
    );
    fireEvent.click(screen.getByLabelText('Close dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides close button when showClose=false', () => {
    render(
      <Dialog open={true} onClose={onClose} title="T" showClose={false}>
        <p>Body</p>
      </Dialog>
    );
    expect(screen.queryByLabelText('Close dialog')).not.toBeInTheDocument();
  });

  it('calls onClose on Escape key', () => {
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on backdrop click', () => {
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );
    // Backdrop is the div with aria-hidden
    const backdrop = document.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on backdrop click when closeOnBackdrop=false', () => {
    render(
      <Dialog open={true} onClose={onClose} closeOnBackdrop={false}>
        <p>Body</p>
      </Dialog>
    );
    const backdrop = document.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies size sm class', () => {
    render(
      <Dialog open={true} onClose={onClose} size="sm">
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-sm');
  });

  it('applies size lg class', () => {
    render(
      <Dialog open={true} onClose={onClose} size="lg">
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-lg');
  });

  it('applies size xl class', () => {
    render(
      <Dialog open={true} onClose={onClose} size="xl">
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-xl');
  });

  it('defaults to size md', () => {
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-md');
  });

  it('applies custom className', () => {
    render(
      <Dialog open={true} onClose={onClose} className="custom-class">
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('custom-class');
  });

  it('prevents body scroll when open', () => {
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll on unmount', () => {
    const { unmount } = render(
      <Dialog open={true} onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('DialogFooter', () => {
  it('renders children', () => {
    render(
      <DialogFooter>
        <button>Save</button>
        <button>Cancel</button>
      </DialogFooter>
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <DialogFooter className="extra-class">
        <button>OK</button>
      </DialogFooter>
    );
    expect(container.firstChild).toHaveClass('extra-class');
  });
});
