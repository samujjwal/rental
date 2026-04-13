import { Test, TestingModule } from '@nestjs/testing';
import { MultiCurrencyService } from './multi-currency.service';
import { CurrencyRepository } from '../repositories/currency.repository';
import { ExchangeRateRepository } from '../repositories/exchange-rate.repository';
import { PaymentRepository } from '../../payments/repositories/payment.repository';
import { ListingRepository } from '../../listings/repositories/listing.repository';
import { CacheService } from '../../../common/cache/cache.service';
import { FxRateService } from '../../payments/services/fx-rate.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MULTI-CURRENCY TESTS
 *
 * These tests validate multi-currency functionality:
 * - Currency conversion with real-time rates
 * - Multi-currency pricing and display
 * - Currency validation and formatting
 * - Exchange rate updates and caching
 * - Currency reporting and analytics
 * - Cross-border payment processing
 * - Tax calculations in different currencies
 * - Financial reporting consolidation
 *
 * Business Truth Validated:
 * - Currency conversions are accurate and up-to-date
 * - Multi-currency pricing is consistent across platforms
 * - Exchange rates are cached and updated appropriately
 * - Currency validation prevents invalid transactions
 * - Financial reporting consolidates multiple currencies correctly
 * - Cross-border payments handle fees and regulations properly
 */

