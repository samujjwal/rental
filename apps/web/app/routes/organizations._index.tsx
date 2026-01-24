import { useLoaderData, Link } from 'react-router';
import type { Route } from './+types/organizations._index';

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'BUSINESS' | 'NONPROFIT' | 'GOVERNMENT' | 'EDUCATIONAL';
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  isActive: boolean;
  description?: string;
  logoUrl?: string;
  website?: string;
  taxId?: string;
  createdAt: string;
  _count: {
    members: number;
    listings: number;
  };
}

export async function clientLoader() {
  const response = await fetch('/api/organizations', {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch organizations');
  }

  const organizations = await response.json();
  return { organizations };
}

export default function OrganizationsIndex({ loaderData }: Route.ComponentProps) {
  const { organizations } = loaderData;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUSINESS':
        return '🏢';
      case 'NONPROFIT':
        return '💚';
      case 'GOVERNMENT':
        return '🏛️';
      case 'EDUCATIONAL':
        return '🎓';
      default:
        return '🏢';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Organizations</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage your organization accounts and team members
            </p>
          </div>
          <Link
            to="/organizations/create"
            className="px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-indigo-700"
          >
            Create Organization
          </Link>
        </div>

        {/* Organizations Grid */}
        {organizations.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No organizations yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Create an organization to start managing listings as a team
            </p>
            <Link
              to="/organizations/create"
              className="mt-6 inline-block px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-indigo-700"
            >
              Create Your First Organization
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org: Organization) => (
              <div
                key={org.id}
                className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  {/* Logo/Icon */}
                  <div className="flex items-center mb-4">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 bg-indigo-100 rounded flex items-center justify-center text-2xl">
                        {getTypeIcon(org.type)}
                      </div>
                    )}
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                      <p className="text-sm text-gray-500">@{org.slug}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {org.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {org.description}
                    </p>
                  )}

                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                        org.verificationStatus
                      )}`}
                    >
                      {org.verificationStatus}
                    </span>
                    {!org.isActive && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-2xl font-bold text-gray-900">{org._count.members}</p>
                      <p className="text-xs text-gray-500">Members</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-2xl font-bold text-gray-900">{org._count.listings}</p>
                      <p className="text-xs text-gray-500">Listings</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <Link
                      to={`/organizations/${org.id}`}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md text-center hover:bg-indigo-700"
                    >
                      Manage
                    </Link>
                    <Link
                      to={`/organizations/${org.id}/listings`}
                      className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md text-center hover:bg-gray-50"
                    >
                      Listings
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">About Organizations</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Organizations allow you to collaborate with team members</li>
                  <li>Verified organizations get a badge and enhanced visibility</li>
                  <li>Members can have different roles (Owner, Admin, Member, Viewer)</li>
                  <li>All organization listings are managed centrally</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
