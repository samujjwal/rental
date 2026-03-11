import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AddFavoriteDto, BulkFavoriteDto } from './favorite.dto';

describe('Favorite DTOs', () => {
  describe('AddFavoriteDto', () => {
    it('passes with valid UUID', async () => {
      const dto = plainToInstance(AddFavoriteDto, {
        listingId: '550e8400-e29b-41d4-a716-446655440000',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when listingId is missing', async () => {
      const dto = plainToInstance(AddFavoriteDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingId')).toBe(true);
    });

    it('fails when listingId is not a UUID', async () => {
      const dto = plainToInstance(AddFavoriteDto, { listingId: 'not-a-uuid' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingId')).toBe(true);
    });

    it('fails with empty string listingId', async () => {
      const dto = plainToInstance(AddFavoriteDto, { listingId: '' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingId')).toBe(true);
    });

    it('passes with different UUID versions', async () => {
      const uuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      ];
      for (const uuid of uuids) {
        const dto = plainToInstance(AddFavoriteDto, { listingId: uuid });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('BulkFavoriteDto', () => {
    it('passes with valid UUID array', async () => {
      const dto = plainToInstance(BulkFavoriteDto, {
        listingIds: [
          '550e8400-e29b-41d4-a716-446655440000',
          '660e8400-e29b-41d4-a716-446655440001',
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with single UUID in array', async () => {
      const dto = plainToInstance(BulkFavoriteDto, {
        listingIds: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when listingIds is missing', async () => {
      const dto = plainToInstance(BulkFavoriteDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingIds')).toBe(true);
    });

    it('fails when listingIds contains non-UUIDs', async () => {
      const dto = plainToInstance(BulkFavoriteDto, {
        listingIds: ['not-a-uuid', 'also-bad'],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingIds')).toBe(true);
    });

    it('fails when listingIds contains mix of valid and invalid', async () => {
      const dto = plainToInstance(BulkFavoriteDto, {
        listingIds: ['550e8400-e29b-41d4-a716-446655440000', 'bad-id'],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingIds')).toBe(true);
    });

    it('fails when listingIds is not an array', async () => {
      const dto = plainToInstance(BulkFavoriteDto, { listingIds: 'not-array' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingIds')).toBe(true);
    });
  });
});
