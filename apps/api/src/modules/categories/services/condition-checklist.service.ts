import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Condition Checklist Service
 * 
 * Generalizes condition report management across all categories:
 * - Checklist template management
 * - Condition validation
 * - Photo documentation
 * - Damage reporting
 * - Signature capture
 * - Checklist completion tracking
 */
@Injectable()
export class ConditionChecklistService {
  private readonly logger = new Logger(ConditionChecklistService.name);

  // Default checklist templates by category
  private readonly CHECKLIST_TEMPLATES = {
    vehicles: [
      { id: 'exterior', label: 'Exterior Condition', required: true, items: ['Scratches', 'Dents', 'Paint condition', 'Lights', 'Tires'] },
      { id: 'interior', label: 'Interior Condition', required: true, items: ['Seats', 'Dashboard', 'Carpet', 'Windows', 'AC/Heat'] },
      { id: 'mechanical', label: 'Mechanical', required: true, items: ['Engine start', 'Brakes', 'Transmission', 'Steering', 'Battery'] },
      { id: 'documentation', label: 'Documentation', required: false, items: ['Registration', 'Insurance', 'Manual'] },
    ],
    spaces: [
      { id: 'general', label: 'General Condition', required: true, items: ['Floors', 'Walls', 'Ceiling', 'Windows', 'Doors'] },
      { id: 'furniture', label: 'Furniture', required: true, items: ['Sofa', 'Tables', 'Chairs', 'Bed', 'Storage'] },
      { id: 'appliances', label: 'Appliances', required: true, items: ['Refrigerator', 'Stove', 'Microwave', 'Washer', 'Dryer'] },
      { id: 'utilities', label: 'Utilities', required: true, items: ['Electricity', 'Water', 'Gas', 'Internet', 'HVAC'] },
    ],
    clothing: [
      { id: 'garment', label: 'Garment Condition', required: true, items: ['Stains', 'Tears', 'Buttons', 'Zippers', 'Seams'] },
      { id: 'cleanliness', label: 'Cleanliness', required: true, items: ['Odor', 'Wrinkles', 'Lint', 'Pet hair', 'Dust'] },
    ],
  } as const;

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get checklist template for a category
   */
  getChecklistTemplate(category: string): {
    sections: Array<{ id: string; label: string; required: boolean; items: string[] }>;
  } {
    const template = this.CHECKLIST_TEMPLATES[category as keyof typeof this.CHECKLIST_TEMPLATES];
    
    if (!template) {
      // Return generic template for unknown categories
      return {
        sections: [
          { id: 'general', label: 'General Condition', required: true, items: ['Overall condition', 'Cleanliness', 'Functionality'] },
        ],
      };
    }

    return { 
      sections: template.map(section => ({
        id: section.id,
        label: section.label,
        required: section.required,
        items: [...section.items],
      })),
    };
  }

