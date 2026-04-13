/**
 * API Contract Validator Service
 * 
 * Validates API contracts, DTOs, and request/response schemas
 */

import { Injectable, Logger } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass, plainToInstance } from 'class-transformer';
import {
  ApiContract,
  ContractValidationResult,
  ContractValidationError,
  ContractWarning,
  JsonSchema,
  ApiEndpointDefinition,
  DtoValidationResult,
  ApiParameter,
} from '../interfaces/api-contract.interface';

@Injectable()
export class ApiContractValidator {
  private readonly logger = new Logger(ApiContractValidator.name);

  async validateDto<T extends object>(dtoClass: new () => T, plainObject: any): Promise<DtoValidationResult> {
    try {
      const instance = plainToInstance(dtoClass, plainObject);
      const errors = await validate(instance);

      return {
        valid: errors.length === 0,
        errors,
        sanitized: errors.length === 0 ? instance : undefined,
      };
    } catch (error) {
      this.logger.error(`DTO validation error: ${error}`);
      return {
        valid: false,
        errors: [this.createValidationError(error)],
      };
    }
  }

  validateAgainstSchema(data: any, schema: JsonSchema): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: ContractWarning[] = [];

    this.validateValue(data, schema, '', errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateContract(contract: ApiContract): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: ContractWarning[] = [];

    // Validate endpoint format
    if (!contract.endpoint.startsWith('/')) {
      errors.push({
        field: 'endpoint',
        message: 'Endpoint must start with /',
        type: 'format',
        value: contract.endpoint,
      });
    }

    // Validate version format (semver)
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(contract.version)) {
      errors.push({
        field: 'version',
        message: 'Version must follow semantic versioning (e.g., 1.0.0)',
        type: 'format',
        value: contract.version,
      });
    }

    // Validate request schema if provided
    if (contract.requestSchema) {
      const schemaValidation = this.validateSchemaDefinition(contract.requestSchema);
      errors.push(...schemaValidation.errors.map((e) => ({ ...e, field: `requestSchema.${e.field}` })));
      warnings.push(...schemaValidation.warnings.map((w) => ({ ...w, field: `requestSchema.${w.field}` })));
    }

    // Validate response schema if provided
    if (contract.responseSchema) {
      const schemaValidation = this.validateSchemaDefinition(contract.responseSchema);
      errors.push(...schemaValidation.errors.map((e) => ({ ...e, field: `responseSchema.${e.field}` })));
      warnings.push(...schemaValidation.warnings.map((w) => ({ ...w, field: `responseSchema.${w.field}` })));
    }

