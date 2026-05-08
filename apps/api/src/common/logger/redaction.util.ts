/**
 * Logging Redaction Utility
 * 
 * Redacts sensitive data from log messages to prevent PII/secrets exposure
 * in logs while maintaining debugging capability through correlation IDs.
 */

/**
 * Patterns to redact from logs
 */
const REDACTION_PATTERNS = [
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
  // Phone numbers (various formats)
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },
  { pattern: /\+\d{1,3}[-.]?\d{3,4}[-.]?\d{3,4}[-.]?\d{3,4}\b/g, replacement: '[REDACTED_PHONE]' },
  // Payment intent IDs (Stripe format)
  { pattern: /\bpi_[A-Za-z0-9]{24,}\b/g, replacement: '[REDACTED_PAYMENT_INTENT_ID]' },
  // Stripe customer IDs
  { pattern: /\bcus_[A-Za-z0-9]{24,}\b/g, replacement: '[REDACTED_CUSTOMER_ID]' },
  // Stripe account IDs
  { pattern: /\bacct_[A-Za-z0-9]{24,}\b/g, replacement: '[REDACTED_ACCOUNT_ID]' },
  // API keys (common patterns)
  { pattern: /\b(sk_|pk_|rk_|tk_)[A-Za-z0-9]{32,}\b/g, replacement: '[REDACTED_API_KEY]' },
  // JWT tokens
  { pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: '[REDACTED_TOKEN]' },
  // Credit card numbers (basic pattern)
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[REDACTED_CARD]' },
  // Password fields
  { pattern: /"password"\s*:\s*"[^"]+"/gi, replacement: '"password": "[REDACTED]"' },
  { pattern: /'password'\s*:\s*'[^']+'/gi, replacement: "'password': '[REDACTED]'" },
  // Secret fields
  { pattern: /"secret"\s*:\s*"[^"]+"/gi, replacement: '"secret": "[REDACTED]"' },
  { pattern: /'secret'\s*:\s*'[^']+'/gi, replacement: "'secret': '[REDACTED]'" },
  // API key fields
  { pattern: /"apiKey"\s*:\s*"[^"]+"/gi, replacement: '"apiKey": "[REDACTED]"' },
  { pattern: /'apiKey'\s*:\s*'[^']+'/gi, replacement: "'apiKey': '[REDACTED]'" },
];

/**
 * Field names that should always be redacted
 */
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'apiKey',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'privateKey',
  'publicKey',
  'token',
  'authToken',
  'sessionToken',
  'csrfToken',
  'stripeSecret',
  'webhookSecret',
  'jwtSecret',
  'encryptionKey',
  'ssn',
  'socialSecurityNumber',
  'creditCard',
  'cardNumber',
  'cvc',
  'cvv',
  'bankAccount',
  'routingNumber',
];

/**
 * Recursively redact sensitive data from an object
 */
export function redactObject(obj: any, depth: number = 0): any {
  if (depth > 10) {
    return '[MAX_DEPTH]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = redactObject(obj[key], depth + 1);
        }
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Redact sensitive patterns from a string
 */
export function redactString(str: string): string {
  let redacted = str;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/**
 * Sanitize log data by redacting sensitive information
 */
export function sanitizeLogData(data: any): any {
  return redactObject(data);
}

/**
 * Generate a correlation ID for tracking log entries across services
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Extract or generate correlation ID from request headers
 */
export function getCorrelationId(headers: Record<string, string>): string {
  const correlationId = headers['x-correlation-id'] || 
                         headers['x-request-id'] || 
                         headers['request-id'];
  if (correlationId) {
    return correlationId;
  }
  return generateCorrelationId();
}
