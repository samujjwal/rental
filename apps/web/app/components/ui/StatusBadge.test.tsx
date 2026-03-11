import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders label text', () => {
    render(<StatusBadge label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('uses default color (gray) when no color specified', () => {
    const { container } = render(<StatusBadge label="Default" />);
    expect(container.firstChild).toHaveClass('bg-gray-100');
  });

  it.each([
    ['primary', 'bg-blue-100'],
    ['secondary', 'bg-purple-100'],
    ['success', 'bg-green-100'],
    ['warning', 'bg-yellow-100'],
    ['error', 'bg-red-100'],
    ['info', 'bg-cyan-100'],
  ] as const)('renders %s color correctly', (color, expectedClass) => {
    const { container } = render(<StatusBadge label="Status" color={color} />);
    expect(container.firstChild).toHaveClass(expectedClass);
  });

  it('renders small size by default', () => {
    const { container } = render(<StatusBadge label="Small" />);
    expect(container.firstChild).toHaveClass('text-xs');
  });

  it('renders medium size', () => {
    const { container } = render(<StatusBadge label="Medium" size="medium" />);
    expect(container.firstChild).toHaveClass('text-sm');
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge label="Custom" className="ml-2" />);
    expect(container.firstChild).toHaveClass('ml-2');
  });

  it('renders react node as label', () => {
    render(<StatusBadge label={<span data-testid="icon-label">✓ OK</span>} />);
    expect(screen.getByTestId('icon-label')).toBeInTheDocument();
  });

  it('has rounded-full class for pill shape', () => {
    const { container } = render(<StatusBadge label="Pill" />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });
});
