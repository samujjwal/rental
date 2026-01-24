import { useLoaderData, Form } from 'react-router';
import { useState } from 'react';
import type { Route } from './+types/organizations.$id.members';

interface Member {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    profileImageUrl?: string;
  };
}

interface Organization {
  id: string;
  name: string;
  members: Member[];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const response = await fetch(`/api/organizations/${params.id}/members`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch members');
  }

  const data = await response.json();
  return { organization: data };
}

export default function OrganizationMembers({ loaderData }: Route.ComponentProps) {
  const { organization } = loaderData;
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const handleInvite = async () => {
    const response = await fetch(`/api/organizations/${organization.id}/members/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    if (response.ok) {
      setShowInviteModal(false);
      setInviteEmail('');
      window.location.reload();
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const response = await fetch(
      `/api/organizations/${organization.id}/members/${memberId}/role`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ role: newRole }),
      }
    );

    if (response.ok) {
      setShowRoleModal(false);
      window.location.reload();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    const response = await fetch(
      `/api/organizations/${organization.id}/members/${memberId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    if (response.ok) {
      window.location.reload();
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800';
      case 'MEMBER':
        return 'bg-green-100 text-green-800';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Full control including billing and deletion';
      case 'ADMIN':
        return 'Manage members, listings, and settings';
      case 'MEMBER':
        return 'Create and manage listings';
      case 'VIEWER':
        return 'View only access';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <a
              href={`/organizations/${organization.id}`}
              className="text-indigo-600 hover:text-indigo-500"
            >
              ← Back to Organization
            </a>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
              <p className="mt-2 text-sm text-gray-600">
                {organization.name} • {organization.members.length} members
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-indigo-700"
            >
              Invite Member
            </button>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {organization.members.map((member: Member) => (
              <li key={member.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Avatar */}
                    {member.user.profileImageUrl ? (
                      <img
                        src={member.user.profileImageUrl}
                        alt={member.user.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-xl font-medium text-indigo-600">
                          {member.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* User Info */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{member.user.name}</h3>
                      <p className="text-sm text-gray-500">{member.user.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Joined{' '}
                        {new Date(member.joinedAt).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Role & Actions */}
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadge(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {getRoleDescription(member.role)}
                      </p>
                    </div>

                    {member.role !== 'OWNER' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowRoleModal(true);
                          }}
                          className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-500"
                        >
                          Change Role
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

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
              <h3 className="text-sm font-medium text-blue-800">Role Permissions</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Owner:</strong> Full control including billing, settings, and deletion</li>
                  <li><strong>Admin:</strong> Manage members, listings, bookings, and organization settings</li>
                  <li><strong>Member:</strong> Create and manage their own listings and bookings</li>
                  <li><strong>Viewer:</strong> Read-only access to organization data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Team Member</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="VIEWER">Viewer - Read only</option>
                  <option value="MEMBER">Member - Create listings</option>
                  <option value="ADMIN">Admin - Manage team</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {getRoleDescription(inviteRole)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showRoleModal && selectedMember && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Change Role for {selectedMember.user.name}
            </h3>
            
            <div className="space-y-2">
              {['ADMIN', 'MEMBER', 'VIEWER'].map((role) => (
                <button
                  key={role}
                  onClick={() => handleChangeRole(selectedMember.id, role)}
                  className={`w-full text-left px-4 py-3 border rounded-md hover:bg-gray-50 ${
                    selectedMember.role === role ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{role}</div>
                  <div className="text-sm text-gray-500">{getRoleDescription(role)}</div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
