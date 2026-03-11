import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SkipLink, SkipLinks } from "./SkipLink";
import { VisuallyHidden } from "./VisuallyHidden";
import { LiveRegion, useAnnounce } from "./LiveRegion";
import { FocusTrap } from "./FocusTrap";

// ─── SkipLink ──────────────────────────────────────────────────────────────

describe("SkipLink", () => {
  it("renders with default label", () => {
    render(<SkipLink />);
    expect(screen.getByText("Skip to main content")).toBeInTheDocument();
  });

  it("renders with custom label and targetId", () => {
    render(<SkipLink targetId="nav" label="Skip to navigation" />);
    const link = screen.getByText("Skip to navigation");
    expect(link).toHaveAttribute("href", "#nav");
  });

  it("focuses target element on click", () => {
    const target = document.createElement("div");
    target.id = "main-content";
    target.tabIndex = -1;
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    const focusSpy = vi.spyOn(target, "focus");
    const scrollSpy = vi.spyOn(target, "scrollIntoView");

    render(<SkipLink />);
    fireEvent.click(screen.getByText("Skip to main content"));

    expect(focusSpy).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    document.body.removeChild(target);
  });

  it("does nothing when target element not found", () => {
    render(<SkipLink targetId="nonexistent" />);
    // Should not throw
    fireEvent.click(screen.getByText("Skip to main content"));
  });

  it("has sr-only class for screen reader accessibility", () => {
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");
    expect(link.className).toContain("sr-only");
  });
});

describe("SkipLinks", () => {
  it("renders multiple skip links", () => {
    const links = [
      { targetId: "nav", label: "Skip to navigation" },
      { targetId: "main", label: "Skip to main" },
    ];
    render(<SkipLinks links={links} />);

    expect(screen.getByText("Skip to navigation")).toBeInTheDocument();
    expect(screen.getByText("Skip to main")).toBeInTheDocument();
  });

  it("renders inside a nav with aria-label", () => {
    const links = [{ targetId: "main", label: "Skip" }];
    render(<SkipLinks links={links} />);
    expect(screen.getByRole("navigation")).toHaveAttribute("aria-label", "Skip links");
  });
});

// ─── VisuallyHidden ────────────────────────────────────────────────────────

describe("VisuallyHidden", () => {
  it("renders children with sr-only class", () => {
    render(<VisuallyHidden>Hidden text</VisuallyHidden>);
    const el = screen.getByText("Hidden text");
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("sr-only");
  });

  it("renders as span by default", () => {
    render(<VisuallyHidden>Content</VisuallyHidden>);
    const el = screen.getByText("Content");
    expect(el.tagName).toBe("SPAN");
  });

  it("renders as custom element", () => {
    render(<VisuallyHidden as="div">Content</VisuallyHidden>);
    const el = screen.getByText("Content");
    expect(el.tagName).toBe("DIV");
  });

  it("applies visually hidden styles when not focusable", () => {
    render(<VisuallyHidden>Content</VisuallyHidden>);
    const el = screen.getByText("Content");
    expect(el.style.position).toBe("absolute");
    expect(el.style.width).toBe("1px");
    expect(el.style.height).toBe("1px");
    expect(el.style.overflow).toBe("hidden");
  });

  it("uses sr-only-focusable class when focusable", () => {
    render(<VisuallyHidden focusable>Focusable</VisuallyHidden>);
    const el = screen.getByText("Focusable");
    expect(el).toHaveClass("sr-only-focusable");
    expect(el.style.position).not.toBe("absolute");
  });
});

// ─── LiveRegion ────────────────────────────────────────────────────────────

describe("LiveRegion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders message with role=status", () => {
    render(<LiveRegion message="Item saved" />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Item saved");
  });

  it("uses aria-live=polite by default", () => {
    render(<LiveRegion message="Info" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("uses aria-live=assertive when priority is assertive", () => {
    render(<LiveRegion message="Error!" priority="assertive" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "assertive");
  });

  it("has aria-atomic=true", () => {
    render(<LiveRegion message="Update" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
  });

  it("clears message after clearAfter timeout", () => {
    render(<LiveRegion message="Temp message" clearAfter={500} />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Temp message");

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(region).toHaveTextContent("");
  });

  it("has sr-only class for visual hiding", () => {
    render(<LiveRegion message="Hidden" />);
    expect(screen.getByRole("status")).toHaveClass("sr-only");
  });
});

describe("useAnnounce", () => {
  it("creates and removes announcement element", () => {
    const TestComponent = () => {
      const { announce } = useAnnounce();
      return <button onClick={() => announce("Test announcement")}>Announce</button>;
    };

    vi.useFakeTimers();
    render(<TestComponent />);
    fireEvent.click(screen.getByText("Announce"));

    // Announcement element should be in the DOM
    const announcements = document.querySelectorAll('[role="status"][aria-live="polite"]');
    // At least one announcement exists (could include LiveRegion from setup)
    expect(announcements.length).toBeGreaterThanOrEqual(1);
    const lastEl = announcements[announcements.length - 1];
    expect(lastEl).toHaveTextContent("Test announcement");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should be removed
    expect(document.body.contains(lastEl)).toBe(false);
    vi.useRealTimers();
  });
});

// ─── FocusTrap ─────────────────────────────────────────────────────────────

describe("FocusTrap", () => {
  it("renders children", () => {
    render(
      <FocusTrap>
        <button>Click me</button>
      </FocusTrap>
    );
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("does not trap focus when active=false", () => {
    render(
      <FocusTrap active={false}>
        <button>No trap</button>
      </FocusTrap>
    );
    // button should not auto-receive focus
    expect(document.activeElement).not.toBe(screen.getByText("No trap"));
  });

  it("focuses first focusable element when active", () => {
    render(
      <FocusTrap active>
        <button>First</button>
        <button>Second</button>
      </FocusTrap>
    );
    expect(document.activeElement).toBe(screen.getByText("First"));
  });

  it("restores focus on unmount when restoreFocus=true", () => {
    const outerButton = document.createElement("button");
    outerButton.textContent = "Outer";
    document.body.appendChild(outerButton);
    outerButton.focus();

    const { unmount } = render(
      <FocusTrap active restoreFocus>
        <button>Inner</button>
      </FocusTrap>
    );

    expect(document.activeElement).toBe(screen.getByText("Inner"));

    const focusSpy = vi.spyOn(outerButton, "focus");
    unmount();
    expect(focusSpy).toHaveBeenCalled();

    document.body.removeChild(outerButton);
  });

  it("applies className", () => {
    const { container } = render(
      <FocusTrap className="my-trap">
        <span>Content</span>
      </FocusTrap>
    );
    expect(container.firstChild).toHaveClass("my-trap");
  });
});
