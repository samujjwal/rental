/**
 * SQL Injection Guard Service
 * 
 * Prevents SQL injection attacks through input validation and query sanitization
 */

import { Injectable, Logger } from '@nestjs/common';

export interface QueryValidationResult {
  safe: boolean;
  reason?: string;
  sanitized?: string;
}

export interface SQLPattern {
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

@Injectable()
export class SqlInjectionGuardService {
  private readonly logger = new Logger(SqlInjectionGuardService.name);

  private sqlPatterns: SQLPattern[] = [
    {
      pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b)/i,
      severity: 'critical',
      description: 'SQL keyword detected',
    },
    {
      pattern: /(--|#|\/\*|\*\/)/,
      severity: 'high',
      description: 'SQL comment detected',
    },
    {
      pattern: /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
      severity: 'critical',
      description: 'Boolean-based injection pattern',
    },
    {
      pattern: /(\bUNION\b|\bUNION\s+ALL\b)/i,
      severity: 'critical',
      description: 'UNION-based injection',
    },
    {
      pattern: /(;\s*\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/i,
      severity: 'critical',
      description: 'Stacked query detected',
    },
    {
      pattern: /(\bWAITFOR\s+DELAY\b|\bSLEEP\s*\()/i,
      severity: 'medium',
      description: 'Time-based blind injection',
    },
    {
      pattern: /(\bINTO\s+OUTFILE\b|\bINTO\s+DUMPFILE\b)/i,
      severity: 'high',
      description: 'File operation attempt',
    },
    {
      pattern: /(\bLOAD_FILE\s*\()/i,
      severity: 'high',
      description: 'File read attempt',
    },
  ];

  private queryLog: Array<{
    query: string;
    timestamp: Date;
    safe: boolean;
    reason?: string;
  }> = [];

  private readonly maxLogSize = 1000;

  validateInput(input: string): QueryValidationResult {
    if (!input) {
      return { safe: true };
    }

    // Check for SQL patterns
    for (const sqlPattern of this.sqlPatterns) {
      if (sqlPattern.pattern.test(input)) {
        this.logger.warn(
          `SQL injection attempt detected: ${sqlPattern.description} (${sqlPattern.severity})`,
        );

        this.logQuery(input, false, sqlPattern.description);

        return {
          safe: false,
          reason: `SQL injection pattern detected: ${sqlPattern.description}`,
        };
      }
    }

    // Check for suspicious characters
    const suspiciousChars = /['";`\-\/\\]/;
    if (suspiciousChars.test(input)) {
      // Sanitize the input
      const sanitized = this.sanitizeInput(input);
      this.logQuery(input, true, 'Sanitized');

      return {
        safe: true,
        sanitized,
      };
    }

    this.logQuery(input, true);
    return { safe: true };
  }

  sanitizeInput(input: string): string {
    // Remove null bytes
    let sanitized = input.replace(/\x00/g, '');

    // Escape single quotes
    sanitized = sanitized.replace(/'/g, "''");

    // Escape double quotes
    sanitized = sanitized.replace(/"/g, '\\"');

    // Remove backticks
    sanitized = sanitized.replace(/`/g, '');

    // Remove SQL comments
    sanitized = sanitized.replace(/--/g, '');
    sanitized = sanitized.replace(/\/\*.*?\*\//g, '');
    sanitized = sanitized.replace(/#/g, '');

    return sanitized;
  }

  validateQuery(query: string): QueryValidationResult {
    // Check if query uses parameterized placeholders
    const hasParameters = /\?|\$\d+|:\w+/.test(query);

    if (!hasParameters) {
      // If no parameters, check for suspicious patterns
      return this.validateInput(query);
    }

    // Check for dangerous patterns even with parameters
    for (const sqlPattern of this.sqlPatterns) {
      if (
        sqlPattern.severity === 'critical' &&
        sqlPattern.pattern.test(query)
      ) {
        this.logger.warn(
          `Suspicious query pattern detected: ${sqlPattern.description}`,
        );

        return {
          safe: false,
          reason: `Suspicious pattern: ${sqlPattern.description}`,
        };
      }
    }

    return { safe: true };
  }

  isSafeIdentifier(identifier: string): boolean {
    // Only allow alphanumeric and underscores in identifiers
    const safePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return safePattern.test(identifier);
  }

  sanitizeIdentifier(identifier: string): string {
    if (this.isSafeIdentifier(identifier)) {
      return identifier;
    }

    // Remove all non-alphanumeric characters except underscore
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }

  validateOrderBy(orderBy: string, allowedColumns: string[]): QueryValidationResult {
    const sanitized = this.sanitizeIdentifier(orderBy);

    if (!allowedColumns.includes(sanitized)) {
      return {
        safe: false,
        reason: `Invalid ORDER BY column: ${orderBy}`,
      };
    }

    return { safe: true, sanitized };
  }

  validateLimit(limit: string, maxLimit: number = 1000): QueryValidationResult {
    const numLimit = parseInt(limit, 10);

    if (isNaN(numLimit) || numLimit < 0) {
      return {
        safe: false,
        reason: 'Invalid LIMIT value',
      };
    }

    if (numLimit > maxLimit) {
      return {
        safe: false,
        reason: `LIMIT exceeds maximum of ${maxLimit}`,
      };
    }

    return { safe: true, sanitized: numLimit.toString() };
  }

  getQueryLog(): Array<{
    query: string;
    timestamp: Date;
    safe: boolean;
    reason?: string;
  }> {
    return [...this.queryLog];
  }

  getThreatStatistics(): {
    totalChecked: number;
    threatsBlocked: number;
    bySeverity: Record<string, number>;
  } {
    const stats = {
      totalChecked: this.queryLog.length,
      threatsBlocked: this.queryLog.filter((q) => !q.safe).length,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
    };

    // Count by severity from blocked queries
    this.queryLog
      .filter((q) => !q.safe)
      .forEach((q) => {
        // Determine severity based on reason
        const pattern = this.sqlPatterns.find((p) => p.description === q.reason);
        if (pattern) {
          stats.bySeverity[pattern.severity]++;
        }
      });

    return stats;
  }

  addPattern(pattern: SQLPattern): void {
    this.sqlPatterns.push(pattern);
  }

  private logQuery(query: string, safe: boolean, reason?: string): void {
    this.queryLog.push({
      query: query.substring(0, 200), // Limit query length in log
      timestamp: new Date(),
      safe,
      reason,
    });

    // Keep log size manageable
    if (this.queryLog.length > this.maxLogSize) {
      this.queryLog = this.queryLog.slice(-this.maxLogSize);
    }
  }
}
