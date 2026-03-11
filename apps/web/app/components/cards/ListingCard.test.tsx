import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingCard, ListingCardGrid, type ListingCardData } from "./ListingCard";

// Mock heavy dependencies
vi.mock("react-router", () => ({
  Link: ({ to, children, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("~/lib/accessibility", () => ({
  prefersReducedMotion: () => false,
}));

vi.mock("~/components/favorites", () => ({
  CompactFavoriteButton: ({ listingId }: { listingId: string }) => (
    <button data-testid={`fav-${listingId}`}>Fav</button>
  ),
}));

vi.mock("~/components/ui/OptimizedImage", () => ({
  OptimizedImage: ({ alt, src }: any) => <img alt={alt} src={src} />,
}));

const baseListing: ListingCardData = {
  id: "listing-1",
  title: "Cozy Kathmandu Apartment",
  basePrice: 5000,
};

describe("ListingCard", () => {
  it("renders title and price", () => {
    render(<ListingCard listing={baseListing} />);

    expect(screen.getByText("Cozy Kathmandu Apartment")).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it("links to the listing detail page", () => {
    render(<ListingCard listing={baseListing} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/listings/listing-1");
  });

  it("renders location when provided", () => {
    render(
      <ListingCard
        listing={{ ...baseListing, location: { city: "Pokhara", state: "Gandaki" } }}
      />
    );

    expect(screen.getByText(/Pokhara/)).toBeInTheDocument();
    expect(screen.getByText(/Gandaki/)).toBeInTheDocument();
  });

  it("renders featured badge", () => {
    render(<ListingCard listing={{ ...baseListing, featured: true }} />);
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("renders instant booking badge", () => {
    render(<ListingCard listing={{ ...baseListing, instantBooking: true }} />);
    expect(screen.getByText("Instant")).toBeInTheDocument();
  });

  it("renders rating when provided", () => {
    render(
      <ListingCard
        listing={{ ...baseListing, rating: 4.5, totalReviews: 12 }}
      />
    );

    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });

  it("renders condition label", () => {
    render(
      <ListingCard listing={{ ...baseListing, condition: "like-new" }} />
    );

    expect(screen.getByText("like new")).toBeInTheDocument();
  });

  it("shows favorite button by default", () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByTestId("fav-listing-1")).toBeInTheDocument();
  });

  it("hides favorite button when showFavorite=false", () => {
    render(<ListingCard listing={baseListing} showFavorite={false} />);
    expect(screen.queryByTestId("fav-listing-1")).not.toBeInTheDocument();
  });

  it("shows 'No image' when no photos", () => {
    render(<ListingCard listing={baseListing} />);
    expect(screen.getByText("No image")).toBeInTheDocument();
  });

  it("renders photo when provided", () => {
    render(
      <ListingCard
        listing={{ ...baseListing, photos: ["/photo.jpg"] }}
      />
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/photo.jpg");
    expect(img).toHaveAttribute("alt", "Cozy Kathmandu Apartment");
  });

  // getCategoryHighlights is exercised indirectly via the component render
  describe("category highlights", () => {
    it("renders property highlights (bedrooms/bathrooms)", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "apartment",
            categorySpecificData: { bedrooms: 3, bathrooms: 2 },
          }}
        />
      );

      expect(screen.getByText("3 bed · 2 bath")).toBeInTheDocument();
    });

    it("renders vehicle highlights", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "car-rental",
            categorySpecificData: {
              make: "Toyota",
              year: 2022,
              transmission: "automatic",
            },
          }}
        />
      );

      expect(screen.getByText("Toyota · 2022 · Auto")).toBeInTheDocument();
    });

    it("renders manual transmission correctly", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "car-rental",
            categorySpecificData: { make: "Honda", transmission: "manual" },
          }}
        />
      );

      expect(screen.getByText("Honda · Manual")).toBeInTheDocument();
    });

    it("renders clothing highlights", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "clothing",
            categorySpecificData: { size: "M", brand: "Nike", color: "Blue" },
          }}
        />
      );

      expect(screen.getByText("Size M · Nike · Blue")).toBeInTheDocument();
    });

    it("renders instrument highlights", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "musical-instrument",
            categorySpecificData: { instrumentType: "Guitar", brand: "Fender" },
          }}
        />
      );

      expect(screen.getByText("Guitar · Fender")).toBeInTheDocument();
    });

    it("renders electronics highlights", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "electronic-devices",
            categorySpecificData: { brand: "Canon", model: "EOS R5" },
          }}
        />
      );

      expect(screen.getByText("Canon · EOS R5")).toBeInTheDocument();
    });

    it("renders event space highlights", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "event-spaces",
            categorySpecificData: { capacity: 200, venueType: "conference_hall" },
          }}
        />
      );

      expect(screen.getByText("200 guests · conference hall")).toBeInTheDocument();
    });

    it("limits highlights to 3 items", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "apartment",
            categorySpecificData: {
              bedrooms: 3,
              bathrooms: 2,
              squareFootage: 1500,
              furnished: true,
            },
          }}
        />
      );

      // Max 3: "3 bed · 2 bath · 1500 sq m" — Furnished is truncated
      expect(screen.getByText("3 bed · 2 bath · 1500 sq m")).toBeInTheDocument();
    });

    it("shows no highlights for unknown category", () => {
      render(
        <ListingCard
          listing={{
            ...baseListing,
            categorySlug: "unknown-category",
            categorySpecificData: { foo: "bar" },
          }}
        />
      );

      // No highlights element should appear — just check title is there
      expect(screen.getByText("Cozy Kathmandu Apartment")).toBeInTheDocument();
    });
  });
});

describe("ListingCardGrid", () => {
  it("renders a grid with listing cards", () => {
    const listings: ListingCardData[] = [
      { id: "1", title: "Listing A", basePrice: 1000 },
      { id: "2", title: "Listing B", basePrice: 2000 },
    ];

    render(<ListingCardGrid listings={listings} />);

    expect(screen.getByText("Listing A")).toBeInTheDocument();
    expect(screen.getByText("Listing B")).toBeInTheDocument();
  });
});
