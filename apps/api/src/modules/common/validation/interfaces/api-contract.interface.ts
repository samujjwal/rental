/**
 * API Contract Interfaces
 * 
 * Defines types and interfaces for API contract validation and testing
 */

import { ValidationError } from 'class-validator';

export interface ApiContract {
  version: string;
  endpoint: string;
  method: HttpMethod;
  requestSchema?: JsonSchema;
  responseSchema?: JsonSchema;
  headers?: Record<string, string>;
  queryParams?: Record<string, ApiParameter>;
  pathParams?: Record<string, ApiParameter>;
  deprecated?: boolean;
  deprecationDate?: Date;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface ApiParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description?: string;
  example?: any;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  pattern?: string;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: any[];
  description?: string;
  example?: any;
}

export interface ContractValidationResult {
  valid: boolean;
  errors: ContractValidationError[];
  warnings: ContractWarning[];
}

export interface ContractValidationError {
  field: string;
  message: string;
  type: 'required' | 'type' | 'format' | 'constraint' | 'schema';
  value?: any;
}

export interface ContractWarning {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ApiEndpointDefinition {
  path: string;
  method: HttpMethod;
  summary?: string;
  description?: string;
  tags?: string[];
  request?: {
    body?: JsonSchema;
    query?: Record<string, ApiParameter>;
    headers?: Record<string, ApiParameter>;
  };
  pathParams?: Record<string, ApiParameter>;
  responses: Record<number, ApiResponseDefinition>;
  deprecated?: boolean;
  security?: string[];
}

export interface ApiResponseDefinition {
  description: string;
  schema?: JsonSchema;
  headers?: Record<string, ApiParameter>;
  examples?: Record<string, any>;
}

export interface ApiContractTest {
  name: string;
  endpoint: string;
  method: HttpMethod;
  request?: {
    body?: any;
    query?: Record<string, any>;
    headers?: Record<string, string>;
  };
  expectedResponse: {
    status: number;
    body?: any;
    headers?: Record<string, string>;
  };
}

export interface ContractTestResult {
  name: string;
  passed: boolean;
  errors: string[];
  actualResponse?: any;
  expectedResponse?: any;
  duration: number;
}

export interface ApiVersionInfo {
  version: string;
  status: 'stable' | 'beta' | 'deprecated' | 'sunset';
  releaseDate: Date;
  deprecationDate?: Date;
  sunsetDate?: Date;
  changes: ApiChange[];
}

export interface ApiChange {
  type: 'breaking' | 'feature' | 'fix' | 'deprecated';
  description: string;
  affectedEndpoints?: string[];
}

export interface ContractDocumentation {
  title: string;
  description: string;
  version: string;
  baseUrl: string;
  endpoints: ApiEndpointDefinition[];
  schemas: Record<string, JsonSchema>;
  securityDefinitions?: Record<string, SecurityDefinition>;
}

export interface SecurityDefinition {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface DtoValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitized?: any;
}
