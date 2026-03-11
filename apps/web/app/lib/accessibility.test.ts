import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateId,
  announceToScreenReader,
  trapFocus,
  getFocusableElements,
  formatNumberForScreenReader,
  formatDateForScreenReader,
  formatPriceForScreenReader,
  Keys,
  isKey,
  isActivationKey,
  handleActivationKey,
  liveRegion,
  FocusManager,
  createSkipLink,
  getAriaLabel,
  setAriaLabel,
  prefersReducedMotion,
  prefersHighContrast,
  prefersDarkMode,
} from "~/lib/accessibility";

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  liveRegion.cleanup();
});

/* ================================================================== */
/*  generateId                                                         */
/* ================================================================== */
describe("generateId", () => {
  it("returns unique IDs with prefix", () => {
    const a = generateId("test");
    const b = generateId("test");
    expect(a).toMatch(/^test-\d+$/);
    expect(a).not.toBe(b);
  });

  it("defaults to 'id' prefix", () => {
    expect(generateId()).toMatch(/^id-\d+$/);
  });
});

/* ================================================================== */
/*  announceToScreenReader                                             */
/* ================================================================== */
describe("announceToScreenReader", () => {
  it("appends a sr-only element with role=status", () => {
    announceToScreenReader("Hello");
    const el = document.querySelector("[role='status']");
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe("Hello");
    expect(el!.getAttribute("aria-live")).toBe("polite");
  });

  it("uses assertive priority", () => {
    announceToScreenReader("Alert!", "assertive");
    const el = document.querySelector("[role='status']");
    expect(el!.getAttribute("aria-live")).toBe("assertive");
  });

  it("removes element after timeout", async () => {
    vi.useFakeTimers();
    announceToScreenReader("temp");
    expect(document.querySelector("[role='status']")).not.toBeNull();
    vi.advanceTimersByTime(5100);
    expect(document.querySelector("[role='status']")).toBeNull();
    vi.useRealTimers();
  });
});

