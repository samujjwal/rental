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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import {
  OrganizationsService,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteMemberDto,
} from '../services/organizations.service';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

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
    return this.organizationsService.getUserOrganizations(userId);
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
    return this.organizationsService.updateMemberRole(orgId, userId, memberUserId, role as any);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get organization statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(@Param('id') orgId: string, @CurrentUser('id') userId: string) {
    return this.organizationsService.getOrganizationStats(orgId, userId);
  }
}
