import type { MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Download,
  Plus,
  Clock,
  User,
  DollarSign,
} from "lucide-react";
import { bookingsApi } from "~/lib/api/bookings";
import { listingsApi } from "~/lib/api/listings";
import { Button } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Booking Calendar | Owner Dashboard" },
    { name: "description", content: "Manage your rental calendar" },
  ];
};

export async function clientLoader() {
  try {
    const [bookings, listings] = await Promise.all([
      bookingsApi.getOwnerBookings(),
      listingsApi.getMyListings(),
    ]);
    return {
      bookings: bookings || [],
      listings: listings || [],
      error: null,
    };
  } catch (error: any) {
    return {
      bookings: [],
      listings: [],
      error: error?.message || "Failed to load calendar data",
    };
  }
}

type ViewMode = "day" | "week" | "month";

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
  totalAmount: number;
}

export default function OwnerCalendarPage() {
  const { bookings, listings, error } = useLoaderData<typeof clientLoader>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedListing, setSelectedListing] = useState<string>("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Month names
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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
  const filteredBookings = selectedListing === "all"
    ? bookings
    : bookings.filter((b: any) => b.listing?.id === selectedListing);

  // Check if a date has bookings
  const getBookingsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filteredBookings.filter((booking: CalendarBooking) => {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      const checkDate = new Date(dateStr);
      return checkDate >= start && checkDate <= end;
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-500";
      case "PENDING":
        return "bg-yellow-500";
      case "IN_PROGRESS":
        return "bg-blue-500";
      case "COMPLETED":
        return "bg-gray-400";
      case "CANCELLED":
        return "bg-red-500";
      default:
        return "bg-gray-300";
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

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard/owner" className="text-muted-foreground hover:text-foreground">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Booking Calendar</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outlined" size="small">
                <Download className="w-4 h-4 mr-2" />
                Sync to iCal
              </Button>
              <Link to="/listings/new">
                <Button size="small">
                  <Plus className="w-4 h-4 mr-2" />
                  New Listing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevMonth}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold min-w-[180px] text-center">
                {monthNames[month]} {year}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <Button variant="outlined" size="small" onClick={goToToday}>
              Today
            </Button>
          </div>

          <div className="flex items-center gap-4">
            {/* Listing Filter */}
            <select
              value={selectedListing}
              onChange={(e) => setSelectedListing(e.target.value)}
              className="px-3 py-2 border border-input rounded-lg bg-background text-sm"
            >
              <option value="all">All Listings</option>
              {listings.map((listing: any) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title}
                </option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div className="flex border border-input rounded-lg overflow-hidden">
              {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    viewMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
          <span className="text-muted-foreground">Legend:</span>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-400"></span>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>Cancelled</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card border rounded-xl overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
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
                        {dayBookings.slice(0, 3).map((booking: CalendarBooking) => (
                          <Link
                            key={booking.id}
                            to={`/bookings/${booking.id}`}
                            className={`block text-xs p-1 rounded truncate text-white ${getStatusColor(booking.status)} hover:opacity-80 transition-opacity`}
                          >
                            {booking.listing?.title || "Booking"}
                          </Link>
                        ))}
                        {dayBookings.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayBookings.length - 3} more
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
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Upcoming Bookings
          </h3>
          <div className="space-y-3">
            {filteredBookings
              .filter((b: CalendarBooking) => new Date(b.startDate) >= new Date())
              .slice(0, 5)
              .map((booking: CalendarBooking) => (
                <Link
                  key={booking.id}
                  to={`/bookings/${booking.id}`}
                  className="flex items-center justify-between p-4 bg-card border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-12 rounded-full ${getStatusColor(booking.status)}`} />
                    <div>
                      <h4 className="font-medium text-foreground">
                        {booking.listing?.title}
                      </h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {booking.renter?.firstName} {booking.renter?.lastName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-foreground font-semibold">
                      <DollarSign className="w-4 h-4" />
                      {booking.totalAmount?.toFixed(2)}
                    </div>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full text-white ${getStatusColor(booking.status)}`}>
                      {booking.status?.replace("_", " ")}
                    </span>
                  </div>
                </Link>
              ))}
            {filteredBookings.filter((b: CalendarBooking) => new Date(b.startDate) >= new Date()).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No upcoming bookings</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
