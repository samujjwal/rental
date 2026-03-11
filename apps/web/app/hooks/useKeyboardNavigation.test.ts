import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  useKeyboardNavigation,
  useListNavigation,
  useRovingTabIndex,
} from "./useKeyboardNavigation";

function createKeyEvent(key: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
    shiftKey: false,
    ...extra,
  } as unknown as KeyboardEvent;
}

describe("useKeyboardNavigation", () => {
  it("should call onEnter handler", () => {
    const onEnter = vi.fn();
    const { result } = renderHook(() => useKeyboardNavigation({ onEnter }));

    const event = createKeyEvent("Enter");
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("should call onSpace handler", () => {
    const onSpace = vi.fn();
    const { result } = renderHook(() => useKeyboardNavigation({ onSpace }));

    const event = createKeyEvent(" ");
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onSpace).toHaveBeenCalledTimes(1);
  });

  it("should call onEscape handler", () => {
    const onEscape = vi.fn();
    const { result } = renderHook(() => useKeyboardNavigation({ onEscape }));

    const event = createKeyEvent("Escape");
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("should call arrow key handlers", () => {
    const onArrowUp = vi.fn();
    const onArrowDown = vi.fn();
    const onArrowLeft = vi.fn();
    const onArrowRight = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({ onArrowUp, onArrowDown, onArrowLeft, onArrowRight })
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowUp"));
      result.current.handleKeyDown(createKeyEvent("ArrowDown"));
      result.current.handleKeyDown(createKeyEvent("ArrowLeft"));
      result.current.handleKeyDown(createKeyEvent("ArrowRight"));
    });

    expect(onArrowUp).toHaveBeenCalledTimes(1);
    expect(onArrowDown).toHaveBeenCalledTimes(1);
    expect(onArrowLeft).toHaveBeenCalledTimes(1);
    expect(onArrowRight).toHaveBeenCalledTimes(1);
  });

  it("should call onHome and onEnd handlers", () => {
    const onHome = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({ onHome, onEnd })
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Home"));
      result.current.handleKeyDown(createKeyEvent("End"));
    });

    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("should call onTab handler with shift key info", () => {
    const onTab = vi.fn();
    const { result } = renderHook(() => useKeyboardNavigation({ onTab }));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Tab", { shiftKey: true }));
    });

    expect(onTab).toHaveBeenCalledWith(true);
  });

  it("should not call handlers when disabled", () => {
    const onEnter = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({ onEnter, enabled: false })
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Enter"));
    });

    expect(onEnter).not.toHaveBeenCalled();
  });

  it("should not prevent default for unhandled keys", () => {
    const { result } = renderHook(() => useKeyboardNavigation({}));

    const event = createKeyEvent("a");
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("useListNavigation", () => {
  const items = ["apple", "banana", "cherry"];
  const onSelect = vi.fn();

  it("should initialize with first item focused", () => {
    const { result } = renderHook(() => useListNavigation(items, onSelect));

    expect(result.current.focusedIndex).toBe(0);
  });

  it("should move focus down with ArrowDown", () => {
    const { result } = renderHook(() => useListNavigation(items, onSelect));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"));
    });

    expect(result.current.focusedIndex).toBe(1);
  });

  it("should move focus up with ArrowUp", () => {
    const { result } = renderHook(() => useListNavigation(items, onSelect));

    act(() => {
      result.current.setFocusedIndex(2);
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowUp"));
    });

    expect(result.current.focusedIndex).toBe(1);
  });

  it("should loop from last to first item", () => {
    const { result } = renderHook(() =>
      useListNavigation(items, onSelect, { loop: true })
    );

    act(() => {
      result.current.setFocusedIndex(2);
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"));
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("should loop from first to last item", () => {
    const { result } = renderHook(() =>
      useListNavigation(items, onSelect, { loop: true })
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowUp"));
    });

    expect(result.current.focusedIndex).toBe(2);
  });

  it("should not loop when loop is disabled", () => {
    const { result } = renderHook(() =>
      useListNavigation(items, onSelect, { loop: false })
    );

    act(() => {
      result.current.setFocusedIndex(2);
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"));
    });

    expect(result.current.focusedIndex).toBe(2);
  });

  it("should jump to first item with Home", () => {
    const { result } = renderHook(() => useListNavigation(items, onSelect));

    act(() => {
      result.current.setFocusedIndex(2);
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("Home"));
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("should jump to last item with End", () => {
    const { result } = renderHook(() => useListNavigation(items, onSelect));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("End"));
    });

    expect(result.current.focusedIndex).toBe(2);
  });

  it("should call onSelect with Enter key", () => {
    const selectFn = vi.fn();
    const { result } = renderHook(() => useListNavigation(items, selectFn));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Enter"));
    });

    expect(selectFn).toHaveBeenCalledWith("apple", 0);
  });

  it("should call onSelect with Space key", () => {
    const selectFn = vi.fn();
    const { result } = renderHook(() => useListNavigation(items, selectFn));

    act(() => {
      result.current.setFocusedIndex(1);
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent(" "));
    });

    expect(selectFn).toHaveBeenCalledWith("banana", 1);
  });

  it("should use horizontal navigation when orientation is horizontal", () => {
    const { result } = renderHook(() =>
      useListNavigation(items, onSelect, { orientation: "horizontal" })
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowRight"));
    });

    expect(result.current.focusedIndex).toBe(1);

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowLeft"));
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("should not respond when disabled", () => {
    const { result } = renderHook(() =>
      useListNavigation(items, onSelect, { enabled: false })
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"));
    });

    expect(result.current.focusedIndex).toBe(0);
  });
});

