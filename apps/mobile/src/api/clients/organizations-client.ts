/**
 * Organizations Client
 * 
 * Handles all organization-related API endpoints:
 * - Organization CRUD
 * - Organization members
 * - Member roles and invitations
 */

import type { Organization, OrganizationMember } from '~/types';
import { BaseClient } from './base-client';

export class OrganizationsClient extends BaseClient {
  /**
   * Get current user's organizations
   */
  async getOrganizations(): Promise<{
    organizations: Organization[];
    total: number;
  }> {
    return this.request<any>('/organizations/my');
  }

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId: string): Promise<Organization> {
    return this.request<Organization>(`/organizations/${organizationId}`);
  }

  /**
   * Create a new organization
   */
  async createOrganization(payload: any): Promise<Organization> {
    return this.request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update an organization
   */
  async updateOrganization(organizationId: string, payload: any): Promise<Organization> {
    return this.request<Organization>(`/organizations/${organizationId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Deactivate an organization
   */
  async deactivateOrganization(organizationId: string): Promise<void> {
    return this.request<void>(`/organizations/${organizationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(organizationId: string): Promise<{
    members: OrganizationMember[];
    total: number;
  }> {
    return this.request<any>(`/organizations/${organizationId}/members`);
  }

  /**
   * Invite a member to organization
   */
  async inviteOrganizationMember(
    organizationId: string,
    payload: { email: string; role: string },
  ): Promise<{ message: string; invitationId: string }> {
    return this.request<any>(`/organizations/${organizationId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update organization member role
   */
  async updateOrganizationMemberRole(
    organizationId: string,
    memberId: string,
    payload: { role: string },
  ): Promise<OrganizationMember> {
    return this.request<OrganizationMember>(
      `/organizations/${organizationId}/members/${memberId}/role`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
  }

  /**
   * Remove organization member
   */
  async removeOrganizationMember(organizationId: string, memberId: string): Promise<void> {
    return this.request<void>(`/organizations/${organizationId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }
}
