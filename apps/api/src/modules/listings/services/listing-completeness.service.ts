import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface CompletenessField {
  field: string;
  label: string;
  filled: boolean;
  weight: number;
  tip?: string;
}

export interface CompletenessResult {
  score: number;
  breakdown: CompletenessField[];
  missingFields: string[];
}

@Injectable()
export class ListingCompletenessService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompleteness(listingId: string): Promise<CompletenessResult> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { category: true },
    });

    if (!listing) {
      return { score: 0, breakdown: [], missingFields: [] };
    }

    const photos = listing.photos as string[] | null;

    const breakdown: CompletenessField[] = [
      {
        field: 'title',
        label: 'Title',
        filled: !!listing.title && listing.title.length >= 10,
        weight: 10,
        tip: 'Add a descriptive title (at least 10 characters)',
      },
      {
        field: 'description',
        label: 'Description',
        filled: !!listing.description && listing.description.length >= 50,
        weight: 15,
        tip: 'Write a detailed description (at least 50 characters)',
      },
      {
        field: 'photos',
        label: 'Photos',
        filled: !!photos && photos.length >= 3,
        weight: 20,
        tip: 'Upload at least 3 photos to attract renters',
      },
      {
        field: 'photos_bonus',
        label: 'Extra photos (5+)',
        filled: !!photos && photos.length >= 5,
        weight: 5,
        tip: 'Add 5 or more photos for the best results',
      },
      {
        field: 'basePrice',
        label: 'Base price',
        filled: listing.basePrice != null && Number(listing.basePrice) > 0,
        weight: 10,
        tip: 'Set a competitive daily rental price',
      },
      {
        field: 'city',
        label: 'City',
        filled: !!listing.city,
        weight: 8,
        tip: 'Specify the city where the item is located',
      },
      {
        field: 'address',
        label: 'Full address',
        filled: !!listing.address && !!listing.state && !!listing.country,
        weight: 7,
        tip: 'Provide full address including state and country',
      },
      {
        field: 'category',
        label: 'Category',
        filled: !!listing.categoryId,
        weight: 5,
        tip: 'Select a category so renters can discover your listing',
      },
      {
        field: 'condition',
        label: 'Item condition',
        filled: !!listing.condition,
        weight: 5,
        tip: 'Specify the condition to set renter expectations',
      },
      {
        field: 'features',
        label: 'Features',
        filled: !!listing.features && (listing.features as string[]).length > 0,
        weight: 5,
        tip: 'List key features to highlight what makes your item special',
      },
      {
        field: 'categorySpecificData',
        label: 'Category details',
        filled: !!(listing as any).categorySpecificData && Object.keys((listing as any).categorySpecificData as object).length > 0,
        weight: 5,
        tip: 'Fill in category-specific details for better search visibility',
      },
      {
        field: 'rules',
        label: 'Rental rules',
        filled: !!listing.rules && (listing.rules as string[]).length > 0,
        weight: 5,
        tip: 'Add rental rules to set clear expectations',
      },
    ];

    const totalWeight = breakdown.reduce((sum, f) => sum + f.weight, 0);
    const earnedWeight = breakdown
      .filter((f) => f.filled)
      .reduce((sum, f) => sum + f.weight, 0);

    const score = Math.round((earnedWeight / totalWeight) * 100);
    const missingFields = breakdown
      .filter((f) => !f.filled)
      .map((f) => f.field);

    return { score, breakdown, missingFields };
  }
}
