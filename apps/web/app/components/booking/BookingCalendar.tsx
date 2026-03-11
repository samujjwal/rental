/**
 * BookingCalendar
 *
 * A range-selection calendar for the listing booking card.
 *  – Blocked / booked  dates: red-tinted, non-interactive
 *  – Past dates          : grey-tinted, non-interactive
 *  – Selected range      : primary-tinted fill between start and end
 *  – Start / end anchors : solid primary background
 *  – Today               : underlined dot indicator
 *
 * Uses only date-fns (already a dependency) – no external calendar library.
 */

import { useState, useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  getDay,
  getDaysInMonth,
  isBefore,
  isAfter,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookingCalendarProps {
  listingId: string;
  /** Called when both start and end are selected */
  onRangeSelect: (startDate: string, endDate: string) => void;
  /** Currently active start date (YYYY-MM-DD) – controlled */
  startDate?: string;
  /** Currently active end date (YYYY-MM-DD) – controlled */
  endDate?: string;
  /** Minimum rental period in days (default 1) */
  minRentalDays?: number;
  /** Maximum rental period in days (default 90) */
  maxRentalDays?: number;
  /** Called when the selection is cleared */
  onClear?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function today(): Date {
  return startOfDay(new Date());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookingCalendar({
  listingId,
  onRangeSelect,
  startDate,
  endDate,
  minRentalDays = 1,
  maxRentalDays = 90,
  onClear,
}: BookingCalendarProps) {
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(today()));
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  /** Internal hover state for range preview */
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Derived controlled dates
  const startDt = useMemo(
    () => (startDate ? startOfDay(parseISO(startDate)) : null),
    [startDate]
  );
  const endDt = useMemo(
    () => (endDate ? startOfDay(parseISO(endDate)) : null),
    [endDate]
  );

  // Fetch blocked dates from API
  useEffect(() => {
    let cancelled = false;
    setLoadingBlocked(true);
    import("~/lib/api/bookings")
      .then(({ bookingsApi }) => bookingsApi.getBlockedDates(listingId))
      .then((dates) => {
        if (cancelled) return;
        setBlockedSet(new Set(dates));
      })
      .catch(() => {
        if (!cancelled) setBlockedSet(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoadingBlocked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  // ---------------------------------------------------------------------------
  // Click handler: pick start (first click) or end (second click)
  // ---------------------------------------------------------------------------
  const handleDayClick = (d: Date) => {
    const ds = toDateString(d);
    if (isUnavailable(d)) return;

    // If no start selected, or both already selected → reset to new start
    if (!startDt || (startDt && endDt)) {
      // Single-click resets range to new start
      onRangeSelect(ds, ds);
      return;
    }

    // Start already picked, pick end
    if (isBefore(d, startDt) || isSameDay(d, startDt)) {
      // Clicked before or on start → swap: make this the new start
      onRangeSelect(ds, ds);
      return;
    }

    // Check if any blocked day lies between startDt and d
    const hasBlockedInRange = hasBlockedBetween(startDt, d);
    if (hasBlockedInRange) {
      // Reset – can't select a range that spans a blocked day
      onRangeSelect(ds, ds);
      return;
    }

    const diffDays =
      (d.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > maxRentalDays) return; // silently reject too-long ranges
    if (diffDays < minRentalDays - 1) return; // too short

    onRangeSelect(toDateString(startDt), ds);
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const isUnavailable = (d: Date): boolean => {
    return isBefore(d, today()) || blockedSet.has(toDateString(d));
  };

  const hasBlockedBetween = (from: Date, to: Date): boolean => {
    // Iterate days between from+1 and to-1
    const cursor = new Date(from.getTime() + 86400000);
    while (isBefore(cursor, to)) {
      if (blockedSet.has(toDateString(cursor))) return true;
      cursor.setDate(cursor.getDate() + 1);
    }
    return false;
  };

  const isInRange = (d: Date): boolean => {
    // Show range highlight between start and end (or hover preview)
    const effectiveEnd = endDt ?? (startDt && hoverDate && isAfter(hoverDate, startDt) ? hoverDate : null);
    if (!startDt || !effectiveEnd) return false;
    if (isSameDay(d, startDt) || isSameDay(d, effectiveEnd)) return false;
    return isWithinInterval(d, { start: startDt, end: effectiveEnd });
  };

  const isRangeStart = (d: Date) => startDt && isSameDay(d, startDt);
  const isRangeEnd = (d: Date) => endDt && isSameDay(d, endDt);
  const isToday = (d: Date) => isSameDay(d, today());

  // ---------------------------------------------------------------------------
  // Render a single month
  // ---------------------------------------------------------------------------
  const renderMonth = (monthBase: Date) => {
    const firstDay = startOfMonth(monthBase);
    const totalDays = getDaysInMonth(firstDay);
    const startWeekday = getDay(firstDay); // 0 = Sunday
    const label = format(firstDay, "MMMM yyyy");

    const days: (Date | null)[] = [
      ...Array(startWeekday).fill(null),
      ...Array.from({ length: totalDays }, (_, i) => {
        const d = new Date(firstDay);
        d.setDate(i + 1);
        return d;
      }),
    ];

    // Pad to full rows of 7
    while (days.length % 7 !== 0) days.push(null);

    return { label, days };
  };

  const thisMonth = renderMonth(viewMonth);
  const nextMonthDate = addMonths(viewMonth, 1);
  const nextMonth = renderMonth(nextMonthDate);

  const renderDay = (d: Date | null, key: string) => {
    if (!d) {
      return <div key={key} />;
    }

    const unavailable = isUnavailable(d);
    const blocked = blockedSet.has(toDateString(d));
    const past = isBefore(d, today());
    const inRange = isInRange(d);
    const rangeStart = isRangeStart(d);
    const rangeEnd = isRangeEnd(d);
    const tdToday = isToday(d);
    const dayNum = d.getDate();

    // Only start is picked, hovered day is preview end
    const isHoverEnd =
      !endDt &&
      startDt &&
      hoverDate &&
      isSameDay(d, hoverDate) &&
      isAfter(hoverDate, startDt);

    return (
      <div
        key={key}
        role={unavailable ? "presentation" : "button"}
        tabIndex={unavailable ? -1 : 0}
        aria-label={
          unavailable
            ? `${format(d, "MMMM d, yyyy")} – ${past ? "past" : "unavailable"}`
            : format(d, "MMMM d, yyyy")
        }
        aria-pressed={Boolean(rangeStart || rangeEnd)}
        aria-disabled={unavailable}
        onClick={() => !unavailable && handleDayClick(d)}
        onKeyDown={(e) => e.key === "Enter" && !unavailable && handleDayClick(d)}
        onMouseEnter={() => setHoverDate(d)}
        onMouseLeave={() => setHoverDate(null)}
        className={cn(
          "relative flex items-center justify-center h-9 w-full text-sm select-none transition-colors",
          // Rounded: start/end get full pills; range interior gets rectangular strip
          rangeStart && "rounded-l-full",
          rangeEnd && "rounded-r-full",
          (rangeStart || rangeEnd) && "!rounded-full",
          // Available interactive day
          !unavailable && !rangeStart && !rangeEnd && !inRange
            ? "hover:bg-muted rounded-full cursor-pointer"
            : "",
          // Range fill (below the circles)
          inRange && "bg-primary/15",
          // Hover preview fill
          !endDt &&
            !inRange &&
            !rangeStart &&
            !rangeEnd &&
            isHoverEnd &&
            "bg-primary/10 rounded-r-full",
          // Solid primary for start / end
          (rangeStart || rangeEnd) && "bg-primary text-primary-foreground font-semibold",
          // Blocked (booked) – reddish, strikethrough-like
          blocked && !past && "bg-destructive/10 text-destructive/60 cursor-not-allowed rounded-full",
          // Past – greyed out
          past && "text-muted-foreground/40 cursor-not-allowed",
          // Focus ring
          !unavailable && "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        )}
      >
        <span className="relative z-10">
          {dayNum}
          {/* Today indicator dot */}
          {tdToday && !rangeStart && !rangeEnd && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
          )}
        </span>
      </div>
    );
  };

  const renderGrid = (month: { label: string; days: (Date | null)[] }, showNav: boolean, monthDate: Date) => (
    <div className="flex-1 min-w-0">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3 px-1">
        {showNav ? (
          <button
            type="button"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            disabled={!isBefore(today(), startOfMonth(monthDate)) || isSameDay(startOfMonth(monthDate), startOfMonth(today()))}
            className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-7" />
        )}
        <span className="text-sm font-semibold text-foreground">{month.label}</span>
        {!showNav ? (
          <button
            type="button"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-7" />
        )}
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-center text-xs font-medium text-muted-foreground py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {month.days.map((d, i) => renderDay(d, `${format(monthDate, "yyyy-MM")}-${i}`))}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------------------
  const Legend = () => (
    <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-border mt-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block w-4 h-4 rounded-full bg-primary" />
        Selected
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block w-4 h-4 rounded-full bg-primary/15 border border-primary/30" />
        In range
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block w-4 h-4 rounded-full bg-destructive/10 border border-destructive/20" />
        Unavailable
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block w-4 h-4 rounded-full bg-muted" />
        Past
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Summary strip
  // ---------------------------------------------------------------------------
  const Summary = () => {
    if (!startDt) return null;
    const nights =
      endDt && !isSameDay(startDt, endDt)
        ? Math.round((endDt.getTime() - startDt.getTime()) / 86400000)
        : 0;
    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <span>
          {format(startDt, "MMM d")}
          {endDt && !isSameDay(startDt, endDt) ? ` → ${format(endDt, "MMM d")}` : " (pick check-out)"}
        </span>
        {nights > 0 && (
          <span className="font-medium text-foreground">{nights} day{nights !== 1 ? "s" : ""}</span>
        )}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="ml-2 text-xs text-destructive hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
      {loadingBlocked && (
        <p className="text-xs text-muted-foreground text-center pb-2">
          Loading availability…
        </p>
      )}

      {/* Dual-month layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        {renderGrid(thisMonth, true, viewMonth)}
        {renderGrid(nextMonth, false, nextMonthDate)}
      </div>

      <Summary />
      <Legend />
    </div>
  );
}
