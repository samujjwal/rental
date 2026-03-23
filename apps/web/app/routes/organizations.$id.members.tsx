
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useRevalidator, Link, redirect } from "react-router";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { PageSkeleton } from "~/components/ui";
import { RouteErrorBoundary } from "~/components/ui/error-state";
import { Dialog, DialogFooter, UnifiedButton } from "~/components/ui";
import { organizationsApi } from "~/lib/api/organizations";
import type { OrganizationMember, OrganizationRole } from "~/lib/api/organizations";
import { getUser } from "~/utils/auth";
import { APP_LOCALE } from "~/config/locale";
import { useTranslation } from "react-i18next";
import { isAppEntityId } from "~/utils/entity-id";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const ErrorBoundary = RouteErrorBoundary;

export const meta: MetaFunction = () => [
  { title: "Members | Organization | GharBatai Rentals" },
];

const mutableRoles: OrganizationRole[] = ["ADMIN", "MEMBER"];
const safeMemberJoinDate = (value: unknown): string => {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleDateString(APP_LOCALE, {
    month: "long",
    year: "numeric",
  });
};
const safeInitial = (value: unknown): string => {
  const name = typeof value === "string" ? value.trim() : "";
  return (name.charAt(0) || "U").toUpperCase();
};

export function getOrganizationMembersLoadError(error: unknown): string {
  return getActionableErrorMessage(
    error,
    "Failed to load organization members. Please try again.",
    {
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
      [ApiErrorType.TIMEOUT_ERROR]: "Loading members timed out. Try again.",
      [ApiErrorType.NETWORK_ERROR]: "We could not reach the organization service. Try again in a moment.",
    }
  );
}

export function getOrganizationMembersMutationError(
  error: unknown,
  fallbackMessage: string
): string {
  const responseMessage =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? (error as { response: { data: { message: string } } }).response.data.message
      : null;

  return (
    responseMessage ||
    getActionableErrorMessage(error, fallbackMessage, {
      [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
      [ApiErrorType.TIMEOUT_ERROR]: "This request timed out. Try again.",
      [ApiErrorType.CONFLICT]: "This organization changed while you were working. Refresh and try again.",
    })
  );
}

export async function clientLoader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }

  if (!isAppEntityId(params.id)) {
    return redirect("/organizations");
  }
  try {
    if (user.role !== "admin") {
      const { organizations } = await organizationsApi.getMyOrganizations();
      const hasAccess = organizations.some((org) => org.id === params.id);
      if (!hasAccess) {
        return redirect("/organizations");
      }
    }

    const [organization, membersData] = await Promise.all([
      organizationsApi.getOrganization(params.id),
      organizationsApi.getMembers(params.id),
    ]);
    const currentMembership = membersData.members.find(
      (member) => member.userId === user.id
    );
    const canManageMembers =
      user.role === "admin" ||
      currentMembership?.role === "OWNER" ||
      currentMembership?.role === "ADMIN";

    return {
      organization: {
        ...organization,
        members: membersData.members,
      },
      canManageMembers,
      currentUserId: user.id,
      error: null,
    };
  } catch (error) {
    return {
      organization: null,
      canManageMembers: false,
      currentUserId: user.id,
      error: getOrganizationMembersLoadError(error),
    };
  }
}

