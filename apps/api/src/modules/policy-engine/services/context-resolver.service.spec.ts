import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContextResolverService, ContextInput } from './context-resolver.service';

describe('ContextResolverService', () => {
  let service: ContextResolverService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue: string) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextResolverService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ContextResolverService>(ContextResolverService);
  });

  describe('resolve', () => {
    it('returns defaults when no input provided', () => {
      const ctx = service.resolve({});
      expect(ctx.country).toBe('NP');
      expect(ctx.currency).toBe('NPR');
      expect(ctx.locale).toBe('en');
      expect(ctx.timezone).toBe('Asia/Kathmandu');
      expect(ctx.userRole).toBe('GUEST');
      expect(ctx.platform).toBe('web');
      expect(ctx.evaluationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ctx.requestTimestamp).toBeTruthy();
    });

    it('resolves country from explicit input', () => {
      const ctx = service.resolve({ country: 'IN' });
      expect(ctx.country).toBe('IN');
    });

    it('resolves country from listing location over user country', () => {
      const ctx = service.resolve({
        country: undefined,
        listingCountry: 'IN',
        userCountry: 'NP',
      });
      expect(ctx.country).toBe('IN');
    });

    it('falls back to user country when listing country not set', () => {
      const ctx = service.resolve({ userCountry: 'IN' });
      expect(ctx.country).toBe('IN');
    });

    it('falls back to IP country when no user country', () => {
      const ctx = service.resolve({ ipCountry: 'BD' });
      expect(ctx.country).toBe('BD');
    });

    it('resolves currency from listing currency', () => {
      const ctx = service.resolve({ listingCurrency: 'INR' });
      expect(ctx.currency).toBe('INR');
    });

    it('resolves locale from user preference', () => {
      const ctx = service.resolve({ preferredLocale: 'ne' });
      expect(ctx.locale).toBe('ne');
    });

    it('explicit locale overrides user preference', () => {
      const ctx = service.resolve({ locale: 'hi', preferredLocale: 'ne' });
      expect(ctx.locale).toBe('hi');
    });

    it('populates listing fields', () => {
      const ctx = service.resolve({
        listingId: 'lst_1',
        listingCategory: 'VEHICLES',
        listingCountry: 'NP',
        listingState: 'BG-3',
        listingCity: 'Bhaktapur',
      });
      expect(ctx.listingId).toBe('lst_1');
      expect(ctx.listingCategory).toBe('VEHICLES');
      expect(ctx.listingCity).toBe('Bhaktapur');
      expect(ctx.state).toBe('BG-3');
      expect(ctx.city).toBe('Bhaktapur');
    });

    it('populates booking fields', () => {
      const ctx = service.resolve({
        bookingValue: 25000,
        bookingDuration: 3,
        startDate: '2026-03-05',
        endDate: '2026-03-08',
        guestCount: 4,
        hostPresent: true,
      });
      expect(ctx.bookingValue).toBe(25000);
      expect(ctx.bookingDuration).toBe(3);
      expect(ctx.guestCount).toBe(4);
      expect(ctx.hostPresent).toBe(true);
    });

    it('sets null for missing optional fields', () => {
      const ctx = service.resolve({});
      expect(ctx.userId).toBeNull();
      expect(ctx.listingId).toBeNull();
      expect(ctx.bookingValue).toBeNull();
      expect(ctx.tenantId).toBeNull();
      expect(ctx.ipCountry).toBeNull();
    });

    it('uses listing location for tax jurisdiction country', () => {
      // Tax jurisdiction should be listing country, NOT user country
      const ctx = service.resolve({
        userCountry: 'US',
        listingCountry: 'NP',
      });
      expect(ctx.country).toBe('NP'); // Tax country = listing country
      expect(ctx.userCountry).toBe('US');
    });
  });
});
