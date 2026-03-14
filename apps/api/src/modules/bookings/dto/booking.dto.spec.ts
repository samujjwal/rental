import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateBookingDto,
  UpdateBookingDto,
  RejectBookingDto,
  CancelBookingDto,
  InitiateDisputeDto,
  RejectReturnDto,
  CalculatePriceDto,
  DeliveryMethod,
} from './booking.dto';

describe('Booking DTOs', () => {
  describe('CreateBookingDto', () => {
    const validData = {
      listingId: '123e4567-e89b-42d3-a456-426614174000',
      startDate: '2025-03-01T00:00:00Z',
      endDate: '2025-03-05T00:00:00Z',
      deliveryMethod: DeliveryMethod.PICKUP,
    };

    it('passes with valid required fields', async () => {
      const dto = plainToInstance(CreateBookingDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional fields', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        guestCount: 2,
        deliveryAddress: '123 Street',
        specialRequests: 'Early check-in please',
        promoCode: 'SAVE10',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails missing listingId', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        startDate: '2025-03-01T00:00:00Z',
        endDate: '2025-03-05T00:00:00Z',
        deliveryMethod: DeliveryMethod.PICKUP,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingId')).toBe(true);
    });

    it('fails with invalid startDate', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        startDate: 'not-a-date',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'startDate')).toBe(true);
    });

    it('fails with invalid endDate', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        endDate: 'bad',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'endDate')).toBe(true);
    });

    it('fails with guestCount less than 1', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        guestCount: 0,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'guestCount')).toBe(true);
    });

    it('fails with guestCount greater than 100', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        guestCount: 101,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'guestCount')).toBe(true);
    });

    it('fails with invalid deliveryMethod', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        deliveryMethod: 'teleport',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'deliveryMethod')).toBe(true);
    });

    it('accepts all valid delivery methods', async () => {
      for (const method of Object.values(DeliveryMethod)) {
        const dto = plainToInstance(CreateBookingDto, { ...validData, deliveryMethod: method });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('fails with deliveryAddress exceeding 500 chars', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        deliveryAddress: 'A'.repeat(501),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'deliveryAddress')).toBe(true);
    });

    it('fails with specialRequests exceeding 500 chars', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        specialRequests: 'R'.repeat(501),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'specialRequests')).toBe(true);
    });

    it('fails with promoCode exceeding 50 chars', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validData,
        promoCode: 'P'.repeat(51),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'promoCode')).toBe(true);
    });
  });

  describe('UpdateBookingDto', () => {
    it('passes with valid optional fields', async () => {
      const dto = plainToInstance(UpdateBookingDto, {
        startDate: '2025-04-01T00:00:00Z',
        guestCount: 5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with empty object (all fields optional)', async () => {
      const dto = plainToInstance(UpdateBookingDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with invalid date format', async () => {
      const dto = plainToInstance(UpdateBookingDto, { startDate: 'invalid' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'startDate')).toBe(true);
    });

    it('fails with message exceeding 1000 chars', async () => {
      const dto = plainToInstance(UpdateBookingDto, { message: 'M'.repeat(1001) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });
  });

  describe('RejectBookingDto', () => {
    it('passes with reason', async () => {
      const dto = plainToInstance(RejectBookingDto, { reason: 'Not available' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes without reason (optional)', async () => {
      const dto = plainToInstance(RejectBookingDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with reason exceeding 1000 chars', async () => {
      const dto = plainToInstance(RejectBookingDto, { reason: 'R'.repeat(1001) });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CancelBookingDto', () => {
    it('passes with reason', async () => {
      const dto = plainToInstance(CancelBookingDto, { reason: 'Change of plans' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes without reason', async () => {
      const dto = plainToInstance(CancelBookingDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('InitiateDisputeDto', () => {
    it('passes with valid reason', async () => {
      const dto = plainToInstance(InitiateDisputeDto, { reason: 'Item was damaged' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails without reason', async () => {
      const dto = plainToInstance(InitiateDisputeDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });

    it('fails with reason exceeding 2000 chars', async () => {
      const dto = plainToInstance(InitiateDisputeDto, { reason: 'D'.repeat(2001) });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('RejectReturnDto', () => {
    it('passes with valid reason', async () => {
      const dto = plainToInstance(RejectReturnDto, { reason: 'Damage found on item' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails without reason', async () => {
      const dto = plainToInstance(RejectReturnDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });

  describe('CalculatePriceDto', () => {
    it('passes with valid data', async () => {
      const dto = plainToInstance(CalculatePriceDto, {
        listingId: '123e4567-e89b-42d3-a456-426614174001',
        startDate: '2025-03-01T00:00:00Z',
        endDate: '2025-03-05T00:00:00Z',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails missing listingId', async () => {
      const dto = plainToInstance(CalculatePriceDto, {
        startDate: '2025-03-01T00:00:00Z',
        endDate: '2025-03-05T00:00:00Z',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingId')).toBe(true);
    });

    it('fails with invalid dates', async () => {
      const dto = plainToInstance(CalculatePriceDto, {
        listingId: 'abc',
        startDate: 'bad',
        endDate: 'bad',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('DeliveryMethod enum', () => {
    it('has correct values', () => {
      expect(DeliveryMethod.PICKUP).toBe('pickup');
      expect(DeliveryMethod.DELIVERY).toBe('delivery');
      expect(DeliveryMethod.SHIPPING).toBe('shipping');
    });

    it('has exactly 3 values', () => {
      expect(Object.values(DeliveryMethod).length).toBe(3);
    });
  });
});
