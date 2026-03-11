import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
    React.createElement("a", { href: to, ...props }, children),
}));

const { mockToggleFavorite, mockIsFavoritedData, mockUseAuthStore } = vi.hoisted(() => ({
  mockToggleFavorite: vi.fn(),
  mockIsFavoritedData: { current: null as { id: string; listingId: string } | null },
  mockUseAuthStore: { isAuthenticated: true },
}));

vi.mock("~/hooks/useFavorites", () => ({
  useToggleFavorite: () => ({
    mutate: mockToggleFavorite,
    isPending: false,
  }),
  useIsFavorited: (listingId: string) => ({
    data: mockIsFavoritedData.current,
    isLoading: false,
    isSuccess: true,
  }),
}));

vi.mock("~/lib/store/auth", () => ({
  useAuthStore: () => mockUseAuthStore,
}));

vi.mock("~/components/animations", () => ({
  PressableScale: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  FadeIn: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  StaggerList: ({ items, renderItem }: { items: unknown[]; renderItem: (item: unknown) => React.ReactNode }) =>
    React.createElement("div", null, items.map((item, i) =>
      React.createElement("div", { key: i }, renderItem(item))
    )),
}));

import { FavoriteButton, CompactFavoriteButton } from "./FavoriteButton";

describe("FavoriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFavoritedData.current = null;
    mockUseAuthStore.isAuthenticated = true;
  });

  it("renders with unfavorited state", () => {
    render(<FavoriteButton listingId="listing-1" />);
    const button = screen.getByRole("button", { name: /add to favorites/i });
    expect(button).toBeInTheDocument();
  });

  it("renders with favorited state", () => {
    mockIsFavoritedData.current = { id: "fav-1", listingId: "listing-1" };

    render(<FavoriteButton listingId="listing-1" />);
    const button = screen.getByRole("button", { name: /remove from favorites/i });
    expect(button).toBeInTheDocument();
  });

  it("calls toggleFavorite on click when authenticated", () => {
    render(<FavoriteButton listingId="listing-1" />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    expect(mockToggleFavorite).toHaveBeenCalledWith({ listingId: "listing-1" });
  });

  it("redirects to login when not authenticated", () => {
    mockUseAuthStore.isAuthenticated = false;

    render(<FavoriteButton listingId="listing-1" />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login?redirectTo="),
    );
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  it("prevents event propagation", () => {
    const outerClick = vi.fn();

    render(
      <div onClick={outerClick}>
        <FavoriteButton listingId="listing-1" />
      </div>,
    );
    const button = screen.getByRole("button");

    fireEvent.click(button);

    expect(outerClick).not.toHaveBeenCalled();
  });

  it("applies size classes", () => {
    const { rerender } = render(<FavoriteButton listingId="listing-1" size="small" />);
    expect(screen.getByRole("button").className).toContain("h-8 w-8");

    rerender(<FavoriteButton listingId="listing-1" size="large" />);
    expect(screen.getByRole("button").className).toContain("h-12 w-12");
  });

  it("shows title tooltip by default", () => {
    render(<FavoriteButton listingId="listing-1" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "Add to favorites");
  });

  it("hides tooltip when showTooltip is false", () => {
    render(<FavoriteButton listingId="listing-1" showTooltip={false} />);
    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("title");
  });

  it("shows login tooltip for unauthenticated users", () => {
    mockUseAuthStore.isAuthenticated = false;
    render(<FavoriteButton listingId="listing-1" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "Login to add favorites");
  });

  it("applies red-500 text color when favorited", () => {
    mockIsFavoritedData.current = { id: "fav-1", listingId: "listing-1" };
    render(<FavoriteButton listingId="listing-1" />);
    expect(screen.getByRole("button").className).toContain("text-red-500");
  });
});

describe("CompactFavoriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFavoritedData.current = null;
    mockUseAuthStore.isAuthenticated = true;
  });

  it("renders a small favorite button", () => {
    render(<CompactFavoriteButton listingId="listing-1" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("h-8 w-8");
  });

  it("applies additional className", () => {
    render(<CompactFavoriteButton listingId="listing-1" className="extra" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("rounded-full");
  });
});
