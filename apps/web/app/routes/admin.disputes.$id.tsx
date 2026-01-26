import { type LoaderFunctionArgs, type ActionFunctionArgs, Link } from 'react-router';
import { useLoaderData, useActionData, Form, useNavigation } from 'react-router';
import { requireAdmin } from '~/utils/auth.server';
import { apiClient } from '~/lib/api-client';

export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const dispute = await apiClient.get(`/disputes/${params.id}`);
  const timeline = await apiClient.get(`/disputes/${params.id}/timeline`);
  const evidence = await apiClient.get(`/disputes/${params.id}/evidence`);

  return { dispute: dispute.data, timeline: timeline.data, evidence: evidence.data };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = formData.get('intent');

  switch (intent) {
    case 'update_status': {
      const status = formData.get('status');
      const resolution = formData.get('resolution');
      const resolvedAmount = formData.get('resolvedAmount');

      await apiClient.put(`/disputes/${params.id}`, {
        status,
        resolution,
        resolvedAmount: resolvedAmount ? parseFloat(resolvedAmount as string) : undefined,
      });

      return { success: true, message: 'Dispute updated' };
    }

    case 'add_response': {
      const message = formData.get('message');

      await apiClient.post(`/disputes/${params.id}/responses`, {
        message,
      });

      return { success: true, message: 'Response added' };
    }

    default:
      return { error: 'Invalid action' };
  }
}

export default function AdminDisputeDetail() {
  const { dispute, timeline, evidence } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link to="/admin/disputes" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Disputes
        </Link>
        <h1 className="text-3xl font-bold">Dispute #{dispute.id.slice(0, 8)}</h1>
        <StatusBadge status={dispute.status} className="mt-2" />
      </div>

      {actionData?.success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-6">
          {actionData.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Details</h2>
            <div className="space-y-3">
              <InfoRow label="Reason" value={dispute.reason} />
              <InfoRow label="Booking ID" value={dispute.bookingId} link={`/admin/bookings/${dispute.bookingId}`} />
              <InfoRow label="Reported By" value={`${dispute.reportedByUser.firstName} ${dispute.reportedByUser.lastName}`} />
              <InfoRow label="Requested Resolution" value={dispute.requestedResolution} />
              {dispute.requestedAmount && (
                <InfoRow label="Requested Amount" value={`$${dispute.requestedAmount}`} />
              )}
              <InfoRow label="Created" value={new Date(dispute.createdAt).toLocaleString()} />
            </div>
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{dispute.description}</p>
            </div>
          </div>

          {/* Evidence */}
          {evidence.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Evidence</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {evidence.map((item: any) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border rounded-lg overflow-hidden hover:shadow-lg transition"
                  >
                    {item.type === 'image' ? (
                      <img src={item.url} alt="Evidence" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center bg-gray-100">
                        <span className="text-gray-600">📄 {item.name}</span>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Timeline</h2>
            <div className="space-y-4">
              {timeline.map((event: any) => (
                <TimelineEvent key={event.id} event={event} />
              ))}
            </div>
          </div>

          {/* Add Response */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Add Response</h2>
            <Form method="post">
              <input type="hidden" name="intent" value="add_response" />
              <textarea
                name="message"
                rows={4}
                className="w-full border rounded px-3 py-2"
                placeholder="Enter your response..."
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Add Response'}
              </button>
            </Form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update_status" />

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select name="status" className="w-full border rounded px-3 py-2" defaultValue={dispute.status}>
                  <option value="OPEN">Open</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Resolution</label>
                <textarea
                  name="resolution"
                  rows={3}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Describe the resolution..."
                  defaultValue={dispute.resolution || ''}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Resolved Amount ($)</label>
                <input
                  type="number"
                  name="resolvedAmount"
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                  placeholder="0.00"
                  defaultValue={dispute.resolvedAmount || ''}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Update Dispute'}
              </button>
            </Form>
          </div>

          {/* Booking Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Booking Info</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500">Listing:</span> {dispute.booking.listing.title}
              </p>
              <p>
                <span className="text-gray-500">Renter:</span> {dispute.booking.renter.firstName}{' '}
                {dispute.booking.renter.lastName}
              </p>
              <p>
                <span className="text-gray-500">Total:</span> ${dispute.booking.totalPrice}
              </p>
              <p>
                <span className="text-gray-500">Dates:</span>{' '}
                {new Date(dispute.booking.startDate).toLocaleDateString()} -{' '}
                {new Date(dispute.booking.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="flex justify-between py-2 border-b">
      <span className="text-gray-600">{label}</span>
      {link ? (
        <Link to={link} className="text-blue-600 hover:underline">
          {value}
        </Link>
      ) : (
        <span className="font-medium">{value}</span>
      )}
    </div>
  );
}

function TimelineEvent({ event }: { event: any }) {
  return (
    <div className="flex gap-3">
      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
      <div>
        <p className="font-medium">{event.title}</p>
        <p className="text-sm text-gray-600">{event.description}</p>
        <p className="text-xs text-gray-400 mt-1">{new Date(event.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status, className }: { status: string; className?: string }) {
  const colors: Record<string, string> = {
    OPEN: 'bg-red-100 text-red-800',
    UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${colors[status]} ${className}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
