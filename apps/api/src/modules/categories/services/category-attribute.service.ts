import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface CreateAttributeDefinitionDto {
  categoryId: string;
  slug: string;
  label: string;
  fieldType: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';
  isRequired?: boolean;
  isSearchable?: boolean;
  isFilterable?: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
    minLength?: number;
    maxLength?: number;
  };
  displayOrder?: number;
  unit?: string;
  helpText?: string;
}

export type UpdateAttributeDefinitionDto = Partial<Omit<CreateAttributeDefinitionDto, 'categoryId' | 'slug'>>;

export interface SetAttributeValueDto {
  listingId: string;
  attributeDefinitionId: string;
  value: string;
}

export interface BulkSetAttributeValuesDto {
  listingId: string;
  values: Array<{
    attributeDefinitionId: string;
    value: string;
  }>;
}

const VALID_FIELD_TYPES = [
  'text',
  'number',
  'select',
  'multiselect',
  'boolean',
  'date',
] as const;

@Injectable()
export class CategoryAttributeService {
  private readonly logger = new Logger(CategoryAttributeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // Attribute Definition CRUD
  // ──────────────────────────────────────────────

  /**
   * Create a new attribute definition for a category.
   */
  async createDefinition(dto: CreateAttributeDefinitionDto) {
    if (!VALID_FIELD_TYPES.includes(dto.fieldType as any)) {
      throw new BadRequestException(
        `Invalid fieldType '${dto.fieldType}'. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`,
      );
    }

    await this.ensureCategoryExists(dto.categoryId);

    // Check for slug uniqueness within category
    const existing = await this.prisma.categoryAttributeDefinition.findUnique({
      where: {
        categoryId_slug: {
          categoryId: dto.categoryId,
          slug: dto.slug,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Attribute '${dto.slug}' already exists in this category`,
      );
    }

    return this.prisma.categoryAttributeDefinition.create({
      data: {
        categoryId: dto.categoryId,
        slug: dto.slug,
        label: dto.label,
        fieldType: dto.fieldType,
        isRequired: dto.isRequired ?? false,
        isSearchable: dto.isSearchable ?? false,
        isFilterable: dto.isFilterable ?? false,
        options: dto.options ? JSON.stringify(dto.options) : null,
        validation: dto.validation ? JSON.stringify(dto.validation) : null,
        displayOrder: dto.displayOrder ?? 0,
        unit: dto.unit ?? null,
        helpText: dto.helpText ?? null,
      },
    });
  }

  /**
   * Update an attribute definition.
   */
  async updateDefinition(id: string, dto: UpdateAttributeDefinitionDto) {
    const definition = await this.prisma.categoryAttributeDefinition.findUnique({
      where: { id },
    });

    if (!definition) {
      throw new NotFoundException(`Attribute definition ${id} not found`);
    }

    if (dto.fieldType && !VALID_FIELD_TYPES.includes(dto.fieldType as any)) {
      throw new BadRequestException(
        `Invalid fieldType '${dto.fieldType}'. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`,
      );
    }

    return this.prisma.categoryAttributeDefinition.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.fieldType !== undefined && { fieldType: dto.fieldType }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.isSearchable !== undefined && { isSearchable: dto.isSearchable }),
        ...(dto.isFilterable !== undefined && { isFilterable: dto.isFilterable }),
        ...(dto.options !== undefined && {
          options: JSON.stringify(dto.options),
        }),
        ...(dto.validation !== undefined && {
          validation: JSON.stringify(dto.validation),
        }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.helpText !== undefined && { helpText: dto.helpText }),
      },
    });
  }

  /**
   * Delete an attribute definition. Also deletes all associated values.
   */
  async deleteDefinition(id: string) {
    const definition = await this.prisma.categoryAttributeDefinition.findUnique({
      where: { id },
      include: { _count: { select: { values: true } } },
    });

    if (!definition) {
      throw new NotFoundException(`Attribute definition ${id} not found`);
    }

    // Cascade delete handled by Prisma onDelete: Cascade
    return this.prisma.categoryAttributeDefinition.delete({
      where: { id },
    });
  }

  /**
   * Get all attribute definitions for a category, ordered by displayOrder.
   */
  async findDefinitionsByCategory(categoryId: string) {
    return this.prisma.categoryAttributeDefinition.findMany({
      where: { categoryId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Get a single attribute definition by ID.
   */
  async findDefinitionById(id: string) {
    const definition = await this.prisma.categoryAttributeDefinition.findUnique({
      where: { id },
    });

    if (!definition) {
      throw new NotFoundException(`Attribute definition ${id} not found`);
    }

    return definition;
  }

  // ──────────────────────────────────────────────
  // Attribute Value CRUD
  // ──────────────────────────────────────────────

  /**
   * Set a single attribute value for a listing.
   * Validates the value against the definition's field type and constraints.
   */
  async setValue(dto: SetAttributeValueDto) {
    const definition = await this.prisma.categoryAttributeDefinition.findUnique({
      where: { id: dto.attributeDefinitionId },
    });

    if (!definition) {
      throw new NotFoundException(
        `Attribute definition ${dto.attributeDefinitionId} not found`,
      );
    }

    this.validateValue(dto.value, definition);

    return this.prisma.listingAttributeValue.upsert({
      where: {
        listingId_attributeDefinitionId: {
          listingId: dto.listingId,
          attributeDefinitionId: dto.attributeDefinitionId,
        },
      },
      create: {
        listingId: dto.listingId,
        attributeDefinitionId: dto.attributeDefinitionId,
        value: dto.value,
      },
      update: {
        value: dto.value,
      },
    });
  }

  /**
   * Bulk set attribute values for a listing.
   * Validates all values before saving any.
   */
  async bulkSetValues(dto: BulkSetAttributeValuesDto) {
    // Load all definitions in one query
    const definitionIds = dto.values.map((v) => v.attributeDefinitionId);
    const definitions = await this.prisma.categoryAttributeDefinition.findMany({
      where: { id: { in: definitionIds } },
    });

    const definitionMap = new Map(definitions.map((d) => [d.id, d]));

    // Validate all values
    for (const item of dto.values) {
      const definition = definitionMap.get(item.attributeDefinitionId);
      if (!definition) {
        throw new NotFoundException(
          `Attribute definition ${item.attributeDefinitionId} not found`,
        );
      }
      this.validateValue(item.value, definition);
    }

    // Use a transaction to set all values atomically
    return this.prisma.$transaction(
      dto.values.map((item) =>
        this.prisma.listingAttributeValue.upsert({
          where: {
            listingId_attributeDefinitionId: {
              listingId: dto.listingId,
              attributeDefinitionId: item.attributeDefinitionId,
            },
          },
          create: {
            listingId: dto.listingId,
            attributeDefinitionId: item.attributeDefinitionId,
            value: item.value,
          },
          update: {
            value: item.value,
          },
        }),
      ),
    );
  }

  /**
   * Get all attribute values for a listing, including definition metadata.
   */
  async getValuesForListing(listingId: string) {
    return this.prisma.listingAttributeValue.findMany({
      where: { listingId },
      include: {
        attributeDefinition: true,
      },
      orderBy: {
        attributeDefinition: { displayOrder: 'asc' },
      },
    });
  }

  /**
   * Delete a specific attribute value.
   */
  async deleteValue(listingId: string, attributeDefinitionId: string) {
    const value = await this.prisma.listingAttributeValue.findUnique({
      where: {
        listingId_attributeDefinitionId: {
          listingId,
          attributeDefinitionId,
        },
      },
    });

    if (!value) {
      throw i18nNotFound('category.attributeNotFound');
    }

    return this.prisma.listingAttributeValue.delete({
      where: {
        listingId_attributeDefinitionId: {
          listingId,
          attributeDefinitionId,
        },
      },
    });
  }

  /**
   * Validate that all required attributes for a listing's category are set.
   */
  async validateRequiredAttributes(
    listingId: string,
    categoryId: string,
  ): Promise<{ valid: boolean; missing: string[] }> {
    const [requiredDefs, existingValues] = await Promise.all([
      this.prisma.categoryAttributeDefinition.findMany({
        where: { categoryId, isRequired: true },
        select: { id: true, slug: true, label: true },
      }),
      this.prisma.listingAttributeValue.findMany({
        where: { listingId },
        select: { attributeDefinitionId: true },
      }),
    ]);

    const setDefIds = new Set(
      existingValues.map((v) => v.attributeDefinitionId),
    );

    const missing = requiredDefs
      .filter((d) => !setDefIds.has(d.id))
      .map((d) => d.label);

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  // ──────────────────────────────────────────────
  // Validation helpers
  // ──────────────────────────────────────────────

  private validateValue(
    value: string,
    definition: {
      fieldType: string;
      options: string | null;
      validation: string | null;
    },
  ) {
    const { fieldType } = definition;

    switch (fieldType) {
      case 'number': {
        const num = Number(value);
        if (isNaN(num)) {
          throw new BadRequestException(
            `Value '${value}' is not a valid number`,
          );
        }
        if (definition.validation) {
          const rules = JSON.parse(definition.validation);
          if (rules.min !== undefined && num < rules.min) {
            throw new BadRequestException(
              `Value ${num} is below minimum ${rules.min}`,
            );
          }
          if (rules.max !== undefined && num > rules.max) {
            throw new BadRequestException(
              `Value ${num} is above maximum ${rules.max}`,
            );
          }
        }
        break;
      }

      case 'boolean': {
        if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
          throw new BadRequestException(
            `Value '${value}' is not a valid boolean`,
          );
        }
        break;
      }

      case 'select': {
        if (definition.options) {
          const options: string[] = JSON.parse(definition.options);
          if (!options.includes(value)) {
            throw new BadRequestException(
              `Value '${value}' is not one of the allowed options: ${options.join(', ')}`,
            );
          }
        }
        break;
      }

      case 'multiselect': {
        if (definition.options) {
          const options: string[] = JSON.parse(definition.options);
          let selected: string[];
          try {
            selected = JSON.parse(value);
          } catch {
            throw new BadRequestException(
              'Multiselect value must be a JSON array of strings',
            );
          }
          if (!Array.isArray(selected)) {
            throw new BadRequestException(
              'Multiselect value must be an array',
            );
          }
          const invalid = selected.filter((s) => !options.includes(s));
          if (invalid.length > 0) {
            throw new BadRequestException(
              `Invalid options: ${invalid.join(', ')}. Allowed: ${options.join(', ')}`,
            );
          }
        }
        break;
      }

      case 'date': {
        const d = new Date(value);
        if (isNaN(d.getTime())) {
          throw new BadRequestException(
            `Value '${value}' is not a valid date`,
          );
        }
        break;
      }

      case 'text': {
        if (definition.validation) {
          const rules = JSON.parse(definition.validation);
          if (rules.minLength !== undefined && value.length < rules.minLength) {
            throw new BadRequestException(
              `Value is too short (min: ${rules.minLength})`,
            );
          }
          if (rules.maxLength !== undefined && value.length > rules.maxLength) {
            throw new BadRequestException(
              `Value is too long (max: ${rules.maxLength})`,
            );
          }
          if (rules.regex) {
            const re = new RegExp(rules.regex);
            if (!re.test(value)) {
              throw new BadRequestException(
                `Value does not match the required pattern`,
              );
            }
          }
        }
        break;
      }
    }
  }

  private async ensureCategoryExists(categoryId: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!cat) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
  }
}