    // Check for deprecation warning
    if (contract.deprecated) {
      warnings.push({
        field: 'deprecated',
        message: `Endpoint ${contract.endpoint} is deprecated`,
        severity: 'high',
      });

      if (!contract.deprecationDate) {
        warnings.push({
          field: 'deprecationDate',
          message: 'Deprecated endpoint should have a deprecation date',
          severity: 'medium',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateEndpointDefinition(endpoint: ApiEndpointDefinition): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: ContractWarning[] = [];

    // Validate path parameters exist in path
    if (endpoint.path) {
      const pathParams = (endpoint.path.match(/\{([^}]+)\}/g) || []) as string[];
      const definedParams = Object.keys(endpoint.pathParams || {});

      pathParams.forEach((param) => {
        const paramName = param.slice(1, -1);
        if (!definedParams.includes(paramName)) {
          errors.push({
            field: `pathParams.${paramName}`,
            message: `Path parameter ${paramName} is used in path but not defined`,
            type: 'required',
          });
        }
      });
    }

    // Validate responses
    if (!endpoint.responses || Object.keys(endpoint.responses).length === 0) {
      errors.push({
        field: 'responses',
        message: 'At least one response must be defined',
        type: 'required',
      });
    }

    // Validate request body schema if present
    if (endpoint.request?.body) {
      const bodyValidation = this.validateSchemaDefinition(endpoint.request.body);
      errors.push(...bodyValidation.errors.map((e) => ({ ...e, field: `request.body.${e.field}` })));
    }

    // Validate response schemas
    Object.entries(endpoint.responses || {}).forEach(([statusCode, response]) => {
      if (response.schema) {
        const schemaValidation = this.validateSchemaDefinition(response.schema);
        errors.push(...schemaValidation.errors.map((e) => ({
          ...e,
          field: `responses.${statusCode}.schema.${e.field}`,
        })));
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateValue(
    value: any,
    schema: JsonSchema,
    path: string,
    errors: ContractValidationError[],
    warnings: ContractWarning[],
  ): void {
    const currentPath = path || 'root';

    // Check null values
    if (value === null || value === undefined) {
      if (schema.type !== 'null' && !schema.enum?.includes(null)) {
        errors.push({
          field: currentPath,
          message: `Expected type ${schema.type}, got null`,
          type: 'type',
          value,
        });
      }
      return;
    }

    // Validate type
    const actualType = this.getType(value);
    if (!this.isTypeCompatible(actualType, schema.type)) {
      errors.push({
        field: currentPath,
        message: `Expected type ${schema.type}, got ${actualType}`,
        type: 'type',
        value,
      });
      return;
    }

    // Validate based on type
    switch (schema.type) {
      case 'object':
        this.validateObject(value, schema, currentPath, errors, warnings);
        break;
      case 'array':
        this.validateArray(value, schema, currentPath, errors, warnings);
        break;
      case 'string':
        this.validateString(value, schema, currentPath, errors, warnings);
        break;
      case 'number':
        this.validateNumber(value, schema, currentPath, errors, warnings);
        break;
    }
  }

  private validateObject(
    value: Record<string, any>,
    schema: JsonSchema,
    path: string,
    errors: ContractValidationError[],
    warnings: ContractWarning[],
  ): void {
    // Check required properties
    const required = schema.required || [];
    required.forEach((prop) => {
      if (!(prop in value)) {
        errors.push({
          field: `${path}.${prop}`,
          message: `Required property '${prop}' is missing`,
          type: 'required',
        });
      }
    });

    // Validate properties
    if (schema.properties) {
      Object.entries(value).forEach(([key, val]) => {
        const propSchema = schema.properties![key];
        if (propSchema) {
          this.validateValue(val, propSchema, `${path}.${key}`, errors, warnings);
        } else if (!schema.additionalProperties) {
          warnings.push({
            field: `${path}.${key}`,
            message: `Additional property '${key}' not allowed by schema`,
            severity: 'medium',
          });
        }
      });
    }
  }

  private validateArray(
    value: any[],
    schema: JsonSchema,
    path: string,
    errors: ContractValidationError[],
    warnings: ContractWarning[],
  ): void {
    if (schema.items) {
      value.forEach((item, index) => {
        this.validateValue(item, schema.items!, `${path}[${index}]`, errors, warnings);
      });
    }
  }

  private validateString(
    value: string,
    schema: JsonSchema,
    path: string,
    errors: ContractValidationError[],
    warnings: ContractWarning[],
  ): void {
    // Validate pattern
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({
        field: path,
        message: `Value does not match pattern: ${schema.pattern}`,
        type: 'format',
        value,
      });
    }

    // Validate length
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        field: path,
        message: `String length ${value.length} is less than minimum ${schema.minLength}`,
        type: 'constraint',
        value,
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        field: path,
        message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
        type: 'constraint',
        value,
      });
    }

    // Validate format
    if (schema.format) {
      const formatValid = this.validateFormat(value, schema.format);
      if (!formatValid) {
        errors.push({
          field: path,
          message: `Value does not match format: ${schema.format}`,
          type: 'format',
          value,
        });
      }
    }

    // Validate enum
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        type: 'constraint',
        value,
      });
    }
  }

  private validateNumber(
    value: number,
    schema: JsonSchema,
    path: string,
    errors: ContractValidationError[],
    _warnings: ContractWarning[],
  ): void {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        field: path,
        message: `Value ${value} is less than minimum ${schema.minimum}`,
        type: 'constraint',
        value,
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        field: path,
        message: `Value ${value} exceeds maximum ${schema.maximum}`,
        type: 'constraint',
        value,
      });
    }

    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        type: 'constraint',
        value,
      });
    }
  }

  private validateSchemaDefinition(schema: JsonSchema): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: ContractWarning[] = [];

    // Check for valid type
    const validTypes = ['object', 'array', 'string', 'number', 'boolean', 'null'];
    if (!validTypes.includes(schema.type)) {
      errors.push({
        field: 'type',
        message: `Invalid type: ${schema.type}. Must be one of: ${validTypes.join(', ')}`,
        type: 'type',
      });
    }

    // Validate object schema
    if (schema.type === 'object' && schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        const propValidation = this.validateSchemaDefinition(propSchema);
        errors.push(...propValidation.errors.map((e) => ({ ...e, field: `properties.${key}.${e.field}` })));
      });

      // Check required properties exist in properties
      if (schema.required) {
        schema.required.forEach((req) => {
          if (!schema.properties![req]) {
            errors.push({
              field: `required.${req}`,
              message: `Required property '${req}' not defined in properties`,
              type: 'required',
            });
          }
        });
      }
    }

    // Validate array schema
    if (schema.type === 'array' && schema.items) {
      const itemsValidation = this.validateSchemaDefinition(schema.items);
      errors.push(...itemsValidation.errors.map((e) => ({ ...e, field: `items.${e.field}` })));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateFormat(value: string, format: string): boolean {
    const formatPatterns: Record<string, RegExp> = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^https?:\/\/.+/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      date: /^\d{4}-\d{2}-\d{2}$/,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/,
    };

    const pattern = formatPatterns[format];
    if (pattern) {
      return pattern.test(value);
    }

    return true;
  }

  private getType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private isTypeCompatible(actualType: string, expectedType: string): boolean {
    if (expectedType === 'array' && actualType === 'array') return true;
    if (expectedType === 'object' && actualType === 'object') return true;
    if (expectedType === 'string' && actualType === 'string') return true;
    if (expectedType === 'number' && actualType === 'number') return true;
    if (expectedType === 'boolean' && actualType === 'boolean') return true;
    if (expectedType === 'null' && actualType === 'null') return true;
    return false;
  }

  private createValidationError(error: any): ValidationError {
    const validationError = new ValidationError();
    validationError.property = 'unknown';
    validationError.constraints = { unknown: String(error) };
    return validationError;
  }
}