describe('MultiCurrencyService', () => {
  let multiCurrencyService: MultiCurrencyService;
  let currencyRepository: CurrencyRepository;
  let exchangeRateRepository: ExchangeRateRepository;
  let paymentRepository: PaymentRepository;
  let listingRepository: ListingRepository;
  let cacheService: CacheService;
  let fxRateService: FxRateService;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiCurrencyService,
        {
          provide: CurrencyRepository,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
            findByCode: jest.fn().mockImplementation((code: string) => {
              const currencies: Record<string, any> = {
                NPR: {
                  code: 'NPR',
                  name: 'Nepalese Rupee',
                  symbol: '₹',
                  decimalPlaces: 2,
                  isActive: true,
                },
                USD: {
                  code: 'USD',
                  name: 'US Dollar',
                  symbol: '$',
                  decimalPlaces: 2,
                  isActive: true,
                },
                EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, isActive: true },
                GBP: {
                  code: 'GBP',
                  name: 'British Pound',
                  symbol: '£',
                  decimalPlaces: 2,
                  isActive: true,
                },
                INR: {
                  code: 'INR',
                  name: 'Indian Rupee',
                  symbol: '₹',
                  decimalPlaces: 2,
                  isActive: true,
                },
              };
              return currencies[code] || null;
            }),
            create: jest.fn(),
            update: jest.fn(),
            getActiveCurrencies: jest.fn(),
            getCurrencyStats: jest.fn(),
          },
        },
        {
          provide: ExchangeRateRepository,
          useValue: {
            getCurrentRate: jest.fn().mockImplementation((from: string, to: string) => {
              const rates: Record<string, number> = {
                'USD-NPR': 132.5,
                'NPR-USD': 0.0075,
                'EUR-NPR': 145.2,
                'NPR-EUR': 0.0069,
                'GBP-NPR': 168.3,
                'NPR-GBP': 0.0059,
              };
              const key = `${from}-${to}`;
              return Promise.resolve({
                fromCurrency: from,
                toCurrency: to,
                rate: rates[key] || 1,
                source: 'fixer',
                timestamp: new Date(),
              });
            }),
            getHistoricalRates: jest.fn().mockImplementation(() => {
              return Promise.resolve([
                { date: '2024-06-15', from: 'USD', to: 'NPR', rate: 132.75 },
                { date: '2024-06-20', from: 'EUR', to: 'NPR', rate: 145.2 },
              ]);
            }),
            updateRate: jest.fn(),
            bulkUpdateRates: jest.fn().mockImplementation((rates: Record<string, number>) => {
              const rateEntries = Object.entries(rates).map(([key, rate]) => {
                const [from, to] = key.split('-');
                return { from, to, oldRate: rate * 0.99, newRate: rate, change: rate * 0.01 };
              });
              return Promise.resolve({
                updated: rateEntries.length,
                failed: 0,
                rates: rateEntries,
                timestamp: new Date(),
              });
            }),
            getRateHistory: jest.fn(),
            validateRate: jest.fn().mockImplementation(() => {
              return Promise.resolve({
                valid: true,
                deviation: 0.5,
                recommendedAction: 'accept',
                alertTriggered: false,
              });
            }),
          },
        },
        {
          provide: PaymentRepository,
          useValue: {
            findById: jest.fn(),
            findByCurrency: jest.fn(),
            createPayment: jest.fn().mockImplementation((data: any) => {
              return Promise.resolve({
                id: 'payment-789',
                ...data,
                status: 'processed',
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }),
            updatePayment: jest.fn(),
            getPaymentStats: jest.fn().mockImplementation(() => {
              return Promise.resolve([
                { currency: 'NPR', amount: 5000000, status: 'COMPLETED' },
                { currency: 'USD', amount: 37500, status: 'COMPLETED' },
                { currency: 'EUR', amount: 34500, status: 'COMPLETED' },
              ]);
            }),
            convertPaymentCurrency: jest.fn(),
          },
        },
        {
          provide: ListingRepository,
          useValue: {
            findById: jest.fn(),
            findByCurrency: jest.fn(),
            updateListing: jest.fn(),
            getListingStats: jest.fn(),
            convertListingCurrency: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            getMultiple: jest.fn(),
            setMultiple: jest.fn(),
            delPattern: jest.fn(),
          },
        },
        {
          provide: FxRateService,
          useValue: {
            convert: jest.fn().mockImplementation((amount: number, from: string, to: string) => {
              const rates: Record<string, number> = {
                'USD-NPR': 132.5,
                'NPR-USD': 0.0075,
                'EUR-NPR': 145.2,
                'NPR-EUR': 0.0069,
                'GBP-NPR': 168.3,
                'NPR-GBP': 0.0059,
                'USD-EUR': 0.92,
                'USD-GBP': 0.79,
                'USD-INR': 83.25,
                'EUR-USD': 1.09,
                'INR-NPR': 1.6,
                'NPR-INR': 0.625,
              };
              const key = `${from}-${to}`;
              const rate = rates[key] || 1;
              return Promise.resolve({
                amount: amount * rate,
                from,
                to,
                rate,
              });
            }),
            getCurrentRate: jest.fn().mockImplementation((from: string, to: string) => {
              const rates: Record<string, number> = {
                'USD-NPR': 132.5,
                'NPR-USD': 0.0075,
                'EUR-NPR': 145.2,
                'NPR-EUR': 0.0069,
                'GBP-NPR': 168.3,
                'NPR-GBP': 0.0059,
              };
              const key = `${from}-${to}`;
              const rate = rates[key] || 1;
              return Promise.resolve({
                fromCurrency: from,
                toCurrency: to,
                rate,
                source: 'fixer',
                timestamp: new Date(),
              });
            }),
            createSnapshot: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            payment: {
              findMany: jest.fn().mockImplementation(() => {
                return Promise.resolve([
                  { amount: 5000000, currency: 'NPR', createdAt: new Date('2024-06-15') },
                  { amount: 37500, currency: 'USD', createdAt: new Date('2024-06-20') },
                  { amount: 34500, currency: 'EUR', createdAt: new Date('2024-06-25') },
                ]);
              }),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'currency.default': 'NPR',
                'currency.supported': ['NPR', 'USD', 'EUR', 'GBP', 'INR'],
                'currency.cacheTTL': 300,
                'currency.conversionFeeRate': 0.005,
                'exchangeRate.updateInterval': 3600,
                'exchangeRate.providers': ['fixer', 'exchangerate-api'],
              };
              return config[key] || null;
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    multiCurrencyService = module.get<MultiCurrencyService>(MultiCurrencyService);
    currencyRepository = module.get<CurrencyRepository>(CurrencyRepository);
    exchangeRateRepository = module.get<ExchangeRateRepository>(ExchangeRateRepository);
    paymentRepository = module.get<PaymentRepository>(PaymentRepository);
    listingRepository = module.get<ListingRepository>(ListingRepository);
    cacheService = module.get<CacheService>(CacheService);
    fxRateService = module.get<FxRateService>(FxRateService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Currency Conversion', () => {
    it('should convert currency with current exchange rate', async () => {
      // Arrange
      const fromCurrency = 'USD';
      const toCurrency = 'NPR';
      const amount = 100;
      const expectedRate = 132.5; // 1 USD = 132.50 NPR

      const conversionRequest = {
        fromCurrency,
        toCurrency,
        amount,
        date: new Date(),
      };

      (fxRateService.getCurrentRate as any).mockResolvedValue(expectedRate);
      (cacheService.get as any).mockResolvedValue(null);
      (cacheService.set as any).mockResolvedValue(undefined);

      // Act
      const result = await multiCurrencyService.convertCurrency(conversionRequest);

      // Assert
      expect(result.convertedAmount).toBe(13250);
      expect(result.totalAmount).toBe(13316.25); // 13250 + (13250 * 0.005)
      expect(result.exchangeRate).toBe(expectedRate);
      expect(result.fee).toBe(0.5); // 0.5% as percentage
      expect(fxRateService.getCurrentRate).toHaveBeenCalledWith(fromCurrency, toCurrency);
    });

    it('should handle currency conversion with cached rates', async () => {
      // Arrange
      const fromCurrency = 'EUR';
      const toCurrency = 'NPR';
      const amount = 50;

      const cachedResult = {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: 7250, // 50 * 145
        convertedCurrency: toCurrency,
        exchangeRate: 145,
        conversionDate: new Date(),
        fee: 0.5,
        totalAmount: 7286.25,
      };

      const conversionRequest = {
        fromCurrency,
        toCurrency,
        amount,
        date: new Date(),
      };

      (cacheService.get as any).mockResolvedValue(cachedResult);

      // Act
      const result = await multiCurrencyService.convertCurrency(conversionRequest);

      // Assert
      expect(result.convertedAmount).toBe(7250);
      expect(result.exchangeRate).toBe(145);
      expect(fxRateService.getCurrentRate).not.toHaveBeenCalled();
      expect(cacheService.get).toHaveBeenCalledWith(
        `conversion:${fromCurrency}:${toCurrency}:${new Date().toDateString()}`,
      );
    });

    it('should convert multiple currencies in batch', async () => {
      // Arrange
      const batchRequest = {
        baseCurrency: 'USD',
        targetCurrencies: ['NPR', 'EUR', 'GBP', 'INR'],
        amounts: [100, 200, 300, 400],
      };

      // Act
      const result = await multiCurrencyService.batchConvertCurrency(batchRequest);

      // Assert
      expect(result.conversions).toHaveLength(4);
      expect(result.conversions[0].currency).toBe('NPR');
      expect(result.conversions[0].converted).toBe(13250);
      expect(result.conversions[1].currency).toBe('EUR');
      expect(result.conversions[1].converted).toBe(184);
      expect(result.conversions[2].currency).toBe('GBP');
      expect(result.conversions[2].converted).toBe(237);
      expect(result.conversions[3].currency).toBe('INR');
      expect(result.conversions[3].converted).toBe(33300);
      // Total fees = (13250 + 184 + 237 + 33300) * 0.005 = 234.855
      expect(result.totalFees).toBeCloseTo(234.86, 1);
    });

    it('should handle unsupported currency conversion', async () => {
      // Arrange
      const conversionRequest = {
        fromCurrency: 'XYZ', // Unsupported currency
        toCurrency: 'NPR',
        amount: 100,
        date: new Date(),
      };

      // Override the mock to return null for XYZ
      (currencyRepository.findByCode as any).mockImplementation((code: string) => {
        if (code === 'XYZ') return Promise.resolve(null);
        const currencies: Record<string, any> = {
          NPR: { code: 'NPR', name: 'Nepalese Rupee', symbol: '₹', decimalPlaces: 2, isActive: true },
          USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, isActive: true },
        };
        return Promise.resolve(currencies[code] || null);
      });

      // Act & Assert
      await expect(multiCurrencyService.convertCurrency(conversionRequest)).rejects.toThrow(
        'Unsupported currency: XYZ',
      );
    });

    it('should handle zero or negative amounts', async () => {
      // Arrange
      const conversionRequest = {
        fromCurrency: 'USD',
        toCurrency: 'NPR',
        amount: -100, // Negative amount
        date: new Date(),
      };

      (fxRateService.getCurrentRate as any).mockResolvedValue(132.5);

      // Act & Assert
      await expect(multiCurrencyService.convertCurrency(conversionRequest)).rejects.toThrow(
        'Amount must be positive',
      );
    });
  });

  describe('Multi-Currency Pricing', () => {
    it('should create multi-currency pricing for listing', async () => {
      // Arrange
      const listingId = 'listing-123';
      const baseCurrency = 'NPR';
      const basePrice = 50000; // NPR

      const pricingRequest = {
        listingId,
        baseCurrency,
        basePrice,
        targetCurrencies: ['USD', 'EUR', 'GBP'],
        pricingStrategy: 'dynamic' as 'fixed' | 'dynamic' | 'competitive',
      };

      const exchangeRates = {
        'NPR-USD': 0.0075,
        'NPR-EUR': 0.0069,
        'NPR-GBP': 0.0059,
      };

      const pricingResult = {
        listingId,
        baseCurrency,
        basePrice,
        currencyPrices: {
          NPR: { price: 50000, formatted: 'NPR 50,000', symbol: '₹' },
          USD: { price: 375, formatted: '$375.00', symbol: '$' },
          EUR: { price: 345, formatted: '€345.00', symbol: '€' },
          GBP: { price: 295, formatted: '£295.00', symbol: '£' },
        },
        pricingStrategy: 'dynamic',
        lastUpdated: new Date(),
        nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      (listingRepository.findById as any).mockResolvedValue({ id: listingId });
      (fxRateService.convert as any).mockImplementation((amount, from, to) => {
        const key = `${from}-${to}`;
        const rate = exchangeRates[key];
        return Promise.resolve({ amount: amount * rate, rate });
      });
      (cacheService.set as any).mockResolvedValue(undefined);

      // Act
      const result = await multiCurrencyService.createMultiCurrencyPricing(pricingRequest);

      // Assert
      expect(result.currencyPrices.USD.price).toBe(375);
      expect(result.currencyPrices.EUR.formatted).toBe('€345.00');
      expect(result.currencyPrices.GBP.symbol).toBe('£');
      expect(result.pricingStrategy).toBe('dynamic');
      expect(fxRateService.convert).toHaveBeenCalledTimes(3);
    });

    it('should update multi-currency pricing based on exchange rate changes', async () => {
      // Arrange
      const listingId = 'listing-456';
      const currentPricing = {
        listingId,
        baseCurrency: 'NPR',
        basePrice: 75000,
        currencyPrices: {
          USD: { price: 562.5, rate: 0.0075 },
          EUR: { price: 517.5, rate: 0.0069 },
        },
        lastUpdated: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      };

      const newRates = {
        'NPR-USD': 0.0078, // Rate increased
        'NPR-EUR': 0.0067, // Rate decreased
      };

      const updatedPricing = {
        ...currentPricing,
        currencyPrices: {
          USD: { price: 585, formatted: '$585.00', symbol: '$', rate: 0.0078 },
          EUR: { price: 502.5, formatted: '€502.50', symbol: '€', rate: 0.0067 },
        },
        lastUpdated: new Date(),
        updateReason: 'exchange_rate_change',
      };

      (cacheService.get as any).mockResolvedValue(currentPricing);
      (fxRateService.convert as any).mockImplementation((amount, from, to) => {
        const key = `${from}-${to}`;
        const rate = newRates[key];
        return Promise.resolve({ amount: amount * rate, rate });
      });
      (cacheService.set as any).mockResolvedValue(undefined);

      // Act
      const result = await multiCurrencyService.updateMultiCurrencyPricing(listingId);

      // Assert
      expect(result.currencyPrices.USD.price).toBe(585); // Increased from 562.50
      expect(result.currencyPrices.EUR.price).toBe(502.5); // Decreased from 517.50
      expect(result.updateReason).toBe('exchange_rate_change');
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle pricing strategy adjustments', async () => {
      // TODO: Implement competitive pricing strategy logic in MultiCurrencyService
      // This test requires implementing market adjustment logic which is not yet implemented
      // Arrange
      const pricingRequest = {
        listingId: 'listing-789',
        baseCurrency: 'NPR',
        basePrice: 100000,
        targetCurrencies: ['USD', 'EUR'],
        pricingStrategy: 'competitive' as 'fixed' | 'dynamic' | 'competitive',
        marketAdjustment: {
          USD: -5, // 5% discount in USD market
          EUR: +3, // 3% premium in EUR market
        },
      };

      const baseRates = {
        'NPR-USD': 0.0075,
        'NPR-EUR': 0.0069,
      };

      const competitivePricing = {
        listingId: 'listing-789',
        baseCurrency: 'NPR',
        basePrice: 100000,
        currencyPrices: {
          NPR: { price: 100000, formatted: 'NPR 100,000', symbol: '₹' },
          USD: { price: 712.5, formatted: '$712.50', symbol: '$', adjusted: true, adjustment: -5 },
          EUR: { price: 710.7, formatted: '€710.70', symbol: '€', adjusted: true, adjustment: +3 },
        },
        pricingStrategy: 'competitive',
        marketAdjustments: {
          USD: -5,
          EUR: +3,
        },
        lastUpdated: new Date(),
      };

      (listingRepository.findById as any).mockResolvedValue({ id: 'listing-789' });
      (fxRateService.getCurrentRate as any).mockImplementation((from, to) => {
        const key = `${from}-${to}`;
        return Promise.resolve(baseRates[key]);
      });

      // Act
      const result = await multiCurrencyService.createMultiCurrencyPricing(pricingRequest);

      // Assert
      expect(result.currencyPrices.USD.price).toBe(712.5); // 750 * 0.95 (5% discount)
      expect(result.currencyPrices.EUR.price).toBe(710.7); // 690 * 1.03 (3% premium)
      expect(result.currencyPrices.USD.adjusted).toBe(true);
      expect(result.currencyPrices.USD.adjustment).toBe(-5);
      expect(result.pricingStrategy).toBe('competitive');
    });
  });

  describe('Currency Validation', () => {
    it('should validate supported currencies', async () => {
      // Arrange
      const currencyCode = 'USD';
      const currency = {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
        isActive: true,
        supportedRegions: ['US', 'CA', 'International'],
      };

      (currencyRepository.findByCode as any).mockResolvedValue(currency);

      // Act
      const result = await multiCurrencyService.validateCurrency(currencyCode);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.currency.code).toBe('USD');
      expect(result.currency.symbol).toBe('$');
      expect(currencyRepository.findByCode).toHaveBeenCalledWith('USD');
    });

    it('should reject unsupported currencies', async () => {
      // Arrange
      const currencyCode = 'BTC'; // Bitcoin not supported
      (currencyRepository.findByCode as any).mockResolvedValue(null);

      // Act
      const result = await multiCurrencyService.validateCurrency(currencyCode);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.currency).toBeNull();
      expect(result.reason).toBe('Currency not supported');
    });

    it('should validate currency amounts and formatting', async () => {
      // Arrange
      const validationRequest = {
        currency: 'JPY', // Japanese Yen - no decimal places
        amount: 1234.56,
        format: true,
      };

      const currency = {
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        decimalPlaces: 0, // Yen doesn't use decimals
        isActive: true,
      };

      const validationResult = {
        valid: false,
        errors: ['Amount cannot have decimal places for JPY'],
        formattedAmount: '¥1,235', // Rounded
        currency: currency,
      };

      (currencyRepository.findByCode as any).mockResolvedValue(currency);

      // Act
      const result = await multiCurrencyService.validateCurrencyAmount(validationRequest);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount cannot have decimal places for JPY');
      expect(result.formattedAmount).toBe('¥1,235');
      expect(currencyRepository.findByCode).toHaveBeenCalledWith('JPY');
    });

    it('should detect currency fraud patterns', async () => {
      // Arrange
      const transactionData = {
        userId: 'user-123',
        currency: 'USD',
        amount: 50000, // Unusually large amount
        frequency: 'high', // Many transactions
        pattern: 'rapid_conversions',
      };

      const fraudAnalysis = {
        riskScore: 85, // High risk
        riskLevel: 'high',
        riskFactors: [
          'unusually_large_amount',
          'high_frequency_transactions',
          'rapid_conversion_pattern',
        ],
        recommendation: 'manual_review',
        alerted: true,
      };

      // Act
      const result = await multiCurrencyService.detectCurrencyFraud(transactionData);

      // Assert
      expect(result.riskScore).toBe(85);
      expect(result.riskLevel).toBe('high');
      expect(result.riskFactors).toContain('unusually_large_amount');
      expect(result.recommendation).toBe('manual_review');
    });
  });

  describe('Exchange Rate Updates', () => {
    it('should update exchange rates from external provider', async () => {
      // Arrange
      const providerData = {
        provider: 'fixer',
        rates: {
          'USD-NPR': 132.75,
          'USD-EUR': 0.91,
          'USD-GBP': 0.78,
          'EUR-GBP': 0.86,
        },
        timestamp: new Date(),
        source: 'api.fixer.io',
      };

      const updateResult = {
        updated: 4,
        failed: 0,
        rates: [
          { from: 'USD', to: 'NPR', oldRate: 132.5, newRate: 132.75, change: 0.25 },
          { from: 'USD', to: 'EUR', oldRate: 0.92, newRate: 0.91, change: -0.01 },
          { from: 'USD', to: 'GBP', oldRate: 0.79, newRate: 0.78, change: -0.01 },
          { from: 'EUR', to: 'GBP', oldRate: 0.87, newRate: 0.86, change: -0.01 },
        ],
        timestamp: new Date(),
      };

      (exchangeRateRepository.bulkUpdateRates as any).mockResolvedValue(updateResult);
      (cacheService.delPattern as any).mockResolvedValue(undefined);

      // Act
      const result = await multiCurrencyService.updateExchangeRates(providerData);

      // Assert
      expect(result.updated).toBe(4);
      expect(result.failed).toBe(0);
      expect(result.rates).toHaveLength(4);
      expect(result.rates[0].change).toBe(0.25);
      expect(exchangeRateRepository.bulkUpdateRates).toHaveBeenCalledWith(providerData.rates);
      expect(cacheService.delPattern).toHaveBeenCalledWith('conversion:*');
    });

    it('should handle exchange rate update failures', async () => {
      // Arrange
      const providerData = {
        provider: 'fixer',
        rates: {
          'USD-NPR': 132.75,
        },
        timestamp: new Date(),
      };

      const partialFailure = {
        updated: 0,
        failed: 1,
        errors: ['Database connection timeout'],
        timestamp: new Date(),
      };

      (exchangeRateRepository.bulkUpdateRates as any).mockResolvedValue(partialFailure);

      // Act
      const result = await multiCurrencyService.updateExchangeRates(providerData);

      // Assert
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Database connection timeout');
    });

    it('should validate exchange rate accuracy', async () => {
      // Arrange
      const rateValidation = {
        fromCurrency: 'USD',
        toCurrency: 'NPR',
        proposedRate: 250.0, // Unusually high rate
        historicalAverage: 132.5,
        tolerance: 10, // 10% tolerance
      };

      const validationResult = {
        valid: false,
        reason: 'Rate deviation exceeds tolerance',
        deviation: 88.7, // percentage deviation
        recommendedAction: 'manual_review',
        alertTriggered: true,
      };

      (exchangeRateRepository.validateRate as any).mockResolvedValue(validationResult);

      // Act
      const result = await multiCurrencyService.validateExchangeRate(rateValidation);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.deviation).toBe(88.7);
      expect(result.recommendedAction).toBe('manual_review');
      expect(exchangeRateRepository.validateRate).toHaveBeenCalledWith(rateValidation);
    });

    it('should schedule periodic exchange rate updates', async () => {
      // Arrange
      const scheduleConfig = {
        interval: 3600, // 1 hour
        providers: ['fixer', 'exchangerate-api'],
        retryAttempts: 3,
        alertThreshold: 5, // Alert after 5 failures
      };

      const scheduleResult = {
        scheduled: true,
        nextUpdate: new Date(Date.now() + 3600 * 1000),
        providers: ['fixer', 'exchangerate-api'],
        lastUpdate: new Date(),
        updateHistory: [
          { timestamp: new Date(Date.now() - 3600 * 1000), success: true, provider: 'fixer' },
          {
            timestamp: new Date(Date.now() - 7200 * 1000),
            success: true,
            provider: 'exchangerate-api',
          },
        ],
      };

      // Act
      const result = await multiCurrencyService.scheduleExchangeRateUpdates(scheduleConfig);

      // Assert
      expect(result.scheduled).toBe(true);
      expect(result.nextUpdate).toBeInstanceOf(Date);
      expect(result.providers).toEqual(['fixer', 'exchangerate-api']);
      expect(result.updateHistory).toHaveLength(2);
    });
  });

  describe('Currency Reporting', () => {
    it('should generate multi-currency financial reports', async () => {
      // Arrange
      const reportConfig = {
        period: {
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-30'),
        },
        baseCurrency: 'NPR',
        includeCurrencies: ['NPR', 'USD', 'EUR'],
        reportType: 'comprehensive',
      };

      // Act
      const result = await multiCurrencyService.generateCurrencyReport(reportConfig);

      // Assert
      expect(result.period).toEqual(reportConfig.period);
      expect(result.baseCurrency).toBe('NPR');
      expect(result.summary.totalRevenue.consolidated).toBe(5000000); // Only base currency volume
      expect(result.currencyBreakdown).toBeDefined();
      expect(Object.keys(result.currencyBreakdown)).toContain('NPR');
    });

    it('should create currency performance analytics', async () => {
      // Arrange
      const analyticsConfig = {
        timeRange: 'last_90_days',
        metrics: ['volume', 'growth', 'volatility', 'conversion_rate'],
        currencies: ['NPR', 'USD', 'EUR', 'GBP'],
        includeForecasting: true,
      };

      // Act
      const result = await multiCurrencyService.generateCurrencyAnalytics(analyticsConfig);

      // Assert
      expect(result.timeRange).toBe('last_90_days');
      expect(result.currencyPerformance).toBeDefined();
      expect(result.marketInsights).toBeDefined();
      expect(result.trends).toBeDefined();
    });
  });

  describe('Cross-Border Payments', () => {
    it('should process cross-border payment with currency conversion', async () => {
      // Arrange
      const paymentRequest = {
        userId: 'user-123',
        listingId: 'listing-456',
        amount: 1000,
        sourceCurrency: 'USD',
        targetCurrency: 'NPR',
        paymentMethod: 'international_transfer',
        recipientInfo: {
          name: 'Property Owner',
          accountNumber: '1234567890',
          bankCode: 'NPRB',
          country: 'NP',
        },
      };

      const conversionResult = {
        originalAmount: 1000,
        originalCurrency: 'USD',
        convertedAmount: 132500,
        convertedCurrency: 'NPR',
        exchangeRate: 132.5,
        conversionFee: 325, // 0.25% fee
        transferFee: 500, // Fixed transfer fee
        totalFees: 825,
        netAmount: 131675, // Amount after fees
      };

      const paymentResult = {
        paymentId: 'payment-789',
        status: 'processed',
        ...conversionResult,
        processingTime: 2.5, // seconds
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        trackingNumber: 'INT-2024-001',
        complianceChecked: true,
        regulations: ['OFAC', 'FATF'],
      };

      (exchangeRateRepository.getCurrentRate as any).mockResolvedValue({
        fromCurrency: 'USD',
        toCurrency: 'NPR',
        rate: 132.5,
        source: 'fixer',
        timestamp: new Date(),
      });
      (paymentRepository.createPayment as any).mockResolvedValue(paymentResult);

      // Act
      const result = await multiCurrencyService.processCrossBorderPayment(paymentRequest);

      // Assert
      expect(result.paymentId).toMatch(/^payment-\d+$/);
      expect(result.status).toBe('processed');
      expect(result.netAmount).toBeGreaterThan(0);
      expect(result.totalFees).toBeGreaterThan(0);
      expect(result.complianceChecked).toBe(true);
      expect(result.regulations).toContain('OFAC');
    });

    it('should handle international compliance checks', async () => {
      // Arrange
      const complianceRequest = {
        transactionId: 'tx-123',
        amount: 50000,
        currency: 'USD',
        sourceCountry: 'US',
        targetCountry: 'NP',
        parties: {
          sender: { userId: 'user-123', country: 'US', riskLevel: 'low' },
          receiver: { userId: 'owner-456', country: 'NP', riskLevel: 'low' },
        },
      };

      const complianceResult = {
        compliant: true,
        riskScore: 15, // Low risk
        checksPerformed: [
          { type: 'sanctions_screening', result: 'passed', details: 'No sanctions found' },
          { type: 'aml_check', result: 'passed', details: 'No suspicious patterns' },
          { type: 'kyc_verification', result: 'passed', details: 'Both parties verified' },
          { type: 'country_risk', result: 'passed', details: 'Low-risk countries' },
        ],
        regulations: {
          applicable: ['OFAC', 'FATF', 'Local_NP_Regulations'],
          requirements: ['reporting_threshold_met', 'documentation_required'],
        },
        actions: ['proceed_with_transaction', 'generate_compliance_report'],
      };

      // Act
      const result = await multiCurrencyService.performComplianceCheck(complianceRequest);

      // Assert
      expect(result.compliant).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.checksPerformed).toHaveLength(4);
      expect(result.checksPerformed[0].result).toBe('passed');
      expect(result.regulations.applicable).toContain('OFAC');
      expect(result.actions).toContain('proceed_with_transaction');
    });

    it('should calculate international transfer fees', async () => {
      // Arrange
      const feeCalculationRequest = {
        amount: 2000,
        sourceCurrency: 'EUR',
        targetCurrency: 'NPR',
        transferType: 'international_wire',
        urgency: 'standard', // standard, expedited, instant
        destinationCountry: 'NP',
      };

      const feeBreakdown = {
        baseAmount: 2000,
        exchangeRate: 145.2,
        convertedAmount: 290400,
        fees: {
          conversionFee: {
            amount: 726, // 0.25% of converted amount
            rate: 0.25,
            description: 'Currency conversion fee',
          },
          transferFee: {
            amount: 1500, // Fixed international wire fee
            description: 'International wire transfer fee',
          },
          urgencyFee: {
            amount: 0, // No urgency fee for standard
            description: 'Standard processing - no urgency fee',
          },
          correspondentFee: {
            amount: 500, // Bank correspondent fee
            description: 'Correspondent banking fee',
          },
          regulatoryFee: {
            amount: 100, // Regulatory compliance fee
            description: 'Regulatory compliance fee',
          },
        },
        totalFees: 2826,
        netAmount: 287574,
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        feeSchedule: {
          standard: { delivery: '3-5 business days', totalFees: 2826 },
          expedited: { delivery: '1-2 business days', totalFees: 3826 },
          instant: { delivery: 'same day', totalFees: 5826 },
        },
      };

      (exchangeRateRepository.getCurrentRate as any).mockResolvedValue({
        fromCurrency: 'EUR',
        toCurrency: 'NPR',
        rate: 145.2,
        source: 'fixer',
        timestamp: new Date(),
      });

      // Act
      const result = await multiCurrencyService.calculateInternationalFees(feeCalculationRequest);

      // Assert
      expect(result.convertedAmount).toBeGreaterThan(0);
      expect(result.fees.conversionFee.amount).toBeGreaterThan(0);
      expect(result.fees.transferFee.amount).toBe(1500);
      expect(result.totalFees).toBeGreaterThan(0);
      expect(result.netAmount).toBeGreaterThan(0);
      expect(result.feeSchedule.standard.delivery).toBe('3-5 business days');
    });
  });
});
