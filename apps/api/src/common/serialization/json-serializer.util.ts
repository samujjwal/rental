/**
 * JSON Serialization Utility
 * 
 * Provides type-safe serialization and deserialization for JSON fields.
 * Prevents parse errors from silently hiding operational state.
 */

export class JsonSerializationError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'JsonSerializationError';
  }
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T = any>(
  jsonString: string | null | undefined,
  defaultValue: T,
  context?: string
): T {
  if (jsonString === null || jsonString === undefined || jsonString === '') {
    return defaultValue;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    const errorMessage = context
      ? `Failed to parse JSON in ${context}: ${error instanceof Error ? error.message : String(error)}`
      : `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`;
    
    throw new JsonSerializationError(errorMessage, error instanceof Error ? error : undefined);
  }
}

/**
 * Safely stringify JSON with error handling
 */
export function safeJsonStringify(
  value: any,
  context?: string
): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    const errorMessage = context
      ? `Failed to stringify JSON in ${context}: ${error instanceof Error ? error.message : String(error)}`
      : `Failed to stringify JSON: ${error instanceof Error ? error.message : String(error)}`;
    
    throw new JsonSerializationError(errorMessage, error instanceof Error ? error : undefined);
  }
}

/**
 * Type-safe JSON serializer for specific types
 */
export class JsonSerializer<T> {
  constructor(
    private readonly typeName: string,
    private readonly validator?: (value: any) => value is T
  ) {}

  parse(jsonString: string | null | undefined, defaultValue: T): T {
    const parsed = safeJsonParse(jsonString, defaultValue, this.typeName);
    
    if (this.validator && !this.validator(parsed)) {
      throw new JsonSerializationError(
        `Validation failed for ${this.typeName}: parsed value does not match expected type`
      );
    }
    
    return parsed;
  }

  stringify(value: T): string {
    return safeJsonStringify(value, this.typeName);
  }
}

/**
 * Common JSON field types and their serializers
 */
export const CommonSerializers = {
  // Metadata: generic key-value object
  metadata: new JsonSerializer<Record<string, any>>('metadata'),
  
  // Rules: array of rule objects
  rules: new JsonSerializer<Array<Record<string, any>>>('rules'),
  
  // Checklist data: structured checklist
  checklistData: new JsonSerializer<Record<string, any>>('checklistData'),
  
  // Damages: array of damage reports
  damages: new JsonSerializer<Array<Record<string, any>>>('damages'),
  
  // Old/new values for audit logs
  auditValues: new JsonSerializer<Record<string, any>>('auditValues'),
  
  // Payment metadata
  paymentMetadata: new JsonSerializer<Record<string, any>>('paymentMetadata'),
  
  // Policy rule metadata
  policyRuleMetadata: new JsonSerializer<Record<string, any>>('policyRuleMetadata'),
};

/**
 * Helper to create a typed serializer with custom validation
 */
export function createSerializer<T>(
  typeName: string,
  validator?: (value: any) => value is T
): JsonSerializer<T> {
  return new JsonSerializer<T>(typeName, validator);
}
