import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('renders children', () => {
    render(<VisuallyHidden>Skip to content</VisuallyHidden>);
    expect(screen.getByText('Skip to content')).toBeInTheDocument();
  });

  it('renders as span by default', () => {
    const { container } = render(<VisuallyHidden>Text</VisuallyHidden>);
    expect(container.firstChild!.nodeName).toBe('SPAN');
  });

  it('renders as custom element', () => {
    const { container } = render(<VisuallyHidden as="div">Text</VisuallyHidden>);
    expect(container.firstChild!.nodeName).toBe('DIV');
  });

  it('renders as h2 element', () => {
    const { container } = render(<VisuallyHidden as="h2">Heading</VisuallyHidden>);
    expect(container.firstChild!.nodeName).toBe('H2');
  });

  it('applies sr-only class when not focusable', () => {
    const { container } = render(<VisuallyHidden>Hidden</VisuallyHidden>);
    expect(container.firstChild).toHaveClass('sr-only');
  });

  it('applies visually-hidden inline styles when not focusable', () => {
    const { container } = render(<VisuallyHidden>Hidden</VisuallyHidden>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.position).toBe('absolute');
    expect(el.style.width).toBe('1px');
    expect(el.style.height).toBe('1px');
    expect(el.style.overflow).toBe('hidden');
  });

  it('applies sr-only-focusable class when focusable', () => {
    const { container } = render(<VisuallyHidden focusable>Skip</VisuallyHidden>);
    expect(container.firstChild).toHaveClass('sr-only-focusable');
  });

  it('does not apply inline styles when focusable', () => {
    const { container } = render(<VisuallyHidden focusable>Skip</VisuallyHidden>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.position).toBe('');
  });

  it('focusable defaults to false', () => {
    const { container } = render(<VisuallyHidden>Text</VisuallyHidden>);
    expect(container.firstChild).toHaveClass('sr-only');
    expect(container.firstChild).not.toHaveClass('sr-only-focusable');
  });

  it('renders multiple children', () => {
    render(
      <VisuallyHidden>
        <span>First</span>
        <span>Second</span>
      </VisuallyHidden>
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
