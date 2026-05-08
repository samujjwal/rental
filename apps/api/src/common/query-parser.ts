import { BadRequestException } from '@nestjs/common';

export interface QueryParamDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'enum';
  required?: boolean;
  default?: any;
  enum?: string[];
  min?: number;
  max?: number;
}

export interface QueryParseOptions {
  [key: string]: QueryParamDefinition;
}

export interface ParsedQueryParams {
  [key: string]: any;
}

/**
 * Centralized query parameter parser with validation and type coercion.
 * Provides consistent parsing across all controllers.
 */
export class QueryParser {
  /**
   * Parse query parameters according to the provided schema.
   *
   * @param query - Raw query parameters from the request
   * @param schema - Parameter definitions with types and validation rules
   * @returns Parsed and validated query parameters
   * @throws BadRequestException if validation fails
   */
  static parse(query: Record<string, any>, schema: QueryParseOptions): ParsedQueryParams {
    const result: ParsedQueryParams = {};

    for (const [key, definition] of Object.entries(schema)) {
      const rawValue = query[key];

      // Handle required fields
      if (definition.required && (rawValue === undefined || rawValue === null || rawValue === '')) {
        throw new BadRequestException({
          message: `Required query parameter '${key}' is missing`,
          field: key,
        });
      }

      // Use default value if not provided
      if ((rawValue === undefined || rawValue === null || rawValue === '') && definition.default !== undefined) {
        result[key] = definition.default;
        continue;
      }

      // Skip if not provided and not required
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        continue;
      }

      // Parse based on type
      try {
        result[key] = this.parseValue(rawValue, definition);
      } catch (error) {
        throw new BadRequestException({
          message: `Invalid value for query parameter '${key}'`,
          field: key,
          expectedType: definition.type,
          receivedValue: rawValue,
        });
      }
    }

    return result;
  }

  /**
   * Parse a single value according to its type definition.
   */
  private static parseValue(rawValue: any, definition: QueryParamDefinition): any {
    let parsedValue: any;

    switch (definition.type) {
      case 'string':
        parsedValue = String(rawValue);
        break;

      case 'number':
        parsedValue = Number(rawValue);
        if (isNaN(parsedValue)) {
          throw new Error('Invalid number');
        }
        if (definition.min !== undefined && parsedValue < definition.min) {
          throw new Error(`Value must be at least ${definition.min}`);
        }
        if (definition.max !== undefined && parsedValue > definition.max) {
          throw new Error(`Value must be at most ${definition.max}`);
        }
        break;

      case 'boolean':
        if (typeof rawValue === 'boolean') {
          parsedValue = rawValue;
        } else if (rawValue === 'true' || rawValue === '1') {
          parsedValue = true;
        } else if (rawValue === 'false' || rawValue === '0') {
          parsedValue = false;
        } else {
          throw new Error('Invalid boolean');
        }
        break;

      case 'date':
        parsedValue = new Date(rawValue);
        if (isNaN(parsedValue.getTime())) {
          throw new Error('Invalid date');
        }
        break;

      case 'array':
        if (Array.isArray(rawValue)) {
          parsedValue = rawValue;
        } else if (typeof rawValue === 'string') {
          parsedValue = rawValue.split(',').map((item) => item.trim());
        } else {
          throw new Error('Invalid array');
        }
        break;

      case 'enum':
        if (!definition.enum || definition.enum.length === 0) {
          throw new Error('Enum values not defined');
        }
        parsedValue = String(rawValue);
        if (!definition.enum.includes(parsedValue)) {
          throw new Error(`Must be one of: ${definition.enum.join(', ')}`);
        }
        break;

      default:
        throw new Error(`Unsupported type: ${definition.type}`);
    }

    return parsedValue;
  }

  /**
   * Parse pagination parameters (page, limit, sort, order).
   */
  static parsePagination(query: Record<string, any>): {
    page: number;
    limit: number;
    skip: number;
    sort?: string;
    order?: 'asc' | 'desc';
  } {
    const schema: QueryParseOptions = {
      page: { type: 'number', default: 1, min: 1 },
      limit: { type: 'number', default: 10, min: 1, max: 100 },
      sort: { type: 'string' },
      order: { type: 'enum', enum: ['asc', 'desc'], default: 'asc' },
    };

    const parsed = this.parse(query, schema);
    const skip = (parsed.page - 1) * parsed.limit;

    return {
      page: parsed.page,
      limit: parsed.limit,
      skip,
      sort: parsed.sort,
      order: parsed.order,
    };
  }

  /**
   * Parse date range parameters (startDate, endDate).
   */
  static parseDateRange(query: Record<string, any>): {
    startDate?: Date;
    endDate?: Date;
  } {
    const schema: QueryParseOptions = {
      startDate: { type: 'date' },
      endDate: { type: 'date' },
    };

    const parsed = this.parse(query, schema);

    // Validate that startDate is before endDate if both are provided
    if (parsed.startDate && parsed.endDate && parsed.startDate > parsed.endDate) {
      throw new BadRequestException({
        message: 'startDate must be before endDate',
      });
    }

    return {
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    };
  }

  /**
   * Parse filter parameters (key=value pairs).
   */
  static parseFilters(query: Record<string, any>, allowedFilters: string[]): Record<string, any> {
    const filters: Record<string, any> = {};

    for (const key of Object.keys(query)) {
      if (allowedFilters.includes(key)) {
        const value = query[key];
        // Handle array values from comma-separated strings
        if (typeof value === 'string' && value.includes(',')) {
          filters[key] = value.split(',').map((item) => item.trim());
        } else {
          filters[key] = value;
        }
      }
    }

    return filters;
  }
}
