/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
export function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize plain-text user input before persistence.
 * Removes HTML tags and normalizes whitespace so profile fields cannot store
 * executable markup while still preserving readable text.
 */
export function sanitizePlainText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
