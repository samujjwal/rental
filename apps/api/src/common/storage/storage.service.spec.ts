import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

jest.mock('fs/promises');
const fsMock = jest.requireMock('fs/promises');

jest.mock('crypto', () => ({
  randomUUID: () => 'mocked-uuid',
}));

// Mock the S3Client and getSignedUrl at module level
jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    __sendMock: sendMock,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/file'),
}));

function makeConfigGet(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string | undefined> = {
    NODE_ENV: 'development',
    R2_ACCOUNT_ID: undefined,
    LOCAL_STORAGE_PATH: '/tmp/test-uploads',
    API_URL: 'http://localhost:3400',
  };
  const merged = { ...defaults, ...overrides };
  return (key: string) => merged[key];
}

describe('StorageService (local mode)', () => {
  let service: StorageService;

  beforeEach(async () => {
    fsMock.mkdir = jest.fn().mockResolvedValue(undefined);
    fsMock.writeFile = jest.fn().mockResolvedValue(undefined);
    fsMock.unlink = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(makeConfigGet()) },
        },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  it('uploads a file to the local filesystem', async () => {
    const file = Buffer.from('hello world');
    const result = await service.upload({
      file,
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      folder: 'listings',
    });

    expect(fsMock.mkdir).toHaveBeenCalledWith(expect.stringContaining('listings'), { recursive: true });
    expect(fsMock.writeFile).toHaveBeenCalledWith(expect.stringContaining('mocked-uuid.jpg'), file);
    expect(result.key).toBe('listings/mocked-uuid.jpg');
    expect(result.url).toContain('/uploads/listings/mocked-uuid.jpg');
    expect(result.size).toBe(file.length);
  });

  it('defaults folder to "general"', async () => {
    const result = await service.upload({
      file: Buffer.from('x'),
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.key).toBe('general/mocked-uuid.pdf');
  });

  it('returns direct URL for signed URL in local mode', async () => {
    const url = await service.getSignedUrl('listings/abc.jpg');
    expect(url).toBe('http://localhost:3400/uploads/listings/abc.jpg');
  });

  it('deletes file from local filesystem', async () => {
    const result = await service.delete('listings/abc.jpg');
    expect(fsMock.unlink).toHaveBeenCalledWith(expect.stringContaining('abc.jpg'));
    expect(result).toBe(true);
  });

  it('returns false when local delete fails', async () => {
    fsMock.unlink.mockRejectedValue(new Error('ENOENT'));
    const result = await service.delete('missing.jpg');
    expect(result).toBe(false);
  });

  it('throws when local upload fails', async () => {
    fsMock.writeFile.mockRejectedValue(new Error('disk full'));
    await expect(
      service.upload({ file: Buffer.from('x'), fileName: 'f.txt', mimeType: 'text/plain' }),
    ).rejects.toThrow('Failed to upload file to local storage');
  });
});

describe('StorageService (R2 mode)', () => {
  let service: StorageService;
  let sendMock: jest.Mock;

  beforeEach(async () => {
    // Access the shared mock
    const s3Module = jest.requireMock('@aws-sdk/client-s3');
    sendMock = s3Module.__sendMock;
    sendMock.mockClear();
    sendMock.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              makeConfigGet({
                NODE_ENV: 'production',
                R2_ACCOUNT_ID: 'acct-123',
                R2_ACCESS_KEY_ID: 'key-id',
                R2_SECRET_ACCESS_KEY: 'secret',
                R2_BUCKET_NAME: 'test-bucket',
                R2_PUBLIC_URL: 'https://cdn.example.com',
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  it('uploads file to R2 via S3Client', async () => {
    const file = Buffer.from('data');
    const result = await service.upload({
      file,
      fileName: 'pic.png',
      mimeType: 'image/png',
      folder: 'photos',
    });

    expect(sendMock).toHaveBeenCalled();
    expect(result.url).toContain('https://cdn.example.com/photos/mocked-uuid.png');
    expect(result.size).toBe(4);
  });

  it('generates signed download URL via S3', async () => {
    const url = await service.getSignedUrl('photos/abc.png', 7200);
    expect(url).toBe('https://signed.example.com/file');
  });

  it('deletes file from R2', async () => {
    const result = await service.delete('photos/abc.png');
    expect(sendMock).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('returns false on R2 delete failure', async () => {
    sendMock.mockRejectedValue(new Error('R2 error'));
    const result = await service.delete('photos/abc.png');
    expect(result).toBe(false);
  });
});
