import { ListingVersionController } from './listing-version.controller';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('ListingVersionController', () => {
  let controller: ListingVersionController;
  let versionService: any;
  let prisma: any;

  beforeEach(() => {
    versionService = {
      createSnapshot: jest.fn().mockResolvedValue({ version: 2, createdAt: new Date() }),
      findAllForListing: jest.fn().mockResolvedValue({
        data: [{ version: 1 }, { version: 2 }],
        total: 2,
      }),
      getLatestVersion: jest.fn().mockResolvedValue({ version: 2 }),
      findVersion: jest.fn().mockResolvedValue({ version: 1, data: {} }),
      diffVersions: jest.fn().mockResolvedValue({
        changes: [{ field: 'title', old: 'A', new: 'B' }],
      }),
    };

    prisma = {
      listing: { findUnique: jest.fn().mockResolvedValue({ ownerId: 'user-1' }) },
      user: { findUnique: jest.fn() },
      booking: { findUnique: jest.fn() },
    };

    controller = new ListingVersionController(versionService, prisma);
  });

  describe('createSnapshot', () => {
    it('should create version snapshot', async () => {
      const result = await controller.createSnapshot('l-1', 'user-1');

      expect(result).toBeDefined();
      expect(versionService.createSnapshot).toHaveBeenCalled();
    });

    it('should pass change notes', async () => {
      await controller.createSnapshot('l-1', 'user-1', 'Updated pricing');

      expect(versionService.createSnapshot).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all versions', async () => {
      const result = await controller.findAll('l-1');

      expect(result).toBeDefined();
      expect(versionService.findAllForListing).toHaveBeenCalled();
    });

    it('should pass pagination', async () => {
      await controller.findAll('l-1', '2', '10');

      expect(versionService.findAllForListing).toHaveBeenCalled();
    });
  });

  describe('getLatestVersion', () => {
    it('should return latest version', async () => {
      const result = await controller.getLatestVersion('l-1');

      expect(result).toBeDefined();
      expect(versionService.getLatestVersion).toHaveBeenCalledWith('l-1');
    });
  });

  describe('findVersion', () => {
    it('should return specific version', async () => {
      const result = await controller.findVersion('l-1', '1');

      expect(result).toBeDefined();
      expect(versionService.findVersion).toHaveBeenCalledWith('l-1', 1);
    });
  });

  describe('diffVersions', () => {
    it('should diff two versions', async () => {
      const result = await controller.diffVersions('l-1', '1', '2');

      expect(result.changes).toHaveLength(1);
      expect(versionService.diffVersions).toHaveBeenCalledWith('l-1', 1, 2);
    });
  });
});
