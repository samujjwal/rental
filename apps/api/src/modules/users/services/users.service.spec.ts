import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { FieldEncryptionService } from '../../../common/encryption/field-encryption.service';
import { ConfigCascadeService } from '../../../common/config/config-cascade.service';
import { User, UserStatus, VerificationStatus } from '@rental-portal/database';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;
  let cacheService: any;

  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'CUSTOMER',
    status: 'ACTIVE' as UserStatus,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            listing: { count: jest.fn() },
            booking: { count: jest.fn() },
            review: { count: jest.fn() },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: FieldEncryptionService,
          useValue: {
            encrypt: jest.fn((v: string) => (v ? `enc:${v}` : null)),
            decrypt: jest.fn((v: string) => (v ? v.replace(/^enc:/, '') : null)),
            isEncrypted: jest.fn((v: string) => typeof v === 'string' && v.startsWith('enc:')),
          },
        },
        {
          provide: ConfigCascadeService,
          useValue: {
            resolve: jest.fn().mockResolvedValue({ locale: 'en', currency: 'USD', timezone: 'UTC' }),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return cached user if available', async () => {
      cacheService.get.mockResolvedValue(mockUser);
      const result = await service.findById('user-123');
      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from db if not cached', async () => {
      cacheService.get.mockResolvedValue(null);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findById('user-123');
      expect(result).toEqual(mockUser);
      expect(cacheService.set).toHaveBeenCalled();
    });
  });
});
