import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { InventoryGraphService } from '../services/inventory-graph.service';
import { AddNodeDto, AddEdgeDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Inventory Graph')
@Controller('marketplace/graph')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryGraphController {
  constructor(private readonly graph: InventoryGraphService) {}

  @Post('nodes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a node to the inventory graph (admin only)' })
  @ApiResponse({ status: 201, description: 'Node created' })
  async addNode(@Body() dto: AddNodeDto) {
    return this.graph.addNode(dto);
  }

  @Post('edges')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an edge between graph nodes (admin only)' })
  @ApiResponse({ status: 201, description: 'Edge created' })
  async addEdge(@Body() dto: AddEdgeDto) {
    return this.graph.addEdge(dto);
  }

  @Post('index/:listingId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Index a listing and its relationships into the graph (admin only)' })
  @ApiResponse({ status: 200, description: 'Listing indexed' })
  async indexListing(@Param('listingId') listingId: string) {
    return this.graph.indexListing(listingId);
  }

  @Get('neighbors/:nodeId')
  @ApiOperation({ summary: 'Get neighboring nodes connected to a graph node' })
  @ApiResponse({ status: 200, description: 'Neighbors returned' })
  async getNeighbors(
    @Param('nodeId') nodeId: string,
    @Query('edgeType') edgeType?: string,
    @Query('direction') direction?: 'outgoing' | 'incoming' | 'both',
  ) {
    return this.graph.getNeighbors(nodeId, edgeType, direction ?? 'both');
  }

  @Get('similar/:listingId')
  @ApiOperation({ summary: 'Find similar listings via graph traversal' })
  @ApiResponse({ status: 200, description: 'Similar listings found' })
  async findSimilar(@Param('listingId') listingId: string, @Query('limit') limit?: number) {
    return this.graph.findSimilarListings(listingId, limit ?? 10);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get graph statistics (node/edge counts) (admin only)' })
  @ApiResponse({ status: 200, description: 'Graph stats returned' })
  async getStats() {
    return this.graph.getGraphStats();
  }
}
