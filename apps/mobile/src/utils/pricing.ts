/**
 * Convert a PricingMode enum value to a user-friendly label.
 */
export function pricingModeLabel(mode?: string): string {
  switch (mode) {
    case 'PER_HOUR': return '/hr';
    case 'PER_DAY': return '/day';
    case 'PER_NIGHT': return '/night';
    case 'PER_WEEK': return '/wk';
    case 'PER_MONTH': return '/mo';
    case 'CUSTOM': return '';
    default: return '';
  }
}
