import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Clothing Size Validation Service
 * 
 * Handles clothing-specific size validation including:
 * - Size chart validation (XS, S, M, L, XL, XXL, etc.)
 * - Measurement validation (chest, waist, hips, inseam)
 * - Size recommendation based on measurements
 * - Size conversion between different sizing systems (US, EU, UK)
 */
@Injectable()
export class ClothingSizeValidationService {
  private readonly logger = new Logger(ClothingSizeValidationService.name);

  // Standard size charts
  private readonly STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
  
  // Size measurement ranges (in inches)
  private readonly SIZE_MEASUREMENTS = {
    XS: { chest: [30, 34], waist: [24, 28], hips: [34, 37] },
    S: { chest: [34, 37], waist: [28, 32], hips: [37, 40] },
    M: { chest: [37, 40], waist: [32, 35], hips: [40, 43] },
    L: { chest: [40, 43], waist: [35, 39], hips: [43, 46] },
    XL: { chest: [43, 47], waist: [39, 43], hips: [46, 50] },
    XXL: { chest: [47, 51], waist: [43, 47], hips: [50, 54] },
    XXXL: { chest: [51, 55], waist: [47, 51], hips: [54, 58] },
  } as const;

  // Size conversion tables
  private readonly SIZE_CONVERSION = {
    US: { XS: 'XS', S: 'S', M: 'M', L: 'L', XL: 'XL', XXL: 'XXL', XXXL: 'XXXL' },
    EU: { XS: '34', S: '36', M: '38', L: '40', XL: '42', XXL: '44', XXXL: '46' },
    UK: { XS: '6', S: '8', M: '10', L: '12', XL: '14', XXL: '16', XXXL: '18' },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validate clothing size
   */
  validateSize(size: string): { valid: boolean; recommendedSize?: string; error?: string } {
    const upperSize = size.toUpperCase();
    
    if (!this.STANDARD_SIZES.includes(upperSize as any)) {
      return {
        valid: false,
        error: `Invalid size: ${size}. Valid sizes are: ${this.STANDARD_SIZES.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate measurements against size
   */
  validateMeasurementsForSize(
    size: string,
    measurements: { chest?: number; waist?: number; hips?: number; inseam?: number },
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const upperSize = size.toUpperCase() as keyof typeof this.SIZE_MEASUREMENTS;
    
    if (!this.SIZE_MEASUREMENTS[upperSize]) {
      errors.push(`Invalid size: ${size}`);
      return { valid: false, errors };
    }

    const sizeRanges = this.SIZE_MEASUREMENTS[upperSize];

    // Validate chest measurement
    if (measurements.chest !== undefined) {
      if (measurements.chest < sizeRanges.chest[0] || measurements.chest > sizeRanges.chest[1]) {
        errors.push(
          `Chest measurement ${measurements.chest}" is outside ${size} range (${sizeRanges.chest[0]}-${sizeRanges.chest[1]}")`,
        );
      }
    }

    // Validate waist measurement
    if (measurements.waist !== undefined) {
      if (measurements.waist < sizeRanges.waist[0] || measurements.waist > sizeRanges.waist[1]) {
        errors.push(
          `Waist measurement ${measurements.waist}" is outside ${size} range (${sizeRanges.waist[0]}-${sizeRanges.waist[1]}")`,
        );
      }
    }

    // Validate hips measurement
    if (measurements.hips !== undefined) {
      if (measurements.hips < sizeRanges.hips[0] || measurements.hips > sizeRanges.hips[1]) {
        errors.push(
          `Hips measurement ${measurements.hips}" is outside ${size} range (${sizeRanges.hips[0]}-${sizeRanges.hips[1]}")`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recommend size based on measurements
   */
  recommendSize(measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
  }): { recommendedSize: string; confidence: number; details: string } {
    const scores: Record<string, number> = {};

    for (const [size, ranges] of Object.entries(this.SIZE_MEASUREMENTS)) {
      let score = 0;
      let measurementsChecked = 0;

      if (measurements.chest !== undefined) {
        if (measurements.chest >= ranges.chest[0] && measurements.chest <= ranges.chest[1]) {
          score += 1;
        }
        measurementsChecked++;
      }

      if (measurements.waist !== undefined) {
        if (measurements.waist >= ranges.waist[0] && measurements.waist <= ranges.waist[1]) {
          score += 1;
        }
        measurementsChecked++;
      }

      if (measurements.hips !== undefined) {
        if (measurements.hips >= ranges.hips[0] && measurements.hips <= ranges.hips[1]) {
          score += 1;
        }
        measurementsChecked++;
      }

      if (measurementsChecked > 0) {
        scores[size] = score / measurementsChecked;
      }
    }

    // Find size with highest score
    let bestSize = 'M'; // Default
    let bestScore = 0;

    for (const [size, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestSize = size;
      }
    }

    const confidence = Math.round(bestScore * 100);
    const details = this.generateSizeRecommendationDetails(bestSize, measurements);

    return {
      recommendedSize: bestSize,
      confidence,
      details,
    };
  }

  /**
   * Convert size between different sizing systems
   */
  convertSize(size: string, fromSystem: 'US' | 'EU' | 'UK', toSystem: 'US' | 'EU' | 'UK'): string {
    const upperSize = size.toUpperCase();
    const fromSystemUpper = fromSystem.toUpperCase() as 'US' | 'EU' | 'UK';
    const toSystemUpper = toSystem.toUpperCase() as 'US' | 'EU' | 'UK';

    // Find US equivalent
    let usSize: string | undefined;
    
    if (fromSystemUpper === 'US') {
      usSize = upperSize;
    } else {
      // Convert from EU or UK to US
      for (const [us, converted] of Object.entries(this.SIZE_CONVERSION[fromSystemUpper])) {
        if (converted === upperSize) {
          usSize = us;
          break;
        }
      }
    }

    if (!usSize) {
      throw new BadRequestException(`Cannot convert size ${size} from ${fromSystem}`);
    }

    // Convert US to target system
    if (toSystemUpper === 'US') {
      return usSize;
    }

    return this.SIZE_CONVERSION[toSystemUpper][usSize as keyof typeof this.SIZE_CONVERSION.US];
  }

  /**
   * Validate listing has size attributes
   */
  async validateListingSizeAttributes(listingId: string): Promise<{
    valid: boolean;
    hasSizeAttribute: boolean;
    availableSizes: string[];
  }> {
    // Get category attribute definitions for clothing
    const categoryAttributes = await this.prisma.categoryAttributeDefinition.findMany({
      where: {
        slug: 'size',
        category: {
          slug: 'clothing',
        },
      },
    });

    if (categoryAttributes.length === 0) {
      return {
        valid: true,
        hasSizeAttribute: false,
        availableSizes: [],
      };
    }

    // Get listing attribute values for size
    const sizeAttributeValues = await this.prisma.listingAttributeValue.findMany({
      where: {
        listingId,
        attributeDefinition: {
          slug: 'size',
        },
      },
      include: {
        attributeDefinition: true,
      },
    });

    const availableSizes = sizeAttributeValues.map(v => v.value);

    // Validate all sizes are valid
    const invalidSizes = availableSizes.filter(
      size => !this.STANDARD_SIZES.includes(size.toUpperCase() as any),
    );

    return {
      valid: invalidSizes.length === 0,
      hasSizeAttribute: true,
      availableSizes,
    };
  }

  /**
   * Generate size recommendation details
   */
  private generateSizeRecommendationDetails(size: string, measurements: any): string {
    const sizeRanges = this.SIZE_MEASUREMENTS[size as keyof typeof this.SIZE_MEASUREMENTS];
    
    const details = [];
    if (measurements.chest) {
      details.push(`Chest: ${measurements.chest}" (range: ${sizeRanges.chest[0]}-${sizeRanges.chest[1]}")`);
    }
    if (measurements.waist) {
      details.push(`Waist: ${measurements.waist}" (range: ${sizeRanges.waist[0]}-${sizeRanges.waist[1]}")`);
    }
    if (measurements.hips) {
      details.push(`Hips: ${measurements.hips}" (range: ${sizeRanges.hips[0]}-${sizeRanges.hips[1]}")`);
    }

    return details.join(', ');
  }
}
