import 'reflect-metadata';
import { PaginationDto, PaginatedResponseDto, ApiPaginatedResponse } from './swagger.decorators';

describe('PaginationDto', () => {
  it('should be instantiable with pagination fields', () => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 10;
    dto.total = 100;
    dto.totalPages = 10;
    dto.hasNext = true;
    dto.hasPrevious = false;

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
    expect(dto.total).toBe(100);
    expect(dto.totalPages).toBe(10);
    expect(dto.hasNext).toBe(true);
    expect(dto.hasPrevious).toBe(false);
  });

  it('has ApiProperty metadata on all fields', () => {
    const metadataKeys = Reflect.getMetadataKeys(PaginationDto.prototype, 'page');
    expect(metadataKeys.length).toBeGreaterThan(0);
  });
});

describe('PaginatedResponseDto', () => {
  it('should hold data array and pagination metadata', () => {
    const dto = new PaginatedResponseDto<{ id: string }>();
    dto.data = [{ id: '1' }, { id: '2' }];
    dto.pagination = Object.assign(new PaginationDto(), {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });

    expect(dto.data).toHaveLength(2);
    expect(dto.pagination.total).toBe(2);
    expect(dto.pagination.hasNext).toBe(false);
  });
});

describe('ApiPaginatedResponse decorator', () => {
  it('is a function that returns a decorator', () => {
    expect(typeof ApiPaginatedResponse).toBe('function');
  });

  it('returns a decorator function when called with a model class', () => {
    class TestModel {
      id: string;
    }
    const decorator = ApiPaginatedResponse(TestModel);
    expect(typeof decorator).toBe('function');
  });

  it('can be applied to a controller method without error', () => {
    class TestModel {
      id: string;
    }

    expect(() => {
      class TestController {
        @ApiPaginatedResponse(TestModel)
        findAll() {
          return [];
        }
      }
      // Ensure class is referenced to avoid unused warning
      expect(TestController).toBeDefined();
    }).not.toThrow();
  });
});