describe("useRovingTabIndex", () => {
  it("should initialize with first item active", () => {
    const { result } = renderHook(() => useRovingTabIndex(5));

    expect(result.current.activeIndex).toBe(0);
    expect(result.current.getTabIndex(0)).toBe(0);
    expect(result.current.getTabIndex(1)).toBe(-1);
  });

  it("should move to next item with ArrowDown", () => {
    const { result } = renderHook(() => useRovingTabIndex(3));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"), 0);
    });

    expect(result.current.activeIndex).toBe(1);
    expect(result.current.getTabIndex(1)).toBe(0);
    expect(result.current.getTabIndex(0)).toBe(-1);
  });

  it("should loop with ArrowDown at end", () => {
    const { result } = renderHook(() => useRovingTabIndex(3, { loop: true }));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"), 2);
    });

    expect(result.current.activeIndex).toBe(0);
  });

  it("should not loop when loop is false", () => {
    const { result } = renderHook(() => useRovingTabIndex(3, { loop: false }));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"), 2);
    });

    expect(result.current.activeIndex).toBe(2);
  });

  it("should move to previous item with ArrowUp", () => {
    const { result } = renderHook(() => useRovingTabIndex(3));

    act(() => {
      result.current.setActiveIndex(2);
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowUp"), 2);
    });

    expect(result.current.activeIndex).toBe(1);
  });

  it("should use horizontal keys when orientation is horizontal", () => {
    const { result } = renderHook(() =>
      useRovingTabIndex(3, { orientation: "horizontal" })
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowRight"), 0);
    });

    expect(result.current.activeIndex).toBe(1);

    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowLeft"), 1);
    });

    expect(result.current.activeIndex).toBe(0);
  });

  it("should jump to first item with Home", () => {
    const { result } = renderHook(() => useRovingTabIndex(5));

    act(() => {
      result.current.setActiveIndex(3);
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("Home"), 3);
    });

    expect(result.current.activeIndex).toBe(0);
  });

  it("should jump to last item with End", () => {
    const { result } = renderHook(() => useRovingTabIndex(5));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("End"), 0);
    });

    expect(result.current.activeIndex).toBe(4);
  });
});
