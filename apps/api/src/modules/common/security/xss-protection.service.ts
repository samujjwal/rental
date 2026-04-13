/**
 * XSS Protection Service
 * 
 * Prevents XSS attacks through input sanitization, output encoding, and CSP
 */

import { Injectable, Logger } from '@nestjs/common';

export interface SanitizationResult {
  safe: boolean;
  sanitized: string;
  threatsFound: string[];
}

export interface CSPPolicy {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'frame-src'?: string[];
  'base-uri'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'upgrade-insecure-requests'?: boolean;
}

@Injectable()
export class XssProtectionService {
  private readonly logger = new Logger(XssProtectionService.name);

  private xssPatterns = [
    {
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      description: 'Script tag',
      severity: 'critical',
    },
    {
      pattern: /javascript:/gi,
      description: 'JavaScript protocol',
      severity: 'critical',
    },
    {
      pattern: /on\w+\s*=/gi,
      description: 'Event handler',
      severity: 'high',
    },
    {
      pattern: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      description: 'Iframe tag',
      severity: 'high',
    },
    {
      pattern: /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      description: 'Object tag',
      severity: 'high',
    },
    {
      pattern: /<embed\b[^<]*>/gi,
      description: 'Embed tag',
      severity: 'high',
    },
    {
      pattern: /data:text\/html/gi,
      description: 'Data URI',
      severity: 'medium',
    },
    {
      pattern: /<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi,
      description: 'External stylesheet',
      severity: 'low',
    },
  ];

  private htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  private defaultCSP: CSPPolicy = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': true,
  };

  sanitizeHtml(input: string): SanitizationResult {
    if (!input) {
      return { safe: true, sanitized: '', threatsFound: [] };
    }

    const threats: string[] = [];
    let sanitized = input;

    // Check for XSS patterns
    for (const xssPattern of this.xssPatterns) {
      if (xssPattern.pattern.test(sanitized)) {
        threats.push(xssPattern.description);
        this.logger.warn(`XSS threat detected: ${xssPattern.description}`);
      }
    }

    // Remove script tags and content
    sanitized = sanitized.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      '',
    );

    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=\s*["']?[^"']*["']?/gi, '');

    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Remove dangerous tags
    sanitized = sanitized.replace(
      /<(script|iframe|object|embed|form|input)[^>]*>/gi,
      '',
    );

    // Encode remaining HTML entities
    sanitized = this.encodeHtml(sanitized);

    return {
      safe: threats.length === 0,
      sanitized,
      threatsFound: threats,
    };
  }

  encodeHtml(input: string): string {
    return input.replace(
      /[&<>"'/]/g,
      (char) => this.htmlEntities[char] || char,
    );
  }

  decodeHtml(input: string): string {
    const reverseEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
    };

    return input.replace(
      /&amp;|&lt;|&gt;|&quot;|&#x27;|&#x2F;/g,
      (entity) => reverseEntities[entity] || entity,
    );
  }

  sanitizeAttribute(input: string): string {
    if (!input) return '';

    // Remove event handlers
    let sanitized = input.replace(/on\w+\s*=/gi, '');

    // Remove javascript:
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Encode
    sanitized = this.encodeHtml(sanitized);

    return sanitized;
  }

  sanitizeUrl(url: string): string {
    if (!url) return '';

    const dangerousProtocols = [
      'javascript:',
      'data:text/html',
      'vbscript:',
      'mocha:',
      'livescript:',
    ];

    const lowerUrl = url.toLowerCase().trim();

    for (const protocol of dangerousProtocols) {
      if (lowerUrl.startsWith(protocol)) {
        this.logger.warn(`Dangerous URL protocol blocked: ${protocol}`);
        return '';
      }
    }

    return url;
  }

  sanitizeCss(input: string): string {
    if (!input) return '';

    // Remove expression() and binding()
    let sanitized = input.replace(/expression\s*\(/gi, '');
    sanitized = sanitized.replace(/binding\s*\(/gi, '');

    // Remove @import
    sanitized = sanitized.replace(/@import\s+/gi, '');

    // Remove behavior
    sanitized = sanitized.replace(/behavior\s*:/gi, '');

    return sanitized;
  }

  generateCSPHeader(policy: CSPPolicy = this.defaultCSP): string {
    const directives: string[] = [];

    for (const [directive, value] of Object.entries(policy)) {
      if (directive === 'upgrade-insecure-requests') {
        if (value) {
          directives.push(directive);
        }
        continue;
      }

      if (Array.isArray(value) && value.length > 0) {
        directives.push(`${directive} ${value.join(' ')}`);
      }
    }

    return directives.join('; ');
  }

  getSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': this.generateCSPHeader(),
      'X-XSS-Protection': '1; mode=block',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  }

  validateInput(input: string, context: 'html' | 'attribute' | 'url' | 'css' | 'js'): SanitizationResult {
    switch (context) {
      case 'html':
        return this.sanitizeHtml(input);
      case 'attribute':
        return {
          safe: true,
          sanitized: this.sanitizeAttribute(input),
          threatsFound: [],
        };
      case 'url':
        return {
          safe: true,
          sanitized: this.sanitizeUrl(input),
          threatsFound: [],
        };
      case 'css':
        return {
          safe: true,
          sanitized: this.sanitizeCss(input),
          threatsFound: [],
        };
      case 'js':
        // For JS context, we should not allow user input at all
        // or use proper JS escaping
        return {
          safe: false,
          sanitized: this.encodeHtml(input),
          threatsFound: ['JavaScript context requires strict escaping'],
        };
      default:
        return this.sanitizeHtml(input);
    }
  }

  scanContent(content: string): {
    safe: boolean;
    threats: Array<{ type: string; severity: string; match: string }>;
  } {
    const threats: Array<{ type: string; severity: string; match: string }> = [];

    for (const xssPattern of this.xssPatterns) {
      const matches = content.match(xssPattern.pattern);
      if (matches) {
        matches.forEach((match) => {
          threats.push({
            type: xssPattern.description,
            severity: xssPattern.severity,
            match: match.substring(0, 50), // Limit match length
          });
        });
      }
    }

    return {
      safe: threats.length === 0,
      threats,
    };
  }

  createSafeHtml(allowedTags: string[], allowedAttributes: Record<string, string[]>): {
    clean: (input: string) => string;
  } {
    return {
      clean: (input: string): string => {
        if (!input) return '';

        // Remove all tags except allowed ones
        const tagPattern = new RegExp(
          `<(?!/?(?:${allowedTags.join('|')})\b)[^>]*>`,
          'gi',
        );
        let cleaned = input.replace(tagPattern, '');

        // Clean attributes for allowed tags
        allowedTags.forEach((tag) => {
          const tagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
          cleaned = cleaned.replace(tagRegex, (match) => {
            const attrs = allowedAttributes[tag] || [];
            // Keep only allowed attributes
            const cleanedTag = match.replace(
              /(\w+)=["']?[^"'>]*["']?/g,
              (attrMatch, attrName) => {
                if (attrs.includes(attrName.toLowerCase())) {
                  // Sanitize attribute value
                  const sanitizedValue = this.sanitizeAttribute(
                    attrMatch.split('=')[1] || '',
                  );
                  return `${attrName}="${sanitizedValue}"`;
                }
                return '';
              },
            );
            return cleanedTag;
          });
        });

        return cleaned;
      },
    };
  }
}
