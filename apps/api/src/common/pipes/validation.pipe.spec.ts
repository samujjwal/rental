import { ValidationPipe } from './validation.pipe';
import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';

class TestDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe();
  });

  it('should pass valid data', async () => {
    const result = await pipe.transform(
      { name: 'Test User', email: 'test@example.com' },
      { metatype: TestDto, type: 'body' } as any
    );

    expect(result).toBeInstanceOf(TestDto);
    expect(result.name).toBe('Test User');
    expect(result.email).toBe('test@example.com');
  });

  it('should throw BadRequestException for invalid data', async () => {
    await expect(
      pipe.transform(
        { name: 'AB', email: 'invalid-email' },
        { metatype: TestDto, type: 'body' } as any
      )
    ).rejects.toThrow('Validation failed');
  });

  it('should include field-level errors', async () => {
    try {
      await pipe.transform(
        { name: '', email: 'bad' },
        { metatype: TestDto, type: 'body' } as any
      );
    } catch (e: any) {
      const response = e.getResponse();
      expect(response.errors).toBeDefined();
      expect(response.errors.length).toBeGreaterThan(0);
      expect(response.errors[0]).toHaveProperty('field');
      expect(response.errors[0]).toHaveProperty('errors');
    }
  });

  it('should skip validation for primitive types', async () => {
    const result = await pipe.transform('hello', {
      metatype: String,
      type: 'body',
    } as any);

    expect(result).toBe('hello');
  });

  it('should skip validation when no metatype is provided', async () => {
    const result = await pipe.transform('hello', {
      type: 'body',
    } as any);

    expect(result).toBe('hello');
  });

  it('should pass with optional fields omitted', async () => {
    const result = await pipe.transform(
      { name: 'Valid Name', email: 'valid@example.com' },
      { metatype: TestDto, type: 'body' } as any
    );

    expect(result.phone).toBeUndefined();
  });

  it('should skip validation for Number type', async () => {
    const result = await pipe.transform(42, {
      metatype: Number,
      type: 'param',
    } as any);

    expect(result).toBe(42);
  });

  it('should skip validation for Boolean type', async () => {
    const result = await pipe.transform(true, {
      metatype: Boolean,
      type: 'query',
    } as any);

    expect(result).toBe(true);
  });
});
