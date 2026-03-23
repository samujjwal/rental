import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, redirect, useRevalidator } from "react-router";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  User,
  Banknote,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import { listingsApi } from "~/lib/api/listings";
import { UnifiedButton, RouteErrorBoundary } from "~/components/ui";
import { PortalPageLayout } from "~/components/layout";
import type { Listing } from "~/types/listing";
import { getUser } from "~/utils/auth";
import { APP_LOCALE } from "~/config/locale";
import { ownerNavSections } from "~/config/navigation";
import { formatCurrency, formatDate } from "~/lib/utils";
import { useTranslation } from "react-i18next";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [
    { title: "Booking Calendar | Owner Dashboard" },
    { name: "description", content: "Manage your rental calendar" },
  ];
};

export function getOwnerCalendarLoadError(error: unknown): string {
  return getActionableErrorMessage(error, "Failed to load calendar data", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading calendar data timed out. Try again.",
  });
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return redirect("/dashboard");
  }

  try {
    const [bookingsResponse, listingsResponse] = await Promise.all([
      bookingsApi.getOwnerBookings(),
      listingsApi.getMyListings(),
    ]);
    return {
      bookings: Array.isArray(bookingsResponse) ? bookingsResponse : [],
      listings: Array.isArray(listingsResponse) ? listingsResponse : [],
      error: null,
    };
  } catch (error: unknown) {
    return {
      bookings: [],
      listings: [],
      error: getOwnerCalendarLoadError(error),
    };
  }
}

interface CalendarBooking {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  listing: {
    id: string;
    title: string;
  };
  renter: {
    firstName: string;
    lastName: string | null;
  };
  totalPrice: number;
  totalAmount?: number; // backward-compat alias for totalPrice
}

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeTime = (value: unknown): number => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
};
const safeStatus = (value: unknown): string =>
  String(value || "").toLowerCase();
const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Date unavailable" : formatDate(date);
};
const safeText = (value: unknown, fallback = ""): string => {
  const text = typeof value === "string" ? value : "";
  return text || fallback;
};

