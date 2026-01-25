import { Test, TestingModule } from '@nestjs/testing';
import { ContentModerationService } from './content-moderation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { ImageModerationService } from './image-moderation.service';
import { TextModerationService } from './text-moderation.service';
import { ModerationQueueService } from './moderation-queue.service';

describe('ContentModerationService', () => {
  let service: ContentModerationService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentModerationService,
        {
          provide: PrismaService,
          useValue: {
            moderationLog: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: ImageModerationService,
          useValue: {
            moderateImage: jest.fn(),
          },
        },
        {
          provide: TextModerationService,
          useValue: {
            moderateText: jest.fn(),
          },
        },
        {
          provide: ModerationQueueService,
          useValue: {
            addToQueue: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContentModerationService>(ContentModerationService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('moderateText', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });
});
