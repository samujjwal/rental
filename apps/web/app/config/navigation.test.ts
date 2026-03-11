import { describe, it, expect, vi } from "vitest";
import { renterNavSections, ownerNavSections } from "./navigation";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  LayoutDashboard: () => null,
  Calendar: () => null,
  Heart: () => null,
  MessageCircle: () => null,
  Star: () => null,
  Settings: () => null,
  Plus: () => null,
  Package: () => null,
  CalendarDays: () => null,
  Banknote: () => null,
  TrendingUp: () => null,
  BarChart3: () => null,
  Bell: () => null,
  Building2: () => null,
  AlertTriangle: () => null,
}));

describe("renterNavSections", () => {
  it("is an array of sections", () => {
    expect(Array.isArray(renterNavSections)).toBe(true);
    expect(renterNavSections.length).toBe(2);
  });

  it("first section has core renter links", () => {
    const items = renterNavSections[0].items;
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Dashboard");
    expect(labels).toContain("My Bookings");
    expect(labels).toContain("Favorites");
    expect(labels).toContain("Messages");
    expect(labels).toContain("Reviews");
    expect(labels).toContain("Settings");
  });

  it("all items have href, label, and icon", () => {
    for (const section of renterNavSections) {
      for (const item of section.items) {
        expect(item.href).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.icon).toBeDefined();
      }
    }
  });

  it("second section has 'Become an Owner' link", () => {
    const items = renterNavSections[1].items;
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Become an Owner");
    expect(items[0].href).toBe("/become-owner");
  });

  it("dashboard link points to renter dashboard", () => {
    const dash = renterNavSections[0].items.find(
      (i) => i.label === "Dashboard"
    );
    expect(dash?.href).toBe("/dashboard/renter");
  });
});

describe("ownerNavSections", () => {
  it("is an array of sections", () => {
    expect(Array.isArray(ownerNavSections)).toBe(true);
    expect(ownerNavSections.length).toBe(2);
  });

  it("first section has core owner links", () => {
    const items = ownerNavSections[0].items;
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Listings");
    expect(labels).toContain("Bookings");
    expect(labels).toContain("Calendar");
    expect(labels).toContain("Earnings");
    expect(labels).toContain("Messages");
    expect(labels).toContain("Organizations");
    expect(labels).toContain("Settings");
  });

  it("all items have href, label, and icon", () => {
    for (const section of ownerNavSections) {
      for (const item of section.items) {
        expect(item.href).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.icon).toBeDefined();
      }
    }
  });

  it("second section is titled 'Insights'", () => {
    expect(ownerNavSections[1].title).toBe("Insights");
  });

  it("insights section has Performance and Insights links", () => {
    const items = ownerNavSections[1].items;
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Performance");
    expect(labels).toContain("Insights");
  });

  it("dashboard link points to owner dashboard", () => {
    const dash = ownerNavSections[0].items.find(
      (i) => i.label === "Dashboard"
    );
    expect(dash?.href).toBe("/dashboard/owner");
  });

  it("owner has more nav items than renter", () => {
    const ownerTotal = ownerNavSections.reduce(
      (sum, s) => sum + s.items.length,
      0
    );
    const renterTotal = renterNavSections.reduce(
      (sum, s) => sum + s.items.length,
      0
    );
    expect(ownerTotal).toBeGreaterThan(renterTotal);
  });
});
