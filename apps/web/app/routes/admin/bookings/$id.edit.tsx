import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const bookingResponse = await fetch(`${API_BASE_URL}/admin/bookings/${params.id}`, { headers });
  
  if (!bookingResponse.ok) {
    throw new Response("Booking not found", { status: 404 });
  }
  
  const bookingData = await bookingResponse.json();
  
  return bookingData;
}

export default function AdminBookingEdit() {
  const booking = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Booking</h2>
        <p className="text-gray-600">Modify booking details and status</p>
        <p className="text-sm text-gray-400 mt-2">Booking ID: {booking.id}</p>
      </div>
    </div>
  );
}
