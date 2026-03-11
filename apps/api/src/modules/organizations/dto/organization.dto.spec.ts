import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  BusinessType,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteMemberDto,
} from './organization.dto';
import { OrganizationRole } from '@rental-portal/database';

describe('Organization DTOs', () => {
  describe('BusinessType enum', () => {
    it('has expected values', () => {
      expect(BusinessType.INDIVIDUAL).toBe('INDIVIDUAL');
      expect(BusinessType.LLC).toBe('LLC');
      expect(BusinessType.CORPORATION).toBe('CORPORATION');
      expect(BusinessType.PARTNERSHIP).toBe('PARTNERSHIP');
    });
  });

  describe('CreateOrganizationDto', () => {
    const validData = {
      name: 'Kathmandu Rentals LLC',
      businessType: BusinessType.LLC,
      email: 'info@ktmrentals.com',
    };

    it('passes with minimum required fields', async () => {
      const dto = plainToInstance(CreateOrganizationDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional fields', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        ...validData,
        description: 'Largest rental platform in Kathmandu valley',
        taxId: 'NP-PAN-123456',
        phoneNumber: '+977-01-4123456',
        addressLine1: '123 Durbar Marg',
        addressLine2: 'Floor 3',
        city: 'Kathmandu',
        state: 'Bagmati',
        postalCode: '44600',
        country: 'Nepal',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when name is missing', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        businessType: BusinessType.LLC,
        email: 'info@test.com',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('fails when businessType is missing', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        name: 'Test Org',
        email: 'info@test.com',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'businessType')).toBe(true);
    });

    it('fails when email is missing', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        name: 'Test Org',
        businessType: BusinessType.LLC,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('fails when email is invalid', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        ...validData,
        email: 'not-an-email',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('fails when businessType is invalid enum', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        ...validData,
        businessType: 'NONPROFIT',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'businessType')).toBe(true);
    });

    it('fails when name exceeds 200 chars', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        ...validData,
        name: 'N'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('fails when description exceeds 2000 chars', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        ...validData,
        description: 'D'.repeat(2001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails when taxId exceeds 50 chars', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        ...validData,
        taxId: 'T'.repeat(51),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'taxId')).toBe(true);
    });

    it('fails when phoneNumber exceeds 20 chars', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        ...validData,
        phoneNumber: '1'.repeat(21),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'phoneNumber')).toBe(true);
    });

    it('fails when city exceeds 100 chars', async () => {
      const dto = plainToInstance(CreateOrganizationDto, {
        ...validData,
        city: 'C'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'city')).toBe(true);
    });

    it('passes with each BusinessType enum value', async () => {
      for (const bt of Object.values(BusinessType)) {
        const dto = plainToInstance(CreateOrganizationDto, { ...validData, businessType: bt });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('UpdateOrganizationDto', () => {
    it('passes with empty object (all optional)', async () => {
      const dto = plainToInstance(UpdateOrganizationDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with partial update', async () => {
      const dto = plainToInstance(UpdateOrganizationDto, {
        name: 'Updated Org Name',
        website: 'https://rentals.np',
        settings: { theme: 'dark' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when name exceeds 200 chars', async () => {
      const dto = plainToInstance(UpdateOrganizationDto, { name: 'N'.repeat(201) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('fails when email is invalid', async () => {
      const dto = plainToInstance(UpdateOrganizationDto, { email: 'bad-email' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('fails when description exceeds 2000 chars', async () => {
      const dto = plainToInstance(UpdateOrganizationDto, { description: 'D'.repeat(2001) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails when website exceeds 500 chars', async () => {
      const dto = plainToInstance(UpdateOrganizationDto, { website: 'W'.repeat(501) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'website')).toBe(true);
    });
  });

  describe('InviteMemberDto', () => {
    it('passes with valid data', async () => {
      const role = Object.values(OrganizationRole)[0];
      const dto = plainToInstance(InviteMemberDto, {
        email: 'member@example.com',
        role,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when email is missing', async () => {
      const dto = plainToInstance(InviteMemberDto, {
        role: Object.values(OrganizationRole)[0],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('fails when role is missing', async () => {
      const dto = plainToInstance(InviteMemberDto, { email: 'test@example.com' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('fails when email is invalid', async () => {
      const dto = plainToInstance(InviteMemberDto, {
        email: 'not-email',
        role: Object.values(OrganizationRole)[0],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('fails when role is invalid enum', async () => {
      const dto = plainToInstance(InviteMemberDto, {
        email: 'test@example.com',
        role: 'SUPER_ADMIN',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });
  });
});
