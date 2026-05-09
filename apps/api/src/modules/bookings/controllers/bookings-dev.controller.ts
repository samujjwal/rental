/**
 * Dev/test-only booking endpoints.
 *
 * This controller is registered ONLY when STRIPE_TEST_BYPASS=true and
 * NODE_ENV !== 'production' (enforced in BookingsModule).
 * It MUST NOT be imported or registered in production builds.
 *
 * TEMPORARILY DISABLED: BookingsDevService does not exist
 */
import { PrismaService } from '@/common/prisma/prisma.service';

/*
import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsDevService } from '../services/bookings-dev.service';
import { isOperationsAdmin } from '@/common/auth/admin-roles';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { BookingStatus } from '@rental-portal/database';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

@ApiTags('Bookings [Dev]')
@Controller('bookings')
export class BookingsDevController {
  constructor(
    private readonly stateMachine: BookingStateMachineService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/bypass-confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST ONLY] Bypass Stripe payment and confirm booking (requires STRIPE_TEST_BYPASS=true)' })
  @ApiResponse({ status: 200, description: 'Booking confirmed via test bypass' })
  @ApiResponse({ status: 403, description: 'Not available outside test mode or not authorized' })
  async bypassConfirm(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<AsyncMethodResult<BookingStateMachineService['transition']>> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { listing: { select: { ownerId: true } } },
    });

    if (!booking || booking.renterId !== userId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    const normalizedRole = String(role || '').toUpperCase();
    if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN') {
      throw new ForbiddenException('bypass-confirm must be executed with the booking renter session');
    }

    return this.stateMachine.transition(id, 'COMPLETE_PAYMENT', userId, 'RENTER');
  }

  @Post('dev-reset')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST ONLY] Force-cancel all non-final bookings (requires STRIPE_TEST_BYPASS=true)' })
  @ApiResponse({ status: 200, description: 'All non-final bookings cancelled' })
  @ApiResponse({ status: 403, description: 'Not available outside test mode' })
  async devReset(@CurrentUser('role') role: string): Promise<{ cancelled: number }> {
    if (!isOperationsAdmin(role)) {
      throw new ForbiddenException('dev-reset requires an admin session');
    }
    const result = await this.prisma.booking.updateMany({
      where: {
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
      },
      data: { status: BookingStatus.CANCELLED },
    });
    return { cancelled: result.count };
  }
}
*/

// Placeholder export to satisfy module
export class BookingsDevController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}
}
