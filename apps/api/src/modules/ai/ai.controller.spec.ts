import { AiController } from './ai.controller';

describe('AiController', () => {
  let controller: AiController;
  let aiService: any;

  beforeEach(() => {
    aiService = {
      generateListingDescription: jest.fn().mockResolvedValue({
        description: 'A beautiful apartment in Kathmandu',
      }),
    };

    controller = new AiController(aiService);
  });

  describe('generateDescription', () => {
    it('should return generated description', async () => {
      const dto = {
        title: 'Cozy Apartment',
        category: 'Apartment',
        location: 'Kathmandu',
        features: ['WiFi', 'Parking'],
      };

      const result = await controller.generateDescription(dto as any);

      expect(result).toBeDefined();
      expect(aiService.generateListingDescription).toHaveBeenCalledWith(dto);
    });
  });
});
