import { Test, TestingModule } from '@nestjs/testing';
import { InventoryGraphService } from './inventory-graph.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('InventoryGraphService', () => {
  let service: InventoryGraphService;
  let prisma: any;

  const mockNode = {
    id: 'node-1',
    nodeType: 'LISTING',
    entityId: 'listing-1',
    label: 'Cozy Room',
    country: 'NP',
  };

  beforeEach(async () => {
    prisma = {
      inventoryGraphNode: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'node-1', ...create })),
        findFirst: jest.fn().mockResolvedValue(mockNode),
        count: jest.fn().mockResolvedValue(10),
        groupBy: jest.fn().mockResolvedValue([
          { nodeType: 'LISTING', _count: { id: 5 } },
          { nodeType: 'HOST', _count: { id: 3 } },
        ]),
      },
      inventoryGraphEdge: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'edge-1', ...create })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(15),
      },
      listing: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'listing-1',
          title: 'Cozy Room',
          country: 'NP',
          city: 'Kathmandu',
          latitude: 27.7172,
          longitude: 85.324,
          basePrice: 2000,
          averageRating: 4.5,
          status: 'ACTIVE',
          owner: { id: 'host-1', firstName: 'Ram', lastName: 'Sharma', country: 'NP' },
          category: { id: 'cat-1', name: 'Room' },
          reviews: [],
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryGraphService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InventoryGraphService>(InventoryGraphService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addNode', () => {
    it('should upsert a graph node', async () => {
      const result = await service.addNode({
        nodeType: 'LISTING',
        entityId: 'listing-1',
        label: 'Cozy Room',
        country: 'NP',
      });
      expect(result).toBeDefined();
      expect(prisma.inventoryGraphNode.upsert).toHaveBeenCalled();
    });
  });

  describe('addEdge', () => {
    it('should upsert a graph edge', async () => {
      const result = await service.addEdge({
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        edgeType: 'OWNS',
      });
      expect(result).toBeDefined();
      expect(prisma.inventoryGraphEdge.upsert).toHaveBeenCalled();
    });
  });

  describe('indexListing', () => {
    it('should index a listing with nodes and edges', async () => {
      const result = await service.indexListing('listing-1');
      expect(result).toBeDefined();
      // Listing node + Host node + Location node + Category node
      expect(prisma.inventoryGraphNode.upsert).toHaveBeenCalledTimes(4);
      // OWNS + LOCATED_IN + BELONGS_TO
      expect(prisma.inventoryGraphEdge.upsert).toHaveBeenCalledTimes(3);
    });

    it('should return null for non-existent listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      const result = await service.indexListing('bad-id');
      expect(result).toBeNull();
    });
  });

  describe('getNeighbors', () => {
    it('should return neighbors of a node', async () => {
      prisma.inventoryGraphEdge.findMany.mockResolvedValue([
        { id: 'e1', fromNodeId: 'node-1', toNodeId: 'node-2', edgeType: 'OWNS', weight: 1, fromNode: mockNode, toNode: { ...mockNode, id: 'node-2' } },
      ]);
      const result = await service.getNeighbors('node-1');
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].edge).toBeDefined();
      expect(result[0].node).toBeDefined();
    });
  });

  describe('getGraphStats', () => {
    it('should return graph statistics', async () => {
      const stats = await service.getGraphStats();
      expect(stats.totalNodes).toBe(10);
      expect(stats.totalEdges).toBe(15);
      expect(stats.nodesByType).toBeDefined();
    });
  });

  describe('findSimilarListings', () => {
    it('should return similar listings', async () => {
      prisma.inventoryGraphEdge.findMany
        .mockResolvedValueOnce([{ toNodeId: 'loc-1', edgeType: 'LOCATED_IN' }])
        .mockResolvedValueOnce([{ fromNode: { ...mockNode, id: 'node-3' } }]);
      const result = await service.findSimilarListings('listing-1', 5);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty for non-existent listing', async () => {
      prisma.inventoryGraphNode.findFirst.mockResolvedValue(null);
      const result = await service.findSimilarListings('bad-id');
      expect(result).toEqual([]);
    });
  });
});
