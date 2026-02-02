import { api } from "~/lib/api-client";

export type OrganizationStatus = "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER";
export type BusinessType = "INDIVIDUAL" | "LLC" | "CORPORATION" | "PARTNERSHIP";

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  joinedAt?: string;
  createdAt: string;
  updatedAt?: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    profilePhotoUrl: string | null;
    averageRating?: number | null;
  };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl?: string | null;
  website?: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  ownerId?: string | null;
  businessType?: BusinessType | null;
  status: OrganizationStatus;
  verificationStatus?: VerificationStatus;
  createdAt: string;
  updatedAt: string;
  members?: OrganizationMember[];
  properties?: {
    id: string;
    title: string;
    status: string;
    basePrice: number;
    currency: string;
    photos: string[];
  }[];
  _count?: {
    properties: number;
    members: number;
  };
}

export interface CreateOrganizationDto {
  name: string;
  description?: string;
  businessType: BusinessType;
  taxId?: string;
  email: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  description?: string;
  website?: string;
  email?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  settings?: Record<string, unknown>;
}

export interface InviteMemberDto {
  email: string;
  role: OrganizationRole;
}

export interface UpdateMemberRoleDto {
  role: OrganizationRole;
}

export interface OrganizationsResponse {
  organizations: Organization[];
  total: number;
}

export interface MembersResponse {
  members: OrganizationMember[];
  total: number;
}

export const organizationsApi = {
  /**
   * Get all organizations for the current user
   */
  async getMyOrganizations(): Promise<OrganizationsResponse> {
    return api.get<OrganizationsResponse>("/organizations");
  },

  /**
   * Get a specific organization by ID
   */
  async getOrganization(id: string): Promise<Organization> {
    return api.get<Organization>(`/organizations/${id}`);
  },

  /**
   * Create a new organization
   */
  async createOrganization(data: CreateOrganizationDto): Promise<Organization> {
    return api.post<Organization>("/organizations", data);
  },

  /**
   * Update an organization
   */
  async updateOrganization(
    id: string,
    data: UpdateOrganizationDto
  ): Promise<Organization> {
    return api.patch<Organization>(`/organizations/${id}`, data);
  },

  /**
   * Deactivate an organization
   */
  async deactivateOrganization(id: string): Promise<void> {
    return api.delete<void>(`/organizations/${id}`);
  },

  /**
   * Get organization members
   */
  async getMembers(organizationId: string): Promise<MembersResponse> {
    return api.get<MembersResponse>(`/organizations/${organizationId}/members`);
  },

  /**
   * Invite a member to the organization
   */
  async inviteMember(
    organizationId: string,
    data: InviteMemberDto
  ): Promise<{ message: string; invitationId: string }> {
    return api.post<{ message: string; invitationId: string }>(
      `/organizations/${organizationId}/members/invite`,
      data
    );
  },

  /**
   * Update a member's role
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    data: UpdateMemberRoleDto
  ): Promise<OrganizationMember> {
    return api.patch<OrganizationMember>(
      `/organizations/${organizationId}/members/${memberId}`,
      data
    );
  },

  /**
   * Remove a member from the organization
   */
  async removeMember(organizationId: string, memberId: string): Promise<void> {
    return api.delete<void>(
      `/organizations/${organizationId}/members/${memberId}`
    );
  },

  /**
   * Accept an organization invitation
   */
  async acceptInvitation(token: string): Promise<Organization> {
    return api.post<Organization>("/organizations/invitations/accept", { token });
  },

  /**
   * Decline an organization invitation
   */
  async declineInvitation(token: string): Promise<void> {
    return api.post<void>("/organizations/invitations/decline", { token });
  },

  /**
   * Get organization statistics
   */
  async getOrganizationStats(
    organizationId: string
  ): Promise<{
    totalListings: number;
    activeListings: number;
    totalBookings: number;
    totalRevenue: number;
    pendingPayouts: number;
    averageRating: number;
  }> {
    return api.get<{
      totalListings: number;
      activeListings: number;
      totalBookings: number;
      totalRevenue: number;
      pendingPayouts: number;
      averageRating: number;
    }>(`/organizations/${organizationId}/stats`);
  },

  /**
   * Upload organization logo
   */
  async uploadLogo(organizationId: string, file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append("logo", file);
    return api.post<{ url: string }>(
      `/organizations/${organizationId}/logo`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },
};
