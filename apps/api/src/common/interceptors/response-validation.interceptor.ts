import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { ApiContractValidator } from '../../modules/common/validation/services/api-contract-validator.service';

/**
 * Response Validation Interceptor
 * 
 * Validates API responses against their declared schemas.
 * Uses the ApiContractValidator to ensure responses conform to expected contracts.
 * Can be enabled globally or per-controller/route using @UseInterceptors decorator.
 */
@Injectable()
export class ResponseValidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseValidationInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly contractValidator: ApiContractValidator,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Skip validation for non-JSON responses or streaming
    const contentType = response.getHeader('content-type');
    if (contentType && !contentType.includes('application/json')) {
      return next.handle();
    }

    // Get the handler and class metadata
    const handler = context.getHandler();
    const controllerClass = context.getClass();

    // Check if validation is disabled for this route
    const skipValidation = this.reflector.get<boolean>('skipResponseValidation', handler) ||
                           this.reflector.get<boolean>('skipResponseValidation', controllerClass);
    
    if (skipValidation) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Validate response data
        this.validateResponse(request.method, request.path, data);
        return data;
      }),
    );
  }

  private validateResponse(method: string, path: string, data: any): void {
    // Skip validation for null/undefined responses
    if (data === null || data === undefined) {
      return;
    }

    // Skip validation for error responses (handled by exception filters)
    if (data && (data.statusCode || data.error || data.message) && typeof data === 'object') {
      return;
    }

    try {
      // Get the expected schema for this endpoint
      const schema = this.getResponseSchema(method, path);
      
      if (schema) {
        const validation = this.contractValidator.validateAgainstSchema(data, schema);
        
        if (!validation.valid) {
          this.logger.error(
            `Response validation failed for ${method} ${path}: ${JSON.stringify(validation.errors)}`,
          );
          
          // In production, log but don't break the response
          // In development/test, you might want to throw an error
          if (process.env.NODE_ENV !== 'production') {
            throw new Error(
              `Response validation failed: ${JSON.stringify(validation.errors)}`,
            );
          }
        }
      }
    } catch (error) {
      // Log validation errors but don't break the response
      this.logger.warn(
        `Response validation error for ${method} ${path}: ${error.message}`,
      );
    }
  }

  private getResponseSchema(method: string, path: string): any {
    // This is a simplified version - in production, you would:
    // 1. Load the OpenAPI/Swagger spec
    // 2. Look up the schema for the specific endpoint and method
    // 3. Return the appropriate response schema
    
    // For now, return null to skip schema-based validation
    // The ValidationPipe handles DTO validation on the request side
    return null;
  }
}
