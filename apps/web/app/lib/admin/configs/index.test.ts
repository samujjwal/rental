import { describe, it, expect } from 'vitest';
import { entityConfigs, getEntityConfig } from './index';

describe('entityConfigs', () => {
  it('has users config', () => {
    expect(entityConfigs.users).toBeDefined();
    expect(entityConfigs.users.slug).toBe('users');
  });

  it('has listings config', () => {
    expect(entityConfigs.listings).toBeDefined();
    expect(entityConfigs.listings.slug).toBe('listings');
  });

  it('has two entity configs', () => {
    expect(Object.keys(entityConfigs)).toHaveLength(2);
  });
});

describe('getEntityConfig', () => {
  it('returns users config for "users" slug', () => {
    const config = getEntityConfig('users');
    expect(config).toBeDefined();
    expect(config!.name).toBe('User');
  });

  it('returns listings config for "listings" slug', () => {
    const config = getEntityConfig('listings');
    expect(config).toBeDefined();
    expect(config!.name).toBe('Listing');
  });

  it('returns null for unknown slug', () => {
    expect(getEntityConfig('unknown')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getEntityConfig('')).toBeNull();
  });
});
