import { Test, TestingModule } from '@nestjs/testing';
import { CountryPolicyController } from './country-policy.controller';
import { CountryPolicyPackService } from '../services/country-policy-pack.service';

describe('CountryPolicyController', () => {
  let controller: CountryPolicyController;
  let service: jest.Mocked<CountryPolicyPackService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CountryPolicyController],
      providers: [
        {
          provide: CountryPolicyPackService,
          useValue: {
            getAllPolicyPacks: jest.fn(),
            getPolicyPack: jest.fn(),
            upsertPolicyPack: jest.fn(),
            validateBooking: jest.fn(),
            getPaymentMethods: jest.fn(),
            seedDefaultPacks: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CountryPolicyController);
    service = module.get(CountryPolicyPackService) as jest.Mocked<CountryPolicyPackService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getAllPacks ──

  describe('getAllPacks', () => {
    it('delegates to service', async () => {
      service.getAllPolicyPacks.mockResolvedValue([{ country: 'NP' }, { country: 'IN' }] as any);

      const result = await controller.getAllPacks();

      expect(service.getAllPolicyPacks).toHaveBeenCalledWith();
      expect(result).toEqual([{ country: 'NP' }, { country: 'IN' }]);
    });

    it('propagates service error', async () => {
      service.getAllPolicyPacks.mockRejectedValue(new Error('DB error'));
      await expect(controller.getAllPacks()).rejects.toThrow('DB error');
    });
  });

  // ── getPack ──

  describe('getPack', () => {
    it('delegates country to service', async () => {
      service.getPolicyPack.mockResolvedValue({ country: 'NP', maxStay: 30 } as any);

      const result = await controller.getPack('NP');

      expect(service.getPolicyPack).toHaveBeenCalledWith('NP');
      expect(result).toEqual({ country: 'NP', maxStay: 30 });
    });
  });

  // ── upsertPack ──

  describe('upsertPack', () => {
    it('delegates full dto to service', async () => {
      const dto = { country: 'NP', maxStay: 60, taxRate: 13 };
      service.upsertPolicyPack.mockResolvedValue({ country: 'NP', maxStay: 60 } as any);

      const result = await controller.upsertPack(dto as any);

      expect(service.upsertPolicyPack).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ country: 'NP', maxStay: 60 });
    });

    it('propagates service error', async () => {
      service.upsertPolicyPack.mockRejectedValue(new Error('Validation failed'));
      await expect(controller.upsertPack({} as any)).rejects.toThrow('Validation failed');
    });
  });

  // ── validateBooking ──

  describe('validateBooking', () => {
    it('destructures country from dto and passes rest as params', async () => {
      const dto = { country: 'NP', guestCount: 3, duration: 7 };
      service.validateBooking.mockResolvedValue({ valid: true } as any);

      const result = await controller.validateBooking(dto as any);

      expect(service.validateBooking).toHaveBeenCalledWith('NP', { guestCount: 3, duration: 7 });
      expect(result).toEqual({ valid: true });
    });

    it('propagates service error', async () => {
      service.validateBooking.mockRejectedValue(new Error('Policy violation'));
      await expect(controller.validateBooking({ country: 'NP' } as any)).rejects.toThrow('Policy violation');
    });
  });

  // ── getPaymentMethods ──

  describe('getPaymentMethods', () => {
    it('delegates country to service', async () => {
      service.getPaymentMethods.mockResolvedValue(['esewa', 'khalti', 'card'] as any);

      const result = await controller.getPaymentMethods('NP');

      expect(service.getPaymentMethods).toHaveBeenCalledWith('NP');
      expect(result).toEqual(['esewa', 'khalti', 'card']);
    });
  });

  // ── seedDefaults ──

  describe('seedDefaults', () => {
    it('delegates to service with no args', async () => {
      service.seedDefaultPacks.mockResolvedValue({ seeded: 5 } as any);

      const result = await controller.seedDefaults();

      expect(service.seedDefaultPacks).toHaveBeenCalledWith();
      expect(result).toEqual({ seeded: 5 });
    });

    it('propagates service error', async () => {
      service.seedDefaultPacks.mockRejectedValue(new Error('Already seeded'));
      await expect(controller.seedDefaults()).rejects.toThrow('Already seeded');
    });
  });
});
