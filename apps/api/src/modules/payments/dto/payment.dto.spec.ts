import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  StartOnboardingDto,
  AttachPaymentMethodDto,
  RequestPayoutDto,
  RequestRefundDto,
} from './payment.dto';

describe('Payment DTOs', () => {
  describe('StartOnboardingDto', () => {
    it('passes with valid URLs', async () => {
      const dto = plainToInstance(StartOnboardingDto, {
        returnUrl: 'https://example.com/return',
        refreshUrl: 'https://example.com/refresh',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with invalid returnUrl', async () => {
      const dto = plainToInstance(StartOnboardingDto, {
        returnUrl: 'not-a-url',
        refreshUrl: 'https://example.com/refresh',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'returnUrl')).toBe(true);
    });

    it('fails with invalid refreshUrl', async () => {
      const dto = plainToInstance(StartOnboardingDto, {
        returnUrl: 'https://example.com/return',
        refreshUrl: 'bad',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'refreshUrl')).toBe(true);
    });

    it('fails with empty returnUrl', async () => {
      const dto = plainToInstance(StartOnboardingDto, {
        returnUrl: '',
        refreshUrl: 'https://example.com/refresh',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'returnUrl')).toBe(true);
    });
  });

  describe('AttachPaymentMethodDto', () => {
    it('passes with valid paymentMethodId', async () => {
      const dto = plainToInstance(AttachPaymentMethodDto, {
        paymentMethodId: 'pm_1234567890',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with empty paymentMethodId', async () => {
      const dto = plainToInstance(AttachPaymentMethodDto, {
        paymentMethodId: '',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'paymentMethodId')).toBe(true);
    });

    it('fails without paymentMethodId', async () => {
      const dto = plainToInstance(AttachPaymentMethodDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'paymentMethodId')).toBe(true);
    });
  });

  describe('RequestPayoutDto', () => {
    it('passes with empty object (optional amount)', async () => {
      const dto = plainToInstance(RequestPayoutDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with valid amount', async () => {
      const dto = plainToInstance(RequestPayoutDto, { amount: 100 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with zero amount', async () => {
      const dto = plainToInstance(RequestPayoutDto, { amount: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('passes with amount >= 1', async () => {
      const dto = plainToInstance(RequestPayoutDto, { amount: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with negative amount', async () => {
      const dto = plainToInstance(RequestPayoutDto, { amount: -10 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
  });

  describe('RequestRefundDto', () => {
    it('passes with empty object', async () => {
      const dto = plainToInstance(RequestRefundDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with amount and reason', async () => {
      const dto = plainToInstance(RequestRefundDto, {
        amount: 25.5,
        reason: 'Item was defective',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails with negative amount', async () => {
      const dto = plainToInstance(RequestRefundDto, { amount: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('fails with reason exceeding 500 chars', async () => {
      const dto = plainToInstance(RequestRefundDto, { reason: 'R'.repeat(501) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });
});
