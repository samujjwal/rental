import { useLoaderData, Link, Form } from 'react-router';
import { useState } from 'react';
import type { Route } from './+types/admin.moderation';

interface QueueItem {
  id: string;
  entityType: string;
  entityId: string;
  flags: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confidence: number;
    description: string;
  }>;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string;
  createdAt: string;
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'PENDING';
  const priority = url.searchParams.get('priority') || '';

  const response = await fetch(
    `/api/moderation/queue?status=${status}&priority=${priority}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to fetch moderation queue');
  }

  const queue = await response.json();

  return { queue, filters: { status, priority } };
}

export default function ModerationQueue({ loaderData }: Route.ComponentProps) {
  const { queue, filters } = loaderData;
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async (itemId: string, action: 'approve' | 'reject', notes?: string) => {
    setSubmitting(true);

    try {
      const response = await fetch(`/api/moderation/queue/${itemId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          entityType: selectedItem?.entityType,
          notes: action === 'approve' ? notes : undefined,
          reason: action === 'reject' ? notes : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} content`);
      }

      // Refresh page
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Content Moderation Queue</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review flagged content and approve or reject items
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('status', e.target.value);
                  window.location.href = url.toString();
                }}
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('priority', e.target.value);
                  window.location.href = url.toString();
                }}
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="">All Priorities</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Pending</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {queue.filter((item: QueueItem) => item.status === 'PENDING').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">High Priority</div>
            <div className="mt-2 text-3xl font-bold text-red-600">
              {queue.filter((item: QueueItem) => item.priority === 'HIGH' && item.status === 'PENDING').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Critical Flags</div>
            <div className="mt-2 text-3xl font-bold text-orange-600">
              {queue.filter((item: QueueItem) => 
                item.flags.some(f => f.severity === 'CRITICAL')
              ).length}
            </div>
          </div>
        </div>

        {/* Queue Items */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {queue.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No items in queue</h3>
                <p className="mt-1 text-sm text-gray-500">All content has been reviewed</p>
              </div>
            ) : (
              queue.map((item: QueueItem) => (
                <div key={item.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-900">
                          {item.entityType}
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getPriorityColor(item.priority)}`}>
                          {item.priority} Priority
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {item.flags.map((flag, idx) => (
                          <div key={idx} className="flex items-start space-x-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(flag.severity)}`}>
                              {flag.type}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm text-gray-700">{flag.description}</p>
                              <p className="text-xs text-gray-500">
                                Confidence: {(flag.confidence * 100).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center space-x-2 text-sm">
                        <Link
                          to={`/admin/${item.entityType.toLowerCase()}/${item.entityId}`}
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          View Content →
                        </Link>
                      </div>
                    </div>

                    {item.status === 'PENDING' && (
                      <div className="ml-6 flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const notes = window.prompt('Add notes (optional):');
                            handleAction(item.entityId, 'approve', notes || undefined);
                          }}
                          disabled={submitting}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt('Rejection reason (required):');
                            if (reason) {
                              handleAction(item.entityId, 'reject', reason);
                            }
                          }}
                          disabled={submitting}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
