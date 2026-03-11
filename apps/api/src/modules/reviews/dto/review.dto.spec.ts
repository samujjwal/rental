import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewDirection,
} from './review.dto';

describe('Review DTOs', () => {
  describe('ReviewDirection enum', () => {
    it('has correct values', () => {
      expect(ReviewDirection.RENTER_TO_OWNER).toBe('RENTER_TO_OWNER');
      expect(ReviewDirection.OWNER_TO_RENTER).toBe('OWNER_TO_RENTER');
    });
  });

  describe('CreateReviewDto', () => {
    const validData = {
      bookingId: 'booking-123',
      reviewType: ReviewDirection.RENTER_TO_OWNER,
      overallRating: 4,
    };

    it('passes with valid required fields', async () => {
      const dto = plainToInstance(CreateReviewDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional ratings', async () => {
      const dto = plainToInstance(CreateReviewDto, {
        ...validData,
        accuracyRating: 5,
        communicationRating: 4,
        cleanlinessRating: 3,
        valueRating: 4,
        comment: 'Great experience!',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails missing bookingId', async () => {
      const dto = plainToInstance(CreateReviewDto, {
        reviewType: ReviewDirection.RENTER_TO_OWNER,
        overallRating: 4,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'bookingId')).toBe(true);
    });

    it('fails with invalid reviewType', async () => {
      const dto = plainToInstance(CreateReviewDto, {
        ...validData,
        reviewType: 'INVALID',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reviewType')).toBe(true);
    });

    it('fails with overallRating below 1', async () => {
      const dto = plainToInstance(CreateReviewDto, { ...validData, overallRating: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'overallRating')).toBe(true);
    });

    it('fails with overallRating above 5', async () => {
      const dto = plainToInstance(CreateReviewDto, { ...validData, overallRating: 6 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'overallRating')).toBe(true);
    });

    it('fails with accuracyRating below 1', async () => {
      const dto = plainToInstance(CreateReviewDto, { ...validData, accuracyRating: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'accuracyRating')).toBe(true);
    });

    it('fails with communicationRating above 5', async () => {
      const dto = plainToInstance(CreateReviewDto, { ...validData, communicationRating: 6 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'communicationRating')).toBe(true);
    });

    it('fails with comment exceeding 2000 chars', async () => {
      const dto = plainToInstance(CreateReviewDto, {
        ...validData,
        comment: 'C'.repeat(2001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'comment')).toBe(true);
    });

    it('accepts rating at boundaries (1 and 5)', async () => {
      const dto1 = plainToInstance(CreateReviewDto, { ...validData, overallRating: 1 });
      const dto5 = plainToInstance(CreateReviewDto, { ...validData, overallRating: 5 });
      expect((await validate(dto1)).length).toBe(0);
      expect((await validate(dto5)).length).toBe(0);
    });
  });

  describe('UpdateReviewDto', () => {
    it('passes with empty object (all fields optional)', async () => {
      const dto = plainToInstance(UpdateReviewDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with partial update', async () => {
      const dto = plainToInstance(UpdateReviewDto, {
        overallRating: 3,
        comment: 'Updated review',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with rating out of range', async () => {
      const dto = plainToInstance(UpdateReviewDto, { valueRating: 10 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'valueRating')).toBe(true);
    });

    it('fails with comment exceeding max length', async () => {
      const dto = plainToInstance(UpdateReviewDto, { comment: 'X'.repeat(2001) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'comment')).toBe(true);
    });
  });
});
