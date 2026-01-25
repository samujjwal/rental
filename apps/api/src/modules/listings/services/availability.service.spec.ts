import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prismaService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: PrismaService,
          useValue: {
            availability: {
              create: jest.fn(),
              findMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            booking: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
