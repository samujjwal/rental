import { useLoaderData, Form } from 'react-router';
import { useState } from 'react';

interface InsurancePolicy {
  id: string;
  policyNumber: string;
  provider: string;
  coverageAmount: number;
  effectiveDate: string;
  expirationDate: string;
  documentUrl: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  listing: {
    id: string;
    title: string;
    insuranceRequirement?: {
      minimumCoverage: number;
      policyTypes: string[];
    };
  };
  createdAt: string;
}

interface LoaderData {
  pendingPolicies: InsurancePolicy[];
  expiringPolicies: InsurancePolicy[];
  stats: {
    totalPending: number;
    verifiedToday: number;
    expiringSoon: number;
  };
  activeTab: string;
}

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') || 'pending';

  const [pendingRes, expiringRes, statsRes] = await Promise.all([
    fetch('/api/insurance/policies?status=PENDING', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }),
    fetch('/api/insurance/policies?expiringSoon=true', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }),
    fetch('/api/insurance/stats', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }),
  ]);

  const pendingPolicies = pendingRes.ok ? await pendingRes.json() : [];
  const expiringPolicies = expiringRes.ok ? await expiringRes.json() : [];
  const stats = statsRes.ok ? await statsRes.json() : {
    totalPending: 0,
    verifiedToday: 0,
    expiringSoon: 0,
  };

  return { pendingPolicies, expiringPolicies, stats, activeTab: tab };
}

export default function AdminInsurance({ loaderData }: { loaderData: LoaderData }) {
  const { pendingPolicies, expiringPolicies, stats, activeTab } = loaderData;
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const daysUntilExpiration = (expirationDate: string) => {
    const days = Math.ceil(
      (new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const handleAction = async (policy: InsurancePolicy, action: 'approve' | 'reject') => {
    setSelectedPolicy(policy);
    setActionType(action);
    setShowModal(true);
  };

  const submitAction = async () => {
    if (!selectedPolicy || !actionType) return;

    const notes = (document.getElementById('actionNotes') as HTMLTextAreaElement)?.value;

    const response = await fetch(`/api/insurance/policies/${selectedPolicy.id}/${actionType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ notes }),
    });

    if (response.ok) {
      setShowModal(false);
      window.location.reload();
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Insurance Verification</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review and verify insurance policies for listings
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Pending Review</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalPending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Verified Today</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.verifiedToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Expiring Soon</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.expiringSoon}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <a
                href="?tab=pending"
                className={`px-6 py-3 text-sm font-medium ${activeTab === 'pending'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Pending Review ({pendingPolicies.length})
              </a>
              <a
                href="?tab=expiring"
                className={`px-6 py-3 text-sm font-medium ${activeTab === 'expiring'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Expiring Soon ({expiringPolicies.length})
              </a>
            </nav>
          </div>

          {/* Pending Policies Table */}
          {activeTab === 'pending' && (
            <div className="overflow-x-auto">
              {pendingPolicies.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">All caught up!</h3>
                  <p className="mt-1 text-sm text-gray-500">No pending insurance policies to review.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Policy</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coverage</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(pendingPolicies) ? pendingPolicies.map((policy: InsurancePolicy) => (
                      <tr key={policy.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{policy.policyNumber}</div>
                          <div className="text-sm text-gray-500">{policy.provider}</div>
                          <a
                            href={policy.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-500"
                          >
                            View Document →
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{policy.user.name}</div>
                          <div className="text-sm text-gray-500">{policy.user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{policy.listing.title}</div>
                          {policy.listing.insuranceRequirement && (
                            <div className="text-xs text-gray-500">
                              Min: {formatCurrency(policy.listing.insuranceRequirement.minimumCoverage)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(policy.coverageAmount)}
                          </div>
                          {policy.listing.insuranceRequirement &&
                            policy.coverageAmount < policy.listing.insuranceRequirement.minimumCoverage && (
                              <div className="text-xs text-red-600">Below minimum</div>
                            )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{formatDate(policy.effectiveDate)}</div>
                          <div>to {formatDate(policy.expirationDate)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(policy.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleAction(policy, 'approve')}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(policy, 'reject')}
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    )) : null}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Expiring Policies Table */}
          {activeTab === 'expiring' && (
            <div className="overflow-x-auto">
              {Array.isArray(expiringPolicies) && expiringPolicies.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No expiring policies</h3>
                  <p className="mt-1 text-sm text-gray-500">All policies are up to date.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Policy</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(expiringPolicies) ? expiringPolicies.map((policy: InsurancePolicy) => {
                      const days = daysUntilExpiration(policy.expirationDate);
                      return (
                        <tr key={policy.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{policy.policyNumber}</div>
                            <div className="text-sm text-gray-500">{policy.provider}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{policy.user.name}</div>
                            <div className="text-sm text-gray-500">{policy.user.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{policy.listing.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatDate(policy.expirationDate)}</div>
                            <div
                              className={`text-xs ${days <= 7 ? 'text-red-600' : days <= 14 ? 'text-orange-600' : 'text-yellow-600'
                                }`}
                            >
                              {days} days remaining
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                                policy.status
                              )}`}
                            >
                              {policy.status}
                            </span>
                          </td>
                        </tr>
                      );
                    }) : null}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {showModal && selectedPolicy && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {actionType === 'approve' ? 'Approve Policy' : 'Reject Policy'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Policy: {selectedPolicy.policyNumber} by {selectedPolicy.user.name}
            </p>
            <textarea
              id="actionNotes"
              rows={4}
              placeholder={actionType === 'approve' ? 'Optional notes...' : 'Reason for rejection...'}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            />
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${actionType === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
