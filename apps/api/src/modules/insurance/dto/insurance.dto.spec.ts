import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePolicyDto, VerifyPolicyDto, CreateClaimDto } from './insurance.dto';
import { InsuranceType, InsuranceStatus } from '@rental-portal/database';

describe('Insurance DTOs', () => {
  describe('CreatePolicyDto', () => {
    const validData = {
      policyNumber: 'POL-2025-001',
      propertyId: '550e8400-e29b-41d4-a716-446655440000',
      type: Object.values(InsuranceType)[0],
      provider: 'Nepal Insurance Co.',
      coverage: 100000,
      premium: 5000,
      startDate: '2025-01-01',
      endDate: '2026-01-01',
    };

    it('passes with minimum required fields', async () => {
      const dto = plainToInstance(CreatePolicyDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional fields', async () => {
      const dto = plainToInstance(CreatePolicyDto, {
        ...validData,
        bookingId: '660e8400-e29b-41d4-a716-446655440001',
        coverageAmount: 100000,
        currency: 'NPR',
        documents: ['https://docs.co/policy.pdf'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when policyNumber is missing', async () => {
      const { policyNumber, ...rest } = validData;
      const dto = plainToInstance(CreatePolicyDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'policyNumber')).toBe(true);
    });

    it('fails when propertyId is missing', async () => {
      const { propertyId, ...rest } = validData;
      const dto = plainToInstance(CreatePolicyDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'propertyId')).toBe(true);
    });

    it('fails when propertyId is not a UUID', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, propertyId: 'bad-id' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'propertyId')).toBe(true);
    });

    it('fails when type is invalid enum', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, type: 'INVALID' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });

    it('fails when provider is missing', async () => {
      const { provider, ...rest } = validData;
      const dto = plainToInstance(CreatePolicyDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'provider')).toBe(true);
    });

    it('fails when coverage is negative', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, coverage: -100 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'coverage')).toBe(true);
    });

    it('passes when coverage is 0', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, coverage: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'coverage')).toBe(false);
    });

    it('fails when premium is negative', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, premium: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'premium')).toBe(true);
    });

    it('fails when startDate is invalid date string', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, startDate: 'not-a-date' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'startDate')).toBe(true);
    });

    it('fails when endDate is invalid date string', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, endDate: 'bad-date' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'endDate')).toBe(true);
    });

    it('fails when policyNumber exceeds 100 chars', async () => {
      const dto = plainToInstance(CreatePolicyDto, {
        ...validData,
        policyNumber: 'P'.repeat(101),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'policyNumber')).toBe(true);
    });

    it('fails when provider exceeds 200 chars', async () => {
      const dto = plainToInstance(CreatePolicyDto, {
        ...validData,
        provider: 'P'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'provider')).toBe(true);
    });

    it('fails when currency exceeds 3 chars', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, currency: 'LONG' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'currency')).toBe(true);
    });

    it('fails when bookingId is not a UUID', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, bookingId: 'bad' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'bookingId')).toBe(true);
    });

    it('fails when coverageAmount is negative', async () => {
      const dto = plainToInstance(CreatePolicyDto, { ...validData, coverageAmount: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'coverageAmount')).toBe(true);
    });
  });

  describe('VerifyPolicyDto', () => {
    it('passes with valid status', async () => {
      const dto = plainToInstance(VerifyPolicyDto, {
        status: Object.values(InsuranceStatus)[0],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional notes', async () => {
      const dto = plainToInstance(VerifyPolicyDto, {
        status: Object.values(InsuranceStatus)[0],
        notes: 'Verified via provider API',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when status is missing', async () => {
      const dto = plainToInstance(VerifyPolicyDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('fails when status is invalid', async () => {
      const dto = plainToInstance(VerifyPolicyDto, { status: 'INVALID' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('fails when notes exceed 1000 chars', async () => {
      const dto = plainToInstance(VerifyPolicyDto, {
        status: Object.values(InsuranceStatus)[0],
        notes: 'N'.repeat(1001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'notes')).toBe(true);
    });
  });

  describe('CreateClaimDto', () => {
    const validClaim = {
      policyId: '550e8400-e29b-41d4-a716-446655440000',
      claimAmount: 25000,
      description: 'Damage to equipment during rental period',
      incidentDate: '2025-06-15',
    };

    it('passes with valid data', async () => {
      const dto = plainToInstance(CreateClaimDto, validClaim);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all optional fields', async () => {
      const dto = plainToInstance(CreateClaimDto, {
        ...validClaim,
        bookingId: '660e8400-e29b-41d4-a716-446655440001',
        documents: ['https://docs.co/evidence.jpg'],
        notes: 'Reported immediately',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when policyId is missing', async () => {
      const { policyId, ...rest } = validClaim;
      const dto = plainToInstance(CreateClaimDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'policyId')).toBe(true);
    });

    it('fails when policyId is not a UUID', async () => {
      const dto = plainToInstance(CreateClaimDto, { ...validClaim, policyId: 'bad' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'policyId')).toBe(true);
    });

    it('fails when claimAmount is negative', async () => {
      const dto = plainToInstance(CreateClaimDto, { ...validClaim, claimAmount: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'claimAmount')).toBe(true);
    });

    it('fails when description exceeds 2000 chars', async () => {
      const dto = plainToInstance(CreateClaimDto, {
        ...validClaim,
        description: 'D'.repeat(2001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails when incidentDate is invalid', async () => {
      const dto = plainToInstance(CreateClaimDto, { ...validClaim, incidentDate: 'not-date' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'incidentDate')).toBe(true);
    });

    it('fails when notes exceed 1000 chars', async () => {
      const dto = plainToInstance(CreateClaimDto, {
        ...validClaim,
        notes: 'N'.repeat(1001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'notes')).toBe(true);
    });
  });
});
