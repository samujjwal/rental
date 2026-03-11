import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Spinner,
  Loading,
  InlineLoading,
  PageLoading,
  LoadingOverlay,
  ButtonLoading,
} from './loading';

describe('Spinner', () => {
  it('renders with role="status" and aria-label', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });

  it.each(['xs', 'sm', 'md', 'lg', 'xl'] as const)(
    'applies %s size class',
    (size) => {
      const { container } = render(<Spinner size={size} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.classList.contains('animate-spin')).toBe(true);
    },
  );

  it.each(['default', 'primary', 'white'] as const)(
    'applies %s variant class',
    (variant) => {
      render(<Spinner variant={variant} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    },
  );

  it('accepts custom className', () => {
    const { container } = render(<Spinner className="extra" />);
    expect(container.querySelector('.extra')).not.toBeNull();
  });
});

describe('Loading', () => {
  it('shows default message', () => {
    render(<Loading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows custom message', () => {
    render(<Loading message="Fetching data..." />);
    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
  });

  it('renders in fullScreen mode with overlay', () => {
    const { container } = render(<Loading fullScreen />);
    expect(container.querySelector('.fixed.inset-0')).not.toBeNull();
  });

  it('renders without fullScreen by default', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });
});

describe('InlineLoading', () => {
  it('renders inline spinner', () => {
    render(<InlineLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('PageLoading', () => {
  it('renders with min-height wrapper', () => {
    const { container } = render(<PageLoading />);
    expect(container.querySelector('.min-h-\\[50vh\\]')).not.toBeNull();
  });

  it('passes message to Loading', () => {
    render(<PageLoading message="Loading page..." />);
    expect(screen.getByText('Loading page...')).toBeInTheDocument();
  });
});

describe('LoadingOverlay', () => {
  it('renders with absolute positioning', () => {
    const { container } = render(<LoadingOverlay />);
    expect(container.querySelector('.absolute.inset-0')).not.toBeNull();
  });

  it('shows message', () => {
    render(<LoadingOverlay message="Saving..." />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
});

describe('ButtonLoading', () => {
  it('shows spinner when loading', () => {
    render(<ButtonLoading loading>Submit</ButtonLoading>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows children when not loading', () => {
    render(<ButtonLoading loading={false}>Submit</ButtonLoading>);
    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
