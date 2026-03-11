import { Test, TestingModule } from '@nestjs/testing';
import { PolicyPackLoaderService } from './policy-pack-loader.service';

describe('PolicyPackLoaderService', () => {
  let service: PolicyPackLoaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyPackLoaderService],
    }).compile();

    // Suppress onModuleInit from auto-loading (files may not exist in test env)
    service = module.get<PolicyPackLoaderService>(PolicyPackLoaderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPack', () => {
    it('should return undefined for non-loaded country', () => {
      const pack = service.getPack('ZZ');
      expect(pack).toBeUndefined();
    });
  });

  describe('getTaxRules', () => {
    it('should return undefined for non-loaded country', () => {
      const rules = service.getTaxRules('ZZ');
      expect(rules).toBeUndefined();
    });
  });

  describe('getPaymentConfig', () => {
    it('should return undefined for non-loaded country', () => {
      const config = service.getPaymentConfig('ZZ');
      expect(config).toBeUndefined();
    });
  });

  describe('getBookingConstraints', () => {
    it('should return undefined for non-loaded country', () => {
      const constraints = service.getBookingConstraints('ZZ');
      expect(constraints).toBeUndefined();
    });
  });

  describe('getIdentityRequirements', () => {
    it('should return undefined for non-loaded country', () => {
      const req = service.getIdentityRequirements('ZZ');
      expect(req).toBeUndefined();
    });
  });

  describe('getLoadedCountries', () => {
    it('should return array of loaded country codes', () => {
      const countries = service.getLoadedCountries();
      expect(Array.isArray(countries)).toBe(true);
    });
  });
});
