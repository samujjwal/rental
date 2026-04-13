/**
 * API Schema Validator Service
 * 
 * Validates API schemas and provides schema versioning
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  JsonSchema,
  ContractValidationResult,
  ContractValidationError,
  ContractWarning,
} from '../interfaces/api-contract.interface';

@Injectable()
export class ApiSchemaValidator {
  private readonly logger = new Logger(ApiSchemaValidator.name);
  private schemas = new Map<string, JsonSchema>();
  private schemaVersions = new Map<string, string[]>();

  registerSchema(name: string, schema: JsonSchema, version: string = '1.0.0'): void {
    const key = `${name}:${version}`;
    this.schemas.set(key, schema);

    if (!this.schemaVersions.has(name)) {
      this.schemaVersions.set(name, []);
    }
    this.schemaVersions.get(name)!.push(version);
  }

  getSchema(name: string, version?: string): JsonSchema | undefined {
    if (version) {
      return this.schemas.get(`${name}:${version}`);
    }

    // Return latest version
    const versions = this.schemaVersions.get(name);
    if (!versions || versions.length === 0) {
      return undefined;
    }

    const latestVersion = versions.sort((a, b) => this.compareVersions(b, a))[0];
    return this.schemas.get(`${name}:${latestVersion}`);
  }

  validateData(data: any, schemaName: string, version?: string): ContractValidationResult {
    const schema = this.getSchema(schemaName, version);

    if (!schema) {
      return {
        valid: false,
        errors: [
          {
            field: 'schema',
            message: `Schema '${schemaName}'${version ? ` version ${version}` : ''} not found`,
            type: 'schema',
          },
        ],
        warnings: [],
      };
    }

    return this.validateAgainstSchema(data, schema);
  }

  private validateAgainstSchema(data: any, schema: JsonSchema, path: string = ''): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: ContractWarning[] = [];

    this.validateValue(data, schema, path, errors, warnings);

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
    if (value === null || value === undefined) {
      if (schema.type !== 'null') {
        errors.push({
          field: path || 'root',
          message: `Expected type ${schema.type}, got null`,
          type: 'type',
          value,
        });
      }
      return;
    }

    const actualType = this.getType(value);
    if (!this.isTypeCompatible(actualType, schema.type)) {
      errors.push({
        field: path || 'root',
        message: `Expected type ${schema.type}, got ${actualType}`,
        type: 'type',
        value,
      });
      return;
    }

    switch (schema.type) {
      case 'object':
        this.validateObject(value, schema, path, errors, warnings);
        break;
      case 'array':
        this.validateArray(value, schema, path, errors, warnings);
        break;
      case 'string':
        this.validateString(value, schema, path, errors);
        break;
      case 'number':
        this.validateNumber(value, schema, path, errors);
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

    if (schema.properties) {
      Object.entries(value).forEach(([key, val]) => {
        const propSchema = schema.properties![key];
        if (propSchema) {
          this.validateValue(val, propSchema, `${path}.${key}`, errors, warnings);
        } else if (!schema.additionalProperties) {
          warnings.push({
            field: `${path}.${key}`,
            message: `Additional property '${key}' not allowed`,
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
  ): void {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({
        field: path,
        message: `Value does not match pattern: ${schema.pattern}`,
        type: 'format',
        value,
      });
    }

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
  }

  private validateNumber(
    value: number,
    schema: JsonSchema,
    path: string,
    errors: ContractValidationError[],
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

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;

      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }

    return 0;
  }

  getSchemaVersions(name: string): string[] {
    return this.schemaVersions.get(name) || [];
  }

  getAllSchemas(): Record<string, JsonSchema> {
    const result: Record<string, JsonSchema> = {};
    this.schemas.forEach((schema, key) => {
      result[key] = schema;
    });
    return result;
  }
}
