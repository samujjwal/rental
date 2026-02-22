import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  listing: {
    title: string;
    basePrice: number;
  };
  renter: {
    name: string;
    email: string;
  };
  owner: {
    name: string;
    email: string;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  serviceFee: number;
  tax: number;
  total: number;
  currency: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate invoice data for a booking.
   */
  async getInvoiceData(bookingId: string, userId: string): Promise<InvoiceData> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: {
          select: {
            title: true,
            basePrice: true,
          },
        },
        renter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        bookingOwner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Only renter and owner can view invoice
    if (booking.renter.id !== userId && booking.bookingOwner?.id !== userId) {
      throw new ForbiddenException('Not authorized to view this invoice');
    }

    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);
    const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const basePrice = Number(booking.listing.basePrice) || 0;
    const rentalTotal = basePrice * days;
    const serviceFee = Number(booking.serviceFee) || Math.round(rentalTotal * 0.1 * 100) / 100;
    const tax = 0; // Tax field not in schema; default to 0
    const total = Number(booking.totalAmount) || rentalTotal + serviceFee + tax;

    const lineItems: InvoiceLineItem[] = [
      {
        description: `${booking.listing.title} — Rental (${days} day${days > 1 ? 's' : ''})`,
        quantity: days,
        unitPrice: basePrice,
        total: rentalTotal,
      },
    ];

    if (serviceFee > 0) {
      lineItems.push({
        description: 'Service Fee',
        quantity: 1,
        unitPrice: serviceFee,
        total: serviceFee,
      });
    }

    if (tax > 0) {
      lineItems.push({
        description: 'Tax',
        quantity: 1,
        unitPrice: tax,
        total: tax,
      });
    }

    return {
      invoiceNumber: `INV-${booking.id.slice(-8).toUpperCase()}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: startDate.toISOString().split('T')[0],
      booking: {
        id: booking.id,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        status: booking.status,
      },
      listing: {
        title: booking.listing.title,
        basePrice,
      },
      renter: {
        name: `${booking.renter.firstName || ''} ${booking.renter.lastName || ''}`.trim() || booking.renter.email,
        email: booking.renter.email,
      },
      owner: {
        name: `${booking.bookingOwner?.firstName || ''} ${booking.bookingOwner?.lastName || ''}`.trim() || booking.bookingOwner?.email || '',
        email: booking.bookingOwner?.email || '',
      },
      lineItems,
      subtotal: rentalTotal,
      serviceFee,
      tax,
      total,
      currency: 'USD',
    };
  }

  /**
   * Generate a simple HTML invoice (can be converted to PDF via puppeteer/wkhtmltopdf).
   */
  generateInvoiceHtml(data: InvoiceData): string {
    const rows = data.lineItems
      .map(
        (item) => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #eee;">${item.description}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${item.quantity}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">$${item.unitPrice.toFixed(2)}</td>
          <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">$${item.total.toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    body { font-family: 'Helvetica Neue', sans-serif; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #4A90D9; }
    .invoice-info { text-align: right; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .party { width: 45%; }
    .party h3 { margin-bottom: 4px; color: #666; font-size: 12px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8f9fa; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; }
    .total-row td { font-weight: bold; font-size: 16px; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">GharBatai</div>
    <div class="invoice-info">
      <h2 style="margin:0;">Invoice ${data.invoiceNumber}</h2>
      <p>Date: ${data.date}</p>
      <p>Booking: ${data.booking.startDate} — ${data.booking.endDate}</p>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h3>Bill To</h3>
      <p><strong>${data.renter.name}</strong></p>
      <p>${data.renter.email}</p>
    </div>
    <div class="party">
      <h3>From</h3>
      <p><strong>${data.owner.name}</strong></p>
      <p>${data.owner.email}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right; padding:12px 8px;">Total (${data.currency})</td>
        <td style="text-align:right; padding:12px 8px;">$${data.total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
  }
}
