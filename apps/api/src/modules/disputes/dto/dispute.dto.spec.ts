import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateDisputeDto,
  UpdateDisputeDto,
  AddEvidenceDto,
  AddResponseDto,
  CloseDisputeDto,
  DisputeType,
} from './dispute.dto';

describe('Dispute DTOs', () => {
  describe('DisputeType enum', () => {
    it('has all expected values', () => {
      expect(Object.values(DisputeType)).toEqual([
        'PROPERTY_DAMAGE',
        'MISSING_ITEMS',
        'CONDITION_MISMATCH',
        'REFUND_REQUEST',
        'PAYMENT_ISSUE',
        'OTHER',
      ]);
    });
  });

  describe('CreateDisputeDto', () => {
    const validData = {
      bookingId: 'booking-1',
      title: 'Damaged item',
      type: DisputeType.PROPERTY_DAMAGE,
      description: 'The chair was broken',
    };

    it('passes with valid required fields', async () => {
      const dto = plainToInstance(CreateDisputeDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional evidence and amount', async () => {
      const dto = plainToInstance(CreateDisputeDto, {
        ...validData,
        evidence: ['https://img.com/photo1.jpg'],
        amount: 500,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails missing bookingId', async () => {
      const { bookingId, ...rest } = validData;
      const dto = plainToInstance(CreateDisputeDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'bookingId')).toBe(true);
    });

    it('fails with invalid type', async () => {
      const dto = plainToInstance(CreateDisputeDto, { ...validData, type: 'INVALID' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('fails with title exceeding 200 chars', async () => {
      const dto = plainToInstance(CreateDisputeDto, {
        ...validData,
        title: 'T'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('fails with description exceeding 5000 chars', async () => {
      const dto = plainToInstance(CreateDisputeDto, {
        ...validData,
        description: 'D'.repeat(5001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails with negative amount', async () => {
      const dto = plainToInstance(CreateDisputeDto, { ...validData, amount: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('accepts all dispute types', async () => {
      for (const type of Object.values(DisputeType)) {
        const dto = plainToInstance(CreateDisputeDto, { ...validData, type });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('UpdateDisputeDto', () => {
    it('passes with empty object', async () => {
      const dto = plainToInstance(UpdateDisputeDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with resolution and amount', async () => {
      const dto = plainToInstance(UpdateDisputeDto, {
        resolution: 'Refund issued',
        resolvedAmount: 100,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with negative resolvedAmount', async () => {
      const dto = plainToInstance(UpdateDisputeDto, { resolvedAmount: -5 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'resolvedAmount')).toBe(true);
    });

    it('fails with adminNotes exceeding 2000 chars', async () => {
      const dto = plainToInstance(UpdateDisputeDto, { adminNotes: 'N'.repeat(2001) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'adminNotes')).toBe(true);
    });
  });

  describe('AddEvidenceDto', () => {
    it('passes with valid data', async () => {
      const dto = plainToInstance(AddEvidenceDto, {
        description: 'Photo of damage',
        files: ['https://img.com/photo.jpg'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails missing description', async () => {
      const dto = plainToInstance(AddEvidenceDto, { files: ['url'] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails missing files', async () => {
      const dto = plainToInstance(AddEvidenceDto, { description: 'desc' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'files')).toBe(true);
    });

    it('fails with description exceeding 1000 chars', async () => {
      const dto = plainToInstance(AddEvidenceDto, {
        description: 'X'.repeat(1001),
        files: ['url'],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });
  });

  describe('AddResponseDto', () => {
    it('passes with valid message', async () => {
      const dto = plainToInstance(AddResponseDto, { message: 'I disagree' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional evidence', async () => {
      const dto = plainToInstance(AddResponseDto, {
        message: 'Here is proof',
        evidence: ['https://url.com/photo.jpg'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails missing message', async () => {
      const dto = plainToInstance(AddResponseDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });

    it('fails with message exceeding 5000 chars', async () => {
      const dto = plainToInstance(AddResponseDto, { message: 'M'.repeat(5001) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });
  });

  describe('CloseDisputeDto', () => {
    it('passes with valid reason', async () => {
      const dto = plainToInstance(CloseDisputeDto, { reason: 'Resolved amicably' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails missing reason', async () => {
      const dto = plainToInstance(CloseDisputeDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });

    it('fails with reason exceeding 2000 chars', async () => {
      const dto = plainToInstance(CloseDisputeDto, { reason: 'R'.repeat(2001) });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
