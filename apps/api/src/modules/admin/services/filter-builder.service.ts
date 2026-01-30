import { Injectable } from '@nestjs/common';

export interface FilterCondition {
  field: string;
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'in'
    | 'not_in'
    | 'between'
    | 'not_between'
    | 'is_null'
    | 'is_not_null';
  value?: any;
  values?: any[];
}

export interface FilterGroup {
  and?: FilterCondition[];
  or?: FilterCondition[];
}

@Injectable()
export class FilterBuilderService {
  /**
   * Build Prisma where clause from filter conditions
   */
  buildWhereClause(filters: FilterCondition[] | FilterGroup): any {
    if (!filters) return {};

    // Handle filter groups (AND/OR logic)
    if (filters && ('and' in filters || 'or' in filters)) {
      const group = filters as FilterGroup;
      const where: any = {};

      if (group.and && group.and.length > 0) {
        where.AND = group.and.map((filter) => this.buildSingleFilter(filter));
      }

      if (group.or && group.or.length > 0) {
        where.OR = group.or.map((filter) => this.buildSingleFilter(filter));
      }

      return where;
    }

    // Handle array of filters (default to AND logic)
    if (Array.isArray(filters)) {
      if (filters.length === 0) return {};
      if (filters.length === 1) return this.buildSingleFilter(filters[0]);

      return {
        AND: filters.map((filter) => this.buildSingleFilter(filter)),
      };
    }

    return {};
  }

  /**
   * Build single filter condition
   */
  private buildSingleFilter(filter: FilterCondition): any {
    const { field, operator, value, values } = filter;

    switch (operator) {
      case 'eq':
        return { [field]: value };

      case 'neq':
        return { [field]: { not: value } };

      case 'gt':
        return { [field]: { gt: value } };

      case 'gte':
        return { [field]: { gte: value } };

      case 'lt':
        return { [field]: { lt: value } };

      case 'lte':
        return { [field]: { lte: value } };

      case 'contains':
        return { [field]: { contains: value, mode: 'insensitive' } };

      case 'startsWith':
        return { [field]: { startsWith: value, mode: 'insensitive' } };

      case 'endsWith':
        return { [field]: { endsWith: value, mode: 'insensitive' } };

      case 'in':
        return { [field]: { in: values || [value] } };

      case 'not_in':
        return { [field]: { notIn: values || [value] } };

      case 'between':
        if (!Array.isArray(value) || value.length !== 2) {
          throw new Error('BETWEEN operator requires array with exactly 2 values');
        }
        return { [field]: { gte: value[0], lte: value[1] } };

      case 'not_between':
        if (!Array.isArray(value) || value.length !== 2) {
          throw new Error('NOT_BETWEEN operator requires array with exactly 2 values');
        }
        return {
          OR: [{ [field]: { lt: value[0] } }, { [field]: { gt: value[1] } }],
        };

      case 'is_null':
        if (value === 'is_null') {
          return { [field]: null };
        } else if (value === 'not_null') {
          return { [field]: { not: null } };
        } else {
          return { [field]: null };
        }

      case 'is_not_null':
        if (value === 'not_null') {
          return { [field]: { not: null } };
        } else if (value === 'is_null') {
          return { [field]: null };
        } else {
          return { [field]: { not: null } };
        }

      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Parse frontend filter format to backend format
   */
  parseFrontendFilters(frontendFilters: any[]): FilterCondition[] {
    if (!frontendFilters || !Array.isArray(frontendFilters)) {
      return [];
    }

    return frontendFilters.map((filter) => {
      // Map frontend operators to backend operators
      const operatorMap: Record<string, FilterCondition['operator']> = {
        equals: 'eq',
        not_equals: 'neq',
        greater_than: 'gt',
        greater_than_equal: 'gte',
        less_than: 'lt',
        less_than_equal: 'lte',
        contains: 'contains',
        starts_with: 'startsWith',
        ends_with: 'endsWith',
        in: 'in',
        not_in: 'not_in',
        between: 'between',
        not_between: 'not_between',
        is_null: 'is_null',
        is_not_null: 'is_not_null',
      };

      const backendOperator = operatorMap[filter.operator] || 'eq';

      return {
        field: filter.field,
        operator: backendOperator,
        value: filter.value,
        values: filter.values,
      };
    });
  }
}
