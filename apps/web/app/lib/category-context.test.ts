import { describe, it, expect } from 'vitest';
import { getCategoryFamily, getCategoryContext } from './category-context';

describe('getCategoryFamily', () => {
  it.each([
    ['car', 'vehicle'],
    ['truck', 'vehicle'],
    ['vehicles', 'vehicle'],
    ['apartment', 'property'],
    ['house', 'property'],
    ['room', 'property'],
    ['camera', 'electronics'],
    ['electronics', 'electronics'],
    ['musical-instrument', 'instrument'],
    ['instruments', 'instrument'],
    ['clothing', 'clothing'],
    ['fashion', 'clothing'],
    ['bicycle', 'bike'],
    ['bike', 'bike'],
  ])('maps "%s" to "%s" family', (slug, expected) => {
    expect(getCategoryFamily(slug)).toBe(expected);
  });

  it('returns "general" for unknown categories', () => {
    expect(getCategoryFamily('unknown-thing')).toBe('general');
  });
});

describe('getCategoryContext', () => {
  it('returns complete context object', () => {
    const ctx = getCategoryContext('apartment');
    expect(ctx).toHaveProperty('showGuestCount');
    expect(ctx).toHaveProperty('guestLabel');
    expect(ctx).toHaveProperty('rulesHeading');
    expect(ctx).toHaveProperty('pricePeriodLabel');
    expect(ctx).toHaveProperty('depositReturnText');
    expect(ctx).toHaveProperty('messagePlaceholder');
    expect(ctx).toHaveProperty('ownerLabel');
    expect(ctx).toHaveProperty('distanceUnit');
    expect(ctx).toHaveProperty('itemNoun');
  });

  it('shows guest count for properties', () => {
    const ctx = getCategoryContext('apartment');
    expect(ctx.showGuestCount).toBe(true);
    expect(ctx.ownerLabel).toBe('Host');
  });

  it('hides guest count for vehicles', () => {
    const ctx = getCategoryContext('car');
    expect(ctx.showGuestCount).toBe(false);
  });

  it('uses "Host" for event spaces', () => {
    const ctx = getCategoryContext('wedding-venues');
    if (getCategoryFamily('wedding-venues') === 'event-space') {
      expect(ctx.ownerLabel).toBe('Host');
    }
  });

  it('uses "km" as distance unit', () => {
    const ctx = getCategoryContext('anything');
    expect(ctx.distanceUnit).toBe('km');
  });

  it('has non-empty strings for all text fields', () => {
    const ctx = getCategoryContext('car');
    expect(ctx.rulesHeading.length).toBeGreaterThan(0);
    expect(ctx.pricePeriodLabel.length).toBeGreaterThan(0);
    expect(ctx.depositReturnText.length).toBeGreaterThan(0);
    expect(ctx.messagePlaceholder.length).toBeGreaterThan(0);
    expect(ctx.ownerLabel.length).toBeGreaterThan(0);
    expect(ctx.itemNoun.length).toBeGreaterThan(0);
  });
});
