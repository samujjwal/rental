import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  it('passes with empty object (all optional)', async () => {
    const dto = plainToInstance(UpdateProfileDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('passes with all valid fields', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      firstName: 'Ram',
      lastName: 'Sharma',
      phoneNumber: '+9779841234567',
      bio: 'Property manager in Kathmandu',
      profilePhotoUrl: 'https://avatars.co/ram.jpg',
      dateOfBirth: '1990-05-15',
      addressLine1: '42 Thamel Marg',
      addressLine2: 'Suite 3',
      city: 'Kathmandu',
      state: 'Bagmati',
      postalCode: '44600',
      country: 'Nepal',
      timezone: 'Asia/Kathmandu',
      preferredLanguage: 'ne',
      preferredCurrency: 'NPR',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  // Phone number E.164 format validation
  it('passes with valid E.164 phone numbers', async () => {
    const validPhones = ['+14155552671', '+9779841234567', '+442071234567', '9779841234567'];
    for (const phone of validPhones) {
      const dto = plainToInstance(UpdateProfileDto, { phoneNumber: phone });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'phoneNumber')).toBe(false);
    }
  });

  it('fails with invalid phone numbers', async () => {
    const invalidPhones = ['123', 'abc', '+0123456789', '12345'];
    for (const phone of invalidPhones) {
      const dto = plainToInstance(UpdateProfileDto, { phoneNumber: phone });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'phoneNumber')).toBe(true);
    }
  });

  // URL validation for profilePhotoUrl
  it('passes with valid URLs for profilePhotoUrl', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      profilePhotoUrl: 'https://images.example.com/avatar.png',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'profilePhotoUrl')).toBe(false);
  });

  it('fails with invalid profilePhotoUrl', async () => {
    const dto = plainToInstance(UpdateProfileDto, { profilePhotoUrl: 'not-a-url' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'profilePhotoUrl')).toBe(true);
  });

  // DateString validation
  it('passes with valid ISO date string', async () => {
    const dto = plainToInstance(UpdateProfileDto, { dateOfBirth: '1990-05-15' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(false);
  });

  it('fails with invalid date string', async () => {
    const dto = plainToInstance(UpdateProfileDto, { dateOfBirth: 'not-a-date' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(true);
  });

  // MaxLength validations
  it('fails when firstName exceeds 100 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { firstName: 'A'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('fails when lastName exceeds 100 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { lastName: 'A'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'lastName')).toBe(true);
  });

  it('fails when bio exceeds 500 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { bio: 'B'.repeat(501) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'bio')).toBe(true);
  });

  it('fails when addressLine1 exceeds 200 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { addressLine1: 'A'.repeat(201) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'addressLine1')).toBe(true);
  });

  it('fails when city exceeds 100 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { city: 'C'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'city')).toBe(true);
  });

  it('fails when postalCode exceeds 20 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { postalCode: 'P'.repeat(21) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'postalCode')).toBe(true);
  });

  it('fails when country exceeds 100 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { country: 'C'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'country')).toBe(true);
  });

  it('fails when timezone exceeds 50 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { timezone: 'T'.repeat(51) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'timezone')).toBe(true);
  });

  it('fails when preferredLanguage exceeds 10 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { preferredLanguage: 'L'.repeat(11) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'preferredLanguage')).toBe(true);
  });

  it('fails when preferredCurrency exceeds 3 chars', async () => {
    const dto = plainToInstance(UpdateProfileDto, { preferredCurrency: 'LONG' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'preferredCurrency')).toBe(true);
  });

  it('passes with boundary MaxLength values', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      firstName: 'A'.repeat(100),
      bio: 'B'.repeat(500),
      timezone: 'T'.repeat(50),
      preferredCurrency: 'NPR',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
