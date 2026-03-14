import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';

// PricingMode is an enum from @rental-portal/database
// We import it to use valid values; the enum likely has DAILY, HOURLY, WEEKLY, MONTHLY etc.
import { PricingMode } from '@rental-portal/database';

describe('Category DTOs', () => {
  describe('CreateCategoryDto', () => {
    const validData = {
      name: 'Electronics',
      slug: 'electronics',
      templateSchema: { brand: 'string', model: 'string' },
    };

    it('passes with minimum required fields', async () => {
      const dto = plainToInstance(CreateCategoryDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional fields', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        description: 'All electronics for rent',
        iconUrl: 'https://icons.co/electronics.svg',
        parentId: '550e8400-e29b-41d4-a716-446655440000',
        order: 5,
        searchableFields: ['brand', 'model'],
        requiredFields: ['brand'],
        defaultPricingMode: Object.values(PricingMode)[0],
        allowInstantBook: true,
        requiresDepositDefault: false,
        defaultDepositPercentage: 10,
        insuranceRequired: true,
        minimumInsuranceAmount: 500,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when name is missing', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        slug: 'electronics',
        templateSchema: {},
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('fails when slug is missing', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'Electronics',
        templateSchema: {},
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'slug')).toBe(true);
    });

    it('fails when templateSchema is missing', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 'Electronics',
        slug: 'electronics',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'templateSchema')).toBe(true);
    });

    it('fails when name exceeds 100 chars', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        name: 'N'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('fails when slug exceeds 100 chars', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        slug: 's'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'slug')).toBe(true);
    });

    it('fails when description exceeds 5000 chars', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        description: 'D'.repeat(5001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails when iconUrl exceeds 200 chars', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        iconUrl: 'U'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'iconUrl')).toBe(true);
    });

    it('fails when parentId is not a UUID', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        parentId: 'not-a-uuid',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'parentId')).toBe(true);
    });

    it('fails when order is negative', async () => {
      const dto = plainToInstance(CreateCategoryDto, { ...validData, order: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'order')).toBe(true);
    });

    it('passes when order is 0', async () => {
      const dto = plainToInstance(CreateCategoryDto, { ...validData, order: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when defaultPricingMode is invalid enum', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        defaultPricingMode: 'INVALID',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'defaultPricingMode')).toBe(true);
    });

    it('fails when defaultDepositPercentage is negative', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        defaultDepositPercentage: -5,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'defaultDepositPercentage')).toBe(true);
    });

    it('fails when minimumInsuranceAmount is negative', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        minimumInsuranceAmount: -100,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'minimumInsuranceAmount')).toBe(true);
    });

    it('fails when searchableFields contain non-strings', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        ...validData,
        searchableFields: [123, true],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'searchableFields')).toBe(true);
    });
  });

  describe('UpdateCategoryDto', () => {
    it('passes with empty object (all optional)', async () => {
      const dto = plainToInstance(UpdateCategoryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with partial update', async () => {
      const dto = plainToInstance(UpdateCategoryDto, {
        name: 'Updated Name',
        active: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when name exceeds 100 chars', async () => {
      const dto = plainToInstance(UpdateCategoryDto, { name: 'N'.repeat(101) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('fails when description exceeds 500 chars', async () => {
      const dto = plainToInstance(UpdateCategoryDto, { description: 'D'.repeat(501) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails when order is negative', async () => {
      const dto = plainToInstance(UpdateCategoryDto, { order: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'order')).toBe(true);
    });

    it('fails when defaultPricingMode is invalid', async () => {
      const dto = plainToInstance(UpdateCategoryDto, { defaultPricingMode: 'BAD' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'defaultPricingMode')).toBe(true);
    });

    it('fails when defaultDepositPercentage is negative', async () => {
      const dto = plainToInstance(UpdateCategoryDto, { defaultDepositPercentage: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'defaultDepositPercentage')).toBe(true);
    });

    it('fails when minimumInsuranceAmount is negative', async () => {
      const dto = plainToInstance(UpdateCategoryDto, { minimumInsuranceAmount: -50 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'minimumInsuranceAmount')).toBe(true);
    });
  });
});
