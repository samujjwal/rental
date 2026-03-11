import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockReducedMotion } = vi.hoisted(() => ({
  mockReducedMotion: { value: false },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, ...props }: any) => {
      // Pass through aria- and data- attributes
      const passThrough: Record<string, any> = {};
      for (const key of Object.keys(props)) {
        if (key.startsWith('aria-') || key.startsWith('data-')) {
          passThrough[key] = props[key];
        }
      }
      return (
        <div onClick={onClick} className={className} {...passThrough}>
          {children}
        </div>
      );
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => mockReducedMotion.value,
}));

import { ModalAnimation, BackdropAnimation } from './ModalAnimation';

describe('ModalAnimation', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders children when isOpen is true', () => {
    render(
      <ModalAnimation isOpen={true}>
        <div>Modal Content</div>
      </ModalAnimation>
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ModalAnimation isOpen={false}>
        <div>Modal Content</div>
      </ModalAnimation>
    );
    expect(container.innerHTML).toBe('');
  });

  it('defaults to scale variant', () => {
    const { container } = render(
      <ModalAnimation isOpen={true}>Content</ModalAnimation>
    );
    expect(container.textContent).toBe('Content');
  });

  it('renders with fade variant', () => {
    render(
      <ModalAnimation isOpen={true} variant="fade">
        <div>Fade</div>
      </ModalAnimation>
    );
    expect(screen.getByText('Fade')).toBeInTheDocument();
  });

  it('renders with slideUp variant', () => {
    render(
      <ModalAnimation isOpen={true} variant="slideUp">
        <div>SlideUp</div>
      </ModalAnimation>
    );
    expect(screen.getByText('SlideUp')).toBeInTheDocument();
  });

  it('renders with slideDown variant', () => {
    render(
      <ModalAnimation isOpen={true} variant="slideDown">
        <div>SlideDown</div>
      </ModalAnimation>
    );
    expect(screen.getByText('SlideDown')).toBeInTheDocument();
  });

  it('accepts custom duration', () => {
    render(
      <ModalAnimation isOpen={true} duration={0.5}>
        <div>Custom</div>
      </ModalAnimation>
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('renders with reduced motion preference', () => {
    mockReducedMotion.value = true;
    render(
      <ModalAnimation isOpen={true}>
        <div>Reduced</div>
      </ModalAnimation>
    );
    expect(screen.getByText('Reduced')).toBeInTheDocument();
  });

  it('toggles visibility when isOpen changes', () => {
    const { rerender } = render(
      <ModalAnimation isOpen={true}><div>Toggle</div></ModalAnimation>
    );
    expect(screen.getByText('Toggle')).toBeInTheDocument();
    rerender(
      <ModalAnimation isOpen={false}><div>Toggle</div></ModalAnimation>
    );
    expect(screen.queryByText('Toggle')).not.toBeInTheDocument();
  });
});

describe('BackdropAnimation', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders backdrop when isOpen is true', () => {
    const { container } = render(<BackdropAnimation isOpen={true} />);
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<BackdropAnimation isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('calls onClick when backdrop is clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      <BackdropAnimation isOpen={true} onClick={onClick} />
    );
    fireEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is aria-hidden', () => {
    const { container } = render(<BackdropAnimation isOpen={true} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('has fixed inset-0 positioning', () => {
    const { container } = render(<BackdropAnimation isOpen={true} />);
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).toHaveClass('fixed', 'inset-0');
  });

  it('accepts custom duration', () => {
    const { container } = render(
      <BackdropAnimation isOpen={true} duration={0.5} />
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
