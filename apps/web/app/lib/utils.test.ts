import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  truncateText,
  getInitials,
  isLightColor,
} from '~/lib/utils';

describe('cn (class name merger)', () => {
  it('merges multiple class names', () => {
    expect(cn('px-4', 'py-2')).toContain('px-4');
    expect(cn('px-4', 'py-2')).toContain('py-2');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    const result = cn('px-4', 'px-6');
    // tailwind-merge keeps the last one
    expect(result).toBe('px-6');
  });

  it('handles conditional classes', () => {
    const falsy = false as boolean;
    const truthy = true as boolean;
    expect(cn('base', falsy && 'hidden')).toBe('base');
    expect(cn('base', truthy && 'visible')).toContain('visible');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null)).toBe('base');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats NPR by default', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1,500');
  });

  it('formats USD', () => {
    const result = formatCurrency(99.99, 'USD');
    expect(result).toContain('99.99');
  });

  it('handles zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formats large numbers with commas', () => {
    const result = formatCurrency(1000000);
    // en-IN locale uses South Asian grouping: 10,00,000
    expect(result).toMatch(/10[,.]00[,.]000|1[,.]000[,.]000/);
  });
});

describe('formatNumber', () => {
  it('formats with commas', () => {
    // en-IN locale uses Indian grouping: 12,34,567
    expect(formatNumber(1234567)).toMatch(/^1[,.]?234[,.]?567$|^12[,.]?34[,.]?567$/);
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles decimals', () => {
    expect(formatNumber(1234.56)).toContain('1,234');
  });
});

describe('formatDate', () => {
  it('formats Date object', () => {
    const result = formatDate(new Date('2024-06-15'));
    expect(result).toContain('2024');
    expect(result).toContain('Jun');
  });

  it('formats date string', () => {
    const result = formatDate('2024-01-01');
    expect(result).toContain('2024');
  });
});

describe('formatDateTime', () => {
  it('includes time component', () => {
    const result = formatDateTime(new Date('2024-06-15T14:30:00'));
    expect(result).toContain('2024');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('truncateText', () => {
  it('returns text unchanged when shorter than max', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates and adds ellipsis', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });

  it('returns full text when exactly at max', () => {
    expect(truncateText('hello', 5)).toBe('hello');
  });

  it('handles empty string', () => {
    expect(truncateText('', 5)).toBe('');
  });
});

describe('getInitials', () => {
  it('returns initials from two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns single initial for single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('caps at 2 characters for multi-word names', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });

  it('returns uppercase initials', () => {
    expect(getInitials('ram kumar')).toBe('RK');
  });
});

describe('isLightColor', () => {
  it('white is light', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);
  });

  it('black is dark', () => {
    expect(isLightColor('#000000')).toBe(false);
  });

  it('yellow is light', () => {
    expect(isLightColor('#FFFF00')).toBe(true);
  });

  it('dark blue is dark', () => {
    expect(isLightColor('#000080')).toBe(false);
  });

  it('works without # prefix', () => {
    expect(isLightColor('FFFFFF')).toBe(true);
  });
});
