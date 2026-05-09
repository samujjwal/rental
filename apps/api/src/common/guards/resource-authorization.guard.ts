import { CanActivate, ExecutionContext, Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import { ALL_ADMIN_ROLES } from '@/common/auth/admin-roles';

/**
 * Resource Authorization Guard
 * 
 * Protects resources based on ownership or admin role.
 * 
 * Usage:
 * @UseGuards(ResourceAuthGuard)
 * 
 * The guard checks:
 * - User has admin role (ADMIN, SUPER_ADMIN, OPERATIONS_ADMIN, SUPPORT_ADMIN)
 * - User is the resource owner (ownerId matches user.id)
 * - User is an organization member with appropriate permissions
 */
@Injectable()
export class ResourceAuthGuard implements CanActivate {
  private readonly logger = new Logger(ResourceAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('Resource authorization guard: No user found in request');
      return false;
    }

    // Admin bypass: Allow all admin roles to access any resource
    if (ALL_ADMIN_ROLES.includes(user.role as string)) {
      return true;
    }

    // Get resource authorization metadata
    const resourceConfig = this.reflector.get<{
      resource: string;
      ownerField?: string;
      relationField?: string;
      customCheck?: (user: any, resource: any) => boolean;
    }>('resourceAuthorization', context.getHandler());

    if (!resourceConfig) {
      // No resource authorization required for this endpoint
      return true;
    }

    const { resource, ownerField = 'ownerId', relationField, customCheck } = resourceConfig;
    const resourceId = request.params.id || request.params[`${resource}Id`];

    if (!resourceId) {
      throw new ForbiddenException('Resource ID required for authorization check');
    }

    // Fetch the resource
    const dbResource = await this.fetchResource(resource, resourceId);

    if (!dbResource) {
      throw new ForbiddenException('Resource not found');
    }

    // Check custom authorization logic if provided
    if (customCheck) {
      if (!customCheck(user, dbResource)) {
        throw i18nForbidden('common.notAuthorized');
      }
      return true;
    }

    // Check ownership
    const ownerId = dbResource[ownerField];
    const renterId = dbResource.renterId;
    const isOwner = ownerId === user.id;
    const isRenter = renterId === user.id;

    // Check organization membership if relationField is specified
    if (relationField && !isOwner) {
      const relation = dbResource[relationField];
      if (Array.isArray(relation)) {
        const isMember = relation.some((member: any) => 
          member.userId === user.id || member.id === user.id
        );
        if (isMember) {
          return true;
        }
      }
    }

    // Check if user is owner or renter
    if (isOwner || isRenter) {
      return true;
    }

    throw i18nForbidden('common.notAuthorized');
  }

  private async fetchResource(resource: string, resourceId: string): Promise<any> {
    switch (resource) {
      case 'listing':
        return this.prisma.listing.findUnique({
          where: { id: resourceId },
          include: { organization: { include: { members: true } } },
        });
      case 'booking':
        return this.prisma.booking.findUnique({
          where: { id: resourceId },
          include: { listing: true },
        });
      case 'organization':
        return this.prisma.organization.findUnique({
          where: { id: resourceId },
          include: { members: true },
        });
      case 'dispute':
        return this.prisma.dispute.findUnique({
          where: { id: resourceId },
          include: { booking: { include: { listing: true } } },
        });
      case 'review':
        return this.prisma.review.findUnique({
          where: { id: resourceId },
          include: { booking: { include: { listing: true } } },
        });
      case 'message':
        return this.prisma.message.findUnique({
          where: { id: resourceId },
          include: { conversation: true },
        });
      case 'payout':
        return this.prisma.payout.findUnique({
          where: { id: resourceId },
        });
      case 'refund':
        return this.prisma.refund.findUnique({
          where: { id: resourceId },
          include: { booking: { include: { listing: true } } },
        });
      case 'conditionReport':
        return this.prisma.conditionReport.findUnique({
          where: { id: resourceId },
          include: { booking: { include: { listing: true } } },
        });
      default:
        return null;
    }
  }
}

/**
 * Decorator to specify resource authorization requirements
 */
export const ResourceOwner = (resource: string, ownerField?: string, relationField?: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('resourceAuthorization', {
      resource,
      ownerField,
      relationField,
    }, descriptor.value);
    return descriptor;
  };
};

/**
 * Decorator for custom resource authorization logic
 */
export const CustomResourceAuth = (customCheck: (user: any, resource: any) => boolean) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('resourceAuthorization', {
      customCheck,
    }, descriptor.value);
    return descriptor;
  };
};
