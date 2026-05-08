import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface CreateListingVersionDto {
  listingId: string;
  changedBy: string;
  changeNotes?: string;
}

@Injectable()
export class ListingVersionService {
  private readonly logger = new Logger(ListingVersionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a version snapshot of the current listing state.
   * Auto-increments the version number.
   */
  async createSnapshot(dto: CreateListingVersionDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      include: {
        contents: true,
        attributeValues: {
          include: { attributeDefinition: true },
        },
        inventoryUnits: true,
      },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${dto.listingId} not found`);
    }

    // Get the latest version number
    const latestVersion = await this.prisma.listingVersion.findFirst({
      where: { listingId: dto.listingId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Serialize the full listing state
    const snapshot = JSON.stringify({
      ...listing,
      _snapshotVersion: nextVersion,
      _snapshotAt: new Date().toISOString(),
    });

    return this.prisma.listingVersion.create({
      data: {
        listingId: dto.listingId,
        version: nextVersion,
        snapshot,
        changedBy: dto.changedBy,
        changeNotes: dto.changeNotes ?? null,
      },
    });
  }

  /**
   * Get all versions of a listing, ordered by version descending (newest first).
   */
  async findAllForListing(
    listingId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const [versions, total] = await Promise.all([
      this.prisma.listingVersion.findMany({
        where: { listingId },
        orderBy: { version: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          version: true,
          changedBy: true,
          changeNotes: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.listingVersion.count({
        where: { listingId },
      }),
    ]);

    return {
      versions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a specific version snapshot.
   */
  async findVersion(listingId: string, version: number) {
    const entry = await this.prisma.listingVersion.findUnique({
      where: {
        listingId_version: { listingId, version },
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(
        `Version ${version} not found for listing ${listingId}`,
      );
    }

    return {
      ...entry,
      snapshot: JSON.parse(entry.snapshot),
    };
  }

  /**
   * Compare two versions and return the diff.
   */
  async diffVersions(
    listingId: string,
    versionA: number,
    versionB: number,
  ) {
    const [a, b] = await Promise.all([
      this.findVersion(listingId, versionA),
      this.findVersion(listingId, versionB),
    ]);

    const snapshotA = a.snapshot as Record<string, unknown>;
    const snapshotB = b.snapshot as Record<string, unknown>;

    const allKeys = new Set([
      ...Object.keys(snapshotA),
      ...Object.keys(snapshotB),
    ]);

    const changes: Array<{
      field: string;
      before: unknown;
      after: unknown;
    }> = [];

    for (const key of allKeys) {
      if (key.startsWith('_snapshot')) continue;
      const valA = JSON.stringify(snapshotA[key]);
      const valB = JSON.stringify(snapshotB[key]);
      if (valA !== valB) {
        changes.push({
          field: key,
          before: snapshotA[key],
          after: snapshotB[key],
        });
      }
    }

    return {
      listingId,
      versionA,
      versionB,
      changes,
    };
  }

  /**
   * Get the latest version number for a listing.
   */
  async getLatestVersion(listingId: string): Promise<number> {
    const latest = await this.prisma.listingVersion.findFirst({
      where: { listingId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return latest?.version ?? 0;
  }

  /**
   * Rollback a listing to a specific version.
   * Creates a new version containing the rolled-back state.
   */
  async rollbackToVersion(
    listingId: string,
    targetVersion: number,
    changedBy: string,
    changeNotes?: string,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    // Get the target version snapshot
    const targetVersionEntry = await this.prisma.listingVersion.findUnique({
      where: {
        listingId_version: { listingId, version: targetVersion },
      },
    });

    if (!targetVersionEntry) {
      throw new NotFoundException(
        `Version ${targetVersion} not found for listing ${listingId}`,
      );
    }

    const targetSnapshot = JSON.parse(targetVersionEntry.snapshot) as Record<string, unknown>;

    // Extract listing fields from snapshot (excluding metadata)
    const { _snapshotVersion, _snapshotAt, ...listingData } = targetSnapshot;

    // Update listing with rolled-back data
    await this.prisma.$transaction(async (tx) => {
      // Update main listing fields
      const updateData: Record<string, unknown> = {
        title: listingData.title,
        description: listingData.description,
        price: listingData.price,
        currency: listingData.currency,
        minRentalDuration: listingData.minRentalDuration,
        maxRentalDuration: listingData.maxRentalDuration,
        cancellationPolicy: listingData.cancellationPolicy,
      };

      // Update listing
      await tx.listing.update({
        where: { id: listingId },
        data: updateData,
      });

      // Rollback content versions
      if (Array.isArray(listingData.contents)) {
        for (const content of listingData.contents as any[]) {
          await tx.listingContent.upsert({
            where: {
              listingId_locale: { listingId, locale: content.locale },
            },
            create: {
              listingId,
              locale: content.locale,
              title: content.title,
              description: content.description,
              rules: content.rules ?? null,
              highlights: content.highlights ?? null,
            },
            update: {
              title: content.title,
              description: content.description,
              rules: content.rules ?? null,
              highlights: content.highlights ?? null,
            },
          });
        }
      }

      // Rollback attribute values
      if (Array.isArray(listingData.attributeValues)) {
        // Delete existing attribute values
        await tx.listingAttributeValue.deleteMany({
          where: { listingId },
        });

        // Recreate from snapshot
        for (const attrValue of listingData.attributeValues as any[]) {
          await tx.listingAttributeValue.create({
            data: {
              listingId,
              attributeDefinitionId: attrValue.attributeDefinitionId,
              value: attrValue.value,
            },
          });
        }
      }
    });

    // Create a new version snapshot of the rolled-back state
    return this.createSnapshot({
      listingId,
      changedBy,
      changeNotes: changeNotes || `Rolled back to version ${targetVersion}`,
    });
  }
}
