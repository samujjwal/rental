import { KycController } from './kyc.controller';

describe('KycController', () => {
  let controller: KycController;
  let kycService: any;

  beforeEach(() => {
    kycService = {
      uploadDocument: jest.fn().mockResolvedValue({ id: 'doc-1', status: 'PENDING' }),
      getMyDocuments: jest.fn().mockReturnValue(undefined),
      getUserDocuments: jest.fn().mockResolvedValue([
        { id: 'doc-1', type: 'CITIZENSHIP', status: 'VERIFIED' },
      ]),
      getPendingDocuments: jest.fn().mockResolvedValue({
        data: [{ id: 'doc-2', status: 'PENDING' }],
        total: 1,
      }),
      reviewDocument: jest.fn().mockResolvedValue({ id: 'doc-2', status: 'APPROVED' }),
    };

    controller = new KycController(kycService);
  });

  describe('uploadDocument', () => {
    it('should upload KYC document', async () => {
      const dto = {
        documentType: 'CITIZENSHIP',
        documentUrl: 'https://example.com/doc.jpg',
        documentNumber: 'CIT-12345',
      };

      const result = await controller.uploadDocument('user-1', dto as any);

      expect(result).toBeDefined();
      expect(kycService.uploadDocument).toHaveBeenCalled();
    });
  });

  describe('getMyDocuments', () => {
    it('should return user documents', async () => {
      const result = await controller.getMyDocuments('user-1');

      expect(Array.isArray(result)).toBe(true);
      expect(kycService.getUserDocuments).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getPendingDocuments', () => {
    it('should return pending documents for admin', async () => {
      const result = await controller.getPendingDocuments();

      expect(result).toBeDefined();
      expect(kycService.getPendingDocuments).toHaveBeenCalled();
    });

    it('should pass pagination params', async () => {
      await controller.getPendingDocuments('2', '20');

      expect(kycService.getPendingDocuments).toHaveBeenCalled();
    });
  });

  describe('reviewDocument', () => {
    it('should review KYC document', async () => {
      const dto = { status: 'APPROVED', notes: 'Verified' };

      const result = await controller.reviewDocument('doc-1', 'admin-1', dto as any);

      expect(result).toBeDefined();
      expect(kycService.reviewDocument).toHaveBeenCalled();
    });
  });
});
