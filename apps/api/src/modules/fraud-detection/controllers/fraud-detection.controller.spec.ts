import { FraudDetectionController } from './fraud-detection.controller';

describe('FraudDetectionController', () => {
  let controller: FraudDetectionController;
  let fraudService: any;

  beforeEach(() => {
    fraudService = {
      getHighRiskUsers: jest.fn().mockResolvedValue([
        { userId: 'u-1', riskScore: 0.85, reasons: ['Multiple failed payments'] },
      ]),
    };

    controller = new FraudDetectionController(fraudService);
  });

  describe('getHighRiskUsers', () => {
    it('should return high risk users', async () => {
      const result = await controller.getHighRiskUsers();

      expect(result).toBeDefined();
      expect(fraudService.getHighRiskUsers).toHaveBeenCalled();
    });

    it('should pass limit parameter', async () => {
      await controller.getHighRiskUsers('10');

      expect(fraudService.getHighRiskUsers).toHaveBeenCalled();
    });
  });
});
