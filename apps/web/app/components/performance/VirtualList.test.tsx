import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VirtualList, VirtualGrid } from "./VirtualList";

describe("VirtualList", () => {
  const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`);
  const itemHeight = 40;
  const containerHeight = 200;

  it("renders only visible items + overscan", () => {
    render(
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={(item) => <div>{item}</div>}
      />
    );

    // Visible: ceil(200/40) = 5 items, with default overscan=3 on each side
    // startIndex = max(0, floor(0/40) - 3) = 0
    // endIndex = min(100, 0 + 5 + 6) = 11
    expect(screen.getByText("Item 0")).toBeInTheDocument();
    expect(screen.getByText("Item 10")).toBeInTheDocument();
    expect(screen.queryByText("Item 50")).not.toBeInTheDocument();
  });

  it("sets total height on inner container", () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={(item) => <div>{item}</div>}
      />
    );

    const innerDiv = container.querySelector('[style*="height: 4000px"]');
    expect(innerDiv).not.toBeNull();
  });

  it("sets container height style", () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={300}
        renderItem={(item) => <div>{item}</div>}
      />
    );

    expect(container.firstChild).toHaveStyle({ height: "300px" });
  });

  it("positions items absolutely with correct top offset", () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={(item) => <div>{item}</div>}
      />
    );

    // First item should be at top: 0
    const firstItem = container.querySelector('[style*="top: 0px"]');
    expect(firstItem).not.toBeNull();

    // Second item at top: 40px
    const secondItem = container.querySelector('[style*="top: 40px"]');
    expect(secondItem).not.toBeNull();
  });

  it("renders with custom overscan", () => {
    render(
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={(item) => <div>{item}</div>}
        overscan={0}
      />
    );

    // No overscan: only ceil(200/40) = 5 items visible
    expect(screen.getByText("Item 0")).toBeInTheDocument();
    expect(screen.getByText("Item 4")).toBeInTheDocument();
    expect(screen.queryByText("Item 5")).not.toBeInTheDocument();
  });

  it("calls onEndReached when scrolled past threshold", () => {
    const onEndReached = vi.fn();

    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={(item) => <div>{item}</div>}
        onEndReached={onEndReached}
        endReachedThreshold={0.8}
      />
    );

    const scrollContainer = container.firstChild as HTMLDivElement;

    // Simulate scroll to near-end
    Object.defineProperty(scrollContainer, "scrollTop", { value: 3600 });
    Object.defineProperty(scrollContainer, "clientHeight", { value: 200 });
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 4000 });
    fireEvent.scroll(scrollContainer);

    // (3600 + 200) / 4000 = 0.95 >= 0.8
    expect(onEndReached).toHaveBeenCalled();
  });

  it("does not call onEndReached when not past threshold", () => {
    const onEndReached = vi.fn();

    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={(item) => <div>{item}</div>}
        onEndReached={onEndReached}
        endReachedThreshold={0.8}
      />
    );

    const scrollContainer = container.firstChild as HTMLDivElement;

    // Scroll to near top
    Object.defineProperty(scrollContainer, "scrollTop", { value: 0 });
    Object.defineProperty(scrollContainer, "clientHeight", { value: 200 });
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 4000 });
    fireEvent.scroll(scrollContainer);

    expect(onEndReached).not.toHaveBeenCalled();
  });

  it("handles empty items", () => {
    const { container } = render(
      <VirtualList
        items={[]}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={(item) => <div>{item}</div>}
      />
    );

    const innerDiv = container.querySelector('[style*="height: 0px"]');
    expect(innerDiv).not.toBeNull();
  });

  it("applies className to container", () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={(item) => <div>{item}</div>}
        className="custom-list"
      />
    );

    expect(container.firstChild).toHaveClass("custom-list");
  });
});

describe("VirtualGrid", () => {
  const items = Array.from({ length: 50 }, (_, i) => `Grid ${i}`);

  it("renders visible items in grid layout", () => {
    render(
      <VirtualGrid
        items={items}
        itemHeight={100}
        itemWidth={200}
        containerHeight={300}
        containerWidth={632}
        renderItem={(item) => <div>{item}</div>}
        gap={16}
      />
    );

    // columnsCount = floor((632 + 16) / (200 + 16)) = floor(648/216) = 3
    // Visible rows = ceil(300 / (100 + 16)) = ceil(300/116) = 3
    // With default overscan=3 → shows rows 0 to 5
    expect(screen.getByText("Grid 0")).toBeInTheDocument();
    expect(screen.getByText("Grid 1")).toBeInTheDocument();
    expect(screen.getByText("Grid 2")).toBeInTheDocument();
  });

  it("positions items with correct left offset for columns", () => {
    const { container } = render(
      <VirtualGrid
        items={items}
        itemHeight={100}
        itemWidth={200}
        containerHeight={300}
        containerWidth={632}
        renderItem={(item) => <div>{item}</div>}
        gap={16}
      />
    );

    // First column: left = 0 * (200 + 16) = 0
    const firstCol = container.querySelector('[style*="left: 0px"]');
    expect(firstCol).not.toBeNull();

    // Second column: left = 1 * (200 + 16) = 216px
    const secondCol = container.querySelector('[style*="left: 216px"]');
    expect(secondCol).not.toBeNull();
  });

  it("handles empty items", () => {
    const { container } = render(
      <VirtualGrid
        items={[]}
        itemHeight={100}
        itemWidth={200}
        containerHeight={300}
        containerWidth={600}
        renderItem={(item) => <div>{item}</div>}
      />
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  it("sets container height", () => {
    const { container } = render(
      <VirtualGrid
        items={items}
        itemHeight={100}
        itemWidth={200}
        containerHeight={400}
        containerWidth={600}
        renderItem={(item) => <div>{item}</div>}
      />
    );

    expect(container.firstChild).toHaveStyle({ height: "400px" });
  });
});
