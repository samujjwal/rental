import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GenerateDescriptionDto, GenerateDescriptionResult } from './ai.dto';

describe('AI DTOs', () => {
  describe('GenerateDescriptionDto', () => {
    const validData = {
      title: 'Mountain Bike for Rent',
      category: 'Sports Equipment',
    };

    it('passes with required fields', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional fields', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        condition: 'EXCELLENT',
        features: ['21-speed', 'disc brakes', 'suspension'],
        location: 'Kathmandu',
        priceHint: 'NPR 1500/day',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when title is missing', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, { category: 'Sports' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('fails when category is missing', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, { title: 'Bike' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'category')).toBe(true);
    });

    it('fails when title exceeds 200 chars', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        title: 'T'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('passes when title is exactly 200 chars', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        title: 'T'.repeat(200),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(false);
    });

    it('fails when category exceeds 100 chars', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        category: 'C'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'category')).toBe(true);
    });

    it('fails when condition exceeds 50 chars', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        condition: 'C'.repeat(51),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'condition')).toBe(true);
    });

    it('fails when location exceeds 100 chars', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        location: 'L'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'location')).toBe(true);
    });

    it('fails when priceHint exceeds 50 chars', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        priceHint: 'P'.repeat(51),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'priceHint')).toBe(true);
    });

    it('fails when features contain non-strings', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        features: [123, true],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'features')).toBe(true);
    });

    it('passes with empty features array', async () => {
      const dto = plainToInstance(GenerateDescriptionDto, {
        ...validData,
        features: [],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('GenerateDescriptionResult', () => {
    it('is a plain class with expected properties', () => {
      const result = new GenerateDescriptionResult();
      result.description = 'A premium mountain bike';
      result.highlights = ['21-speed', 'disc brakes'];
      result.suggestedTags = ['bike', 'sports', 'outdoor'];

      expect(result.description).toBe('A premium mountain bike');
      expect(result.highlights).toHaveLength(2);
      expect(result.suggestedTags).toHaveLength(3);
    });
  });
});
