/* eslint-disable react-refresh/only-export-components */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator, Link } from "react-router";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { organizationsApi } from "~/lib/api/organizations";
import type { OrganizationMember, OrganizationRole } from "~/lib/api/organizations";

export async function clientLoader({ params }: LoaderFunctionArgs) {
  if (!params.id) {
    throw new Response("Organization not found", { status: 404 });
  }
  const [organization, membersData] = await Promise.all([
    organizationsApi.getOrganization(params.id),
    organizationsApi.getMembers(params.id),
  ]);

  return { 
    organization: {
      ...organization,
      members: membersData.members,
    }
  };
}

export default function OrganizationMembers() {
  const { organization } = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("MEMBER");
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const getUserDisplayName = (member: OrganizationMember) => {
    const lastName = member.user.lastName ? ` ${member.user.lastName}` : "";
    return `${member.user.firstName}${lastName}`;
  };

  const handleInvite = async () => {
    try {
      await organizationsApi.inviteMember(organization.id, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setShowInviteModal(false);
      revalidator.revalidate();
    } catch (error) {
      console.error("Failed to invite member:", error);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: OrganizationRole) => {
    try {
      await organizationsApi.updateMemberRole(organization.id, memberId, { role: newRole });
      setShowRoleModal(false);
      setSelectedMember(null);
      revalidator.revalidate();
    } catch (error) {
      console.error("Failed to update member role:", error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await organizationsApi.removeMember(organization.id, memberId);
      revalidator.revalidate();
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "OWNER":
        return "bg-purple-100 text-purple-800";
      case "ADMIN":
        return "bg-primary/10 text-primary";
      case "MEMBER":
        return "bg-success/10 text-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "OWNER":
        return "Full control including billing and deletion";
      case "ADMIN":
        return "Manage members, listings, and settings";
      case "MEMBER":
        return "Create and manage listings";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              to={`/organizations/${organization.id}`}
              className="text-primary hover:text-primary/80"
            >
              ← Back to Organization
            </Link>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Team Members
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {organization.name} • {organization.members.length} members
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-md shadow-sm hover:bg-primary/90"
            >
              Invite Member
            </button>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-card shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-border">
            {organization.members.map((member: OrganizationMember) => (
              <li key={member.id} className="p-6 hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Avatar */}
                    {member.user.profilePhotoUrl ? (
                      <img
                        src={member.user.profilePhotoUrl}
                        alt={getUserDisplayName(member)}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xl font-medium text-primary">
                          {member.user.firstName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* User Info */}
                    <div>
                      <h3 className="text-lg font-medium text-foreground">
                        {getUserDisplayName(member)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {member.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Joined{" "}
                        {new Date(member.joinedAt || member.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Role & Actions */}
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span
                        className={cn(
                          "px-3 py-1 text-xs font-semibold rounded-full",
                          getRoleBadge(member.role)
                        )}
                      >
                        {member.role}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getRoleDescription(member.role)}
                      </p>
                    </div>

                    {member.role !== "OWNER" && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowRoleModal(true);
                          }}
                          className="px-3 py-1 text-sm text-primary hover:text-primary/80"
                        >
                          Change Role
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="px-3 py-1 text-sm text-destructive hover:text-destructive/80"
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
        <div className="mt-8 bg-primary/5 border border-primary/10 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-primary">
                Role Permissions
              </h3>
              <div className="mt-2 text-sm text-primary/80">
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Owner:</strong> Full control including billing,
                    settings, and deletion
                  </li>
                  <li>
                    <strong>Admin:</strong> Manage members, listings, bookings,
                    and organization settings
                  </li>
                  <li>
                    <strong>Member:</strong> Create and manage their own
                    listings and bookings
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-foreground mb-4">
              Invite Team Member
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as OrganizationRole)
                  }
                  className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
                >
                  <option value="MEMBER">Member - Create listings</option>
                  <option value="ADMIN">Admin - Manage team</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {getRoleDescription(inviteRole)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showRoleModal && selectedMember && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-foreground mb-4">
              Change Role for {getUserDisplayName(selectedMember)}
            </h3>

            <div className="space-y-2">
              {(["ADMIN", "MEMBER"] as OrganizationRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => handleUpdateRole(selectedMember.id, role)}
                  className={cn(
                    "w-full text-left px-4 py-3 border rounded-md hover:bg-muted",
                    selectedMember.role === role
                      ? "border-primary bg-primary/5"
                      : "border-input"
                  )}
                >
                  <div className="font-medium text-foreground">{role}</div>
                  <div className="text-sm text-muted-foreground">
                    {getRoleDescription(role)}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-md hover:bg-muted"
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
