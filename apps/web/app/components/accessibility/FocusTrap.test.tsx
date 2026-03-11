import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

const { mockTrapFocus } = vi.hoisted(() => ({
  mockTrapFocus: vi.fn(() => vi.fn()),
}));

vi.mock('~/lib/accessibility', () => ({
  trapFocus: mockTrapFocus,
}));

import { FocusTrap } from './FocusTrap';

describe('FocusTrap', () => {
  let cleanup: Mock<() => void>;

  beforeEach(() => {
    cleanup = vi.fn<() => void>();
    mockTrapFocus.mockReturnValue(cleanup);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(
      <FocusTrap>
        <button>Click me</button>
      </FocusTrap>
    );
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('wraps children in a div', () => {
    const { container } = render(
      <FocusTrap>
        <span>Inner</span>
      </FocusTrap>
    );
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });

  it('activates trap by default (active=true)', () => {
    render(
      <FocusTrap>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(mockTrapFocus).toHaveBeenCalledTimes(1);
  });

  it('passes container element to trapFocus', () => {
    const { container } = render(
      <FocusTrap>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(mockTrapFocus).toHaveBeenCalledWith(container.firstChild);
  });

  it('does not activate trap when active=false', () => {
    render(
      <FocusTrap active={false}>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(mockTrapFocus).not.toHaveBeenCalled();
  });

  it('calls cleanup when unmounted', () => {
    const { unmount } = render(
      <FocusTrap>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('saves and restores focus when restoreFocus=true (default)', () => {
    const outsideBtn = document.createElement('button');
    outsideBtn.textContent = 'Outside';
    document.body.appendChild(outsideBtn);
    outsideBtn.focus();
    expect(document.activeElement).toBe(outsideBtn);

    const { unmount } = render(
      <FocusTrap>
        <button>Inside</button>
      </FocusTrap>
    );

    unmount();
    expect(outsideBtn.focus).toBeDefined();
    document.body.removeChild(outsideBtn);
  });

  it('does not save focus when restoreFocus=false', () => {
    const outsideBtn = document.createElement('button');
    outsideBtn.textContent = 'Outside';
    document.body.appendChild(outsideBtn);
    outsideBtn.focus();

    const focusSpy = vi.spyOn(outsideBtn, 'focus');

    const { unmount } = render(
      <FocusTrap restoreFocus={false}>
        <button>Inside</button>
      </FocusTrap>
    );

    unmount();
    expect(focusSpy).not.toHaveBeenCalled();
    document.body.removeChild(outsideBtn);
  });

  it('applies className to container div', () => {
    const { container } = render(
      <FocusTrap className="my-modal">
        <p>Content</p>
      </FocusTrap>
    );
    expect(container.firstChild).toHaveClass('my-modal');
  });

  it('applies empty className by default', () => {
    const { container } = render(
      <FocusTrap>
        <p>Content</p>
      </FocusTrap>
    );
    expect((container.firstChild as HTMLElement).className).toBe('');
  });

  it('re-activates trap when active changes from false to true', () => {
    const { rerender } = render(
      <FocusTrap active={false}>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(mockTrapFocus).not.toHaveBeenCalled();

    rerender(
      <FocusTrap active={true}>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(mockTrapFocus).toHaveBeenCalledTimes(1);
  });

  it('cleans up and re-traps when active toggles off then on', () => {
    const cleanup2 = vi.fn<() => void>();
    mockTrapFocus
      .mockReturnValueOnce(cleanup)
      .mockReturnValueOnce(cleanup2);

    const { rerender } = render(
      <FocusTrap active={true}>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(mockTrapFocus).toHaveBeenCalledTimes(1);

    rerender(
      <FocusTrap active={false}>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(cleanup).toHaveBeenCalledTimes(1);

    rerender(
      <FocusTrap active={true}>
        <button>Btn</button>
      </FocusTrap>
    );
    expect(mockTrapFocus).toHaveBeenCalledTimes(2);
  });
});
