import { Test, TestingModule } from '@nestjs/testing';
import { ResponseValidationInterceptor } from './response-validation.interceptor';
import { Reflector } from '@nestjs/core';
import { ApiContractValidator } from '../../modules/common/validation/services/api-contract-validator.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('ResponseValidationInterceptor', () => {
  let interceptor: ResponseValidationInterceptor;
  let reflector: Reflector;
  let contractValidator: ApiContractValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseValidationInterceptor,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ApiContractValidator,
          useValue: {
            validateAgainstSchema: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<ResponseValidationInterceptor>(ResponseValidationInterceptor);
    reflector = module.get<Reflector>(Reflector);
    contractValidator = module.get<ApiContractValidator>(ApiContractValidator);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through valid responses', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/api/test' }),
        getResponse: () => ({
          getHeader: () => 'application/json',
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => of({ data: 'test' }),
    };

    (reflector.get as jest.Mock).mockReturnValue(false);

    interceptor.intercept(context, callHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({ data: 'test' });
        done();
      },
    });
  });

  it('should skip validation when skipResponseValidation is true', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/api/test' }),
        getResponse: () => ({
          getHeader: () => 'application/json',
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => of({ data: 'test' }),
    };

    (reflector.get as jest.Mock).mockReturnValue(true);

    interceptor.intercept(context, callHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({ data: 'test' });
        expect(contractValidator.validateAgainstSchema).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should skip validation for non-JSON responses', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/api/test' }),
        getResponse: () => ({
          getHeader: () => 'text/html',
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => of({ data: 'test' }),
    };

    interceptor.intercept(context, callHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({ data: 'test' });
        expect(contractValidator.validateAgainstSchema).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should skip validation for null responses', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/api/test' }),
        getResponse: () => ({
          getHeader: () => 'application/json',
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    (reflector.get as jest.Mock).mockReturnValue(false);

    interceptor.intercept(context, callHandler).subscribe({
      next: (data) => {
        expect(data).toBeNull();
        expect(contractValidator.validateAgainstSchema).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should skip validation for error responses', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/api/test' }),
        getResponse: () => ({
          getHeader: () => 'application/json',
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    const errorResponse = { statusCode: 400, error: 'Bad Request', message: 'Validation failed' };
    const callHandler: CallHandler = {
      handle: () => of(errorResponse),
    };

    (reflector.get as jest.Mock).mockReturnValue(false);

    interceptor.intercept(context, callHandler).subscribe({
      next: (data) => {
        expect(data).toEqual(errorResponse);
        expect(contractValidator.validateAgainstSchema).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
