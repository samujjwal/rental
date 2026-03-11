import { ParseUUIDPipe } from './parse-uuid.pipe';

describe('ParseUUIDPipe', () => {
  let pipe: ParseUUIDPipe;

  beforeEach(() => {
    pipe = new ParseUUIDPipe();
  });

  it('should pass valid UUID v4', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = pipe.transform(uuid, { type: 'param', data: 'id' } as any);
    expect(result).toBe(uuid);
  });

  it('should pass valid UUID v1', () => {
    const uuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const result = pipe.transform(uuid, { type: 'param', data: 'id' } as any);
    expect(result).toBe(uuid);
  });

  it('should throw BadRequestException for invalid UUID', () => {
    expect(() =>
      pipe.transform('not-a-uuid', { type: 'param', data: 'id' } as any)
    ).toThrow('Invalid UUID format for id');
  });

  it('should throw BadRequestException for empty string', () => {
    expect(() =>
      pipe.transform('', { type: 'param', data: 'userId' } as any)
    ).toThrow('Invalid UUID format for userId');
  });

  it('should throw BadRequestException for numeric string', () => {
    expect(() =>
      pipe.transform('12345', { type: 'param', data: 'id' } as any)
    ).toThrow('Invalid UUID format');
  });

  it('should include parameter name in error message', () => {
    expect(() =>
      pipe.transform('bad', { type: 'param', data: 'listingId' } as any)
    ).toThrow('Invalid UUID format for listingId');
  });
});
