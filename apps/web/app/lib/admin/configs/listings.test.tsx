import { describe, it, expect, vi } from 'vitest';

vi.mock('~/components/ui/StatusBadge', () => ({
  StatusBadge: ({ label, color, size }: { label: string; color: string; size: string }) => (
    <span data-testid="status-badge" data-color={color} data-size={size}>{label}</span>
  ),
}));

import { listingsConfig } from './listings';

describe('listingsConfig', () => {
  it('has correct entity name', () => {
    expect(listingsConfig.name).toBe('Listing');
    expect(listingsConfig.pluralName).toBe('Listings');
    expect(listingsConfig.slug).toBe('listings');
  });

  it('has description', () => {
    expect(listingsConfig.description).toContain('Manage rental listings');
  });

  describe('api', () => {
    it('has base endpoint', () => {
      expect(listingsConfig.api.baseEndpoint).toBe('/admin/listings');
    });

    it('has list endpoint', () => {
      expect(listingsConfig.api.listEndpoint).toBe('/admin/listings');
    });

    it('has get endpoint that returns listing path', () => {
      expect(listingsConfig.api.getEndpoint!('abc-123')).toBe('/listings/abc-123');
    });
  });

  describe('columns', () => {
    it('has 4 columns', () => {
      expect(listingsConfig.columns).toHaveLength(4);
    });

    it('includes title column', () => {
      const col = listingsConfig.columns.find(c => c.accessorKey === 'title');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Title');
    });

    it('includes status column with Cell renderer', () => {
      const col = listingsConfig.columns.find(c => c.accessorKey === 'status');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Status');
      expect(col!.Cell).toBeDefined();
    });

    it('includes basePrice column with currency formatting', () => {
      const col = listingsConfig.columns.find(c => c.accessorKey === 'basePrice');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Price');
      expect(col!.Cell).toBeDefined();
      const result = col!.Cell!({ cell: { getValue: () => 50 } } as any);
      // Currency format depends on locale config (NPR for Nepal)
      expect(result).toMatch(/50/);
    });

    it('includes createdAt column with date formatting', () => {
      const col = listingsConfig.columns.find(c => c.accessorKey === 'createdAt');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Created');
      expect(col!.Cell).toBeDefined();
      const result = col!.Cell!({ cell: { getValue: () => '2024-01-15T00:00:00Z' } } as any);
      expect(result).toBeTruthy();
    });
  });

  describe('fields', () => {
    it('has 2 fields', () => {
      expect(listingsConfig.fields).toHaveLength(2);
    });

    it('includes title text field', () => {
      const field = listingsConfig.fields!.find(f => f.key === 'title');
      expect(field).toBeDefined();
      expect(field!.label).toBe('Title');
      expect(field!.type).toBe('text');
    });

    it('includes status select field with 3 options', () => {
      const field = listingsConfig.fields!.find(f => f.key === 'status');
      expect(field).toBeDefined();
      expect(field!.label).toBe('Status');
      expect(field!.type).toBe('select');
      expect(field!.options).toHaveLength(3);
      expect(field!.options!.map(o => o.value)).toEqual(['active', 'draft', 'archived']);
    });
  });
});
