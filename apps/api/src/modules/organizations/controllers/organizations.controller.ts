import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { OrganizationsService } from '../services/organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteMemberDto,
} from '../dto/organization.dto';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create organization (for rental businesses)' })
  @ApiResponse({ status: 201, description: 'Organization created' })
  async createOrganization(@CurrentUser('id') userId: string, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.createOrganization(userId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: "Get user's organizations" })
  @ApiResponse({ status: 200, description: 'Organizations retrieved' })
  async getMyOrganizations(@CurrentUser('id') userId: string) {
    const organizations = await this.organizationsService.getUserOrganizations(userId);
    return { organizations, total: organizations.length };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization details' })
  @ApiResponse({ status: 200, description: 'Organization retrieved' })
  async getOrganization(@Param('id') orgId: string, @CurrentUser('id') userId: string) {
    return this.organizationsService.getOrganization(orgId, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  async updateOrganization(
    @Param('id') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(orgId, userId, dto);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Invite member to organization' })
  @ApiResponse({ status: 201, description: 'Member invited' })
  async inviteMember(
    @Param('id') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(orgId, userId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from organization' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  async removeMember(
    @Param('id') orgId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') memberUserId: string,
  ) {
    await this.organizationsService.removeMember(orgId, currentUserId, memberUserId);
  }

  @Put(':id/members/:userId/role')
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({ status: 200, description: 'Member role updated' })
  async updateMemberRole(
    @Param('id') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('userId') memberUserId: string,
    @Body('role') role: string,
  ) {
    const validRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    return this.organizationsService.updateMemberRole(orgId, userId, memberUserId, role as any);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get organization statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(@Param('id') orgId: string, @CurrentUser('id') userId: string) {
    return this.organizationsService.getOrganizationStats(orgId, userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get organization members' })
  @ApiResponse({ status: 200, description: 'Members retrieved' })
  async getMembers(@Param('id') orgId: string, @CurrentUser('id') userId: string) {
    return this.organizationsService.getMembers(orgId, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate (soft-delete) an organization' })
  @ApiResponse({ status: 204, description: 'Organization deactivated' })
  async deactivateOrganization(@Param('id') orgId: string, @CurrentUser('id') userId: string) {
    await this.organizationsService.deactivateOrganization(orgId, userId);
  }

  @Post('invitations/accept')
  @ApiOperation({ summary: 'Accept an organization invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  async acceptInvitation(
    @CurrentUser('id') userId: string,
    @Body() body: { organizationId?: string; token?: string },
  ) {
    const orgId = body.organizationId;
    if (!orgId) {
      throw i18nBadRequest('validation.organizationIdRequired');
    }
    return this.organizationsService.acceptInvitation(userId, orgId);
  }

  @Post('invitations/decline')
  @ApiOperation({ summary: 'Decline an organization invitation' })
  @ApiResponse({ status: 200, description: 'Invitation declined' })
  async declineInvitation(
    @CurrentUser('id') userId: string,
    @Body() body: { organizationId?: string; token?: string },
  ) {
    const orgId = body.organizationId;
    if (!orgId) {
      throw i18nBadRequest('validation.organizationIdRequired');
    }
    return this.organizationsService.declineInvitation(userId, orgId);
  }
}
