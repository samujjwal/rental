import { json, type LoaderFunctionArgs } from 'react-router';
import { requireAdmin } from '~/utils/auth.server';
import { apiClient } from '~/lib/api-client';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);

  // Fetch dashboard statistics
  const [stats, recentBookings, recentDisputes, systemHealth] = await Promise.all([
    apiClient.get('/admin/stats'),
    apiClient.get('/admin/bookings/recent?limit=10'),
    apiClient.get('/admin/disputes?status=OPEN&limit=5'),
    apiClient.get('/health'),
  ]);

  return json({
    user,
    stats: stats.data,
    recentBookings: recentBookings.data,
    recentDisputes: recentDisputes.data,
    systemHealth: systemHealth.data,
  });
}

export default function AdminDashboard() {
  const { stats, recentBookings, recentDisputes, systemHealth } =
    useLoaderData<typeof loader>();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Users"
          value={stats.totalUsers}
          change={stats.userGrowth}
          icon="users"
        />
        <MetricCard
          title="Active Listings"
          value={stats.activeListings}
          change={stats.listingGrowth}
          icon="list"
        />
        <MetricCard
          title="Total Bookings"
          value={stats.totalBookings}
          change={stats.bookingGrowth}
          icon="calendar"
        />
        <MetricCard
          title="Revenue (30d)"
          value={`$${stats.revenue30d.toLocaleString()}`}
          change={stats.revenueGrowth}
          icon="dollar"
        />
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow mb-8 p-6">
        <h2 className="text-xl font-semibold mb-4">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthIndicator
            label="API"
            status={systemHealth.status}
            responseTime={systemHealth.responseTime}
          />
          <HealthIndicator label="Database" status={systemHealth.database?.status} />
          <HealthIndicator label="Redis" status={systemHealth.redis?.status} />
          <HealthIndicator label="Elasticsearch" status={systemHealth.elasticsearch?.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Bookings</h2>
            <Link to="/admin/bookings" className="text-blue-600 hover:underline text-sm">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentBookings.map((booking: any) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </div>
        </div>

        {/* Open Disputes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Open Disputes</h2>
            <Link to="/admin/disputes" className="text-blue-600 hover:underline text-sm">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentDisputes.map((dispute: any) => (
              <DisputeRow key={dispute.id} dispute={dispute} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  icon,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change !== undefined && (
            <p className={`text-sm mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}
              {change}% vs last period
            </p>
          )}
        </div>
        <div className="text-4xl text-gray-400">{/* Icon here */}</div>
      </div>
    </div>
  );
}

function HealthIndicator({
  label,
  status,
  responseTime,
}: {
  label: string;
  status?: string;
  responseTime?: number;
}) {
  const statusColor =
    status === 'healthy' || status === 'ok' ? 'text-green-600' : 'text-red-600';

  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`font-semibold ${statusColor}`}>
        {status || 'Unknown'}
        {responseTime && <span className="text-xs text-gray-500 ml-1">({responseTime}ms)</span>}
      </p>
    </div>
  );
}

function BookingRow({ booking }: { booking: any }) {
  return (
    <Link
      to={`/admin/bookings/${booking.id}`}
      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded"
    >
      <div>
        <p className="font-medium">{booking.listing.title}</p>
        <p className="text-sm text-gray-500">
          {booking.renter.firstName} {booking.renter.lastName}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold">${booking.totalPrice}</p>
        <StatusBadge status={booking.status} />
      </div>
    </Link>
  );
}

function DisputeRow({ dispute }: { dispute: any }) {
  return (
    <Link
      to={`/admin/disputes/${dispute.id}`}
      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded"
    >
      <div>
        <p className="font-medium">{dispute.reason}</p>
        <p className="text-sm text-gray-500">Booking #{dispute.bookingId.slice(0, 8)}</p>
      </div>
      <StatusBadge status={dispute.status} />
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    OPEN: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}
