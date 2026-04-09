import { Test, TestingModule } from '@nestjs/testing';
import { QueryValidationMiddleware } from './query-validation.middleware';
import { BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

describe('QueryValidationMiddleware', () => {
  let middleware: QueryValidationMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueryValidationMiddleware],
    }).compile();

    middleware = module.get<QueryValidationMiddleware>(QueryValidationMiddleware);
  });

  describe('SQL Injection Prevention', () => {
    it('should block SQL injection attempts in query parameters', () => {
      const req = {
        query: {
          search: "'; DROP TABLE users; --",
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should block OR-based injection attempts', () => {
      const req = {
        query: {
          username: "' OR '1'='1",
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should allow safe query parameters', () => {
      const req = {
        query: {
          search: 'apartment',
          city: 'Kathmandu',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Pagination Validation', () => {
    it('should block invalid limit values', () => {
      const req = {
        query: {
          limit: '999',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should block negative limit values', () => {
      const req = {
        query: {
          limit: '-1',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should block invalid offset values', () => {
      const req = {
        query: {
          offset: '99999',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should allow valid pagination parameters', () => {
      const req = {
        query: {
          limit: '10',
          offset: '20',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Sorting Validation', () => {
    it('should block too many sort fields', () => {
      const req = {
        query: {
          sort: 'field1,field2,field3,field4,field5,field6',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should block invalid sort direction', () => {
      const req = {
        query: {
          sort: 'price:invalid',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should allow valid sort parameters', () => {
      const req = {
        query: {
          sort: 'price:desc,name:asc',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Filtering Validation', () => {
    it('should block excessively nested filter objects', () => {
      const req = {
        query: {
          filter: JSON.stringify({
            level1: {
              level2: {
                level3: {
                  level4: {
                    level5: {
                      level6: 'value',
                    },
                  },
                },
              },
            },
          }),
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should block malformed filter JSON', () => {
      const req = {
        query: {
          filter: '{invalid json',
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).toThrow(BadRequestException);
    });

    it('should allow valid filter objects', () => {
      const req = {
        query: {
          filter: JSON.stringify({
            status: 'ACTIVE',
            price: { gte: 100, lte: 1000 },
          }),
        },
      } as unknown as Request;

      const res = {} as Response;
      const next = jest.fn() as NextFunction;

      expect(() => middleware.use(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });
  });
});
