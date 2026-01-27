import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const bookingsResponse = await fetch(`${API_BASE_URL}/admin/bookings/calendar?month=${month}`, { headers });
  
  if (!bookingsResponse.ok) {
    throw new Response("Failed to fetch calendar data", { status: 500 });
  }
  
  const bookingsData = await bookingsResponse.json();
  
  return { bookings: bookingsData.data || [], month };
}

export default function AdminBookingCalendar() {
  const { bookings, month } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Calendar</h2>
        <p className="text-gray-600">Calendar view of all bookings for {month}</p>
        
        <div className="mt-6">
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500">Calendar component would be implemented here</p>
            <p className="text-sm text-gray-400 mt-2">Showing {bookings.length} bookings for {month}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
