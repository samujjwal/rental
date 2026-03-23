import { Injectable, Logger, Inject } from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { AI_PROVIDER_PORT, type AiProviderPort } from '../ports/ai-provider.port';
import {
  PROMPT_LISTING_GENERATE_DESCRIPTION,
  PROMPT_LISTING_GENERATE_SUGGESTIONS,
} from '../prompts/prompt-registry';

export interface GenerateDescriptionDto {
  title: string;
  category?: string;
  city?: string;
  features?: string[];
  amenities?: string[];
  condition?: string;
  basePrice?: number;
}

export interface GenerateDescriptionResult {
  description: string;
  model: string;
  tokens?: number;
}

export type SuggestionType = 'pricing' | 'title' | 'description' | 'location' | 'features' | 'images';

export interface ListingSuggestion {
  type: SuggestionType;
  field: string;
  suggestion: string;
  confidence: number;
  reasoning: string;
}

export interface GenerateListingSuggestionsDto {
  currentData: {
    title?: string;
    description?: string;
    category?: string;
    city?: string;
    basePrice?: number;
    features?: string[];
    amenities?: string[];
    condition?: string;
  };
  category?: string;
}

export interface GenerateListingSuggestionsResult {
  suggestions: ListingSuggestion[];
  fromProvider: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER_PORT) private readonly aiProvider: AiProviderPort,
  ) {}

  /**
   * Generate a compelling listing description using the AI provider.
   * Falls back to a template-based description when the provider is unavailable.
   */
  async generateListingDescription(
    dto: GenerateDescriptionDto,
  ): Promise<GenerateDescriptionResult> {
    if (!dto.title || dto.title.trim().length < 3) {
      throw i18nBadRequest('validation.titleTooShort');
    }

    const { promptId, version: promptVersion, systemPrompt } = PROMPT_LISTING_GENERATE_DESCRIPTION;

    const result = await this.aiProvider.complete({
      promptId,
      promptVersion,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: this.buildPrompt(dto) },
      ],
      maxTokens: 400,
      temperature: 0.7,
    });

    if (!result.fromProvider || !result.content) {
      if (!result.fromProvider) {
        this.logger.warn(
          `AI provider unavailable [${promptId}@${promptVersion}], using template fallback`,
        );
      }
      return {
        description: this.generateTemplateFallback(dto),
        model: result.fromProvider ? 'template-fallback' : 'template',
      };
    }

    this.logger.log(
      `Listing description generated [${promptId}@${promptVersion}] ` +
        `model=${result.model} latency=${result.latencyMs}ms tokens=${result.usage?.totalTokens ?? '?'}`,
    );

    return {
      description: result.content,
      model: result.model,
      tokens: result.usage?.totalTokens,
    };
  }

  private buildPrompt(dto: GenerateDescriptionDto): string {
    const parts: string[] = [`Write a rental listing description for: "${dto.title}"`];

    if (dto.category) {
      parts.push(`Category: ${dto.category}`);
    }
    if (dto.city) {
      parts.push(`Location: ${dto.city}`);
    }
    if (dto.condition) {
      parts.push(`Condition: ${dto.condition}`);
    }
    if (dto.basePrice) {
      parts.push(`Price: $${dto.basePrice}/day`);
    }
    if (dto.features?.length) {
      parts.push(`Features: ${dto.features.join(', ')}`);
    }
    if (dto.amenities?.length) {
      parts.push(`Amenities: ${dto.amenities.join(', ')}`);
    }

    return parts.join('\n');
  }

  private generateTemplateFallback(dto: GenerateDescriptionDto): string {
    const title = dto.title;
    const category = dto.category || 'item';
    const city = dto.city ? ` in ${dto.city}` : '';
    const condition = dto.condition
      ? ` This ${category} is in ${dto.condition.toLowerCase().replace(/_/g, ' ')} condition.`
      : '';
    const features =
      dto.features?.length && dto.features.length > 0
        ? ` Key features include ${dto.features.slice(0, 3).join(', ')}.`
        : '';
    const price = dto.basePrice ? ` Available starting at $${dto.basePrice}/day.` : '';

    return `${title} is available for rent${city}. Whether you need it for a day, a week, or longer, this ${category} is ready for you.${condition}${features}${price} Book now to secure your rental dates.`;
  }

  /**
   * Generate listing improvement suggestions using the AI provider.
   * Returns an empty suggestions array when the AI provider is unavailable —
   * callers should render an honest "not available" state rather than mock values.
   */
  async generateListingSuggestions(
    dto: GenerateListingSuggestionsDto,
  ): Promise<GenerateListingSuggestionsResult> {
    const { promptId, version: promptVersion, systemPrompt } =
      PROMPT_LISTING_GENERATE_SUGGESTIONS;

    const userContent = this.buildSuggestionsPrompt(dto);

    const result = await this.aiProvider.complete({
      promptId,
      promptVersion,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      maxTokens: 800,
      temperature: 0.5,
    });

    if (!result.fromProvider || !result.content) {
      this.logger.warn(
        `AI provider unavailable [${promptId}@${promptVersion}], returning empty suggestions`,
      );
      return { suggestions: [], fromProvider: false };
    }

    this.logger.log(
      `Listing suggestions generated [${promptId}@${promptVersion}] ` +
        `model=${result.model} latency=${result.latencyMs}ms`,
    );

    try {
      const parsed: unknown = JSON.parse(result.content);
      if (!Array.isArray(parsed)) {
        this.logger.warn(`AI suggestions response was not an array for [${promptId}]`);
        return { suggestions: [], fromProvider: true };
      }
      const suggestions = (parsed as ListingSuggestion[]).filter(
        (s) =>
          typeof s.type === 'string' &&
          typeof s.field === 'string' &&
          typeof s.suggestion === 'string' &&
          typeof s.confidence === 'number' &&
          typeof s.reasoning === 'string',
      );
      return { suggestions, fromProvider: true };
    } catch {
      this.logger.warn(`Failed to parse AI suggestions JSON for [${promptId}]`);
      return { suggestions: [], fromProvider: true };
    }
  }

  private buildSuggestionsPrompt(dto: GenerateListingSuggestionsDto): string {
    const d = dto.currentData;
    const parts: string[] = ['Current listing data:'];
    if (d.title) parts.push(`Title: ${d.title}`);
    if (d.category ?? dto.category) parts.push(`Category: ${d.category ?? dto.category}`);
    if (d.city) parts.push(`City: ${d.city}`);
    if (d.description) parts.push(`Description: ${d.description.slice(0, 300)}`);
    if (d.basePrice != null) parts.push(`Price: $${d.basePrice}/day`);
    if (d.condition) parts.push(`Condition: ${d.condition}`);
    if (d.features?.length) parts.push(`Features: ${d.features.join(', ')}`);
    if (d.amenities?.length) parts.push(`Amenities: ${d.amenities.join(', ')}`);
    return parts.join('\n');
  }
}
