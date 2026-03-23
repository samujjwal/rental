import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Service layer for payment-related database operations.
 * Replaces direct Prisma access that was previously in PaymentsController.
 * 
 * All DB queries needed by the payments controller flow through this service,
 * keeping the controller thin and testable.
 */
@Injectable()
export class PaymentDataService {
  private readonly logger = new Logger(PaymentDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserStripeConnectId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectId: true },
    });
    return user?.stripeConnectId ?? null;
  }

  async getUserStripeCustomerId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    return user?.stripeCustomerId ?? null;
  }

  async getBookingForPayment(bookingId: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { renter: true },
    });
    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }
    return booking;
  }

  async getBookingMinimal(bookingId: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }
    return booking;
  }

  async updateBookingPaymentIntent(bookingId: string, paymentIntentId: string, tx?: any): Promise<any> {
    const client = tx || this.prisma;
    return client.booking.update({
      where: { id: bookingId },
      data: { paymentIntentId },
    });
  }

  async createPaymentRecord(data: {
    bookingId: string;
    amount: any;
    currency: string;
    status: string;
    paymentIntentId: string;
    stripePaymentIntentId: string;
    metadata?: Record<string, unknown> | null;
  }, tx?: any): Promise<any> {
    const client = tx || this.prisma;
    return client.payment.upsert({
      where: { paymentIntentId: data.paymentIntentId },
      create: {
        bookingId: data.bookingId,
        amount: data.amount,
        currency: data.currency,
        status: data.status as any,
        paymentIntentId: data.paymentIntentId,
        stripePaymentIntentId: data.stripePaymentIntentId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
      update: {
        bookingId: data.bookingId,
        amount: data.amount,
        currency: data.currency,
        status: data.status as any,
        stripePaymentIntentId: data.stripePaymentIntentId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        failureReason: null,
        processedAt: null,
      },
    });
  }

  async getDepositHold(depositId: string): Promise<any> {
    const deposit = await this.prisma.depositHold.findUnique({
      where: { id: depositId },
    });
    if (!deposit) {
      throw i18nNotFound('payment.depositNotFound');
    }
    return deposit;
  }

  async getDepositWithBooking(depositId: string): Promise<any> {
    const deposit = await this.prisma.depositHold.findUnique({
      where: { id: depositId },
    });

    if (!deposit || !deposit.bookingId) {
      throw i18nNotFound('payment.depositNotFound');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: deposit.bookingId },
    });

    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }

    return { deposit, booking };
  }

  async getLatestPaymentForBooking(bookingId: string): Promise<any> {
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      include: { booking: { select: { renterId: true } } },
    });
    return payment;
  }
}
