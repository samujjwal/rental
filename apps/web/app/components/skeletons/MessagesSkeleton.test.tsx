import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../ui/skeleton', () => ({
  Skeleton: ({ className, variant, ...props }: Record<string, unknown>) => (
    <div data-testid="skeleton" data-variant={variant} className={className as string} {...props} />
  ),
}));

import { MessagesSkeleton } from './MessagesSkeleton';

describe('MessagesSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<MessagesSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders conversations list panel', () => {
    const { container } = render(<MessagesSkeleton />);
    const panel = container.querySelector('.w-80.border-r');
    expect(panel).toBeInTheDocument();
  });

  it('renders 8 conversation items', () => {
    const { container } = render(<MessagesSkeleton />);
    const panel = container.querySelector('.w-80');
    // Each conversation has a circular avatar skeleton
    const avatars = panel!.querySelectorAll('[data-variant="circular"]');
    expect(avatars).toHaveLength(8);
  });

  it('renders search bar skeleton in conversation list header', () => {
    const { container } = render(<MessagesSkeleton />);
    const panel = container.querySelector('.w-80');
    const header = panel!.querySelector('.border-b');
    const searchSkeleton = header!.querySelector('[data-variant="rounded"]');
    expect(searchSkeleton).toBeInTheDocument();
  });

  it('renders message thread area', () => {
    const { container } = render(<MessagesSkeleton />);
    const thread = container.querySelector('.flex-1.flex.flex-col');
    expect(thread).toBeInTheDocument();
  });

  it('renders thread header with avatar and name skeletons', () => {
    const { container } = render(<MessagesSkeleton />);
    // Thread header has a circular avatar
    const thread = container.querySelector('.flex-1.flex.flex-col');
    const headerSection = thread!.querySelector('.border-b');
    const avatar = headerSection!.querySelector('[data-variant="circular"]');
    expect(avatar).toBeInTheDocument();
  });

  it('renders 6 message bubbles', () => {
    const { container } = render(<MessagesSkeleton />);
    // Messages area contains rounded skeletons as message bubbles
    const messagesArea = container.querySelector('.overflow-y-auto');
    const bubbles = messagesArea!.querySelectorAll('[data-variant="rounded"]');
    expect(bubbles).toHaveLength(6);
  });

  it('alternates message alignment for visual variety', () => {
    const { container } = render(<MessagesSkeleton />);
    const messagesArea = container.querySelector('.overflow-y-auto');
    const messageRows = messagesArea!.children;
    // Even indices = justify-start, odd indices = justify-end
    expect(messageRows[0].className).toContain('justify-start');
    expect(messageRows[1].className).toContain('justify-end');
    expect(messageRows[2].className).toContain('justify-start');
  });

  it('renders input skeleton at bottom of thread', () => {
    const { container } = render(<MessagesSkeleton />);
    const thread = container.querySelector('.flex-1.flex.flex-col');
    const inputArea = thread!.querySelector('.border-t');
    expect(inputArea).toBeInTheDocument();
    const inputSkeleton = inputArea!.querySelector('[data-variant="rounded"]');
    expect(inputSkeleton).toBeInTheDocument();
  });

  it('uses full viewport height layout', () => {
    const { container } = render(<MessagesSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('h-[calc(100vh-4rem)]');
  });

  it('renders many skeleton elements total', () => {
    render(<MessagesSkeleton />);
    const all = screen.getAllByTestId('skeleton');
    // Search(1) + 8 conversations(8 avatars + 16 text) + header avatar(1) + header text(2) + 6 bubbles + input(1)
    expect(all.length).toBeGreaterThanOrEqual(20);
  });
});
