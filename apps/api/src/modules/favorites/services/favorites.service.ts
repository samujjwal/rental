import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapListing(listing: any) {
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      images: listing.photos || [],
      pricePerDay: Number(listing.basePrice || 0),
      basePrice: Number(listing.basePrice || 0),
      currency: listing.currency,
      location: {
        city: listing.city,
        state: listing.state,
        country: listing.country,
      },
      status: listing.status,
      averageRating: listing.averageRating || 0,
      reviewCount: listing.totalReviews || 0,
      category: listing.category ? { name: listing.category.name } : { name: 'Uncategorized' },
      owner: listing.owner
        ? { firstName: listing.owner.firstName, lastName: listing.owner.lastName }
        : { firstName: '', lastName: null },
      instantBooking:
        listing.bookingMode === 'INSTANT_BOOK' || listing.instantBookable || false,
      deliveryAvailable: false,
    };
  }

  async getFavorites(
    userId: string,
    page = 1,
    limit = 20,
    sortBy: 'createdAt' | 'price' | 'title' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    category?: string,
  ) {
    const skip = (page - 1) * limit;
    const orderBy =
      sortBy === 'price'
        ? { listing: { basePrice: sortOrder } }
        : sortBy === 'title'
          ? { listing: { title: sortOrder } }
          : { createdAt: sortOrder };

    const where: any = { userId };
    if (category) {
      where.listing = {
        category: {
          name: {
            equals: category,
            mode: 'insensitive',
          },
        },
      };
    }

    const [favorites, total] = await Promise.all([
      this.prisma.favoriteListing.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              description: true,
              photos: true,
              basePrice: true,
              currency: true,
              city: true,
              state: true,
              country: true,
              status: true,
              averageRating: true,
              totalReviews: true,
              bookingMode: true,
              instantBookable: true,
              category: { select: { name: true } },
              owner: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.favoriteListing.count({ where }),
    ]);

    return {
      favorites: favorites.map((favorite) => ({
        ...favorite,
        listing: this.mapListing(favorite.listing),
      })),
      total,
      page,
      limit,
    };
  }

  async getFavoriteByListingId(userId: string, listingId: string) {
    const favorite = await this.prisma.favoriteListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            description: true,
            photos: true,
            basePrice: true,
            currency: true,
            city: true,
            state: true,
            country: true,
            status: true,
            averageRating: true,
            totalReviews: true,
            bookingMode: true,
            instantBookable: true,
            category: { select: { name: true } },
            owner: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    return {
      ...favorite,
      listing: this.mapListing(favorite.listing),
    };
  }

  async addFavorite(userId: string, listingId: string) {
    return this.prisma.favoriteListing.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId },
      update: {},
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            description: true,
            photos: true,
            basePrice: true,
            currency: true,
            city: true,
            state: true,
            country: true,
            status: true,
            averageRating: true,
            totalReviews: true,
            bookingMode: true,
            instantBookable: true,
            category: { select: { name: true } },
            owner: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }).then((favorite) => ({
      ...favorite,
      listing: this.mapListing(favorite.listing),
    }));
  }

  async removeFavorite(userId: string, listingId: string) {
    await this.prisma.favoriteListing.deleteMany({
      where: { userId, listingId },
    });
  }

  async countFavorites(userId: string) {
    return this.prisma.favoriteListing.count({ where: { userId } });
  }

  async bulkAddFavorites(userId: string, listingIds: string[]) {
    if (!listingIds.length) return [];

    await this.prisma.favoriteListing.createMany({
      data: listingIds.map((listingId) => ({ userId, listingId })),
      skipDuplicates: true,
    });

    return this.prisma.favoriteListing.findMany({
      where: { userId, listingId: { in: listingIds } },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            description: true,
            photos: true,
            basePrice: true,
            currency: true,
            city: true,
            state: true,
            country: true,
            status: true,
            averageRating: true,
            totalReviews: true,
            bookingMode: true,
            instantBookable: true,
            category: { select: { name: true } },
            owner: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }).then((favorites) =>
      favorites.map((favorite) => ({
        ...favorite,
        listing: this.mapListing(favorite.listing),
      }))
    );
  }

  async bulkRemoveFavorites(userId: string, listingIds: string[]) {
    if (!listingIds.length) return;
    await this.prisma.favoriteListing.deleteMany({
      where: { userId, listingId: { in: listingIds } },
    });
  }

  async clearAllFavorites(userId: string) {
    await this.prisma.favoriteListing.deleteMany({ where: { userId } });
  }
}
