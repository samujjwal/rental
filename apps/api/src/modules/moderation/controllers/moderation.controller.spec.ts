import { ModerationController } from './moderation.controller';

describe('ModerationController', () => {
  let controller: ModerationController;
  let moderationService: any;

  beforeEach(() => {
    moderationService = {
      getModerationQueue: jest.fn().mockResolvedValue({
        data: [{ entityId: 'e-1', status: 'PENDING', priority: 'HIGH' }],
        total: 1,
      }),
      approveContent: jest.fn().mockResolvedValue({ success: true }),
      rejectContent: jest.fn().mockResolvedValue({ success: true }),
      getUserModerationHistory: jest.fn().mockResolvedValue([
        { action: 'APPROVED', entityId: 'e-1' },
      ]),
      moderateMessage: jest.fn().mockResolvedValue({
        flags: [],
        confidence: 1,
      }),
    };

    controller = new ModerationController(moderationService);
  });

  describe('getQueue', () => {
    it('should return moderation queue', async () => {
      const result = await controller.getQueue();

      expect(result).toBeDefined();
      expect(moderationService.getModerationQueue).toHaveBeenCalled();
    });

    it('should pass filter parameters', async () => {
      await controller.getQueue('PENDING', 'HIGH', 'listing');

      expect(moderationService.getModerationQueue).toHaveBeenCalled();
    });
  });

  describe('approveContent', () => {
    it('should approve content', async () => {
      const result = await controller.approveContent('e-1', 'admin-1', 'listing');

      expect(result).toEqual({ success: true, message: 'Content approved' });
    });

    it('should pass notes when provided', async () => {
      await controller.approveContent('e-1', 'admin-1', 'listing', 'Looks good');

      expect(moderationService.approveContent).toHaveBeenCalled();
    });
  });

  describe('rejectContent', () => {
    it('should reject content with reason', async () => {
      const result = await controller.rejectContent('e-1', 'admin-1', 'listing', 'Violates policy');

      expect(result).toEqual({ success: true, message: 'Content rejected' });
    });
  });

  describe('getUserHistory', () => {
    it('should return moderation history for user', async () => {
      const result = await controller.getUserHistory('user-1');

      expect(result).toBeDefined();
      expect(moderationService.getUserModerationHistory).toHaveBeenCalledWith('user-1');
    });
  });

  describe('testTextModeration', () => {
    it('should run text moderation test', async () => {
      const result = await controller.testTextModeration('This is clean text');

      expect(result).toBeDefined();
      expect(moderationService.moderateMessage).toHaveBeenCalledWith('This is clean text');
    });
  });
});