/* ================================================================== */
/*  trapFocus                                                          */
/* ================================================================== */
describe("trapFocus", () => {
  it("focuses the first focusable element", () => {
    document.body.innerHTML = `
      <div id="container">
        <button id="a">A</button>
        <button id="b">B</button>
      </div>
    `;
    const container = document.getElementById("container")!;
    trapFocus(container);
    expect(document.activeElement!.id).toBe("a");
  });

  it("wraps focus from last to first on Tab", () => {
    document.body.innerHTML = `
      <div id="c">
        <button id="first">First</button>
        <button id="last">Last</button>
      </div>
    `;
    const container = document.getElementById("c")!;
    trapFocus(container);

    // Focus the last element
    document.getElementById("last")!.focus();

    // Press Tab without Shift
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    vi.spyOn(event, "preventDefault");
    container.dispatchEvent(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("cleanup removes the keydown listener", () => {
    document.body.innerHTML = '<div id="d"><button>X</button></div>';
    const container = document.getElementById("d")!;
    const removeSpy = vi.spyOn(container, "removeEventListener");
    const cleanup = trapFocus(container);
    cleanup();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});

/* ================================================================== */
/*  getFocusableElements                                               */
/* ================================================================== */
describe("getFocusableElements", () => {
  it("returns buttons, links, inputs, selects, textareas", () => {
    document.body.innerHTML = `
      <div id="x">
        <button>B</button>
        <a href="#">L</a>
        <input/>
        <textarea></textarea>
        <select><option>O</option></select>
        <div tabindex="0">D</div>
        <div tabindex="-1">Hidden</div>
      </div>
    `;
    const els = getFocusableElements(document.getElementById("x")!);
    expect(els).toHaveLength(6); // excludes tabindex=-1
  });
});

/* ================================================================== */
/*  format helpers                                                     */
/* ================================================================== */
describe("formatNumberForScreenReader", () => {
  it('returns "zero" for 0', () => expect(formatNumberForScreenReader(0)).toBe("zero"));
  it('returns "one" for 1', () => expect(formatNumberForScreenReader(1)).toBe("one"));
  it("returns string for other numbers", () => expect(formatNumberForScreenReader(42)).toBe("42"));
});

describe("formatDateForScreenReader", () => {
  it("formats with full weekday and month", () => {
    const d = new Date(2024, 0, 15); // Jan 15, 2024
    const result = formatDateForScreenReader(d);
    expect(result).toContain("Monday");
    expect(result).toContain("January");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });
});

describe("formatPriceForScreenReader", () => {
  it("formats price with currency name for screen readers", () => {
    const result = formatPriceForScreenReader(25.5, "NPR");
    expect(result).toContain("25.50");
    expect(result.toLowerCase()).toContain("nepalese");
  });

  it("handles USD correctly", () => {
    const result = formatPriceForScreenReader(99, "USD");
    expect(result).toContain("99");
    expect(result.toLowerCase()).toMatch(/dollar/);
  });
});

/* ================================================================== */
/*  Keys + isKey helpers                                               */
/* ================================================================== */
describe("Keys and helpers", () => {
  it("Keys contains standard keyboard values", () => {
    expect(Keys.ENTER).toBe("Enter");
    expect(Keys.ESCAPE).toBe("Escape");
    expect(Keys.ARROW_DOWN).toBe("ArrowDown");
  });

  it("isKey matches event key", () => {
    const ev = new KeyboardEvent("keydown", { key: "Enter" });
    expect(isKey(ev, "Enter")).toBe(true);
    expect(isKey(ev, "Escape")).toBe(false);
  });

  it("isActivationKey matches Enter and Space", () => {
    expect(isActivationKey(new KeyboardEvent("keydown", { key: "Enter" }))).toBe(true);
    expect(isActivationKey(new KeyboardEvent("keydown", { key: " " }))).toBe(true);
    expect(isActivationKey(new KeyboardEvent("keydown", { key: "Tab" }))).toBe(false);
  });

  it("handleActivationKey calls callback and prevents default", () => {
    const cb = vi.fn();
    const ev = new KeyboardEvent("keydown", { key: "Enter" });
    vi.spyOn(ev, "preventDefault");
    handleActivationKey(ev, cb);
    expect(cb).toHaveBeenCalled();
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it("handleActivationKey does nothing for non-activation key", () => {
    const cb = vi.fn();
    handleActivationKey(new KeyboardEvent("keydown", { key: "a" }), cb);
    expect(cb).not.toHaveBeenCalled();
  });
});

/* ================================================================== */
/*  LiveRegionManager                                                  */
/* ================================================================== */
describe("liveRegion (LiveRegionManager)", () => {
  it("creates a region element on first announce", () => {
    liveRegion.announce("test");
    const el = document.getElementById("live-region-polite");
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe("test");
  });

  it("reuses the same region element", () => {
    liveRegion.announce("first");
    liveRegion.announce("second");
    const els = document.querySelectorAll("#live-region-polite");
    expect(els).toHaveLength(1);
    expect(els[0].textContent).toBe("second");
  });

  it("clears text after timeout", () => {
    vi.useFakeTimers();
    liveRegion.announce("flash");
    vi.advanceTimersByTime(1100);
    expect(document.getElementById("live-region-polite")!.textContent).toBe("");
    vi.useRealTimers();
  });

  it("cleanup removes all regions", () => {
    liveRegion.announce("a", "polite");
    liveRegion.announce("b", "assertive");
    liveRegion.cleanup();
    expect(document.getElementById("live-region-polite")).toBeNull();
    expect(document.getElementById("live-region-assertive")).toBeNull();
  });
});

/* ================================================================== */
/*  FocusManager                                                       */
/* ================================================================== */
describe("FocusManager", () => {
  it("saves and restores focus", () => {
    document.body.innerHTML = '<button id="btn">Click</button>';
    const btn = document.getElementById("btn") as HTMLElement;
    btn.focus();

    const fm = new FocusManager();
    fm.saveFocus();

    document.body.focus();
    fm.restoreFocus();
    expect(document.activeElement).toBe(btn);
  });

  it("focusFirst focuses first focusable child", () => {
    document.body.innerHTML =
      '<div id="w"><input id="i1"/><input id="i2"/></div>';
    const fm = new FocusManager();
    fm.focusFirst(document.getElementById("w")!);
    expect(document.activeElement!.id).toBe("i1");
  });

  it("focusLast focuses last focusable child", () => {
    document.body.innerHTML =
      '<div id="w"><input id="i1"/><input id="i2"/></div>';
    const fm = new FocusManager();
    fm.focusLast(document.getElementById("w")!);
    expect(document.activeElement!.id).toBe("i2");
  });
});

/* ================================================================== */
/*  createSkipLink                                                     */
/* ================================================================== */
describe("createSkipLink", () => {
  it("creates an anchor with href #targetId", () => {
    const link = createSkipLink("main-content");
    expect(link.tagName).toBe("A");
    expect(link.href).toContain("#main-content");
    expect(link.textContent).toBe("Skip to main content");
  });

  it("focuses target on click", () => {
    document.body.innerHTML = '<div id="target" tabindex="-1">Target</div>';
    const target = document.getElementById("target")!;
    target.scrollIntoView = vi.fn();
    const link = createSkipLink("target", "Jump");
    document.body.appendChild(link);
    link.click();
    expect(document.activeElement).toBe(target);
  });
});

/* ================================================================== */
/*  ARIA label helpers                                                 */
/* ================================================================== */
describe("getAriaLabel / setAriaLabel", () => {
  it("returns aria-label attribute", () => {
    const el = document.createElement("button");
    el.setAttribute("aria-label", "Close");
    expect(getAriaLabel(el)).toBe("Close");
  });

  it("falls back to textContent", () => {
    const el = document.createElement("span");
    el.textContent = "Hello";
    expect(getAriaLabel(el)).toBe("Hello");
  });

  it("setAriaLabel sets the attribute", () => {
    const el = document.createElement("div");
    setAriaLabel(el, "My label");
    expect(el.getAttribute("aria-label")).toBe("My label");
  });
});

/* ================================================================== */
/*  Media query helpers                                                */
/* ================================================================== */
describe("media query helpers", () => {
  it("prefersReducedMotion returns boolean", () => {
    expect(typeof prefersReducedMotion()).toBe("boolean");
  });

  it("prefersHighContrast returns boolean", () => {
    expect(typeof prefersHighContrast()).toBe("boolean");
  });

  it("prefersDarkMode returns boolean", () => {
    expect(typeof prefersDarkMode()).toBe("boolean");
  });
});
