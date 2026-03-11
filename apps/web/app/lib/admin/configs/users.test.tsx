import { describe, it, expect, vi } from 'vitest';

vi.mock('~/components/ui/StatusBadge', () => ({
  StatusBadge: ({ label, color, size }: { label: string; color: string; size: string }) => (
    <span data-testid="status-badge" data-color={color} data-size={size}>{label}</span>
  ),
}));

import { usersConfig } from './users';

describe('usersConfig', () => {
  it('has correct entity name', () => {
    expect(usersConfig.name).toBe('User');
    expect(usersConfig.pluralName).toBe('Users');
    expect(usersConfig.slug).toBe('users');
  });

  it('has description', () => {
    expect(usersConfig.description).toContain('Manage system users');
  });

  describe('api', () => {
    it('has base endpoint', () => {
      expect(usersConfig.api.baseEndpoint).toBe('/admin/users');
    });

    it('has list endpoint', () => {
      expect(usersConfig.api.listEndpoint).toBe('/admin/users');
    });

    it('has get endpoint that returns user-specific path', () => {
      expect(usersConfig.api.getEndpoint!('abc-123')).toBe('/admin/users/abc-123');
    });

    it('has update endpoint that returns user-specific path', () => {
      expect(usersConfig.api.updateEndpoint!('xyz')).toBe('/admin/users/xyz');
    });

    it('does not have delete endpoint (users are suspended, not deleted)', () => {
      expect(usersConfig.api.deleteEndpoint).toBeUndefined();
    });
  });

  describe('columns', () => {
    it('has expected number of columns', () => {
      expect(usersConfig.columns).toHaveLength(6);
    });

    it('includes firstName column', () => {
      const col = usersConfig.columns.find(c => c.accessorKey === 'firstName');
      expect(col).toBeDefined();
      expect(col!.header).toBe('First Name');
    });

    it('includes lastName column with fallback dash', () => {
      const col = usersConfig.columns.find(c => c.accessorKey === 'lastName');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Last Name');
      expect(col!.Cell).toBeDefined();
    });

    it('includes email column', () => {
      const col = usersConfig.columns.find(c => c.accessorKey === 'email');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Email');
    });

    it('includes role column with Cell renderer', () => {
      const col = usersConfig.columns.find(c => c.accessorKey === 'role');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Role');
      expect(col!.Cell).toBeDefined();
    });

    it('includes status column with Cell renderer', () => {
      const col = usersConfig.columns.find(c => c.accessorKey === 'status');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Status');
      expect(col!.Cell).toBeDefined();
    });

    it('includes createdAt column', () => {
      const col = usersConfig.columns.find(c => c.accessorKey === 'createdAt');
      expect(col).toBeDefined();
      expect(col!.header).toBe('Joined');
    });
  });

  describe('fields', () => {
    it('has expected fields', () => {
      expect(usersConfig.fields).toBeDefined();
      expect(usersConfig.fields!.length).toBe(5);
    });

    it('firstName field is required text', () => {
      const f = usersConfig.fields!.find(f => f.key === 'firstName');
      expect(f).toBeDefined();
      expect(f!.type).toBe('text');
      expect(f!.validation?.required).toBe(true);
    });

    it('email field is required email type', () => {
      const f = usersConfig.fields!.find(f => f.key === 'email');
      expect(f).toBeDefined();
      expect(f!.type).toBe('email');
      expect(f!.validation?.required).toBe(true);
      expect(f!.validation?.email).toBe(true);
    });

    it('role field is select with options', () => {
      const f = usersConfig.fields!.find(f => f.key === 'role');
      expect(f).toBeDefined();
      expect(f!.type).toBe('select');
      expect(f!.options).toHaveLength(3);
      expect(f!.options!.map(o => o.value)).toEqual(['USER', 'HOST', 'ADMIN']);
    });

    it('status field is select with options', () => {
      const f = usersConfig.fields!.find(f => f.key === 'status');
      expect(f).toBeDefined();
      expect(f!.type).toBe('select');
      expect(f!.options!.map(o => o.value)).toContain('ACTIVE');
      expect(f!.options!.map(o => o.value)).toContain('SUSPENDED');
    });
  });

  describe('filters', () => {
    it('has role and status filters', () => {
      expect(usersConfig.filters).toBeDefined();
      expect(usersConfig.filters).toHaveLength(2);
    });

    it('role filter uses eq operator', () => {
      const f = usersConfig.filters!.find(f => f.key === 'role');
      expect(f).toBeDefined();
      expect(f!.operator).toBe('eq');
      expect(f!.type).toBe('select');
    });

    it('status filter uses eq operator', () => {
      const f = usersConfig.filters!.find(f => f.key === 'status');
      expect(f).toBeDefined();
      expect(f!.operator).toBe('eq');
      expect(f!.options).toHaveLength(3);
    });
  });
});