  /**
   * Validate checklist completion
   */
  validateChecklistCompletion(
    category: string,
    checklistData: Record<string, any>,
  ): { valid: boolean; errors: string[]; completedSections: string[] } {
    const errors: string[] = [];
    const completedSections: string[] = [];
    const template = this.getChecklistTemplate(category);

    for (const section of template.sections) {
      const sectionData = checklistData[section.id];
      
      if (section.required && !sectionData) {
        errors.push(`Required section "${section.label}" is missing`);
        continue;
      }

      if (sectionData) {
        const completedItems = section.items.filter(item => sectionData[item] !== undefined);
        
        if (section.required && completedItems.length === 0) {
          errors.push(`Required section "${section.label}" has no completed items`);
        } else if (completedItems.length > 0) {
          completedSections.push(section.id);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      completedSections,
    };
  }

  /**
   * Create condition report with checklist
   */
  async createConditionReport(data: {
    bookingId: string;
    propertyId: string;
    createdBy: string;
    checkIn: boolean;
    checkOut: boolean;
    category: string;
    checklistData: Record<string, any>;
    photos: string[];
    notes?: string;
    damages?: string;
    signature?: string;
    reportType?: string;
  }) {
    // Validate booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Validate checklist completion
    const checklistValidation = this.validateChecklistCompletion(
      data.category,
      data.checklistData,
    );

    if (!checklistValidation.valid) {
      throw new BadRequestException(
        `Checklist validation failed: ${checklistValidation.errors.join(', ')}`,
      );
    }

    // Create condition report
    const conditionReport = await this.prisma.conditionReport.create({
      data: {
        bookingId: data.bookingId,
        propertyId: data.propertyId,
        createdBy: data.createdBy,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        photos: data.photos,
        notes: data.notes,
        damages: data.damages,
        signature: data.signature,
        status: data.checkIn ? 'CHECKIN_COMPLETED' : 'CHECKOUT_COMPLETED',
        reportType: data.reportType || (data.checkIn ? 'CHECKIN' : 'CHECKOUT'),
        checklistData: JSON.stringify({
          ...data.checklistData,
          completedSections: checklistValidation.completedSections,
          completedAt: new Date().toISOString(),
        }),
      },
    });

    this.logger.log(
      `Condition report created for booking ${data.bookingId}, sections: ${checklistValidation.completedSections.length}`,
    );
    
    return {
      conditionReport,
      validation: checklistValidation,
    };
  }

  /**
   * Compare check-in and check-out reports
   */
  async compareReports(bookingId: string): Promise<{
    checkinReport: any;
    checkoutReport: any;
    differences: Array<{ section: string; item: string; checkin: any; checkout: any }>;
    newDamages: string[];
  }> {
    const checkinReport = await this.prisma.conditionReport.findFirst({
      where: {
        bookingId,
        checkIn: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const checkoutReport = await this.prisma.conditionReport.findFirst({
      where: {
        bookingId,
        checkOut: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!checkinReport || !checkoutReport) {
      throw new BadRequestException('Both check-in and check-out reports are required for comparison');
    }

    const checkinData = JSON.parse(checkinReport.checklistData || '{}');
    const checkoutData = JSON.parse(checkoutReport.checklistData || '{}');

    const differences: Array<{ section: string; item: string; checkin: any; checkout: any }> = [];

    // Compare checklist items
    for (const section of Object.keys(checkinData)) {
      if (typeof checkinData[section] === 'object' && !Array.isArray(checkinData[section])) {
        for (const item of Object.keys(checkinData[section])) {
          if (checkoutData[section] && checkoutData[section][item] !== checkinData[section][item]) {
            differences.push({
              section,
              item,
              checkin: checkinData[section][item],
              checkout: checkoutData[section][item],
            });
          }
        }
      }
    }

    // Identify new damages
    const checkinDamages = (checkinReport.damages || '').split(',').map(d => d.trim()).filter(Boolean);
    const checkoutDamages = (checkoutReport.damages || '').split(',').map(d => d.trim()).filter(Boolean);
    const newDamages = checkoutDamages.filter(d => !checkinDamages.includes(d));

    return {
      checkinReport: { ...checkinReport, checklistData: checkinData },
      checkoutReport: { ...checkoutReport, checklistData: checkoutData },
      differences,
      newDamages,
    };
  }

  /**
   * Get condition reports for a booking
   */
  async getBookingReports(bookingId: string) {
    const reports = await this.prisma.conditionReport.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });

    return reports.map(report => ({
      ...report,
      checklistData: JSON.parse(report.checklistData || '{}'),
    }));
  }

  /**
   * Update condition report
   */
  async updateConditionReport(
    reportId: string,
    updates: {
      checklistData?: Record<string, any>;
      photos?: string[];
      notes?: string;
      damages?: string;
    },
  ) {
    const existingReport = await this.prisma.conditionReport.findUnique({
      where: { id: reportId },
    });

    if (!existingReport) {
      throw new NotFoundException('Condition report not found');
    }

    // If checklist data is being updated, validate it
    if (updates.checklistData) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: existingReport.bookingId },
        include: { listing: { include: { category: true } } },
      });

      if (booking) {
        const category = booking.listing.category?.slug || 'general';
        const validation = this.validateChecklistCompletion(category, updates.checklistData);
        
        if (!validation.valid) {
          throw new BadRequestException(
            `Checklist validation failed: ${validation.errors.join(', ')}`,
          );
        }
      }
    }

    const updatedReport = await this.prisma.conditionReport.update({
      where: { id: reportId },
      data: {
        ...(updates.checklistData && { checklistData: JSON.stringify(updates.checklistData) }),
        ...(updates.photos && { photos: updates.photos }),
        ...(updates.notes && { notes: updates.notes }),
        ...(updates.damages !== undefined && { damages: updates.damages }),
      },
    });

    return {
      ...updatedReport,
      checklistData: JSON.parse(updatedReport.checklistData || '{}'),
    };
  }

  /**
   * Calculate condition score
   */
  calculateConditionScore(checklistData: Record<string, any>): {
    score: number;
    totalItems: number;
    passedItems: number;
    percentage: number;
  } {
    let totalItems = 0;
    let passedItems = 0;

    for (const section of Object.values(checklistData)) {
      if (typeof section === 'object' && !Array.isArray(section)) {
        for (const value of Object.values(section)) {
          totalItems++;
          if (value === true || value === 'good' || value === 'pass') {
            passedItems++;
          }
        }
      }
    }

    const percentage = totalItems > 0 ? (passedItems / totalItems) * 100 : 100;
    
    return {
      score: Math.round(percentage),
      totalItems,
      passedItems,
      percentage: Math.round(percentage * 100) / 100,
    };
  }
}
