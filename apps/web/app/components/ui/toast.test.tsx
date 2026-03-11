import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast, ToastContainer, Alert, FormError } from './toast';

describe('Toast', () => {
  it('renders message', () => {
    render(<Toast type="success" message="Operation successful" />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('renders with role="alert"', () => {
    render(<Toast type="info" message="Hello" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders success icon', () => {
    render(<Toast type="success" message="Done" />);
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('renders error icon', () => {
    render(<Toast type="error" message="Failed" />);
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('renders warning icon', () => {
    render(<Toast type="warning" message="Careful" />);
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('renders info icon', () => {
    render(<Toast type="info" message="Note" />);
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('renders action button that calls onClick', () => {
    const onClick = vi.fn();
    render(
      <Toast type="info" message="Update" action={{ label: 'Undo', onClick }} />
    );
    fireEvent.click(screen.getByText('Undo'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render action when not provided', () => {
    render(<Toast type="info" message="Test" />);
    expect(screen.queryByText('Undo')).not.toBeInTheDocument();
  });

  it('renders dismiss button that calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(<Toast type="info" message="Test" onDismiss={onDismiss} />);
    const dismissBtn = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss when onDismiss not provided', () => {
    render(<Toast type="info" message="Test" />);
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Toast type="success" message="Custom" className="custom-toast" />
    );
    expect(container.querySelector('.custom-toast')).toBeTruthy();
  });
});

describe('ToastContainer', () => {
  it('renders children', () => {
    render(
      <ToastContainer>
        <div>Toast 1</div>
        <div>Toast 2</div>
      </ToastContainer>
    );
    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
  });

  it('defaults to bottom-right positioning', () => {
    const { container } = render(
      <ToastContainer>
        <div>Content</div>
      </ToastContainer>
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('bottom-4');
    expect(wrapper?.className).toContain('right-4');
  });

  it('supports top-left position', () => {
    const { container } = render(
      <ToastContainer position="top-left">
        <div>Content</div>
      </ToastContainer>
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('top-4');
    expect(wrapper?.className).toContain('left-4');
  });

  it('supports top-center position', () => {
    const { container } = render(
      <ToastContainer position="top-center">
        <div>Content</div>
      </ToastContainer>
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('top-4');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ToastContainer className="custom-container">
        <div>Content</div>
      </ToastContainer>
    );
    expect(container.querySelector('.custom-container')).toBeTruthy();
  });
});

describe('Alert', () => {
  it('renders message', () => {
    render(<Alert type="info" message="Information notice" />);
    expect(screen.getByText('Information notice')).toBeInTheDocument();
  });

  it('renders with role="alert"', () => {
    render(<Alert type="error" message="Error!" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Alert type="warning" message="Body" title="Warning Title" />);
    expect(screen.getByText('Warning Title')).toBeInTheDocument();
  });

  it('does not render title when omitted', () => {
    render(<Alert type="info" message="Body" />);
    expect(screen.queryByText('Warning Title')).not.toBeInTheDocument();
  });

  it('renders correct icon per type', () => {
    const { rerender } = render(<Alert type="success" message="ok" />);
    expect(screen.getByText('✅')).toBeInTheDocument();

    rerender(<Alert type="error" message="bad" />);
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <Alert type="info" message="Note">
        <a href="/help">Learn more</a>
      </Alert>
    );
    expect(screen.getByText('Learn more')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Alert type="info" message="Msg" className="alert-custom" />
    );
    expect(container.querySelector('.alert-custom')).toBeTruthy();
  });
});

describe('FormError', () => {
  it('renders nothing when no errors', () => {
    const { container } = render(<FormError errors={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when all values are undefined', () => {
    const { container } = render(
      <FormError errors={{ email: undefined, password: undefined }} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders error messages for string values', () => {
    render(
      <FormError errors={{ email: 'Email is required', password: 'Too short' }} />
    );
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });

  it('joins array error values with commas', () => {
    render(
      <FormError errors={{ password: ['Too short', 'Must have number'] }} />
    );
    expect(screen.getByText('Too short, Must have number')).toBeInTheDocument();
  });

  it('renders error title', () => {
    render(<FormError errors={{ name: 'Required' }} />);
    expect(screen.getByText('Please fix the following errors:')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <FormError errors={{ name: 'Required' }} className="form-err" />
    );
    expect(container.querySelector('.form-err')).toBeTruthy();
  });
});
