import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnhancedInput, EnhancedTextarea } from './EnhancedInput';
import { Mail, Lock } from 'lucide-react';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLParagraphElement>>) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('EnhancedInput', () => {
  it('renders with default props', () => {
    render(<EnhancedInput />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<EnhancedInput label="Email Address" />);
    expect(screen.getByText('Email Address')).toBeInTheDocument();
  });

  it('associates label with input via htmlFor', () => {
    render(<EnhancedInput label="Email" id="email-input" />);
    const label = screen.getByText('Email');
    const input = screen.getByRole('textbox');

    expect(label).toHaveAttribute('for', 'email-input');
    expect(input).toHaveAttribute('id', 'email-input');
  });

  it('renders with placeholder', () => {
    render(<EnhancedInput placeholder="Enter your email" />);
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
  });

  it('renders error message and sets aria-invalid', () => {
    render(<EnhancedInput error="Email is required" />);

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders success state', () => {
    render(<EnhancedInput success />);
    // Input should have success styling (green border)
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-success');
  });

  it('renders hint text', () => {
    render(<EnhancedInput hint="We will never share your email" />);
    expect(screen.getByText('We will never share your email')).toBeInTheDocument();
  });

  it('renders with left icon', () => {
    render(<EnhancedInput icon={Mail} />);
    // Icon should be rendered
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders with right icon', () => {
    render(<EnhancedInput rightIcon={Lock} />);
    const icons = document.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('renders all sizes correctly', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      render(<EnhancedInput size={size} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('disables input when disabled prop is true', () => {
    render(<EnhancedInput disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders full width by default', () => {
    render(<EnhancedInput />);
    expect(screen.getByRole('textbox').parentElement).toHaveClass('w-full');
  });

  it('calls onChange when input value changes', () => {
    const handleChange = vi.fn();
    render(<EnhancedInput onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test@example.com' } });

    expect(handleChange).toHaveBeenCalled();
  });

  it('forwards ref correctly', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<EnhancedInput ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className to input', () => {
    render(<EnhancedInput className="custom-input-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-input-class');
  });

  it('applies custom containerClassName', () => {
    render(
      <EnhancedInput containerClassName="custom-container" />
    );
    expect(screen.getByRole('textbox').parentElement?.parentElement).toHaveClass('custom-container');
  });

  it('prioritizes error over success state', () => {
    render(
      <EnhancedInput error="Error" success />
    );
    // Should show error, not success
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('border-destructive');
  });

  it('has correct aria-describedby with error', () => {
    render(<EnhancedInput id="test-input" error="Error message" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
  });

  it('has correct aria-describedby with hint', () => {
    render(<EnhancedInput id="test-input" hint="Hint text" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'test-input-hint');
  });

  it('supports different input types', () => {
    render(<EnhancedInput type="password" />);
    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password');
  });

  it('shows opacity change when label is disabled', () => {
    render(<EnhancedInput label="Label" disabled />);
    const label = screen.getByText('Label');
    expect(label).toHaveClass('opacity-50');
  });
});

describe('EnhancedTextarea', () => {
  it('renders with default props', () => {
    render(<EnhancedTextarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders as textarea element', () => {
    render(<EnhancedTextarea />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
  });

  it('renders with label', () => {
    render(<EnhancedTextarea label="Description" />);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<EnhancedTextarea error="Description is required" />);
    expect(screen.getByText('Description is required')).toBeInTheDocument();
  });

  it('renders success state', () => {
    render(<EnhancedTextarea success />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('border-success');
  });

  it('renders hint text', () => {
    render(<EnhancedTextarea hint="Max 500 characters" />);
    expect(screen.getByText('Max 500 characters')).toBeInTheDocument();
  });

  it('disables textarea when disabled', () => {
    render(<EnhancedTextarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('calls onChange when value changes', () => {
    const handleChange = vi.fn();
    render(<EnhancedTextarea onChange={handleChange} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New content' } });

    expect(handleChange).toHaveBeenCalled();
  });

  it('has minimum height', () => {
    render(<EnhancedTextarea />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('min-h-[80px]');
  });

  it('is resizable vertically', () => {
    render(<EnhancedTextarea />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('resize-y');
  });
});
