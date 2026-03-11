import { Test, TestingModule } from '@nestjs/testing';
import { InventoryGraphController } from './inventory-graph.controller';
import { InventoryGraphService } from '../services/inventory-graph.service';

describe('InventoryGraphController', () => {
  let controller: InventoryGraphController;
  let graph: jest.Mocked<InventoryGraphService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryGraphController],
      providers: [
        {
          provide: InventoryGraphService,
          useValue: {
            addNode: jest.fn(),
            addEdge: jest.fn(),
            indexListing: jest.fn(),
            getNeighbors: jest.fn(),
            findSimilarListings: jest.fn(),
            getGraphStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(InventoryGraphController);
    graph = module.get(InventoryGraphService) as jest.Mocked<InventoryGraphService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── addNode ──

  describe('addNode', () => {
    it('delegates dto to service', async () => {
      const dto = { type: 'listing', entityId: 'l1' } as any;
      graph.addNode.mockResolvedValue({ id: 'n1' } as any);

      const result = await controller.addNode(dto);

      expect(graph.addNode).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'n1' });
    });
  });

  // ── addEdge ──

  describe('addEdge', () => {
    it('delegates dto to service', async () => {
      const dto = { fromId: 'n1', toId: 'n2', type: 'similar' } as any;
      graph.addEdge.mockResolvedValue({ id: 'e1' } as any);

      const result = await controller.addEdge(dto);

      expect(graph.addEdge).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'e1' });
    });
  });

  // ── indexListing ──

  describe('indexListing', () => {
    it('delegates listingId to service', async () => {
      graph.indexListing.mockResolvedValue({ indexed: true } as any);

      const result = await controller.indexListing('l1');

      expect(graph.indexListing).toHaveBeenCalledWith('l1');
      expect(result).toEqual({ indexed: true });
    });

    it('propagates service error', async () => {
      graph.indexListing.mockRejectedValue(new Error('Listing not found'));
      await expect(controller.indexListing('bad')).rejects.toThrow('Listing not found');
    });
  });

  // ── getNeighbors ──

  describe('getNeighbors', () => {
    it('passes defaults for optional params', async () => {
      graph.getNeighbors.mockResolvedValue([{ id: 'n2' }] as any);

      const result = await controller.getNeighbors('n1');

      expect(graph.getNeighbors).toHaveBeenCalledWith('n1', undefined, 'both');
      expect(result).toEqual([{ id: 'n2' }]);
    });

    it('passes explicit edgeType and direction', async () => {
      graph.getNeighbors.mockResolvedValue([] as any);

      await controller.getNeighbors('n1', 'similar', 'outgoing');

      expect(graph.getNeighbors).toHaveBeenCalledWith('n1', 'similar', 'outgoing');
    });
  });

  // ── findSimilar ──

  describe('findSimilar', () => {
    it('defaults limit to 10', async () => {
      graph.findSimilarListings.mockResolvedValue([{ id: 'l2' }] as any);

      const result = await controller.findSimilar('l1');

      expect(graph.findSimilarListings).toHaveBeenCalledWith('l1', 10);
      expect(result).toEqual([{ id: 'l2' }]);
    });

    it('passes explicit limit', async () => {
      graph.findSimilarListings.mockResolvedValue([] as any);

      await controller.findSimilar('l1', 5);

      expect(graph.findSimilarListings).toHaveBeenCalledWith('l1', 5);
    });
  });

  // ── getStats ──

  describe('getStats', () => {
    it('delegates to service', async () => {
      graph.getGraphStats.mockResolvedValue({ nodes: 100, edges: 250 } as any);

      const result = await controller.getStats();

      expect(graph.getGraphStats).toHaveBeenCalled();
      expect(result).toEqual({ nodes: 100, edges: 250 });
    });

    it('propagates service error', async () => {
      graph.getGraphStats.mockRejectedValue(new Error('Stats unavailable'));
      await expect(controller.getStats()).rejects.toThrow('Stats unavailable');
    });
  });
});
