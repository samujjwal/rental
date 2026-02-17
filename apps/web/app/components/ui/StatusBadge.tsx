import type { ReactNode } from 'react';

export type BadgeColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

const colorClasses: Record<BadgeColor, string> = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-blue-100 text-blue-700',
  secondary: 'bg-purple-100 text-purple-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-700',
  info: 'bg-cyan-100 text-cyan-700',
};

export interface StatusBadgeProps {
  label: ReactNode;
  color?: BadgeColor;
  size?: 'small' | 'medium';
  className?: string;
}

/**
 * StatusBadge — a lightweight Tailwind replacement for MUI Chip
 * Used in admin configs and entity tables.
 */
export function StatusBadge({
  label,
  color = 'default',
  size = 'small',
  className = '',
}: StatusBadgeProps) {
  const sizeClass = size === 'small' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${colorClasses[color]} ${className}`}
    >
      {label}
    </span>
  );
}
