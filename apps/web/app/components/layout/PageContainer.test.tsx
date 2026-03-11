import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('~/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { PageContainer } from './PageContainer';

describe('PageContainer', () => {
  it('renders children', () => {
    render(<PageContainer><p>Hello World</p></PageContainer>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('applies default max-w-7xl class', () => {
    const { container } = render(<PageContainer>Content</PageContainer>);
    expect(container.firstChild).toHaveClass('max-w-7xl');
  });

  it('applies base padding classes', () => {
    const { container } = render(<PageContainer>Content</PageContainer>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('mx-auto');
    expect(el).toHaveClass('px-4');
    expect(el).toHaveClass('py-8');
  });

  it('applies small size class', () => {
    const { container } = render(<PageContainer size="small">Content</PageContainer>);
    expect(container.firstChild).toHaveClass('max-w-4xl');
  });

  it('applies large size class', () => {
    const { container } = render(<PageContainer size="large">Content</PageContainer>);
    expect(container.firstChild).toHaveClass('max-w-screen-2xl');
  });

  it('applies full size class', () => {
    const { container } = render(<PageContainer size="full">Content</PageContainer>);
    expect(container.firstChild).toHaveClass('max-w-none');
  });

  it('merges custom className', () => {
    const { container } = render(<PageContainer className="bg-red-500">Content</PageContainer>);
    expect(container.firstChild).toHaveClass('bg-red-500');
  });

  it('renders as a div element', () => {
    const { container } = render(<PageContainer>Content</PageContainer>);
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });
});
