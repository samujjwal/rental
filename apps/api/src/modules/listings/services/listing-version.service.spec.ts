import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListingVersionService } from './listing-version.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('ListingVersionService', () => {
  let service: ListingVersionService;
  let prisma: any;

  const listingId = 'listing-1';
  const userId = 'user-1';

  const mockListing = {
    id: listingId,
    title: 'Test Listing',
    description: 'Great place',
    basePrice: 100,
    contents: [{ locale: 'en', title: 'Test' }],
    attributeValues: [],
    inventoryUnits: [],
  };

  const mockVersion = {
    id: 'version-1',
    listingId,
    version: 1,
    snapshot: JSON.stringify({ ...mockListing, _snapshotVersion: 1 }),
    changedBy: userId,
    changeNotes: 'Initial version',
    createdAt: new Date(),
    author: { id: userId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  };

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
      },
      listingVersion: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingVersionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ListingVersionService>(ListingVersionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSnapshot', () => {
    it('should create first version snapshot', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listingVersion.findFirst.mockResolvedValue(null); // No previous version
      prisma.listingVersion.create.mockResolvedValue({ ...mockVersion, version: 1 });

      const result = await service.createSnapshot({
        listingId,
        changedBy: userId,
        changeNotes: 'Initial version',
      });

      expect(result.version).toBe(1);
      expect(prisma.listingVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listingId,
          version: 1,
          changedBy: userId,
          changeNotes: 'Initial version',
        }),
      });
    });

    it('should auto-increment version number', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listingVersion.findFirst.mockResolvedValue({ version: 3 });
      prisma.listingVersion.create.mockResolvedValue({ ...mockVersion, version: 4 });

      const result = await service.createSnapshot({
        listingId,
        changedBy: userId,
      });

      expect(prisma.listingVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 4 }),
      });
    });

    it('should throw NotFoundException if listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.createSnapshot({ listingId, changedBy: userId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should serialize full listing state including relations', async () => {
      const listingWithRelations = {
        ...mockListing,
        contents: [{ locale: 'en', title: 'English' }],
        inventoryUnits: [{ sku: 'UNIT-1' }],
      };
      prisma.listing.findUnique.mockResolvedValue(listingWithRelations);
      prisma.listingVersion.findFirst.mockResolvedValue(null);
      prisma.listingVersion.create.mockImplementation(({ data }) => {
        const snapshot = JSON.parse(data.snapshot);
        expect(snapshot.contents).toHaveLength(1);
        expect(snapshot.inventoryUnits).toHaveLength(1);
        return Promise.resolve({ ...mockVersion, snapshot: data.snapshot });
      });

      await service.createSnapshot({ listingId, changedBy: userId });

      expect(prisma.listingVersion.create).toHaveBeenCalled();
    });

    it('should set changeNotes to null when not provided', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listingVersion.findFirst.mockResolvedValue(null);
      prisma.listingVersion.create.mockResolvedValue(mockVersion);

      await service.createSnapshot({ listingId, changedBy: userId });

      expect(prisma.listingVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changeNotes: null }),
      });
    });
  });

  describe('findAllForListing', () => {
    it('should return paginated versions', async () => {
      const versions = [
        { id: 'v1', version: 2, changedBy: userId, changeNotes: null, createdAt: new Date(), author: mockVersion.author },
        { id: 'v2', version: 1, changedBy: userId, changeNotes: 'Init', createdAt: new Date(), author: mockVersion.author },
      ];
      prisma.listingVersion.findMany.mockResolvedValue(versions);
      prisma.listingVersion.count.mockResolvedValue(2);

      const result = await service.findAllForListing(listingId, 1, 20);

      expect(result.versions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate pagination correctly', async () => {
      prisma.listingVersion.findMany.mockResolvedValue([]);
      prisma.listingVersion.count.mockResolvedValue(45);

      const result = await service.findAllForListing(listingId, 2, 20);

      expect(result.totalPages).toBe(3);
      expect(prisma.listingVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        }),
      );
    });

    it('should return empty result when no versions exist', async () => {
      prisma.listingVersion.findMany.mockResolvedValue([]);
      prisma.listingVersion.count.mockResolvedValue(0);

      const result = await service.findAllForListing(listingId);

      expect(result.versions).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findVersion', () => {
    it('should return a specific version with parsed snapshot', async () => {
      prisma.listingVersion.findUnique.mockResolvedValue(mockVersion);

      const result = await service.findVersion(listingId, 1);

      expect(result.snapshot).toEqual(expect.objectContaining({ title: 'Test Listing' }));
      expect(result.author).toBeDefined();
    });

    it('should throw NotFoundException if version not found', async () => {
      prisma.listingVersion.findUnique.mockResolvedValue(null);

      await expect(service.findVersion(listingId, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('diffVersions', () => {
    it('should return field-level diffs between two versions', async () => {
      const v1 = {
        ...mockVersion,
        version: 1,
        snapshot: JSON.stringify({ title: 'Old Title', description: 'Same', _snapshotVersion: 1 }),
      };
      const v2 = {
        ...mockVersion,
        version: 2,
        snapshot: JSON.stringify({ title: 'New Title', description: 'Same', _snapshotVersion: 2 }),
      };

      prisma.listingVersion.findUnique
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await service.diffVersions(listingId, 1, 2);

      expect(result.listingId).toBe(listingId);
      expect(result.versionA).toBe(1);
      expect(result.versionB).toBe(2);
      // title changed, description unchanged
      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            before: 'Old Title',
            after: 'New Title',
          }),
        ]),
      );
      // description should NOT be in changes
      const descChange = result.changes.find((c) => c.field === 'description');
      expect(descChange).toBeUndefined();
    });

    it('should skip _snapshot prefixed fields', async () => {
      const v1 = {
        ...mockVersion,
        version: 1,
        snapshot: JSON.stringify({ title: 'Same', _snapshotVersion: 1, _snapshotAt: '2024-01-01' }),
      };
      const v2 = {
        ...mockVersion,
        version: 2,
        snapshot: JSON.stringify({ title: 'Same', _snapshotVersion: 2, _snapshotAt: '2024-02-01' }),
      };

      prisma.listingVersion.findUnique
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await service.diffVersions(listingId, 1, 2);

      expect(result.changes).toHaveLength(0);
    });

    it('should detect new fields added between versions', async () => {
      const v1 = {
        ...mockVersion,
        version: 1,
        snapshot: JSON.stringify({ title: 'Test' }),
      };
      const v2 = {
        ...mockVersion,
        version: 2,
        snapshot: JSON.stringify({ title: 'Test', newField: 'value' }),
      };

      prisma.listingVersion.findUnique
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await service.diffVersions(listingId, 1, 2);

      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'newField',
            before: undefined,
            after: 'value',
          }),
        ]),
      );
    });
  });

  describe('getLatestVersion', () => {
    it('should return latest version number', async () => {
      prisma.listingVersion.findFirst.mockResolvedValue({ version: 5 });

      const result = await service.getLatestVersion(listingId);

      expect(result).toBe(5);
    });

    it('should return 0 when no versions exist', async () => {
      prisma.listingVersion.findFirst.mockResolvedValue(null);

      const result = await service.getLatestVersion(listingId);

      expect(result).toBe(0);
    });
  });
});
