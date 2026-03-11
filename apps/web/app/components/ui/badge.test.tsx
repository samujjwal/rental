import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it.each([
    'default',
    'secondary',
    'destructive',
    'outline',
    'success',
    'warning',
  ] as const)('renders %s variant without crashing', (variant) => {
    const { unmount } = render(<Badge variant={variant}>Badge</Badge>);
    expect(screen.getByText('Badge')).toBeInTheDocument();
    unmount();
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom-class">Custom</Badge>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders as a span element', () => {
    const { container } = render(<Badge>Span</Badge>);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('has rounded-full class', () => {
    const { container } = render(<Badge>Rounded</Badge>);
    expect(container.firstChild).toHaveClass('rounded-full');
  });

  it('forwards HTML attributes', () => {
    render(<Badge data-testid="my-badge" title="tooltip">Attr</Badge>);
    const badge = screen.getByTestId('my-badge');
    expect(badge).toHaveAttribute('title', 'tooltip');
  });

  it('success variant has green background', () => {
    const { container } = render(<Badge variant="success">Active</Badge>);
    expect(container.firstChild).toHaveClass('bg-green-500');
  });

  it('destructive variant has destructive background', () => {
    const { container } = render(<Badge variant="destructive">Error</Badge>);
    expect(container.firstChild).toHaveClass('bg-destructive');
  });
});
