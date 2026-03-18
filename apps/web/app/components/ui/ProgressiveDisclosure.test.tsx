import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProgressiveDisclosure, CollapsibleSection } from './ProgressiveDisclosure';

// Mock the UI components
vi.mock('~/components/ui', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>{children}</h2>
  ),
}));

describe('ProgressiveDisclosure', () => {
  const defaultProps = {
    title: 'Test Title',
    children: <div data-testid="test-content">Test Content</div>,
  };

  it('renders with default props', () => {
    render(<ProgressiveDisclosure {...defaultProps} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('card-header')).toBeInTheDocument();
    // Content is not rendered when collapsed by default
    expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
  });

  it('renders with description', () => {
    render(
      <ProgressiveDisclosure 
        {...defaultProps} 
        description="Test description" 
      />
    );
    
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('is collapsed by default', () => {
    render(<ProgressiveDisclosure {...defaultProps} />);
    
    // Content should not be in DOM when collapsed
    expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
  });

  it('expands when defaultExpanded is true', () => {
    render(
      <ProgressiveDisclosure 
        {...defaultProps} 
        defaultExpanded={true} 
      />
    );
    
    const content = screen.getByTestId('test-content');
    expect(content).toBeVisible();
  });

  it('toggles expansion on click', async () => {
    render(<ProgressiveDisclosure {...defaultProps} />);
    
    const button = screen.getByRole('button');
    
    // Initially collapsed - content not in DOM
    expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });
    
    // Click to collapse
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });
  });

  it('applies correct variant styles', () => {
    const { rerender } = render(
      <ProgressiveDisclosure {...defaultProps} variant="compact" />
    );
    
    let header = screen.getByTestId('card-header');
    expect(header).toHaveClass('pb-2');
    
    rerender(<ProgressiveDisclosure {...defaultProps} variant="minimal" />);
    header = screen.getByTestId('card-header');
    expect(header).toHaveClass('pb-1');
  });

  it('applies custom className', () => {
    render(
      <ProgressiveDisclosure 
        {...defaultProps} 
        className="custom-class" 
      />
    );
    
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-class');
  });

  it('supports keyboard navigation', async () => {
    render(<ProgressiveDisclosure {...defaultProps} />);
    
    const button = screen.getByRole('button');
    
    // Initially collapsed - content not in DOM
    expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    
    // Enter key should toggle
    fireEvent.keyDown(button, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });
    
    // Space key should toggle
    fireEvent.keyDown(button, { key: ' ' });
    await waitFor(() => {
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
    });
  });

  it('has correct accessibility attributes', () => {
    render(<ProgressiveDisclosure {...defaultProps} id="test-disclosure" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'test-disclosure-content');
  });

  it('updates aria-expanded when toggled', async () => {
    render(<ProgressiveDisclosure {...defaultProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });
});

describe('CollapsibleSection', () => {
  const defaultProps = {
    title: 'Section Title',
    children: <div data-testid="section-content">Section Content</div>,
  };

  it('renders with default props', () => {
    render(<CollapsibleSection {...defaultProps} />);
    
    expect(screen.getByText('Section Title')).toBeInTheDocument();
    expect(screen.getByTestId('section-content')).toBeInTheDocument();
  });

  it('is collapsed by default', () => {
    render(<CollapsibleSection {...defaultProps} initiallyCollapsed={true} />);
    
    // Content should not be in DOM when collapsed
    expect(screen.queryByTestId('section-content')).not.toBeInTheDocument();
  });

  it('expands when initiallyCollapsed is false', () => {
    render(
      <CollapsibleSection 
        {...defaultProps} 
        initiallyCollapsed={false} 
      />
    );
    
    const content = screen.getByTestId('section-content');
    expect(content).toBeInTheDocument();
  });

  it('toggles content visibility', async () => {
    render(<CollapsibleSection {...defaultProps} />);
    
    const button = screen.getByRole('button');
    const content = screen.getByTestId('section-content');
    
    // Initially expanded (defaultExpanded=true in defaultProps)
    expect(content).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    
    // Click to collapse
    fireEvent.click(button);
    await waitFor(() => {
      expect(content).not.toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('displays badge when provided', () => {
    render(
      <CollapsibleSection 
        {...defaultProps} 
        badge={5} 
      />
    );
    
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows chevron rotation when expanded', async () => {
    render(<CollapsibleSection {...defaultProps} />);
    
    const button = screen.getByRole('button');
    const chevron = button.querySelector('svg');
    
    // Initially expanded (defaultExpanded=true), so chevron is rotated
    expect(chevron).toHaveClass('rotate-180');
    
    // Click to collapse
    fireEvent.click(button);
    await waitFor(() => {
      expect(chevron).not.toHaveClass('rotate-180');
    });
  });

  it('applies custom className', () => {
    render(
      <CollapsibleSection 
        {...defaultProps} 
        className="custom-section" 
      />
    );
    
    const section = screen.getByRole('button').closest('div');
    expect(section).toHaveClass('custom-section');
  });
});
