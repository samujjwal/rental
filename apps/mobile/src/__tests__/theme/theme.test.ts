import { colors, darkColors, typography, spacing, borderRadius, shadows, commonStyles } from '../../theme';

describe('colors', () => {
  it('defines primary color', () => {
    expect(colors.primary).toBe('#3B82F6');
  });

  it('defines all required color tokens', () => {
    const requiredKeys = [
      'primary', 'primaryDark', 'primaryLight',
      'background', 'surface', 'card',
      'text', 'textSecondary', 'textMuted',
      'border', 'borderLight', 'input',
      'error', 'success', 'warning', 'info',
      'destructive', 'overlay', 'skeleton',
    ];
    for (const key of requiredKeys) {
      expect(colors).toHaveProperty(key);
    }
  });

  it('all color values are strings', () => {
    for (const value of Object.values(colors)) {
      expect(typeof value).toBe('string');
    }
  });
});

describe('darkColors', () => {
  it('extends colors with dark theme overrides', () => {
    expect(darkColors.background).not.toBe(colors.background);
    expect(darkColors.text).not.toBe(colors.text);
  });

  it('has a darker background', () => {
    // Dark background should be a dark color (starts with # and low values)
    expect(darkColors.background).toBe('#0F172A');
  });

  it('has all the same keys as colors', () => {
    for (const key of Object.keys(colors)) {
      expect(darkColors).toHaveProperty(key);
    }
  });
});

describe('typography', () => {
  it('defines heading styles', () => {
    expect(typography.h1.fontSize).toBe(28);
    expect(typography.h2.fontSize).toBe(22);
    expect(typography.h3.fontSize).toBe(18);
  });

  it('defines body styles', () => {
    expect(typography.body.fontSize).toBe(16);
    expect(typography.bodySmall.fontSize).toBe(14);
  });

  it('defines caption and label styles', () => {
    expect(typography.caption.fontSize).toBe(12);
    expect(typography.label.fontWeight).toBe('500');
  });

  it('all styles have fontSize and lineHeight', () => {
    for (const style of Object.values(typography)) {
      expect(style).toHaveProperty('fontSize');
      expect(style).toHaveProperty('lineHeight');
    }
  });
});

describe('spacing', () => {
  it('has ascending values', () => {
    expect(spacing.xs).toBeLessThan(spacing.sm);
    expect(spacing.sm).toBeLessThan(spacing.md);
    expect(spacing.md).toBeLessThan(spacing.lg);
    expect(spacing.lg).toBeLessThan(spacing.xl);
  });

  it('has expected values', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.md).toBe(16);
    expect(spacing.xl).toBe(32);
  });
});

describe('borderRadius', () => {
  it('has ascending scale', () => {
    expect(borderRadius.sm).toBeLessThan(borderRadius.md);
    expect(borderRadius.md).toBeLessThan(borderRadius.lg);
    expect(borderRadius.lg).toBeLessThan(borderRadius.xl);
  });

  it('full is 9999', () => {
    expect(borderRadius.full).toBe(9999);
  });
});

describe('shadows', () => {
  it('defines sm, md, lg shadows', () => {
    expect(shadows.sm).toHaveProperty('elevation', 1);
    expect(shadows.md).toHaveProperty('elevation', 3);
    expect(shadows.lg).toHaveProperty('elevation', 5);
  });

  it('all shadows have required RN properties', () => {
    for (const shadow of Object.values(shadows)) {
      expect(shadow).toHaveProperty('shadowColor');
      expect(shadow).toHaveProperty('shadowOffset');
      expect(shadow).toHaveProperty('shadowOpacity');
      expect(shadow).toHaveProperty('shadowRadius');
      expect(shadow).toHaveProperty('elevation');
    }
  });
});

describe('commonStyles', () => {
  it('has container style with flex 1', () => {
    expect(commonStyles.container.flex).toBe(1);
    expect(commonStyles.container.backgroundColor).toBe(colors.background);
  });

  it('has card style with border and shadow', () => {
    expect(commonStyles.card.borderWidth).toBe(1);
    expect(commonStyles.card.borderRadius).toBe(borderRadius.lg);
  });

  it('has input style', () => {
    expect(commonStyles.input.borderWidth).toBe(1);
    expect(commonStyles.input.fontSize).toBe(16);
  });

  it('has button styles', () => {
    expect(commonStyles.button.backgroundColor).toBe(colors.primary);
    expect(commonStyles.buttonText.color).toBe('#FFFFFF');
  });

  it('has button outline style', () => {
    expect(commonStyles.buttonOutline.backgroundColor).toBe('transparent');
    expect(commonStyles.buttonOutline.borderColor).toBe(colors.primary);
  });

  it('has layout helpers', () => {
    expect(commonStyles.row.flexDirection).toBe('row');
    expect(commonStyles.spaceBetween.justifyContent).toBe('space-between');
    expect(commonStyles.center.alignItems).toBe('center');
  });

  it('has error text uses error color', () => {
    expect(commonStyles.errorText.color).toBe(colors.error);
  });

  it('has divider style', () => {
    expect(commonStyles.divider.height).toBe(1);
  });

  it('has badge styles', () => {
    expect(commonStyles.badge.borderRadius).toBe(borderRadius.full);
  });

  it('has empty state styles', () => {
    expect(commonStyles.emptyContainer.flex).toBe(1);
  });
});
