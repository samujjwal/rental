import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Global Inventory Graph (V5 Prompt 9)
 *
 * Graph representing the entire rental supply network:
 * - Nodes: Listings, Assets, Locations, Hosts, Categories
 * - Edges: OWNS, LOCATED_IN, BELONGS_TO, SIMILAR_TO, REVIEWED
 *
 * Enables graph-based queries for recommendations, clustering, and analytics.
 */
@Injectable()
export class InventoryGraphService {
  private readonly logger = new Logger(InventoryGraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add a node to the inventory graph.
   */
  async addNode(params: {
    nodeType: string;
    entityId: string;
    label: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    properties?: Record<string, any>;
  }) {
    return this.prisma.inventoryGraphNode.upsert({
      where: {
        nodeType_entityId: {
          nodeType: params.nodeType,
          entityId: params.entityId,
        },
      },
      update: {
        label: params.label,
        country: params.country,
        latitude: params.latitude,
        longitude: params.longitude,
        properties: params.properties || {},
      },
      create: {
        nodeType: params.nodeType,
        entityId: params.entityId,
        label: params.label,
        country: params.country,
        latitude: params.latitude,
        longitude: params.longitude,
        properties: params.properties || {},
      },
    });
  }

  /**
   * Add an edge between two nodes.
   */
  async addEdge(params: {
    fromNodeId: string;
    toNodeId: string;
    edgeType: string;
    weight?: number;
    properties?: Record<string, any>;
  }) {
    return this.prisma.inventoryGraphEdge.upsert({
      where: {
        fromNodeId_toNodeId_edgeType: {
          fromNodeId: params.fromNodeId,
          toNodeId: params.toNodeId,
          edgeType: params.edgeType,
        },
      },
      update: {
        weight: params.weight ?? 1.0,
        properties: params.properties || {},
      },
      create: {
        fromNodeId: params.fromNodeId,
        toNodeId: params.toNodeId,
        edgeType: params.edgeType,
        weight: params.weight ?? 1.0,
        properties: params.properties || {},
      },
    });
  }

  /**
   * Index a listing into the graph with all its relationships.
   */
  async indexListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, country: true } },
        category: { select: { id: true, name: true } },
        reviews: { select: { id: true, reviewerId: true, rating: true } },
      },
    });

    if (!listing) return null;

    // Create listing node
    const listingNode = await this.addNode({
      nodeType: 'LISTING',
      entityId: listing.id,
      label: listing.title,
      country: listing.country,
      latitude: listing.latitude ? Number(listing.latitude) : undefined,
      longitude: listing.longitude ? Number(listing.longitude) : undefined,
      properties: {
        price: Number(listing.basePrice),
        rating: listing.averageRating,
        status: listing.status,
      },
    });

    // Create host node + OWNS edge
    const hostNode = await this.addNode({
      nodeType: 'HOST',
      entityId: listing.owner.id,
      label: `${listing.owner.firstName || ''} ${listing.owner.lastName || ''}`.trim(),
      country: listing.owner.country,
    });

    await this.addEdge({
      fromNodeId: hostNode.id,
      toNodeId: listingNode.id,
      edgeType: 'OWNS',
    });

    // Create location node + LOCATED_IN edge
    if (listing.city || listing.country) {
      const locationKey = `${listing.city || 'unknown'}-${listing.country || 'unknown'}`;
      const locationNode = await this.addNode({
        nodeType: 'LOCATION',
        entityId: locationKey,
        label: `${listing.city || ''}, ${listing.country || ''}`,
        country: listing.country,
        latitude: listing.latitude ? Number(listing.latitude) : undefined,
        longitude: listing.longitude ? Number(listing.longitude) : undefined,
      });

      await this.addEdge({
        fromNodeId: listingNode.id,
        toNodeId: locationNode.id,
        edgeType: 'LOCATED_IN',
      });
    }

    // Category node + BELONGS_TO edge
    if (listing.category) {
      const categoryNode = await this.addNode({
        nodeType: 'CATEGORY',
        entityId: listing.category.id,
        label: listing.category.name,
      });

      await this.addEdge({
        fromNodeId: listingNode.id,
        toNodeId: categoryNode.id,
        edgeType: 'BELONGS_TO',
      });
    }

    return listingNode;
  }

  /**
   * Get neighbors of a node (traversal).
   */
  async getNeighbors(
    nodeId: string,
    edgeType?: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
  ) {
    const conditions: any[] = [];

    if (direction === 'outgoing' || direction === 'both') {
      conditions.push({
        edgesFrom: {
          some: {
            fromNodeId: nodeId,
            ...(edgeType ? { edgeType } : {}),
          },
        },
      });
    }

    if (direction === 'incoming' || direction === 'both') {
      conditions.push({
        edgesTo: {
          some: {
            toNodeId: nodeId,
            ...(edgeType ? { edgeType } : {}),
          },
        },
      });
    }

    // Get edges first, then nodes
    const edges = await this.prisma.inventoryGraphEdge.findMany({
      where: {
        OR: [
          { fromNodeId: nodeId, ...(edgeType ? { edgeType } : {}) },
          { toNodeId: nodeId, ...(edgeType ? { edgeType } : {}) },
        ],
      },
      include: { fromNode: true, toNode: true },
    });

    return edges.map((e) => ({
      edge: { id: e.id, type: e.edgeType, weight: e.weight },
      node: e.fromNodeId === nodeId ? e.toNode : e.fromNode,
    }));
  }

  /**
   * Find similar listings (via shared location, category, or host).
   */
  async findSimilarListings(listingId: string, limit: number = 10) {
    const listingNode = await this.prisma.inventoryGraphNode.findFirst({
      where: { nodeType: 'LISTING', entityId: listingId },
    });

    if (!listingNode) return [];

    // Get category and location edges
    const edges = await this.prisma.inventoryGraphEdge.findMany({
      where: {
        fromNodeId: listingNode.id,
        edgeType: { in: ['LOCATED_IN', 'BELONGS_TO'] },
      },
    });

    const targetNodeIds = edges.map((e) => e.toNodeId);

    // Find other listings connected to same locations/categories
    const similarEdges = await this.prisma.inventoryGraphEdge.findMany({
      where: {
        toNodeId: { in: targetNodeIds },
        fromNodeId: { not: listingNode.id },
        edgeType: { in: ['LOCATED_IN', 'BELONGS_TO'] },
      },
      include: { fromNode: true },
      take: limit,
    });

    return similarEdges.map((e) => e.fromNode);
  }

  /**
   * Get graph statistics.
   */
  async getGraphStats() {
    const [nodeCount, edgeCount, nodeTypeCounts] = await Promise.all([
      this.prisma.inventoryGraphNode.count(),
      this.prisma.inventoryGraphEdge.count(),
      this.prisma.inventoryGraphNode.groupBy({
        by: ['nodeType'],
        _count: { id: true },
      }),
    ]);

    return {
      totalNodes: nodeCount,
      totalEdges: edgeCount,
      nodesByType: Object.fromEntries(
        nodeTypeCounts.map((g) => [g.nodeType, g._count.id]),
      ),
    };
  }
}
