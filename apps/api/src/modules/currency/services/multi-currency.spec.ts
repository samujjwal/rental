import { Test, TestingModule } from '@nestjs/testing';
import { MultiCurrencyService } from './multi-currency.service';
import { CurrencyRepository } from '../repositories/currency.repository';
import { ExchangeRateRepository } from '../repositories/exchange-rate.repository';
import { PaymentRepository } from '../../payments/repositories/payment.repository';
import { ListingRepository } from '../../listings/repositories/listing.repository';
import { CacheService } from '../../cache/services/cache.service';
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
            findByCode: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            getActiveCurrencies: jest.fn(),
            getCurrencyStats: jest.fn(),
          },
        },
        {
          provide: ExchangeRateRepository,
          useValue: {
            getCurrentRate: jest.fn(),
            getHistoricalRates: jest.fn(),
            updateRate: jest.fn(),
            bulkUpdateRates: jest.fn(),
            getRateHistory: jest.fn(),
            validateRate: jest.fn(),
          },
        },
        {
          provide: PaymentRepository,
          useValue: {
            findById: jest.fn(),
            findByCurrency: jest.fn(),
            createPayment: jest.fn(),
            updatePayment: jest.fn(),
            getPaymentStats: jest.fn(),
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
            invalidatePattern: jest.fn(),
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
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Currency Conversion', () => {
    it('should convert currency with current exchange rate', async () => {
      // Arrange
      const fromCurrency = 'USD';
      const toCurrency = 'NPR';
      const amount = 100;
      const expectedRate = 132.50; // 1 USD = 132.50 NPR
      
      const conversionRequest = {
        fromCurrency,
        toCurrency,
        amount,
        date: new Date(),
      };

      const exchangeRate = {
        fromCurrency,
        toCurrency,
        rate: expectedRate,
        source: 'fixer',
        timestamp: new Date(),
      };

      const conversionResult = {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: amount * expectedRate,
        convertedCurrency: toCurrency,
        exchangeRate: expectedRate,
        conversionDate: new Date(),
        fee: 0.5, // 0.5% conversion fee
        totalAmount: amount * expectedRate * 1.005, // Including fee
      };

      exchangeRateRepository.getCurrentRate.mockResolvedValue(exchangeRate);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await multiCurrencyService.convertCurrency(conversionRequest);

      // Assert
      expect(result.convertedAmount).toBe(13250);
      expect(result.totalAmount).toBe(13316.25); // 13250 * 1.005
      expect(result.exchangeRate).toBe(expectedRate);
      expect(result.fee).toBe(0.5);
      expect(exchangeRateRepository.getCurrentRate).toHaveBeenCalledWith(fromCurrency, toCurrency);
      expect(cacheService.set).toHaveBeenCalledWith(
        `conversion:${fromCurrency}:${toCurrency}:${new Date().toDateString()}`,
        conversionResult,
        300
      );
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

      cacheService.get.mockResolvedValue(cachedResult);

      // Act
      const result = await multiCurrencyService.convertCurrency(conversionRequest);

      // Assert
      expect(result.convertedAmount).toBe(7250);
      expect(result.exchangeRate).toBe(145);
      expect(exchangeRateRepository.getCurrentRate).not.toHaveBeenCalled();
      expect(cacheService.get).toHaveBeenCalledWith(
        `conversion:${fromCurrency}:${toCurrency}:${new Date().toDateString()}`
      );
    });

    it('should convert multiple currencies in batch', async () => {
      // Arrange
      const batchRequest = {
        baseCurrency: 'USD',
        targetCurrencies: ['NPR', 'EUR', 'GBP', 'INR'],
        amounts: [100, 200, 300, 400],
      };

      const exchangeRates = {
        'USD-NPR': 132.50,
        'USD-EUR': 0.92,
        'USD-GBP': 0.79,
        'USD-INR': 83.25,
      };

      const batchResult = {
        baseCurrency: 'USD',
        conversions: [
          { currency: 'NPR', amount: 100, converted: 13250, rate: 132.50 },
          { currency: 'EUR', amount: 200, converted: 184, rate: 0.92 },
          { currency: 'GBP', amount: 300, converted: 237, rate: 0.79 },
          { currency: 'INR', amount: 400, converted: 33300, rate: 83.25 },
        ],
        totalFees: 2.5, // Average fee
        timestamp: new Date(),
      };

      exchangeRateRepository.getCurrentRate.mockImplementation((from, to) => {
        const key = `${from}-${to}`;
        return Promise.resolve({
          fromCurrency: from,
          toCurrency: to,
          rate: exchangeRates[key],
          source: 'fixer',
          timestamp: new Date(),
        });
      });

      // Act
      const result = await multiCurrencyService.batchConvertCurrency(batchRequest);

      // Assert
      expect(result.conversions).toHaveLength(4);
      expect(result.conversions[0].currency).toBe('NPR');
      expect(result.conversions[0].converted).toBe(13250);
      expect(result.conversions[1].currency).toBe('EUR');
      expect(result.conversions[1].converted).toBe(184);
      expect(exchangeRateRepository.getCurrentRate).toHaveBeenCalledTimes(4);
    });

    it('should handle unsupported currency conversion', async () => {
      // Arrange
      const conversionRequest = {
        fromCurrency: 'XYZ', // Unsupported currency
        toCurrency: 'NPR',
        amount: 100,
        date: new Date(),
      };

      currencyRepository.findByCode.mockResolvedValue(null);

      // Act & Assert
      await expect(multiCurrencyService.convertCurrency(conversionRequest)).rejects.toThrow('Unsupported currency: XYZ');
      expect(currencyRepository.findByCode).toHaveBeenCalledWith('XYZ');
    });

    it('should handle zero or negative amounts', async () => {
      // Arrange
      const conversionRequest = {
        fromCurrency: 'USD',
        toCurrency: 'NPR',
        amount: -100, // Negative amount
        date: new Date(),
      };

      const exchangeRate = {
        fromCurrency: 'USD',
        toCurrency: 'NPR',
        rate: 132.50,
        source: 'fixer',
        timestamp: new Date(),
      };

      exchangeRateRepository.getCurrentRate.mockResolvedValue(exchangeRate);

      // Act & Assert
      await expect(multiCurrencyService.convertCurrency(conversionRequest)).rejects.toThrow('Amount must be positive');
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
        pricingStrategy: 'dynamic', // Adjust for market conditions
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

      listingRepository.findById.mockResolvedValue({ id: listingId });
      exchangeRateRepository.getCurrentRate.mockImplementation((from, to) => {
        const key = `${from}-${to}`;
        return Promise.resolve({
          fromCurrency: from,
          toCurrency: to,
          rate: exchangeRates[key],
          source: 'fixer',
          timestamp: new Date(),
        });
      });
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await multiCurrencyService.createMultiCurrencyPricing(pricingRequest);

      // Assert
      expect(result.currencyPrices.USD.price).toBe(375);
      expect(result.currencyPrices.EUR.formatted).toBe('€345.00');
      expect(result.currencyPrices.GBP.symbol).toBe('£');
      expect(result.pricingStrategy).toBe('dynamic');
      expect(listingRepository.findById).toHaveBeenCalledWith(listingId);
      expect(exchangeRateRepository.getCurrentRate).toHaveBeenCalledTimes(3);
    });

    it('should update multi-currency pricing based on exchange rate changes', async () => {
      // Arrange
      const listingId = 'listing-456';
      const currentPricing = {
        listingId,
        baseCurrency: 'NPR',
        basePrice: 75000,
        currencyPrices: {
          USD: { price: 562.50, rate: 0.0075 },
          EUR: { price: 517.50, rate: 0.0069 },
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
          EUR: { price: 502.50, formatted: '€502.50', symbol: '€', rate: 0.0067 },
        },
        lastUpdated: new Date(),
        updateReason: 'exchange_rate_change',
      };

      cacheService.get.mockResolvedValue(currentPricing);
      exchangeRateRepository.getCurrentRate.mockImplementation((from, to) => {
        const key = `${from}-${to}`;
        return Promise.resolve({
          fromCurrency: from,
          toCurrency: to,
          rate: newRates[key],
          source: 'fixer',
          timestamp: new Date(),
        });
      });
      cacheService.set.mockResolvedValue(true);

      // Act
      const result = await multiCurrencyService.updateMultiCurrencyPricing(listingId);

      // Assert
      expect(result.currencyPrices.USD.price).toBe(585); // Increased from 562.50
      expect(result.currencyPrices.EUR.price).toBe(502.50); // Decreased from 517.50
      expect(result.updateReason).toBe('exchange_rate_change');
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle pricing strategy adjustments', async () => {
      // Arrange
      const pricingRequest = {
        listingId: 'listing-789',
        baseCurrency: 'NPR',
        basePrice: 100000,
        targetCurrencies: ['USD', 'EUR'],
        pricingStrategy: 'competitive', // Adjust to be competitive
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
          USD: { price: 712.50, formatted: '$712.50', symbol: '$', adjusted: true, adjustment: -5 },
          EUR: { price: 710.70, formatted: '€710.70', symbol: '€', adjusted: true, adjustment: +3 },
        },
        pricingStrategy: 'competitive',
        marketAdjustments: {
          USD: -5,
          EUR: +3,
        },
        lastUpdated: new Date(),
      };

      listingRepository.findById.mockResolvedValue({ id: 'listing-789' });
      exchangeRateRepository.getCurrentRate.mockImplementation((from, to) => {
        const key = `${from}-${to}`;
        return Promise.resolve({
          fromCurrency: from,
          toCurrency: to,
          rate: baseRates[key],
          source: 'fixer',
          timestamp: new Date(),
        });
      });

      // Act
      const result = await multiCurrencyService.createMultiCurrencyPricing(pricingRequest);

      // Assert
      expect(result.currencyPrices.USD.price).toBe(712.50); // 750 * 0.95 (5% discount)
      expect(result.currencyPrices.EUR.price).toBe(710.70); // 690 * 1.03 (3% premium)
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

      currencyRepository.findByCode.mockResolvedValue(currency);

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
      currencyRepository.findByCode.mockResolvedValue(null);

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

      currencyRepository.findByCode.mockResolvedValue(currency);

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
          { from: 'USD', to: 'NPR', oldRate: 132.50, newRate: 132.75, change: 0.25 },
          { from: 'USD', to: 'EUR', oldRate: 0.92, newRate: 0.91, change: -0.01 },
          { from: 'USD', to: 'GBP', oldRate: 0.79, newRate: 0.78, change: -0.01 },
          { from: 'EUR', to: 'GBP', oldRate: 0.87, newRate: 0.86, change: -0.01 },
        ],
        timestamp: new Date(),
      };

      exchangeRateRepository.bulkUpdateRates.mockResolvedValue(updateResult);
      cacheService.invalidatePattern.mockResolvedValue(true);

      // Act
      const result = await multiCurrencyService.updateExchangeRates(providerData);

      // Assert
      expect(result.updated).toBe(4);
      expect(result.failed).toBe(0);
      expect(result.rates).toHaveLength(4);
      expect(result.rates[0].change).toBe(0.25);
      expect(exchangeRateRepository.bulkUpdateRates).toHaveBeenCalledWith(providerData.rates);
      expect(cacheService.invalidatePattern).toHaveBeenCalledWith('conversion:*');
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

      exchangeRateRepository.bulkUpdateRates.mockResolvedValue(partialFailure);

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
        proposedRate: 250.00, // Unusually high rate
        historicalAverage: 132.50,
        tolerance: 10, // 10% tolerance
      };

      const validationResult = {
        valid: false,
        reason: 'Rate deviation exceeds tolerance',
        deviation: 88.7, // percentage deviation
        recommendedAction: 'manual_review',
        alertTriggered: true,
      };

      exchangeRateRepository.validateRate.mockResolvedValue(validationResult);

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
          { timestamp: new Date(Date.now() - 7200 * 1000), success: true, provider: 'exchangerate-api' },
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

      const currencyReport = {
        period: reportConfig.period,
        baseCurrency: 'NPR',
        summary: {
          totalRevenue: {
            NPR: 5000000,
            USD: 37500,
            EUR: 34500,
            consolidated: 5000000, // In base currency
          },
          totalExpenses: {
            NPR: 1500000,
            USD: 11250,
            EUR: 10350,
            consolidated: 1500000,
          },
          netProfit: {
            NPR: 3500000,
            USD: 26250,
            EUR: 24150,
            consolidated: 3500000,
          },
        },
        currencyBreakdown: {
          NPR: { percentage: 85, volume: 5000000, transactions: 1250 },
          USD: { percentage: 10, volume: 37500, transactions: 180 },
          EUR: { percentage: 5, volume: 34500, transactions: 95 },
        },
        exchangeRateImpact: {
          rateChanges: [
            { date: '2024-06-15', from: 'USD', to: 'NPR', oldRate: 132.50, newRate: 132.75, impact: 9375 },
            { date: '2024-06-20', from: 'EUR', to: 'NPR', oldRate: 144.80, newRate: 145.20, impact: 1380 },
          ],
          totalImpact: 10755,
          volatility: 'low',
        },
        analytics: {
          conversionTrends: {
            USD_to_NPR: 'increasing',
            EUR_to_NPR: 'stable',
            GBP_to_NPR: 'decreasing',
          },
          popularCurrencies: ['NPR', 'USD', 'EUR'],
          growthRates: {
            NPR: 12.5,
            USD: 18.3,
            EUR: 8.7,
          },
        },
        recommendations: [
          {
            type: 'opportunity',
            title: 'USD Market Growth',
            description: 'USD transactions showing 18.3% growth',
            action: 'expand_USD_marketing',
            potentialImpact: '+15% revenue',
          },
        ],
      };

      paymentRepository.getPaymentStats.mockResolvedValue({
        totalRevenue: 5000000,
        totalExpenses: 1500000,
        currencyBreakdown: {
          NPR: { volume: 5000000, transactions: 1250 },
          USD: { volume: 37500, transactions: 180 },
          EUR: { volume: 34500, transactions: 95 },
        },
      });
      exchangeRateRepository.getHistoricalRates.mockResolvedValue([
        { date: '2024-06-15', from: 'USD', to: 'NPR', rate: 132.75 },
        { date: '2024-06-20', from: 'EUR', to: 'NPR', rate: 145.20 },
      ]);

      // Act
      const result = await multiCurrencyService.generateCurrencyReport(reportConfig);

      // Assert
      expect(result.summary.totalRevenue.consolidated).toBe(5000000);
      expect(result.currencyBreakdown.NPR.percentage).toBe(85);
      expect(result.exchangeRateImpact.totalImpact).toBe(10755);
      expect(result.analytics.conversionTrends.USD_to_NPR).toBe('increasing');
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].type).toBe('opportunity');
    });

    it('should create currency performance analytics', async () => {
      // Arrange
      const analyticsConfig = {
        timeRange: 'last_90_days',
        metrics: ['volume', 'growth', 'volatility', 'conversion_rate'],
        currencies: ['NPR', 'USD', 'EUR', 'GBP'],
        includeForecasting: true,
      };

      const performanceAnalytics = {
        timeRange: analyticsConfig.timeRange,
        currencyPerformance: {
          NPR: {
            volume: 15000000,
            growth: 15.2,
            volatility: 8.5,
            conversionRate: 0.95,
            marketShare: 82.3,
            forecast: {
              nextMonth: 15800000,
              confidence: 0.87,
              trend: 'increasing',
            },
          },
          USD: {
            volume: 1125000,
            growth: 22.7,
            volatility: 12.3,
            conversionRate: 0.89,
            marketShare: 6.2,
            forecast: {
              nextMonth: 1250000,
              confidence: 0.82,
              trend: 'increasing',
            },
          },
          EUR: {
            volume: 1035000,
            growth: 9.8,
            volatility: 10.1,
            conversionRate: 0.91,
            marketShare: 5.7,
            forecast: {
              nextMonth: 1080000,
              confidence: 0.79,
              trend: 'stable',
            },
          },
          GBP: {
            volume: 890000,
            growth: -3.2,
            volatility: 14.7,
            conversionRate: 0.87,
            marketShare: 4.9,
            forecast: {
              nextMonth: 860000,
              confidence: 0.75,
              trend: 'decreasing',
            },
          },
        },
        marketInsights: {
          fastestGrowing: 'USD',
          highestVolume: 'NPR',
          mostVolatile: 'GBP',
          bestConversionRate: 'NPR',
        },
        trends: {
          overall: 'positive_growth',
          emergingMarkets: ['USD'],
          decliningMarkets: ['GBP'],
          stableMarkets: ['NPR', 'EUR'],
        },
        recommendations: [
          {
            priority: 'high',
            currency: 'USD',
            action: 'increase_marketing_spend',
            reason: '22.7% growth with high conversion rate',
            expectedROI: '+25%',
          },
          {
            priority: 'medium',
            currency: 'GBP',
            action: 'investigate_decline',
            reason: '3.2% decline with high volatility',
            expectedImpact: 'stabilize_market',
          },
        ],
      };

      paymentRepository.getPaymentStats.mockResolvedValue({
        currencyStats: performanceAnalytics.currencyPerformance,
      });

      // Act
      const result = await multiCurrencyService.generateCurrencyAnalytics(analyticsConfig);

      // Assert
      expect(result.currencyPerformance.USD.growth).toBe(22.7);
      expect(result.currencyPerformance.GBP.growth).toBe(-3.2);
      expect(result.marketInsights.fastestGrowing).toBe('USD');
      expect(result.trends.overall).toBe('positive_growth');
      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations[0].priority).toBe('high');
    });

    it('should track currency conversion efficiency', async () => {
      // Arrange
      const efficiencyConfig = {
        period: 'last_30_days',
        includeCosts: true,
        includeTimings: true,
      };

      const efficiencyReport = {
        period: efficiencyConfig.period,
        conversionMetrics: {
          totalConversions: 15420,
          successfulConversions: 15234,
          failedConversions: 186,
          successRate: 98.8,
          averageProcessingTime: 0.045, // seconds
          totalVolume: 8750000,
        },
        costAnalysis: {
          totalFees: 21875,
          averageFeeRate: 0.25, // percentage
          feeByCurrency: {
            USD: { totalFees: 8750, avgRate: 0.35 },
            EUR: { totalFees: 6562.50, avgRate: 0.30 },
            GBP: { totalFees: 4375, avgRate: 0.25 },
            NPR: { totalFees: 2187.50, avgRate: 0.15 },
          },
        },
        performanceMetrics: {
          cacheHitRate: 87.3,
          apiResponseTime: 0.032,
          errorRate: 1.2,
          timeoutRate: 0.3,
        },
        optimizationOpportunities: [
          {
            area: 'cache_optimization',
            currentPerformance: 87.3,
            targetPerformance: 95.0,
            potentialSavings: '+15% processing_time',
            implementation: 'increase_cache_duration_and_size',
          },
          {
            area: 'fee_optimization',
            currentAverage: 0.25,
            targetAverage: 0.20,
            potentialSavings: '-20% fees',
            implementation: 'negotiate_better_rates_with_providers',
          },
        ],
      };

      // Act
      const result = await multiCurrencyService.generateEfficiencyReport(efficiencyConfig);

      // Assert
      expect(result.conversionMetrics.successRate).toBe(98.8);
      expect(result.costAnalysis.totalFees).toBe(21875);
      expect(result.performanceMetrics.cacheHitRate).toBe(87.3);
      expect(result.optimizationOpportunities).toHaveLength(2);
      expect(result.optimizationOpportunities[0].area).toBe('cache_optimization');
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
        exchangeRate: 132.50,
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

      exchangeRateRepository.getCurrentRate.mockResolvedValue({
        fromCurrency: 'USD',
        toCurrency: 'NPR',
        rate: 132.50,
        source: 'fixer',
        timestamp: new Date(),
      });
      paymentRepository.createPayment.mockResolvedValue(paymentResult);

      // Act
      const result = await multiCurrencyService.processCrossBorderPayment(paymentRequest);

      // Assert
      expect(result.paymentId).toBe('payment-789');
      expect(result.status).toBe('processed');
      expect(result.netAmount).toBe(131675);
      expect(result.totalFees).toBe(825);
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
      expect(result.riskScore).toBe(15);
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
        exchangeRate: 145.20,
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

      exchangeRateRepository.getCurrentRate.mockResolvedValue({
        fromCurrency: 'EUR',
        toCurrency: 'NPR',
        rate: 145.20,
        source: 'fixer',
        timestamp: new Date(),
      });

      // Act
      const result = await multiCurrencyService.calculateInternationalFees(feeCalculationRequest);

      // Assert
      expect(result.convertedAmount).toBe(290400);
      expect(result.fees.conversionFee.amount).toBe(726);
      expect(result.fees.transferFee.amount).toBe(1500);
      expect(result.totalFees).toBe(2826);
      expect(result.netAmount).toBe(287574);
      expect(result.feeSchedule.standard.delivery).toBe('3-5 business days');
    });
  });
});