export default function OwnerCalendarPage() {
  const { t } = useTranslation();
  const { bookings, listings, error } = useLoaderData<
    typeof clientLoader
  >() as {
    bookings: CalendarBooking[];
    listings: Listing[];
    error: string | null;
  };
  const { revalidate } = useRevalidator();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedListing, setSelectedListing] = useState<string>("all");
  const listingIds = useMemo(
    () => new Set(listings.map((listing) => listing.id)),
    [listings]
  );
  const activeListingFilter =
    selectedListing === "all" || listingIds.has(selectedListing)
      ? selectedListing
      : "all";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Month names — locale-aware
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(APP_LOCALE, { month: "long" }).format(
      new Date(2020, i, 1)
    )
  );

  // Navigate months
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Filter bookings by selected listing
  const filteredBookings = useMemo(() => {
    return activeListingFilter === "all"
      ? bookings
      : bookings.filter((b) => b.listing?.id === activeListingFilter);
  }, [activeListingFilter, bookings]);

  // Check if a date has bookings
  const getBookingsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filteredBookings.filter((booking: CalendarBooking) => {
      const startAt = safeTime(booking.startDate);
      const endAt = safeTime(booking.endDate);
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
        return false;
      }
      const checkAt = safeTime(dateStr);
      return Number.isFinite(checkAt) && checkAt >= startAt && checkAt <= endAt;
    });
  };

  // Get status color
  const getStatusColor = (status: unknown) => {
    const normalized = safeStatus(status);
    switch (normalized) {
      case "confirmed":
        return "bg-success";
      case "pending":
      case "pending_owner_approval":
      case "pending_payment":
        return "bg-warning";
      case "in_progress":
      case "active":
        return "bg-info";
      case "completed":
      case "settled":
        return "bg-muted-foreground";
      case "cancelled":
      case "payment_failed":
        return "bg-destructive";
      default:
        return "bg-muted-foreground/50";
    }
  };

  // Generate calendar days
  const calendarDays = [];
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const today = new Date();
  const isToday = (day: number | null) => {
    if (!day) return false;
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  return (
    <PortalPageLayout
      title={t("dashboard.calendar.bookingCalendar")}
      description="Manage your rental calendar"
      sidebarSections={ownerNavSections}
      banner={
        error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p>{error}</p>
              <UnifiedButton variant="outline" onClick={() => revalidate()}>
                Try Again
              </UnifiedButton>
            </div>
          </div>
        ) : null
      }
      actions={
        <Link to="/listings/new">
          <UnifiedButton size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {t("dashboard.calendar.newListing")}
          </UnifiedButton>
        </Link>
      }
      contentClassName="space-y-6"
    >
      {error ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/50 p-10 text-center text-muted-foreground">
          Calendar data is currently unavailable.
          <div className="mt-4">
            <UnifiedButton variant="outline" onClick={() => revalidate()}>
              Try Again
            </UnifiedButton>
          </div>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Month Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevMonth}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold min-w-[180px] text-center">
                  {monthNames[month]} {year}
                </h2>
                <button
                  onClick={goToNextMonth}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <UnifiedButton variant="outline" size="sm" onClick={goToToday}>
                {t("dashboard.calendar.today")}
              </UnifiedButton>
            </div>

            <div className="flex items-center gap-4">
              {/* Listing Filter */}
              <select
                value={activeListingFilter}
                onChange={(e) => setSelectedListing(e.target.value)}
                className="px-3 py-2 border border-input rounded-lg bg-background text-sm"
              >
                <option value="all">
                  {t("dashboard.calendar.allListings")}
                </option>
                {listings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.title}
                  </option>
                ))}
              </select>

              <div className="px-3 py-2 text-sm font-medium rounded-lg border border-input bg-background">
                {t("dashboard.calendar.monthView")}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {t("dashboard.calendar.legend")}
            </span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-success"></span>
              <span>{t("bookings.status.confirmed")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-warning"></span>
              <span>{t("bookings.status.pending")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-info"></span>
              <span>{t("bookings.status.inProgress")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-muted-foreground"></span>
              <span>{t("bookings.status.completed")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-destructive"></span>
              <span>{t("bookings.status.cancelled")}</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-card border rounded-xl overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b bg-muted/50">
              {Array.from(
                { length: 7 },
                (_, i) =>
                  new Intl.DateTimeFormat(APP_LOCALE, {
                    weekday: "short",
                  }).format(new Date(2024, 0, 7 + i)) // 2024-01-07 is Sunday
              ).map((day) => (
                <div
                  key={day}
                  className="p-3 text-center text-sm font-semibold text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayBookings = day ? getBookingsForDate(day) : [];
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={index}
                    className={`min-h-[120px] border-b border-r p-2 ${
                      day ? "bg-background" : "bg-muted/30"
                    } ${isCurrentDay ? "bg-primary/5" : ""}`}
                  >
                    {day && (
                      <>
                        <div
                          className={`text-sm font-medium mb-1 ${
                            isCurrentDay
                              ? "bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center"
                              : "text-foreground"
                          }`}
                        >
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayBookings
                            .slice(0, 3)
                            .map((booking: CalendarBooking) =>
                              (() => {
                                const bookingId = safeText(booking.id);
                                const listingTitle = safeText(
                                  booking.listing?.title,
                                  "Booking"
                                );
                                return (
                                  <Link
                                    key={booking.id}
                                    to={
                                      bookingId
                                        ? `/bookings/${bookingId}`
                                        : "/bookings"
                                    }
                                    className={`block text-xs p-1 rounded truncate text-white ${getStatusColor(booking.status)} hover:opacity-80 transition-opacity`}
                                  >
                                    {listingTitle}
                                  </Link>
                                );
                              })()
                            )}
                          {dayBookings.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              {t("dashboard.calendar.moreBookings", {
                                count: dayBookings.length - 3,
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Bookings List */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t("bookings.upcoming")}
            </h3>
            <div className="space-y-3">
              {filteredBookings
                .filter((b: CalendarBooking) => {
                  const startAt = safeTime(b.startDate);
                  return Number.isFinite(startAt) && startAt >= Date.now();
                })
                .slice(0, 5)
                .map((booking: CalendarBooking) =>
                  (() => {
                    const bookingId = safeText(booking.id);
                    const renterFirstName = safeText(
                      booking.renter?.firstName,
                      "Renter"
                    );
                    const renterLastName = safeText(booking.renter?.lastName);
                    const listingTitle = safeText(
                      booking.listing?.title,
                      "Booking"
                    );
                    return (
                      <Link
                        key={booking.id}
                        to={bookingId ? `/bookings/${bookingId}` : "/bookings"}
                        className="flex items-center justify-between p-4 bg-card border rounded-lg hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-2 h-12 rounded-full ${getStatusColor(booking.status)}`}
                          />
                          <div>
                            <h4 className="font-medium text-foreground">
                              {listingTitle}
                            </h4>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {renterFirstName}
                                {renterLastName ? ` ${renterLastName}` : ""}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {safeDateLabel(booking.startDate)} -{" "}
                                {safeDateLabel(booking.endDate)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-foreground font-semibold">
                            <Banknote className="w-4 h-4" />
                            {formatCurrency(
                              safeNumber(
                                booking.totalPrice ?? booking.totalAmount
                              )
                            )}
                          </div>
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full text-white ${getStatusColor(booking.status)}`}
                          >
                            {String(booking.status || "").replace(/_/g, " ")}
                          </span>
                        </div>
                      </Link>
                    );
                  })()
                )}
              {filteredBookings.filter((b: CalendarBooking) => {
                const startAt = safeTime(b.startDate);
                return Number.isFinite(startAt) && startAt >= Date.now();
              }).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t("dashboard.calendar.noUpcomingBookings")}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PortalPageLayout>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
