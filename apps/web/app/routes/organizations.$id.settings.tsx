import { Form, useLoaderData, useActionData, useParams } from 'react-router';
import { useState } from 'react';
import { cn } from '~/lib/utils';
import type { Route } from './+types/organizations.$id.settings';

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
  address?: string;
  phoneNumber?: string;
  emailAddress?: string;
  settings?: {
    autoApproveMembers: boolean;
    requireInsurance: boolean;
    allowPublicProfile: boolean;
  };
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const response = await fetch(`/api/organizations/${params.id}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch organization');
  }

  const organization = await response.json();
  return { organization };
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const action = formData.get('_action');

  if (action === 'update') {
    const response = await fetch(`/api/organizations/${params.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        name: formData.get('name'),
        description: formData.get('description'),
        website: formData.get('website'),
        address: formData.get('address'),
        phoneNumber: formData.get('phoneNumber'),
        emailAddress: formData.get('emailAddress'),
        settings: {
          autoApproveMembers: formData.get('autoApproveMembers') === 'on',
          requireInsurance: formData.get('requireInsurance') === 'on',
          allowPublicProfile: formData.get('allowPublicProfile') === 'on',
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to update organization' };
    }

    return { success: true, message: 'Organization updated successfully' };
  }

  if (action === 'deactivate') {
    const response = await fetch(`/api/organizations/${params.id}/deactivate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to deactivate organization' };
    }

    return { success: true, message: 'Organization deactivated', redirect: '/organizations' };
  }

  return null;
}

export default function OrganizationSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { organization } = loaderData;
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <a href={`/organizations/${organization.id}`} className="text-primary hover:text-primary/80">
              ← Back to Organization
            </a>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Organization Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">{organization.name}</p>
        </div>

        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 bg-success/10 border border-success/20 text-success px-4 py-3 rounded">
            {actionData.message}
          </div>
        )}
        {actionData?.error && (
          <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-6">
          <input type="hidden" name="_action" value="update" />

          {/* Basic Information */}
          <div className="bg-card shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={organization.name}
                  required
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Slug (URL identifier)
                </label>
                <input
                  type="text"
                  value={organization.slug}
                  disabled
                  className="w-full border border-input rounded-md px-3 py-2 bg-muted text-muted-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug cannot be changed after creation
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Type
                </label>
                <input
                  type="text"
                  value={organization.type}
                  disabled
                  className="w-full border border-input rounded-md px-3 py-2 bg-muted text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={organization.description}
                  placeholder="Tell us about your organization..."
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-card shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Contact Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  defaultValue={organization.website}
                  placeholder="https://example.com"
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  defaultValue={organization.emailAddress}
                  placeholder="contact@example.com"
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  defaultValue={organization.phoneNumber}
                  placeholder="+1 (555) 123-4567"
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Address
                </label>
                <textarea
                  name="address"
                  rows={3}
                  defaultValue={organization.address}
                  placeholder="123 Main St, City, State ZIP"
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Organization Settings */}
          <div className="bg-card shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Organization Settings</h2>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="autoApproveMembers"
                    name="autoApproveMembers"
                    type="checkbox"
                    defaultChecked={organization.settings?.autoApproveMembers}
                    className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="autoApproveMembers" className="font-medium text-foreground">
                    Auto-approve new members
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Automatically approve member join requests without manual review
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="requireInsurance"
                    name="requireInsurance"
                    type="checkbox"
                    defaultChecked={organization.settings?.requireInsurance}
                    className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="requireInsurance" className="font-medium text-foreground">
                    Require insurance for all listings
                  </label>
                  <p className="text-sm text-muted-foreground">
                    All listings from this organization must have valid insurance
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="allowPublicProfile"
                    name="allowPublicProfile"
                    type="checkbox"
                    defaultChecked={organization.settings?.allowPublicProfile}
                    className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="allowPublicProfile" className="font-medium text-foreground">
                    Public profile
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Allow your organization profile to be visible to all users
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className="bg-card shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Verification Status</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>
                <p className="mt-1 text-lg font-medium">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full",
                      organization.verificationStatus === 'VERIFIED'
                        ? "bg-success/10 text-success"
                        : organization.verificationStatus === 'PENDING'
                          ? "bg-warning/10 text-warning"
                          : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {organization.verificationStatus}
                  </span>
                </p>
              </div>
              {organization.verificationStatus === 'PENDING' && (
                <p className="text-sm text-muted-foreground">
                  Your verification request is being reviewed
                </p>
              )}
              {organization.verificationStatus === 'REJECTED' && (
                <button
                  type="button"
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90"
                >
                  Request Verification
                </button>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            >
              Save Changes
            </button>
          </div>
        </Form>

        {/* Danger Zone */}
        <div className="mt-8 bg-card shadow rounded-lg p-6 border-2 border-destructive/20">
          <h2 className="text-lg font-medium text-destructive mb-4">Danger Zone</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Deactivate Organization</p>
              <p className="text-sm text-muted-foreground">
                Deactivating will hide all listings and prevent new bookings
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeactivateModal(true)}
              className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-md hover:bg-destructive/90"
            >
              Deactivate
            </button>
          </div>
        </div>
      </div>

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-foreground mb-4">
              Deactivate Organization?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to deactivate this organization? All listings will be hidden
              and you won't be able to create new bookings. You can reactivate it later.
            </p>
            <Form method="post" className="flex justify-end space-x-3">
              <input type="hidden" name="_action" value="deactivate" />
              <button
                type="button"
                onClick={() => setShowDeactivateModal(false)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90"
              >
                Deactivate
              </button>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
