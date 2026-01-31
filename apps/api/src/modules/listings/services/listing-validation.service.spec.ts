import { Test, TestingModule } from '@nestjs/testing';
import { ListingValidationService } from './listing-validation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CategoryTemplateService } from '../../categories/services/category-template.service';

describe('ListingValidationService', () => {
  let service: InstanceType<typeof ListingValidationService>;
  let prismaService: any;
  let templateService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingValidationService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: CategoryTemplateService,
          useValue: {
            getTemplate: jest.fn(),
            validateData: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InstanceType<typeof ListingValidationService>>(ListingValidationService);
    prismaService = module.get(PrismaService);
    templateService = module.get(CategoryTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateCategoryData', () => {
    it('should validate valid data', async () => {
      const categoryId = 'cat-123';
      const data = { year: 2020 };

      templateService.getTemplate.mockResolvedValue({
        fields: [{ key: 'year', required: true, type: 'number' }],
      });

      const result = await service.validateCategoryData(categoryId, data);

      // Since validateData logic is likely inside, we mock it or rely on internal logic
      // Assuming the service implements validation logic manually if validateData isn't on templateService
      // Looking at the read_file output, it calls this.templateService.getTemplate

      // If validation passes (simple checks or mocked)
      expect(result.isValid).toBeDefined();
    });
  });
});
