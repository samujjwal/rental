import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { LazyImage } from "./LazyImage";

// The global IntersectionObserver mock from setup.ts doesn't trigger callbacks,
// so we override it to control intersection behavior.
let intersectionCallback: IntersectionObserverCallback;
let observedElements: Element[] = [];

beforeEach(() => {
  observedElements = [];
  const MockIO = class {
    constructor(cb: IntersectionObserverCallback) {
      intersectionCallback = cb;
    }
    observe = vi.fn((el: Element) => { observedElements.push(el); });
    disconnect = vi.fn();
    unobserve = vi.fn();
  };
  vi.stubGlobal("IntersectionObserver", MockIO);
});

function simulateIntersection(isIntersecting: boolean) {
  act(() => {
    intersectionCallback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });
}

describe("LazyImage", () => {
  it("shows skeleton before image loads", () => {
    const { container } = render(<LazyImage src="/test.jpg" alt="Test" />);

    // There should be a skeleton element (Skeleton component renders with data-slot)
    // Before intersection, the img should not be rendered
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders image after intersection", () => {
    const { container } = render(<LazyImage src="/test.jpg" alt="Test image" />);

    // Initially no img
    expect(container.querySelector("img")).toBeNull();

    // Simulate entering viewport
    simulateIntersection(true);

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/test.jpg");
    expect(img).toHaveAttribute("alt", "Test image");
  });

  it("calls onLoad when image loads", () => {
    const onLoad = vi.fn();
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" onLoad={onLoad} />
    );

    simulateIntersection(true);

    const img = container.querySelector("img")!;
    fireEvent.load(img);

    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("falls back to fallbackSrc on error", () => {
    const onError = vi.fn();
    const { container } = render(
      <LazyImage
        src="/broken.jpg"
        alt="Test"
        fallbackSrc="/fallback.jpg"
        onError={onError}
      />
    );

    simulateIntersection(true);

    const img = container.querySelector("img")!;
    fireEvent.error(img);

    expect(onError).toHaveBeenCalledOnce();
    expect(img).toHaveAttribute("src", "/fallback.jpg");
  });

  it("hides skeleton after image loads", () => {
    const { container } = render(<LazyImage src="/test.jpg" alt="Test" />);

    simulateIntersection(true);

    const img = container.querySelector("img")!;
    fireEvent.load(img);

    // After load, opacity should be 100
    expect(img.className).toContain("opacity-100");
  });

  it("does not show skeleton when showSkeleton=false", () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" showSkeleton={false} />
    );

    // No skeleton component should be rendered
    const skeletonEl = container.querySelector('[data-slot="skeleton"]');
    expect(skeletonEl).toBeNull();
  });

  it("applies aspect ratio style", () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" aspectRatio={16 / 9} />
    );

    const wrapper = container.firstChild as HTMLElement;
    // paddingBottom = (1 / (16/9)) * 100 ≈ 56.25%
    expect(wrapper.style.paddingBottom).toBe("56.25%");
  });

  it("has lazy loading and async decoding attributes", () => {
    const { container } = render(<LazyImage src="/test.jpg" alt="Test" />);

    simulateIntersection(true);

    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
  });

  it("passes through additional img attributes", () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" data-testid="my-img" width={300} />
    );

    simulateIntersection(true);

    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("data-testid", "my-img");
    expect(img).toHaveAttribute("width", "300");
  });
});
