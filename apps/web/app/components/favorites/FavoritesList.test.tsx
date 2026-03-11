import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mock dependencies
vi.mock("react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href: to, ...props }, children),
}));

const { mockRemoveFavorite, mockClearAll, mockFavoritesData } = vi.hoisted(
  () => ({
    mockRemoveFavorite: vi.fn(),
    mockClearAll: vi.fn(),
    mockFavoritesData: {
      current: null as {
        favorites: Array<{
          id: string;
          listingId: string;
          createdAt: string;
          listing?: {
            title: string;
            description: string;
            basePrice: number;
            images: string[];
            location: { city: string; state: string };
          };
        }>;
        total: number;
      } | null,
    },
  })
);

vi.mock("~/hooks/useFavorites", () => ({
  useFavorites: () => ({
    data: mockFavoritesData.current,
    isLoading: false,
    error: null,
  }),
  useRemoveFavorite: () => ({
    mutate: mockRemoveFavorite,
  }),
  useClearAllFavorites: () => ({
    mutate: mockClearAll,
    isPending: false,
  }),
}));

vi.mock("~/components/animations", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  StaggerList: ({
    items,
    renderItem,
  }: {
    items: unknown[];
    staggerDelay: number;
    renderItem: (item: unknown) => React.ReactNode;
  }) =>
    React.createElement(
      "div",
      null,
      items.map((item, i) =>
        React.createElement("div", { key: i }, renderItem(item))
      )
    ),
}));

vi.mock("~/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onClose,
    title,
    message,
    confirmText,
  }: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
    title: string;
    message: string;
    confirmText: string;
    confirmColor?: string;
    isLoading?: boolean;
  }) =>
    open
      ? React.createElement(
          "div",
          { "data-testid": "confirm-dialog" },
          React.createElement("p", null, title),
          React.createElement("p", null, message),
          React.createElement("button", { onClick: onConfirm }, confirmText),
          React.createElement("button", { onClick: onClose }, "Cancel")
        )
      : null,
}));

import { FavoritesList } from "./FavoritesList";

const sampleFavorites = [
  {
    id: "fav-1",
    listingId: "listing-1",
    createdAt: "2024-01-15T00:00:00Z",
    listing: {
      title: "Mountain Bike",
      description: "A great mountain bike for trails",
      basePrice: 25,
      images: ["/bike.jpg"],
      location: { city: "Kathmandu", state: "Bagmati" },
    },
  },
  {
    id: "fav-2",
    listingId: "listing-2",
    createdAt: "2024-01-16T00:00:00Z",
    listing: {
      title: "Camera Kit",
      description: "Professional camera equipment",
      basePrice: 50,
      images: ["/camera.jpg"],
      location: { city: "Pokhara", state: "Gandaki" },
    },
  },
];

describe("FavoritesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFavoritesData.current = { favorites: sampleFavorites, total: 2 };
  });

  it("renders favorites list with items", () => {
    render(<FavoritesList />);
    expect(screen.getByText("Saved Listings")).toBeInTheDocument();
    expect(screen.getByText("Mountain Bike")).toBeInTheDocument();
    expect(screen.getByText("Camera Kit")).toBeInTheDocument();
  });

  it("shows empty state when no favorites", () => {
    mockFavoritesData.current = { favorites: [], total: 0 };

    render(<FavoritesList />);
    expect(screen.getByText("No favorites yet")).toBeInTheDocument();
    expect(screen.getByText(/Browse Listings/)).toBeInTheDocument();
  });

  it("shows sort controls when showFilters is true", () => {
    render(<FavoritesList showFilters />);
    expect(screen.getByLabelText("Sort By")).toBeInTheDocument();
    expect(screen.getByLabelText("Order")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
  });

  it("hides sort controls when showFilters is false", () => {
    render(<FavoritesList showFilters={false} />);
    expect(screen.queryByLabelText("Sort By")).not.toBeInTheDocument();
  });

  it("shows Clear All button when showClearAll is true", () => {
    render(<FavoritesList showClearAll />);
    expect(screen.getByText("Clear All")).toBeInTheDocument();
  });

  it("hides Clear All button when showClearAll is false", () => {
    render(<FavoritesList showClearAll={false} />);
    expect(screen.queryByText("Clear All")).not.toBeInTheDocument();
  });

  it("hides Clear All when list is empty", () => {
    mockFavoritesData.current = { favorites: [], total: 0 };
    render(<FavoritesList showClearAll />);
    expect(screen.queryByText("Clear All")).not.toBeInTheDocument();
  });

  it("calls removeFavorite when remove button is clicked", () => {
    render(<FavoritesList />);
    const removeButtons = screen.getAllByRole("button", {
      name: /remove from favorites/i,
    });
    fireEvent.click(removeButtons[0]);
    expect(mockRemoveFavorite).toHaveBeenCalledWith({ listingId: "listing-1" });
  });

  it("opens confirm dialog when Clear All is clicked", () => {
    render(<FavoritesList />);
    fireEvent.click(screen.getByText("Clear All"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Clear All Favorites?")).toBeInTheDocument();
  });

  it("calls clearAll when confirm dialog is confirmed", () => {
    render(<FavoritesList />);
    fireEvent.click(screen.getByText("Clear All"));
    // Click the confirm button within the dialog
    const confirmButtons = screen.getAllByText("Clear All");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]); // The one in the dialog
    expect(mockClearAll).toHaveBeenCalled();
  });

  it("displays listing prices", () => {
    render(<FavoritesList />);
    expect(screen.getByText(/25.*\/day/)).toBeInTheDocument();
    expect(screen.getByText(/50.*\/day/)).toBeInTheDocument();
  });

  it("displays listing locations", () => {
    render(<FavoritesList />);
    expect(screen.getByText(/Kathmandu, Bagmati/)).toBeInTheDocument();
    expect(screen.getByText(/Pokhara, Gandaki/)).toBeInTheDocument();
  });

  it("links to listing detail pages", () => {
    render(<FavoritesList />);
    const links = screen.getAllByRole("link");
    const listingLinks = links.filter((l) =>
      l.getAttribute("href")?.includes("/listings/")
    );
    expect(listingLinks.length).toBeGreaterThanOrEqual(2);
  });
});
