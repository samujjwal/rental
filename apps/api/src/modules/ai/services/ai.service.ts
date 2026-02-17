import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.model = this.config.get<string>('OPENAI_MODEL') || 'gpt-3.5-turbo';
  }

  /**
   * Generate a compelling listing description using OpenAI.
   * Falls back to a template-based description if the API key is not configured.
   */
  async generateListingDescription(
    dto: GenerateDescriptionDto,
  ): Promise<GenerateDescriptionResult> {
    if (!dto.title || dto.title.trim().length < 3) {
      throw new BadRequestException('Title must be at least 3 characters');
    }

    // If no API key, use template-based fallback
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY not set, using template-based description');
      return {
        description: this.generateTemplateFallback(dto),
        model: 'template',
      };
    }

    try {
      const prompt = this.buildPrompt(dto);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert copywriter for a rental platform. Write compelling, honest, and SEO-friendly listing descriptions. Keep descriptions between 100-200 words. Use a warm, professional tone. Highlight key features and benefits. Do not use exclamation marks excessively. Do not invent features not mentioned in the input.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 400,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`OpenAI API error: ${response.status} ${errorBody}`);
        // Fallback to template
        return {
          description: this.generateTemplateFallback(dto),
          model: 'template-fallback',
        };
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();

      if (!content) {
        return {
          description: this.generateTemplateFallback(dto),
          model: 'template-fallback',
        };
      }

      return {
        description: content,
        model: data.model || this.model,
        tokens: data.usage?.total_tokens,
      };
    } catch (error) {
      this.logger.error('Failed to generate description via OpenAI', error);
      return {
        description: this.generateTemplateFallback(dto),
        model: 'template-fallback',
      };
    }
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
}
