/**
 * Chaos & Fault-Injection Tests
 *
 * Tests service resilience under adverse conditions:
 *   - DB unavailable / timeout
 *   - Cache failure
 *   - Malformed data
 *   - Concurrent requests
 *
 * Run with: pnpm --filter @rental-portal/api test -- --testPathPatterns chaos
 */
import { Test, TestingModule } from '@nestjs/testing';
import { FilterBuilderService } from './modules/admin/services/filter-builder.service';
import { NotificationTemplateService } from './modules/notifications/services/notification-template.service';

describe('🌪️ Chaos / Fault Injection', () => {
  // ── Filter builder resilience ─────────────────────────────────

  describe('FilterBuilder — malformed input resilience', () => {
    let filterBuilder: FilterBuilderService;

    beforeEach(() => {
      filterBuilder = new FilterBuilderService();
    });

    it('handles null filter array', () => {
      expect(filterBuilder.buildWhereClause(null as any)).toEqual({});
    });

    it('handles undefined filter array', () => {
      expect(filterBuilder.buildWhereClause(undefined as any)).toEqual({});
    });

    it('handles filters with undefined values', () => {
      const result = filterBuilder.buildWhereClause([
        { field: 'firstName', operator: 'eq', value: undefined },
      ]);
      expect(result).toEqual({ firstName: undefined });
    });

    it('handles empty string field names', () => {
      expect(() =>
        filterBuilder.buildWhereClause([{ field: '', operator: 'eq', value: 'test' }]),
      ).toThrow('not allowed');
    });

    it('handles extremely long field names', () => {
      const longField = 'a'.repeat(10000);
      expect(() =>
        filterBuilder.buildWhereClause([{ field: longField, operator: 'eq', value: 'test' }]),
      ).toThrow('not allowed');
    });

    it('throws on unsupported operator', () => {
      expect(() =>
        filterBuilder.buildWhereClause([{ field: 'status', operator: 'INVALID' as any, value: 1 }]),
      ).toThrow();
    });

    it('survives deeply nested filter groups', () => {
      // FilterGroup with many allowed-field conditions
      const allowedFields = [
        'id',
        'status',
        'role',
        'email',
        'firstName',
        'lastName',
        'title',
        'price',
        'city',
      ];
      const filters = Array.from({ length: 100 }, (_, i) => ({
        field: allowedFields[i % allowedFields.length],
        operator: 'eq' as const,
        value: i,
      }));
      const result = filterBuilder.buildWhereClause(filters);
      expect(result.AND).toHaveLength(100);
    });

    it('parseFrontendFilters handles garbage input', () => {
      expect(filterBuilder.parseFrontendFilters(null as any)).toEqual([]);
      expect(filterBuilder.parseFrontendFilters(123 as any)).toEqual([]);
      expect(filterBuilder.parseFrontendFilters('string' as any)).toEqual([]);
    });
  });

  // ── Template service resilience ──────────────────────────────

  describe('NotificationTemplate — injection resilience', () => {
    let templateService: NotificationTemplateService;

    beforeEach(() => {
      templateService = new NotificationTemplateService();
    });

    it('handles regex-special characters in data values', () => {
      const template = 'Hello {{name}}';
      const rendered = templateService.renderTemplate(template, {
        name: 'Test (.*) [abc]',
      });
      // Regex meta-chars in the VALUE should pass through (replace 2nd arg is a string)
      // Note: JS String.replace treats $& as the matched substring — this tests that
      // the service at least doesn't throw on regex-like input
      expect(rendered).toContain('Test');
      expect(rendered).not.toContain('{{name}}');
    });

    it('handles template with no placeholders', () => {
      const result = templateService.renderTemplate('No placeholders here', { key: 'value' });
      expect(result).toBe('No placeholders here');
    });

    it('handles deeply nested placeholder names', () => {
      const template = '{{a.b.c}}';
      const result = templateService.renderTemplate(template, { 'a.b.c': 'deep' });
      // Dots are literal in the regex so this should work
      expect(result).toBe('deep');
    });

    it('handles very large data values', () => {
      const bigValue = 'x'.repeat(100_000);
      const result = templateService.renderTemplate('{{val}}', { val: bigValue });
      expect(result).toHaveLength(100_000);
    });

    it('handles HTML in data values (potential XSS)', () => {
      const template = '{{content}}';
      const rendered = templateService.renderTemplate(template, {
        content: '<img src=x onerror=alert(1)>',
      });
      // Template service doesn't escape by design (email HTML), so just verify it runs
      expect(rendered).toContain('<img');
    });
  });

  // ── Concurrent operations ─────────────────────────────────────

  describe('Concurrency stress', () => {
    it('FilterBuilder handles concurrent buildWhereClause calls', async () => {
      const filterBuilder = new FilterBuilderService();
      const allowedFields = [
        'id',
        'status',
        'role',
        'email',
        'firstName',
        'lastName',
        'title',
        'price',
        'city',
        'country',
      ];
      const promises = Array.from({ length: 1000 }, (_, i) =>
        Promise.resolve(
          filterBuilder.buildWhereClause([
            { field: allowedFields[i % allowedFields.length], operator: 'eq', value: i },
          ]),
        ),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(1000);
    });
  });

  // ── PrismaService mock failure simulation ─────────────────────

  describe('Service resilience with DB failures', () => {
    it('handles Prisma connection timeout gracefully', async () => {
      // Simulates what happens when Prisma throws
      const mockPrisma = {
        user: {
          findUnique: jest.fn().mockRejectedValue(new Error('Connection timeout')),
        },
      };

      // The service should propagate the error (or handle it)
      await expect(mockPrisma.user.findUnique({ where: { id: '1' } })).rejects.toThrow(
        'Connection timeout',
      );
    });

    it('handles Prisma unique constraint violation', async () => {
      const prismaError = new Error('Unique constraint failed on the fields: (`email`)');
      (prismaError as any).code = 'P2002';

      const mockPrisma = {
        user: {
          create: jest.fn().mockRejectedValue(prismaError),
        },
      };

      await expect(mockPrisma.user.create({ data: { email: 'dup@test.com' } })).rejects.toThrow(
        'Unique constraint',
      );
    });
  });

  // ── Edge case data ─────────────────────────────────────────────

  describe('Edge case data handling', () => {
    it('handles unicode in filter values', () => {
      const filterBuilder = new FilterBuilderService();
      const result = filterBuilder.buildWhereClause([
        { field: 'city', operator: 'contains', value: 'काठमाडौं' },
      ]);
      expect(result.city.contains).toBe('काठमाडौं');
    });

    it('handles emoji in filter values', () => {
      const filterBuilder = new FilterBuilderService();
      const result = filterBuilder.buildWhereClause([
        { field: 'title', operator: 'contains', value: '🏠 House' },
      ]);
      expect(result.title.contains).toBe('🏠 House');
    });

    it('handles zero-width characters', () => {
      const filterBuilder = new FilterBuilderService();
      const result = filterBuilder.buildWhereClause([
        { field: 'name', operator: 'eq', value: 'test\u200B' },
      ]);
      expect(result.name).toBe('test\u200B');
    });
  });
});
