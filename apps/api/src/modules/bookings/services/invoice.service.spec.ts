import { InvoiceService } from './invoice.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: any;
  let configService: any;

  const mockBooking = {
    id: 'booking-abc12345',
    startDate: new Date('2025-01-10'),
    endDate: new Date('2025-01-15'),
    status: 'CONFIRMED',
    totalPrice: 550,
    serviceFee: 50,
    currency: 'NPR',
    listing: {
      title: 'Canon DSLR Camera',
      basePrice: 100,
    },
    renter: {
      id: 'renter-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
    bookingOwner: {
      id: 'owner-1',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
    },
    priceBreakdown: [],
  };

  beforeEach(() => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
      },
    };
    configService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'brand.name') return 'TestBrand';
        return defaultVal;
      }),
    };
    service = new InvoiceService(prisma, configService);
  });

  describe('getInvoiceData', () => {
    it('should throw NotFoundException when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.getInvoiceData('no-such-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not renter or owner', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.getInvoiceData('booking-abc12345', 'stranger-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return invoice data for the renter', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      expect(invoice.invoiceNumber).toMatch(/^INV-[A-Z0-9]+$/);
      expect(invoice.renter.name).toBe('John Doe');
      expect(invoice.renter.email).toBe('john@example.com');
      expect(invoice.owner.name).toBe('Jane Smith');
      expect(invoice.owner.email).toBe('jane@example.com');
      expect(invoice.listing.title).toBe('Canon DSLR Camera');
      expect(invoice.currency).toBe('NPR');
    });

    it('should return invoice data for the owner', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const invoice = await service.getInvoiceData('booking-abc12345', 'owner-1');

      expect(invoice.renter.name).toBe('John Doe');
      expect(invoice.owner.name).toBe('Jane Smith');
    });

    it('should calculate correct line items for a 5-day rental', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      // 5 days: Jan 10 → Jan 15
      const rentalLine = invoice.lineItems.find((item) =>
        item.description.includes('Rental'),
      );
      expect(rentalLine).toBeDefined();
      expect(rentalLine!.quantity).toBe(5);
      expect(rentalLine!.unitPrice).toBe(100);
      expect(rentalLine!.total).toBe(500);
    });

    it('should include service fee as a line item', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      const feeLine = invoice.lineItems.find((item) =>
        item.description.includes('Service Fee'),
      );
      expect(feeLine).toBeDefined();
      expect(feeLine!.total).toBe(50);
    });

    it('should use totalPrice from booking as total', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      expect(invoice.total).toBe(550);
    });

    it('should handle booking with no service fee', async () => {
      const bookingNoFee = {
        ...mockBooking,
        serviceFee: 0,
        totalPrice: 500,
      };
      prisma.booking.findUnique.mockResolvedValue(bookingNoFee);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      // serviceFee is 0, so it falls back to 10% of rental total = 50
      // The code: Number(booking.serviceFee) || Math.round(rentalTotal * 0.1 * 100) / 100
      // 0 is falsy, so it falls through to calculated fee
      expect(invoice.serviceFee).toBe(50);
    });

    it('should handle missing owner names gracefully', async () => {
      const bookingNoOwnerName = {
        ...mockBooking,
        bookingOwner: {
          id: 'owner-1',
          firstName: null,
          lastName: null,
          email: 'owner@example.com',
        },
      };
      prisma.booking.findUnique.mockResolvedValue(bookingNoOwnerName);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      expect(invoice.owner.name).toBe('owner@example.com');
    });
  });

  describe('generateInvoiceHtml', () => {
    it('should generate valid HTML with invoice data', () => {
      const invoiceData = {
        invoiceNumber: 'INV-ABC12345',
        date: '2025-01-15',
        dueDate: '2025-01-10',
        booking: {
          id: 'booking-1',
          startDate: '2025-01-10',
          endDate: '2025-01-15',
          status: 'CONFIRMED',
        },
        listing: { title: 'Canon DSLR Camera', basePrice: 100 },
        renter: { name: 'John Doe', email: 'john@example.com' },
        owner: { name: 'Jane Smith', email: 'jane@example.com' },
        lineItems: [
          { description: 'Canon DSLR Camera — Rental (5 days)', quantity: 5, unitPrice: 100, total: 500 },
          { description: 'Service Fee', quantity: 1, unitPrice: 50, total: 50 },
        ],
        subtotal: 500,
        serviceFee: 50,
        tax: 0,
        total: 550,
        currency: 'NPR',
        brandName: 'TestBrand',
      };

      const html = service.generateInvoiceHtml(invoiceData);

      expect(html).toContain('INV-ABC12345');
      expect(html).toContain('Canon DSLR Camera');
      expect(html).toContain('John Doe');
      expect(html).toContain('Jane Smith');
      expect(html).toContain(`NPR\u00a0550`);
      expect(html).toContain('TestBrand');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should use brandName from config', () => {
      const invoiceData = {
        invoiceNumber: 'INV-1',
        date: '2025-01-15',
        dueDate: '2025-01-10',
        booking: { id: 'b1', startDate: '2025-01-10', endDate: '2025-01-15', status: 'CONFIRMED' },
        listing: { title: 'Test', basePrice: 100 },
        renter: { name: 'R', email: 'r@test.com' },
        owner: { name: 'O', email: 'o@test.com' },
        lineItems: [],
        subtotal: 100,
        serviceFee: 0,
        tax: 0,
        total: 100,
        currency: 'USD',
        brandName: 'TestBrand',
      };

      const html = service.generateInvoiceHtml(invoiceData);
      expect(html).toContain('TestBrand');
      expect(html).not.toContain('GharBatai');
    });
  });

  describe('tax from priceBreakdown', () => {
    it('should compute tax from priceBreakdown items', async () => {
      const bookingWithTax = {
        ...mockBooking,
        priceBreakdown: [
          { type: 'VAT', amount: 65, label: 'Nepal VAT 13%' },
          { type: 'SERVICE_FEE', amount: 50, label: 'Service Fee' },
        ],
      };
      prisma.booking.findUnique.mockResolvedValue(bookingWithTax);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      // Only VAT types should be summed as tax
      expect(invoice.tax).toBe(65);
    });

    it('should sum multiple tax types', async () => {
      const bookingMultiTax = {
        ...mockBooking,
        priceBreakdown: [
          { type: 'GST', amount: 90, label: 'GST' },
          { type: 'SALES_TAX', amount: 40, label: 'Sales Tax' },
        ],
      };
      prisma.booking.findUnique.mockResolvedValue(bookingMultiTax);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      expect(invoice.tax).toBe(130);
    });

    it('should return 0 tax when no tax entries in breakdown', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      expect(invoice.tax).toBe(0);
    });

    it('should include brandName in invoice data', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const invoice = await service.getInvoiceData('booking-abc12345', 'renter-1');

      expect(invoice.brandName).toBe('TestBrand');
    });
  });
});
