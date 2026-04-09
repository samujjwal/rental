import { Injectable, NestMiddleware, Logger, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Query Validation Middleware
 *
 * This middleware validates incoming query parameters to prevent:
 * - SQL injection attempts
 * - Excessive query complexity
 * - Oversized result requests
 * - Malformed query parameters
 */
@Injectable()
export class QueryValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(QueryValidationMiddleware.name);

  // Configuration limits
  private readonly MAX_LIMIT = 100;
  private readonly MAX_OFFSET = 10000;
  private readonly MAX_DEPTH = 5;
  private readonly MAX_SORT_FIELDS = 5;

  use(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateQueryParameters(req.query);
      this.validatePagination(req.query);
      this.validateSorting(req.query);
      this.validateFiltering(req.query);

      next();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Query validation error:', error);
      throw new BadRequestException('Invalid query parameters');
    }
  }

  /**
   * Validate query parameters for SQL injection patterns
   */
  private validateQueryParameters(query: any) {
    const sqlInjectionPatterns = [
      /(';|--|\/\*|\*\/|xp_|sp_|exec\s|select\s|insert\s|update\s|delete\s|drop\s|union\s|script)/i,
      /(or\s+1\s*=\s*1|or\s+1\s*=\s*"|"|'|\-\-)/i,
    ];

    for (const [key, value] of Object.entries(query)) {
      // Skip filter parameter from SQL injection validation as it's expected to be JSON
      if (key === 'filter') {
        continue;
      }

      if (typeof value === 'string') {
        for (const pattern of sqlInjectionPatterns) {
          if (pattern.test(value)) {
            this.logger.warn(`Potential SQL injection detected in parameter '${key}': ${value}`);
            throw new BadRequestException(`Invalid query parameter: ${key}`);
          }
        }
      }
    }
  }

  /**
   * Validate pagination parameters (limit, offset)
   */
  private validatePagination(query: any) {
    const limit = parseInt(query.limit as string, 10);
    const offset = parseInt(query.offset as string, 10);

    if (query.limit && (isNaN(limit) || limit < 1 || limit > this.MAX_LIMIT)) {
      throw new BadRequestException(`Limit must be between 1 and ${this.MAX_LIMIT}`);
    }

    if (query.offset && (isNaN(offset) || offset < 0 || offset > this.MAX_OFFSET)) {
      throw new BadRequestException(`Offset must be between 0 and ${this.MAX_OFFSET}`);
    }

    // Warn about large offsets
    if (offset > 1000) {
      this.logger.warn(`Large offset detected: ${offset}. Consider using cursor-based pagination.`);
    }
  }

  /**
   * Validate sorting parameters
   */
  private validateSorting(query: any) {
    const sort = query.sort;
    if (sort) {
      const sortFields = Array.isArray(sort) ? sort : sort.split(',');

      if (sortFields.length > this.MAX_SORT_FIELDS) {
        throw new BadRequestException(`Maximum ${this.MAX_SORT_FIELDS} sort fields allowed`);
      }

      // Validate sort field format (field:direction)
      for (const field of sortFields) {
        if (typeof field === 'string') {
          const parts = field.split(':');
          if (parts.length > 2) {
            throw new BadRequestException(`Invalid sort format: ${field}`);
          }

          if (parts.length === 2) {
            const direction = parts[1].toLowerCase();
            if (direction !== 'asc' && direction !== 'desc') {
              throw new BadRequestException(
                `Invalid sort direction: ${direction}. Use 'asc' or 'desc'`,
              );
            }
          }
        }
      }
    }
  }

  /**
   * Validate filtering parameters
   */
  private validateFiltering(query: any) {
    // Check for excessive nesting depth in filter objects
    const filter = query.filter;
    if (filter && typeof filter === 'string') {
      try {
        const parsed = JSON.parse(filter);
        const depth = this.getObjectDepth(parsed);

        if (depth > this.MAX_DEPTH) {
          throw new BadRequestException(`Filter depth exceeds maximum of ${this.MAX_DEPTH}`);
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new BadRequestException('Invalid filter JSON format');
        }
        throw error;
      }
    }
  }

  /**
   * Calculate object nesting depth
   */
  private getObjectDepth(obj: any, currentDepth = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const value of Object.values(obj)) {
      const depth = this.getObjectDepth(value, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }
}
