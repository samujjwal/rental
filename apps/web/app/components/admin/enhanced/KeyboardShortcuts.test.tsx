import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  X: (props: any) => <span data-testid="x-icon" {...props} />,
  Keyboard: (props: any) => <span data-testid="keyboard-icon" {...props} />,
}));

import {
  KeyboardShortcuts,
  KeyboardShortcutsHelp,
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from './KeyboardShortcuts';

const createShortcuts = (): KeyboardShortcut[] => [
  { key: 'n', ctrlKey: true, description: 'New item', action: vi.fn(), category: 'General' },
  { key: 's', ctrlKey: true, description: 'Save', action: vi.fn(), category: 'General' },
  { key: 'f', ctrlKey: true, shiftKey: true, description: 'Search', action: vi.fn(), category: 'Navigation' },
  { key: 'd', altKey: true, description: 'Delete', action: vi.fn(), category: 'Actions' },
];

describe('useKeyboardShortcuts', () => {
  it('invokes action on matching keydown', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'n', ctrlKey: true, description: 'New', action },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not invoke action for non-matching key', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'n', ctrlKey: true, description: 'New', action },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    expect(action).not.toHaveBeenCalled();
  });

  it('does not invoke when modifiers do not match', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'n', ctrlKey: true, description: 'New', action },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(window, { key: 'n', ctrlKey: false });
    expect(action).not.toHaveBeenCalled();
  });

  it('does not invoke when disabled', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'n', ctrlKey: true, description: 'New', action },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts, false));
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(action).not.toHaveBeenCalled();
  });

  it('matches shift modifier correctly', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'f', ctrlKey: true, shiftKey: true, description: 'Find', action },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('matches alt modifier', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'd', altKey: true, description: 'Delete', action },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(window, { key: 'd', altKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('matches meta modifier', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'k', metaKey: true, description: 'Command', action },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('prevents default on matched shortcut', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'n', ctrlKey: true, description: 'New', action },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    const event = new KeyboardEvent('keydown', {
      key: 'n', ctrlKey: true, bubbles: true, cancelable: true,
    });
    const spy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });
});

describe('KeyboardShortcutsHelp', () => {
  const shortcuts = createShortcuts();

  it('does not render by default', () => {
    const { container } = render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    expect(container.innerHTML).toBe('');
  });

  it('opens on Shift+? keypress', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('displays grouped shortcuts', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('displays shortcut descriptions', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByText('New item')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('displays key combinations with kbd elements', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const kbdElements = document.querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThanOrEqual(4);
  });

  it('closes when X button is clicked', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    // Find the close button (contains X icon)
    const closeButton = screen.getByTestId('x-icon').closest('button')!;
    fireEvent.click(closeButton);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('closes when backdrop is clicked', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    // Click the backdrop (outermost fixed div)
    const backdrop = document.querySelector('.fixed.inset-0')!;
    fireEvent.click(backdrop);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('does not close when dialog content is clicked', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('shows hint text about Shift+?', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByText('Press Shift + ? to show this dialog')).toBeInTheDocument();
  });

  it('formats Ctrl modifier', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allKbd = Array.from(document.querySelectorAll('kbd'));
    const ctrlKeys = allKbd.filter((k) => k.textContent === 'Ctrl');
    expect(ctrlKeys.length).toBeGreaterThanOrEqual(1);
  });

  it('formats Alt modifier', () => {
    render(<KeyboardShortcutsHelp shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    const allKbd = Array.from(document.querySelectorAll('kbd'));
    const altKeys = allKbd.filter((k) => k.textContent === 'Alt');
    expect(altKeys.length).toBeGreaterThanOrEqual(1);
  });
});

describe('KeyboardShortcuts', () => {
  it('registers shortcuts and renders help', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'n', ctrlKey: true, description: 'New', action },
    ];
    render(<KeyboardShortcuts shortcuts={shortcuts} />);
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('disables shortcuts when enabled=false', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'n', ctrlKey: true, description: 'New', action },
    ];
    render(<KeyboardShortcuts shortcuts={shortcuts} enabled={false} />);
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(action).not.toHaveBeenCalled();
  });
});
