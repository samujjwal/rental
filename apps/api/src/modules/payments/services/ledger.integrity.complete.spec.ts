import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { LedgerService } from '../services/ledger.service';
import { AuditService } from '@/common/audit/audit.service';
import { TransactionType, LedgerEntryStatus } from '@rental-portal/database';

/**
 * Ledger Integrity - Complete Validation
 * 
 * These tests validate the complete ledger integrity including
 * double-entry bookkeeping, audit trails, and financial data consistency.
 */
describe('Ledger Integrity - Complete Validation', () => {
  let service: LedgerService;
  let prisma: PrismaService;
  let cache: CacheService;
  let auditService: AuditService;

  beforeEach(async () => {
    const mockPrisma = {
      ledgerEntry: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      financialReport: {
        create: jest.fn().mockResolvedValue({ id: 'report-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback()),
    } as any;

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: AuditService, useValue: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) } },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
    auditService = module.get<AuditService>(AuditService);
  });

  describe('Double-Entry Bookkeeping', () => {
    it('should maintain balanced ledger entries', async () => {
      const transactions = [
        {
          id: 'tx-1',
          type: TransactionType.PAYMENT,
          amount: 100000, // $1000
          bookingId: 'booking-1',
          userId: 'user-1',
          hostId: 'host-1',
        },
        {
          id: 'tx-2',
          type: TransactionType.REFUND,
          amount: -25000, // -$250
          bookingId: 'booking-1',
          userId: 'user-1',
          hostId: 'host-1',
        },
      ];

      for (const transaction of transactions) {
        const entries = await service.createDoubleEntry(transaction);

        // Should create exactly two entries (debit and credit)
        expect(entries).toHaveLength(2);

        // Check that amounts are equal but opposite
        const debitEntry = entries.find(e => e.amount < 0);
        const creditEntry = entries.find(e => e.amount > 0);

        expect(debitEntry).toBeDefined();
        expect(creditEntry).toBeDefined();
        expect(Math.abs(debitEntry.amount)).toBe(creditEntry.amount);

        // Check that transaction IDs match
        expect(debitEntry.transactionId).toBe(transaction.id);
        expect(creditEntry.transactionId).toBe(transaction.id);

        // Verify database calls
        expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(2);
      }
    });

    it('should prevent orphaned entries', async () => {
      const orphanedEntries = [
        {
          id: 'ledger-1',
          transactionId: 'tx-1',
          amount: 50000,
          type: 'CREDIT',
          status: LedgerEntryStatus.POSTED,
          createdAt: new Date(),
        },
        {
          id: 'ledger-2',
          transactionId: 'tx-2',
          amount: -30000,
          type: 'DEBIT',
          status: LedgerEntryStatus.POSTED,
          createdAt: new Date(),
        },
      ];

      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue(orphanedEntries);

      const integrityCheck = await service.checkOrphanedEntries();

      expect(integrityCheck.orphanedEntries).toHaveLength(2);
      expect(integrityCheck.orphanedEntries[0].transactionId).toBe('tx-1');
      expect(integrityCheck.orphanedEntries[1].transactionId).toBe('tx-2');

      // Verify audit logging
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'orphaned_entries_detected',
          metadata: expect.objectContaining({
            count: 2,
            transactionIds: ['tx-1', 'tx-2'],
          }),
        }),
      });
    });

    it('should validate transaction completeness', async () => {
      const incompleteTransactions = [
        {
          transactionId: 'tx-1',
          entries: [
            { amount: 50000, type: 'CREDIT' },
            // Missing debit entry
          ],
        },
        {
          transactionId: 'tx-2',
          entries: [
            { amount: -30000, type: 'DEBIT' },
            // Missing credit entry
          ],
        },
        {
          transactionId: 'tx-3',
          entries: [
            { amount: 40000, type: 'CREDIT' },
            { amount: -35000, type: 'DEBIT' }, // Amount mismatch
          ],
        },
      ];

      (prisma.ledgerEntry.groupBy as jest.Mock).mockResolvedValue(
        incompleteTransactions.map(tx => ({
          transactionId: tx.transactionId,
          _count: { amount: tx.entries.length },
          _sum: { amount: tx.entries.reduce((sum, e) => sum + e.amount, 0) },
        }))
      );

      const completenessCheck = await service.validateTransactionCompleteness();

      expect(completenessCheck.incompleteTransactions).toHaveLength(3);
      expect(completenessCheck.incompleteTransactions[0].issue).toBe('missing_debit');
      expect(completenessCheck.incompleteTransactions[1].issue).toBe('missing_credit');
      expect(completenessCheck.incompleteTransactions[2].issue).toBe('amount_mismatch');
    });

    it('should handle complex multi-party transactions', async () => {
      const multiPartyTransaction = {
        id: 'tx-multi',
        type: TransactionType.PAYMENT,
        amount: 100000,
        bookingId: 'booking-1',
        userId: 'user-1',
        hostId: 'host-1',
        platformFee: 12000, // $120
        processingFee: 3000, // $30
      };

      const entries = await service.createMultiPartyEntry(multiPartyTransaction);

      // Should create entries for all parties
      expect(entries).toHaveLength(6); // 3 parties × 2 entries each

      // Check platform fee entries
      const platformDebit = entries.find(e => 
        e.accountType === 'PLATFORM_FEE' && e.amount < 0
      );
      const platformCredit = entries.find(e => 
        e.accountType === 'PLATFORM_FEE' && e.amount > 0
      );

      expect(platformDebit.amount).toBe(-12000);
      expect(platformCredit.amount).toBe(12000);

      // Check processing fee entries
      const processingDebit = entries.find(e => 
        e.accountType === 'PROCESSING_FEE' && e.amount < 0
      );
      const processingCredit = entries.find(e => 
        e.accountType === 'PROCESSING_FEE' && e.amount > 0
      );

      expect(processingDebit.amount).toBe(-3000);
      expect(processingCredit.amount).toBe(3000);

      // Check host and guest entries
      const hostCredit = entries.find(e => 
        e.accountType === 'HOST_REVENUE' && e.amount > 0
      );
      const guestDebit = entries.find(e => 
        e.accountType === 'GUEST_PAYMENT' && e.amount < 0
      );

      expect(hostCredit.amount).toBe(85000); // 100000 - 12000 - 3000
      expect(guestDebit.amount).toBe(-100000);
    });
  });

  describe('Audit Trail', () => {
    it('should log all financial transactions', async () => {
      const financialTransactions = [
        {
          type: TransactionType.PAYMENT,
          amount: 100000,
          bookingId: 'booking-1',
          userId: 'user-1',
          hostId: 'host-1',
          timestamp: new Date(),
        },
        {
          type: TransactionType.REFUND,
          amount: -25000,
          bookingId: 'booking-1',
          userId: 'user-1',
          hostId: 'host-1',
          timestamp: new Date(),
        },
        {
          type: TransactionType.PAYOUT,
          amount: 85000,
          hostId: 'host-1',
          timestamp: new Date(),
        },
      ];

      for (const transaction of financialTransactions) {
        await service.logFinancialTransaction(transaction);

        expect(auditService.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'financial_transaction',
            userId: transaction.userId || transaction.hostId,
            metadata: expect.objectContaining({
              type: transaction.type,
              amount: transaction.amount,
              bookingId: transaction.bookingId,
            }),
            timestamp: transaction.timestamp,
          }),
        });
      }
    });

    it('should prevent ledger tampering', async () => {
      const originalEntry = {
        id: 'ledger-1',
        transactionId: 'tx-1',
        amount: 50000,
        type: 'CREDIT',
        status: LedgerEntryStatus.POSTED,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        hash: 'original_hash',
      };

      // Simulate tampering attempt
      const tamperedEntry = {
        ...originalEntry,
        amount: 75000, // Changed amount
        updatedAt: new Date('2026-01-02'),
      };

      (prisma.ledgerEntry.findUnique as jest.Mock).mockResolvedValue(tamperedEntry);

      const tamperingCheck = await service.detectTampering('ledger-1');

      expect(tamperingCheck.isTampered).toBe(true);
      expect(tamperingCheck.originalHash).toBe('original_hash');
      expect(tamperingCheck.currentHash).not.toBe('original_hash');

      // Verify security alert
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ledger_tampering_detected',
          metadata: expect.objectContaining({
            entryId: 'ledger-1',
            originalHash: 'original_hash',
          }),
          severity: 'HIGH',
        }),
      });
    });

    it('should maintain immutable audit logs', async () => {
      const auditLogs = [
        {
          id: 'audit-1',
          action: 'financial_transaction',
          userId: 'user-1',
          metadata: { type: 'PAYMENT', amount: 100000 },
          timestamp: new Date('2026-01-01'),
          hash: 'audit_hash_1',
        },
        {
          id: 'audit-2',
          action: 'ledger_entry_created',
          userId: 'system',
          metadata: { entryId: 'ledger-1', amount: 50000 },
          timestamp: new Date('2026-01-01'),
          hash: 'audit_hash_2',
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(auditLogs);

      const integrityCheck = await service.validateAuditIntegrity();

      expect(integrityCheck.isValid).toBe(true);
      expect(integrityCheck.totalLogs).toBe(2);
      expect(integrityCheck.tamperedLogs).toEqual([]);

      // Simulate audit log tampering
      const tamperedAuditLogs = [
        ...auditLogs,
        {
          id: 'audit-3',
          action: 'financial_transaction',
          userId: 'user-1',
          metadata: { type: 'PAYMENT', amount: 150000 }, // Tampered amount
          timestamp: new Date('2026-01-01'),
          hash: 'audit_hash_1', // Duplicate hash
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(tamperedAuditLogs);

      const tamperedCheck = await service.validateAuditIntegrity();

      expect(tamperedCheck.isValid).toBe(false);
      expect(tamperedCheck.tamperedLogs).toHaveLength(1);
    });

    it('should track all ledger modifications', async () => {
      const modificationHistory = [
        {
          entryId: 'ledger-1',
          action: 'created',
          oldValue: null,
          newValue: { amount: 50000, status: 'POSTED' },
          userId: 'system',
          timestamp: new Date('2026-01-01'),
        },
        {
          entryId: 'ledger-1',
          action: 'updated',
          oldValue: { status: 'POSTED' },
          newValue: { status: 'SETTLED' },
          userId: 'admin-1',
          timestamp: new Date('2026-01-02'),
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(
        modificationHistory.map(mod => ({
          id: `audit-${mod.action}`,
          action: 'ledger_modification',
          metadata: {
            entryId: mod.entryId,
            modification: mod.action,
            oldValue: mod.oldValue,
            newValue: mod.newValue,
          },
          userId: mod.userId,
          timestamp: mod.timestamp,
        }))
      );

      const history = await service.getLedgerModificationHistory('ledger-1');

      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('created');
      expect(history[1].action).toBe('updated');
      expect(history[1].userId).toBe('admin-1');
    });
  });

  describe('Financial Reconciliation', () => {
    it('should reconcile daily balances', async () => {
      const dailyEntries = [
        {
          id: 'ledger-1',
          transactionId: 'tx-1',
          amount: 100000,
          type: 'CREDIT',
          accountType: 'GUEST_PAYMENT',
          date: new Date('2026-01-01'),
        },
        {
          id: 'ledger-2',
          transactionId: 'tx-1',
          amount: -100000,
          type: 'DEBIT',
          accountType: 'HOST_REVENUE',
          date: new Date('2026-01-01'),
        },
        {
          id: 'ledger-3',
          transactionId: 'tx-2',
          amount: -12000,
          type: 'DEBIT',
          accountType: 'PLATFORM_FEE',
          date: new Date('2026-01-01'),
        },
        {
          id: 'ledger-4',
          transactionId: 'tx-2',
          amount: 12000,
          type: 'CREDIT',
          accountType: 'PLATFORM_FEE',
          date: new Date('2026-01-01'),
        },
      ];

      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue(dailyEntries);

      const reconciliation = await service.reconcileDailyBalance(new Date('2026-01-01'));

      expect(reconciliation.isBalanced).toBe(true);
      expect(reconciliation.totalCredits).toBe(112000);
      expect(reconciliation.totalDebits).toBe(-112000);
      expect(reconciliation.netBalance).toBe(0);
      expect(reconciliation.discrepancies).toEqual([]);
    });

    it('should detect balance discrepancies', async () => {
      const unbalancedEntries = [
        {
          id: 'ledger-1',
          transactionId: 'tx-1',
          amount: 100000,
          type: 'CREDIT',
          accountType: 'GUEST_PAYMENT',
          date: new Date('2026-01-01'),
        },
        {
          id: 'ledger-2',
          transactionId: 'tx-1',
          amount: -95000, // Missing $5000
          type: 'DEBIT',
          accountType: 'HOST_REVENUE',
          date: new Date('2026-01-01'),
        },
      ];

      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue(unbalancedEntries);

      const reconciliation = await service.reconcileDailyBalance(new Date('2026-01-01'));

      expect(reconciliation.isBalanced).toBe(false);
      expect(reconciliation.totalCredits).toBe(100000);
      expect(reconciliation.totalDebits).toBe(-95000);
      expect(reconciliation.netBalance).toBe(5000);
      expect(reconciliation.discrepancies).toHaveLength(1);
      expect(reconciliation.discrepancies[0].amount).toBe(5000);
      expect(reconciliation.discrepancies[0].type).toBe('missing_debit');

      // Verify discrepancy alert
      expect(auditService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'balance_discrepancy_detected',
          metadata: expect.objectContaining({
            date: '2026-01-01',
            discrepancy: 5000,
          }),
          severity: 'HIGH',
        }),
      });
    });

    it('should generate reconciliation reports', async () => {
      const reportData = {
        date: new Date('2026-01-01'),
        totalTransactions: 150,
        totalVolume: 1500000, // $15,000
        totalFees: 180000, // $1,800
        netRevenue: 1320000, // $13,200
        discrepancies: [],
        status: 'BALANCED',
      };

      (prisma.financialReport.create as jest.Mock).mockResolvedValue({
        id: 'report-1',
        ...reportData,
      });

      const report = await service.generateReconciliationReport(new Date('2026-01-01'));

      expect(report.date).toBe(reportData.date);
      expect(report.totalTransactions).toBe(150);
      expect(report.totalVolume).toBe(1500000);
      expect(report.status).toBe('BALANCED');
      expect(prisma.financialReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          date: reportData.date,
          totalTransactions: 150,
          totalVolume: 1500000,
          status: 'BALANCED',
        }),
      });
    });
  });

  describe('Data Integrity & Consistency', () => {
    it('should validate cross-table consistency', async () => {
      const crossTableData = {
        payments: [
          { id: 'payment-1', amount: 100000, status: 'succeeded' },
          { id: 'payment-2', amount: 75000, status: 'succeeded' },
        ],
        bookings: [
          { id: 'booking-1', totalAmount: 100000, paymentId: 'payment-1' },
          { id: 'booking-2', totalAmount: 75000, paymentId: 'payment-2' },
        ],
        ledgerEntries: [
          { transactionId: 'payment-1', amount: 100000 },
          { transactionId: 'payment-2', amount: 75000 },
        ],
      };

      (prisma.payment.findMany as jest.Mock).mockResolvedValue(crossTableData.payments);
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(crossTableData.bookings);
      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue(crossTableData.ledgerEntries);

      const consistencyCheck = await service.validateCrossTableConsistency();

      expect(consistencyCheck.isConsistent).toBe(true);
      expect(consistencyCheck.inconsistencies).toEqual([]);

      // Simulate inconsistency
      const inconsistentBookings = [
        { id: 'booking-1', totalAmount: 95000, paymentId: 'payment-1' }, // Mismatch
        { id: 'booking-2', totalAmount: 75000, paymentId: 'payment-2' },
      ];

      (prisma.booking.findMany as jest.Mock).mockResolvedValue(inconsistentBookings);

      const inconsistentCheck = await service.validateCrossTableConsistency();

      expect(inconsistentCheck.isConsistent).toBe(false);
      expect(inconsistentCheck.inconsistencies).toHaveLength(1);
      expect(inconsistentCheck.inconsistencies[0].type).toBe('booking_payment_mismatch');
      expect(inconsistentCheck.inconsistencies[0].bookingId).toBe('booking-1');
      expect(inconsistentCheck.inconsistencies[0].expectedAmount).toBe(100000);
      expect(inconsistentCheck.inconsistencies[0].actualAmount).toBe(95000);
    });

    it('should handle data migration integrity', async () => {
      const migrationData = {
        sourceEntries: [
          { id: 'old-ledger-1', amount: 50000, type: 'CREDIT' },
          { id: 'old-ledger-2', amount: -50000, type: 'DEBIT' },
        ],
        targetEntries: [
          { id: 'new-ledger-1', amount: 50000, type: 'CREDIT', sourceId: 'old-ledger-1' },
          { id: 'new-ledger-2', amount: -50000, type: 'DEBIT', sourceId: 'old-ledger-2' },
        ],
      };

      const migrationCheck = await service.validateMigrationIntegrity(
        migrationData.sourceEntries,
        migrationData.targetEntries
      );

      expect(migrationCheck.isIntegrity).toBe(true);
      expect(migrationCheck.migratedCount).toBe(2);
      expect(migrationCheck.missingEntries).toEqual([]);
      expect(migrationCheck.duplicateEntries).toEqual([]);

      // Simulate migration issues
      const problematicMigration = {
        sourceEntries: migrationData.sourceEntries,
        targetEntries: [
          { id: 'new-ledger-1', amount: 50000, type: 'CREDIT', sourceId: 'old-ledger-1' },
          // Missing second entry
        ],
      };

      const problematicCheck = await service.validateMigrationIntegrity(
        problematicMigration.sourceEntries,
        problematicMigration.targetEntries
      );

      expect(problematicCheck.isIntegrity).toBe(false);
      expect(problematicCheck.missingEntries).toHaveLength(1);
      expect(problematicCheck.missingEntries[0]).toBe('old-ledger-2');
    });

    it('should maintain referential integrity', async () => {
      const referentialChecks = [
        {
          table: 'ledger_entry',
          field: 'transactionId',
          references: 'payment',
          validIds: ['payment-1', 'payment-2'],
        },
        {
          table: 'ledger_entry',
          field: 'bookingId',
          references: 'booking',
          validIds: ['booking-1', 'booking-2'],
        },
      ];

      for (const check of referentialChecks) {
        (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue([
          { id: 'ledger-1', [check.field]: check.validIds[0] },
          { id: 'ledger-2', [check.field]: check.validIds[1] },
          { id: 'ledger-3', [check.field]: 'invalid-reference' }, // Invalid reference
        ]);

        const integrityCheck = await service.validateReferentialIntegrity(
          check.table,
          check.field,
          check.references
        );

        expect(integrityCheck.isValid).toBe(false);
        expect(integrityCheck.invalidReferences).toHaveLength(1);
        expect(integrityCheck.invalidReferences[0]).toBe('invalid-reference');
      }
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle large volume reconciliation efficiently', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `ledger-${i}`,
        transactionId: `tx-${i}`,
        amount: Math.random() * 100000,
        type: i % 2 === 0 ? 'CREDIT' : 'DEBIT',
        date: new Date('2026-01-01'),
      }));

      (prisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue(largeDataset);

      const startTime = Date.now();
      const reconciliation = await service.reconcileDailyBalance(new Date('2026-01-01'));
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(reconciliation.totalEntries).toBe(10000);
      expect(reconciliation.isBalanced).toBe(true);
    });

    it('should use caching for frequently accessed data', async () => {
      const cacheKey = 'ledger:balance:2026-01-01';
      const cachedResult = {
        isBalanced: true,
        totalCredits: 1000000,
        totalDebits: -1000000,
        netBalance: 0,
        discrepancies: [],
      };

      (cache.get as jest.Mock).mockResolvedValue(cachedResult);

      const result = await service.reconcileDailyBalance(new Date('2026-01-01'));

      expect(result).toEqual(cachedResult);
      expect(cache.get).toHaveBeenCalledWith(cacheKey);
      expect(prisma.ledgerEntry.findMany).not.toHaveBeenCalled();
    });

    it('should handle concurrent ledger operations safely', async () => {
      const concurrentOperations = Array.from({ length: 100 }, (_, i) =>
        service.createDoubleEntry({
          id: `tx-${i}`,
          type: TransactionType.PAYMENT,
          amount: 1000 + i * 100,
          bookingId: `booking-${i}`,
          userId: `user-${i}`,
          hostId: `host-${i}`,
        })
      );

      const results = await Promise.all(concurrentOperations);

      expect(results).toHaveLength(100);
      results.forEach((result) => {
        expect(result).toHaveLength(2); // Each transaction creates 2 entries
      });

      // Verify all database transactions were used
      expect(prisma.$transaction).toHaveBeenCalledTimes(100);
    });
  });
});
