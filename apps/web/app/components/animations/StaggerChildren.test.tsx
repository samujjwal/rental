import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockReducedMotion } = vi.hoisted(() => ({
  mockReducedMotion: { value: false },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className}>{children}</div>
    ),
  },
}));

vi.mock('~/lib/accessibility', () => ({
  prefersReducedMotion: () => mockReducedMotion.value,
}));

import { StaggerChildren, StaggerItem, StaggerList } from './StaggerChildren';

describe('StaggerChildren', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders children', () => {
    render(
      <StaggerChildren>
        <div>Child 1</div>
        <div>Child 2</div>
      </StaggerChildren>
    );
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StaggerChildren className="custom-stagger">
        <div>Content</div>
      </StaggerChildren>
    );
    expect(container.querySelector('.custom-stagger')).toBeInTheDocument();
  });

  it('accepts custom staggerDelay', () => {
    render(
      <StaggerChildren staggerDelay={0.2}>
        <div>Delayed</div>
      </StaggerChildren>
    );
    expect(screen.getByText('Delayed')).toBeInTheDocument();
  });

  it('accepts custom initialDelay', () => {
    render(
      <StaggerChildren initialDelay={0.5}>
        <div>Initial</div>
      </StaggerChildren>
    );
    expect(screen.getByText('Initial')).toBeInTheDocument();
  });

  it('works with reduced motion', () => {
    mockReducedMotion.value = true;
    render(
      <StaggerChildren>
        <div>Accessible</div>
      </StaggerChildren>
    );
    expect(screen.getByText('Accessible')).toBeInTheDocument();
  });
});

describe('StaggerItem', () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
  });

  it('renders children', () => {
    render(
      <StaggerItem>
        <span>Item content</span>
      </StaggerItem>
    );
    expect(screen.getByText('Item content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StaggerItem className="item-class">
        <span>Styled</span>
      </StaggerItem>
    );
    expect(container.querySelector('.item-class')).toBeInTheDocument();
  });

  it('works with reduced motion', () => {
    mockReducedMotion.value = true;
    render(
      <StaggerItem>
        <span>Reduced</span>
      </StaggerItem>
    );
    expect(screen.getByText('Reduced')).toBeInTheDocument();
  });
});

describe('StaggerList', () => {
  const items = ['Apple', 'Banana', 'Cherry'];
  const renderItem = (item: string, index: number) => (
    <div data-testid={`item-${index}`}>{item}</div>
  );

  it('renders all items', () => {
    render(<StaggerList items={items} renderItem={renderItem} />);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('renders correct number of items', () => {
    render(<StaggerList items={items} renderItem={renderItem} />);
    expect(screen.getByTestId('item-0')).toBeInTheDocument();
    expect(screen.getByTestId('item-1')).toBeInTheDocument();
    expect(screen.getByTestId('item-2')).toBeInTheDocument();
  });

  it('applies container className', () => {
    const { container } = render(
      <StaggerList items={items} renderItem={renderItem} className="list-class" />
    );
    expect(container.querySelector('.list-class')).toBeInTheDocument();
  });

  it('applies item className', () => {
    const { container } = render(
      <StaggerList
        items={items}
        renderItem={renderItem}
        itemClassName="each-item"
      />
    );
    const itemElements = container.querySelectorAll('.each-item');
    expect(itemElements.length).toBe(3);
  });

  it('renders empty list without errors', () => {
    const { container } = render(
      <StaggerList items={[]} renderItem={renderItem} />
    );
    expect(container).toBeInTheDocument();
  });

  it('accepts custom staggerDelay', () => {
    render(
      <StaggerList items={items} renderItem={renderItem} staggerDelay={0.2} />
    );
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('passes index to renderItem', () => {
    const renderWithIndex = (item: string, index: number) => (
      <div>{`${index}: ${item}`}</div>
    );
    render(<StaggerList items={items} renderItem={renderWithIndex} />);
    expect(screen.getByText('0: Apple')).toBeInTheDocument();
    expect(screen.getByText('2: Cherry')).toBeInTheDocument();
  });
});