export default function OrganizationMembers() {
  const { organization, canManageMembers, currentUserId, error: loadError } = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();

  if (!organization) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Link to="/organizations" className="text-primary hover:text-primary/80">
              ← Back to organizations
            </Link>
          </div>
          <div className="bg-card rounded-lg shadow-md p-8 border border-border">
            <h1 className="text-2xl font-bold text-foreground mb-3">Members unavailable</h1>
            <p className="text-muted-foreground mb-6">
              {loadError ?? "Failed to load organization members. Please try again."}
            </p>
            <div className="flex flex-wrap gap-3">
              <UnifiedButton onClick={() => revalidator.revalidate()}>Retry</UnifiedButton>
              <Link
                to="/organizations"
                className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-input text-foreground hover:bg-accent transition-colors"
              >
                Back to organizations
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("MEMBER");
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removalConfirmation, setRemovalConfirmation] = useState("");
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"invite" | "role" | "remove" | null>(null);
  const { t } = useTranslation();

  const isInviteSubmitting = pendingAction === "invite";
  const isRoleSubmitting = pendingAction === "role";
  const isRemoveSubmitting = pendingAction === "remove";

  const getUserDisplayName = (member: OrganizationMember) => {
    const lastName = member.user.lastName ? ` ${member.user.lastName}` : "";
    return `${member.user.firstName}${lastName}`;
  };

  const handleInvite = async () => {
    if (!canManageMembers) {
      setErrorMessage("Only organization owners or admins can invite members.");
      return;
    }
    try {
      const email = inviteEmail.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrorMessage("Please enter a valid email address.");
        return;
      }
      if (email.length > 320) {
        setErrorMessage("Email address is too long.");
        return;
      }
      setErrorMessage(null);
      setPendingAction("invite");
      await organizationsApi.inviteMember(organization.id, {
        email: email.toLowerCase(),
        role: inviteRole,
      });
      setInviteEmail("");
      setShowInviteModal(false);
      revalidator.revalidate();
    } catch (error) {
      setErrorMessage(
        getOrganizationMembersMutationError(error, "Unable to send invite. Please try again.")
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleUpdateRole = async (memberUserId: string, newRole: OrganizationRole) => {
    if (!canManageMembers) {
      setErrorMessage("Only organization owners or admins can change member roles.");
      return;
    }
    if (memberUserId === currentUserId) {
      setErrorMessage("You cannot change your own organization role.");
      return;
    }
    if (!mutableRoles.includes(newRole)) {
      setErrorMessage("Invalid role selected.");
      return;
    }
    if (!isAppEntityId(memberUserId)) {
      setErrorMessage("Invalid member selected.");
      return;
    }
    if (selectedMember?.role === newRole) {
      setErrorMessage("Member already has this role.");
      return;
    }
    try {
      setErrorMessage(null);
      setPendingAction("role");
      await organizationsApi.updateMemberRole(organization.id, memberUserId, { role: newRole });
      setShowRoleModal(false);
      setSelectedMember(null);
      revalidator.revalidate();
    } catch (error) {
      setErrorMessage(
        getOrganizationMembersMutationError(error, "Unable to update role. Please try again.")
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!canManageMembers) {
      setErrorMessage("Only organization owners or admins can remove members.");
      return;
    }
    if (memberUserId === currentUserId) {
      setErrorMessage("You cannot remove yourself from this page.");
      return;
    }
    if (!isAppEntityId(memberUserId)) {
      setErrorMessage("Invalid member selected.");
      return;
    }
    if (removalConfirmation.trim().toUpperCase() !== "REMOVE") {
      setErrorMessage('Type "REMOVE" to confirm member removal.');
      return;
    }
    try {
      setErrorMessage(null);
      setPendingAction("remove");
      await organizationsApi.removeMember(organization.id, memberUserId);
      setRemovalConfirmation("");
      setShowRemoveModal(false);
      setSelectedMember(null);
      revalidator.revalidate();
    } catch (error) {
      setErrorMessage(
        getOrganizationMembersMutationError(error, "Unable to remove member. Please try again.")
      );
    } finally {
      setPendingAction(null);
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
              to="/organizations"
              className="text-primary hover:text-primary/80"
            >
              ← {t("organizations.backToOrgs")}
            </Link>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("organizations.teamMembers")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {organization.name} • {organization.members.length} {t("organizations.members").toLowerCase()}
              </p>
            </div>
            {canManageMembers ? (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-md shadow-sm hover:bg-primary/90"
              >
                {t("organizations.inviteMember")}
              </button>
            ) : null}
          </div>
        </div>

        {/* Members List */}
        <div className="bg-card shadow rounded-lg overflow-hidden">
          {errorMessage ? (
            <div className="px-6 py-3 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">
              {errorMessage}
            </div>
          ) : null}
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
                          {safeInitial(member.user.firstName)}
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
                        {t("organizations.joined")}{" "}
                        {safeMemberJoinDate(member.joinedAt || member.createdAt)}
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

                    {canManageMembers &&
                      member.role !== "OWNER" &&
                      member.userId !== currentUserId && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowRoleModal(true);
                            setRemovalConfirmation("");
                          }}
                          className="px-3 py-1 text-sm text-primary hover:text-primary/80"
                        >
                          {t("organizations.changeRole")}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowRemoveModal(true);
                            setRemovalConfirmation("");
                          }}
                          className="px-3 py-1 text-sm text-destructive hover:text-destructive/80"
                        >
                          {t("organizations.remove")}
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
                {t("organizations.rolePermissions")}
              </h3>
              <div className="mt-2 text-sm text-primary/80">
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>{t("organizations.owner")}:</strong> {t("organizations.ownerDesc")}
                  </li>
                  <li>
                    <strong>{t("organizations.admin")}:</strong> {t("organizations.adminDesc")}
                  </li>
                  <li>
                    <strong>{t("organizations.member")}:</strong> {t("organizations.memberDesc")}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <Dialog
        open={showInviteModal}
        onClose={() => {
          if (!isInviteSubmitting) {
            setShowInviteModal(false);
          }
        }}
        title={t("organizations.inviteTeamMember")}
        size="md"
      >
        <div className="space-y-4">
          {showInviteModal && errorMessage ? (
            <div
              id="invite-member-error"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}

          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-foreground mb-1">
              {t("organizations.emailAddress")}
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              maxLength={320}
              aria-invalid={showInviteModal && !!errorMessage}
              aria-describedby={showInviteModal && errorMessage ? "invite-member-error" : undefined}
              className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-foreground mb-1">
              {t("organizations.role")}
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as OrganizationRole)
              }
              aria-describedby="invite-role-description"
              className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
            >
              <option value="MEMBER">{t("organizations.memberCreateListings")}</option>
              <option value="ADMIN">{t("organizations.adminManageTeam")}</option>
            </select>
            <p id="invite-role-description" className="mt-1 text-xs text-muted-foreground">
              {getRoleDescription(inviteRole)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <UnifiedButton
            type="button"
            variant="outline"
            onClick={() => setShowInviteModal(false)}
            disabled={isInviteSubmitting}
          >
            {t("common.cancel")}
          </UnifiedButton>
          <UnifiedButton
            type="button"
            onClick={handleInvite}
            loading={isInviteSubmitting}
            disabled={!inviteEmail.trim() || isInviteSubmitting}
          >
            {t("organizations.sendInvite")}
          </UnifiedButton>
        </DialogFooter>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog
        open={showRoleModal && !!selectedMember}
        onClose={() => {
          if (!isRoleSubmitting) {
            setShowRoleModal(false);
            setSelectedMember(null);
          }
        }}
        title={
          selectedMember
            ? t("organizations.changeRoleFor", { name: getUserDisplayName(selectedMember) })
            : t("organizations.changeRole")
        }
        size="md"
      >
        {showRoleModal && errorMessage ? (
          <div
            id="change-role-error"
            className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-2">
          {selectedMember
            ? mutableRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleUpdateRole(selectedMember.userId, role)}
                  disabled={isRoleSubmitting}
                  aria-describedby={showRoleModal && errorMessage ? "change-role-error" : undefined}
                  className={cn(
                    "w-full text-left px-4 py-3 border rounded-md hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
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
              ))
            : null}
        </div>

        <DialogFooter>
          <UnifiedButton
            type="button"
            variant="outline"
            onClick={() => {
              setShowRoleModal(false);
              setSelectedMember(null);
            }}
            disabled={isRoleSubmitting}
          >
            {t("common.cancel")}
          </UnifiedButton>
        </DialogFooter>
      </Dialog>

      {/* Remove Member Modal */}
      <Dialog
        open={showRemoveModal && !!selectedMember}
        onClose={() => {
          if (!isRemoveSubmitting) {
            setShowRemoveModal(false);
            setSelectedMember(null);
            setRemovalConfirmation("");
          }
        }}
        title={
          selectedMember
            ? t("organizations.removeConfirmTitle", { name: getUserDisplayName(selectedMember) })
            : t("organizations.removeMember")
        }
        description={t("organizations.removeAccessDesc")}
        size="md"
      >
        {showRemoveModal && errorMessage ? (
          <div
            id="remove-member-error"
            className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}

        <label htmlFor="remove-member-confirmation" className="block text-sm font-medium text-foreground mb-2">
          {t("organizations.typeRemove")}
        </label>
        <input
          id="remove-member-confirmation"
          type="text"
          value={removalConfirmation}
          onChange={(e) => setRemovalConfirmation(e.target.value)}
          placeholder={t("organizations.typeRemove")}
          maxLength={16}
          aria-invalid={showRemoveModal && !!errorMessage}
          aria-describedby={showRemoveModal && errorMessage ? "remove-member-error" : undefined}
          className="w-full border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-ring focus:border-primary"
        />

        <DialogFooter>
          <UnifiedButton
            type="button"
            variant="outline"
            onClick={() => {
              setShowRemoveModal(false);
              setSelectedMember(null);
              setRemovalConfirmation("");
            }}
            disabled={isRemoveSubmitting}
          >
            {t("common.cancel")}
          </UnifiedButton>
          <UnifiedButton
            type="button"
            variant="destructive"
            onClick={() => selectedMember && handleRemoveMember(selectedMember.userId)}
            loading={isRemoveSubmitting}
            disabled={removalConfirmation.trim().toUpperCase() !== "REMOVE" || isRemoveSubmitting}
          >
            {t("organizations.removeMember")}
          </UnifiedButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
