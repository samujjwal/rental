import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class BookingRepository {
  private readonly logger = new Logger(BookingRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findBookingsByListing(listingId: string): Promise<any[]> {
    return this.prisma.booking.findMany({
      where: { listingId },
    });
  }

  async findBookingsByPeriod(listingId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return this.prisma.booking.findMany({
      where: {
        listingId,
        startDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }

  async findConfirmedBookings(listingId: string): Promise<any[]> {
    return this.prisma.booking.findMany({
      where: {
        listingId,
        status: 'CONFIRMED',
      },
    });
  }

  async findPendingBookings(listingId: string): Promise<any[]> {
    return this.prisma.booking.findMany({
      where: {
        listingId,
        status: 'PENDING',
      },
    });
  }

  async countBookingsByListing(listingId: string): Promise<number> {
    return this.prisma.booking.count({
      where: { listingId },
    });
  }

  async findById(bookingId: string): Promise<any> {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
  }
}
