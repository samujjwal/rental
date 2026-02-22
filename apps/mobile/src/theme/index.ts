import { StyleSheet } from 'react-native';

// Design tokens matching web Tailwind theme
export const colors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#DBEAFE',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  input: '#F9FAFB',
  ring: '#3B82F6',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  destructive: '#EF4444',
  overlay: 'rgba(0, 0, 0, 0.5)',
  skeleton: '#E5E7EB',
} as const;

export const darkColors = {
  ...colors,
  primary: '#60A5FA',
  primaryDark: '#3B82F6',
  primaryLight: '#1E3A5F',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#334155',
  borderLight: '#1E293B',
  input: '#1E293B',
  errorLight: '#450A0A',
  successLight: '#052E16',
  warningLight: '#422006',
  infoLight: '#1E3A5F',
  skeleton: '#334155',
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, color: colors.text },
  h2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28, color: colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, color: colors.text },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, color: colors.text },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, color: colors.textSecondary },
  label: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, color: colors.text },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

export const commonStyles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenPadding: {
    paddingHorizontal: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cards
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },

  // Forms
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.input,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  inputHelper: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },

  // Buttons
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    ...typography.button,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonOutlineText: {
    color: colors.primary,
    ...typography.button,
  },
  buttonDestructive: {
    backgroundColor: colors.destructive,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },

  // Badge
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.primary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
