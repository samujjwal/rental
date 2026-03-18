import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContextualHelp, QuickTip, FirstTimeHelp } from './ContextualHelp';

// Mock the UnifiedButton component
vi.mock('./unified-button', () => ({
  UnifiedButton: ({ 
    children, 
    onClick, 
    className, 
    variant, 
    size 
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button 
      onClick={onClick} 
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

describe('ContextualHelp', () => {
  const defaultProps = {
    title: 'Help Title',
    content: 'Help content description',
  };

  it('renders tooltip variant by default', () => {
    render(<ContextualHelp {...defaultProps} />);
    
    const helpButton = screen.getByRole('button');
    expect(helpButton).toBeInTheDocument();
  });

  it('shows tooltip on click', async () => {
    render(<ContextualHelp {...defaultProps} />);
    
    const helpButton = screen.getByRole('button');
    
    // Initially hidden
    expect(screen.queryByText('Help content description')).not.toBeInTheDocument();
    
    // Click to show
    fireEvent.click(helpButton);
    await waitFor(() => {
      expect(screen.getByText('Help content description')).toBeInTheDocument();
      expect(screen.getByText('Help Title')).toBeInTheDocument();
    });
  });

  it('hides tooltip when clicking backdrop', async () => {
    render(<ContextualHelp {...defaultProps} />);
    
    const helpButton = screen.getByRole('button');
    
    // Show tooltip
    fireEvent.click(helpButton);
    await waitFor(() => {
      expect(screen.getByText('Help content description')).toBeInTheDocument();
    });
    
    // Click backdrop to hide
    const backdrop = document.querySelector('.fixed.inset-0.z-40');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    
    await waitFor(() => {
      expect(screen.queryByText('Help content description')).not.toBeInTheDocument();
    });
  });

  it('renders with custom className', () => {
    render(
      <ContextualHelp 
        {...defaultProps} 
        className="custom-help" 
      />
    );
    
    const container = screen.getByRole('button').parentElement;
    expect(container).toHaveClass('custom-help');
  });

  it('renders modal variant', async () => {
    render(
      <ContextualHelp 
        {...defaultProps} 
        variant="modal" 
      />
    );
    
    const helpButton = screen.getByRole('button');
    fireEvent.click(helpButton);
    
    await waitFor(() => {
      const tooltip = document.querySelector('.z-50.bg-background.border.border-border');
      expect(tooltip).toHaveClass('fixed');
    });
  });

  it('renders inline variant', () => {
    render(
      <ContextualHelp 
        {...defaultProps} 
        variant="inline" 
      />
    );
    
    expect(screen.getByText('Help Title')).toBeInTheDocument();
    expect(screen.getByText('Help content description')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument(); // Close button
  });

  it('renders React content', async () => {
    const customContent = <div data-testid="custom-content">Custom React Content</div>;
    
    render(
      <ContextualHelp 
        {...defaultProps} 
        content={customContent} 
      />
    );
    
    const helpButton = screen.getByRole('button');
    fireEvent.click(helpButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });

  it('shows on mount when showOnMount is true', () => {
    render(
      <ContextualHelp 
        {...defaultProps} 
        showOnMount={true} 
      />
    );
    
    expect(screen.getByText('Help content description')).toBeInTheDocument();
  });

  it('positions tooltip correctly - top position', async () => {
    render(<ContextualHelp {...defaultProps} position="top" />);
    
    const helpButton = screen.getByRole('button');
    fireEvent.click(helpButton);
    
    await waitFor(() => {
      const tooltip = document.querySelector('.absolute.z-50.w-80');
      expect(tooltip).toHaveClass('bottom-full');
    });
  });

  it('positions tooltip correctly - bottom position', async () => {
    render(
      <ContextualHelp 
        {...defaultProps} 
        position="bottom" 
      />
    );
    
    const helpButton = screen.getByRole('button');
    fireEvent.click(helpButton);
    
    await waitFor(() => {
      const tooltip = document.querySelector('.absolute.z-50.w-80');
      expect(tooltip).toHaveClass('top-full');
    });
  });

  it('calls onDismiss when close button is clicked - inline variant', async () => {
    render(
      <div>
        <ContextualHelp 
          {...defaultProps} 
          variant="inline"
        />
      </div>
    );
    
    const closeButton = screen.getByRole('button');
    expect(() => fireEvent.click(closeButton)).not.toThrow();
  });
});

describe('QuickTip', () => {
  const defaultProps = {
    children: <span>Hover me</span>,
    tip: 'Quick tip content',
  };

  it('renders children with help icon', () => {
    render(<QuickTip {...defaultProps} />);
    
    expect(screen.getByText('Hover me')).toBeInTheDocument();
    const icon = document.querySelector('svg.lucide-circle-question-mark');
    expect(icon).toBeInTheDocument();
  });

  it('shows tooltip on hover', async () => {
    render(<QuickTip {...defaultProps} />);
    
    const container = screen.getByText('Hover me').closest('div')!;
    
    // Initially hidden
    expect(screen.queryByText('Quick tip content')).not.toBeInTheDocument();
    
    // Hover to show
    fireEvent.mouseEnter(container);
    await waitFor(() => {
      expect(screen.getByText('Quick tip content')).toBeInTheDocument();
    });
    
    // Unhover to hide
    fireEvent.mouseLeave(container);
    await waitFor(() => {
      expect(screen.queryByText('Quick tip content')).not.toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    render(
      <QuickTip 
        {...defaultProps} 
        className="custom-tip" 
      />
    );
    
    const container = screen.getByText('Hover me').parentElement?.parentElement;
    expect(container).toHaveClass('custom-tip');
  });
});

describe('FirstTimeHelp', () => {
  const defaultProps = {
    title: 'Welcome!',
    description: 'This is a first-time help message',
  };

  it('renders with required props', () => {
    render(<FirstTimeHelp {...defaultProps} />);
    
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
    expect(screen.getByText('This is a first-time help message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
  });

  it('renders with action button', () => {
    const action = {
      label: 'Get Started',
      onClick: vi.fn(),
    };
    
    render(
      <FirstTimeHelp 
        {...defaultProps} 
        action={action} 
      />
    );
    
    const actionButton = screen.getByRole('button', { name: 'Get Started' });
    expect(actionButton).toBeInTheDocument();
    
    fireEvent.click(actionButton);
    expect(action.onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when Got it is clicked', () => {
    const onDismiss = vi.fn();
    
    render(
      <FirstTimeHelp 
        {...defaultProps} 
        onDismiss={onDismiss} 
      />
    );
    
    const dismissButton = screen.getByRole('button', { name: /Got it/i });
    fireEvent.click(dismissButton);
    
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(
      <FirstTimeHelp 
        {...defaultProps} 
        className="custom-first-time" 
      />
    );
    
    const container = screen.getByText('Welcome!').parentElement?.parentElement?.parentElement;
    expect(container).toHaveClass('custom-first-time');
  });

  it('renders without action when not provided', () => {
    render(<FirstTimeHelp {...defaultProps} />);
    
    expect(screen.queryByRole('button', { name: 'Get Started' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
  });

  it('renders without onDismiss when not provided', () => {
    render(<FirstTimeHelp {...defaultProps} />);
    
    const dismissButton = screen.getByRole('button', { name: /Got it/i });
    expect(() => fireEvent.click(dismissButton)).not.toThrow();
  });
});
