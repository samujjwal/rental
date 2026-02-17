// ============================================================================
// Organization Types
// Shared contract for organization data between frontend and backend
// ============================================================================

import { OrganizationRole, OrganizationStatus } from './enums';

/** Create organization input */
export interface CreateOrganizationInput {
  name: string;
  businessType?: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

/** Update organization input */
export interface UpdateOrganizationInput extends Partial<CreateOrganizationInput> {}

/** Invite member input */
export interface InviteMemberInput {
  email: string;
  role: OrganizationRole | string;
}

/** Organization summary */
export interface OrganizationSummary {
  id: string;
  name: string;
  status: OrganizationStatus | string;
  memberCount: number;
  listingCount: number;
  createdAt: string;
}

/** Organization detail */
export interface OrganizationDetail extends OrganizationSummary {
  businessType?: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  updatedAt: string;
}

/** Organization member */
export interface OrganizationMemberInfo {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: OrganizationRole | string;
  joinedAt: string;
}
