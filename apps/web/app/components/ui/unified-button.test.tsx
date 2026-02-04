import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnifiedButton, IconButton, ButtonGroup } from './unified-button';

// Mock prefersReducedMotion
vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => false,
}));

describe('UnifiedButton', () => {
  it('renders with default props', () => {
    render(<UnifiedButton>Click me</UnifiedButton>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('renders all variants correctly', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'success', 'link'] as const;

    variants.forEach((variant) => {
      render(
        <UnifiedButton variant={variant}>Button</UnifiedButton>
      );
      expect(screen.getByText('Button')).toBeInTheDocument();
    });
  });

  it('renders all sizes correctly', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl', 'icon', 'icon-sm', 'icon-lg'] as const;

    sizes.forEach((size) => {
      render(
        <UnifiedButton size={size}>Button</UnifiedButton>
      );
      expect(screen.getByText('Button')).toBeInTheDocument();
    });
  });

  it('shows loading state with spinner', () => {
    render(<UnifiedButton loading>Loading</UnifiedButton>);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    // Check if button is disabled during loading
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when disabled prop is true', () => {
    render(<UnifiedButton disabled>Disabled</UnifiedButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders with left icon', () => {
    render(
      <UnifiedButton leftIcon={<span data-testid="left-icon">Icon</span>}>
        With Icon
      </UnifiedButton>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('renders with right icon', () => {
    render(
      <UnifiedButton rightIcon={<span data-testid="right-icon">Icon</span>}>
        With Icon
      </UnifiedButton>
    );
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<UnifiedButton onClick={handleClick}>Click me</UnifiedButton>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <UnifiedButton onClick={handleClick} disabled>
        Click me
      </UnifiedButton>
    );

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading', () => {
    const handleClick = vi.fn();
    render(
      <UnifiedButton onClick={handleClick} loading>
        Click me
      </UnifiedButton>
    );

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders full width when fullWidth is true', () => {
    const { container } = render(<UnifiedButton fullWidth>Full Width</UnifiedButton>);
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<UnifiedButton ref={ref}>Button</UnifiedButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies custom className', () => {
    const { container } = render(
      <UnifiedButton className="custom-class">Button</UnifiedButton>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders children content correctly', () => {
    render(<UnifiedButton>Custom Text</UnifiedButton>);
    expect(screen.getByText('Custom Text')).toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('renders with icon', () => {
    render(
      <IconButton icon={<span data-testid="icon">★</span>} aria-label="Star" />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<IconButton icon={<span>★</span>} aria-label="Favorite" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Favorite');
  });

  it('uses icon size by default', () => {
    const { container } = render(
      <IconButton icon={<span>★</span>} aria-label="Star" />
    );
    // Should have icon size classes (h-10 w-10)
    expect(container.firstChild).toHaveClass('h-10', 'w-10');
  });
});

describe('ButtonGroup', () => {
  it('renders children in horizontal orientation by default', () => {
    render(
      <ButtonGroup>
        <button>One</button>
        <button>Two</button>
        <button>Three</button>
      </ButtonGroup>
    );

    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();
  });

  it('renders with vertical orientation', () => {
    render(
      <ButtonGroup orientation="vertical">
        <button>One</button>
        <button>Two</button>
      </ButtonGroup>
    );
    expect(screen.getByRole('group')).toHaveClass('flex-col');
  });

  it('applies custom className', () => {
    render(
      <ButtonGroup className="custom-group">
        <button>One</button>
      </ButtonGroup>
    );
    expect(screen.getByRole('group')).toHaveClass('custom-group');
  });
});
