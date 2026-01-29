import { Injectable, Logger } from '@nestjs/common';

export interface ModerationResult {
  approved: boolean;
  reasons: string[];
  originalText?: string;
  cleanedText?: string;
}

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);
  private readonly profanityFilter: any;
  private readonly suspiciousPatterns: RegExp[];
  private readonly spamKeywords: string[];
  
  constructor() {
    // Create a simple profanity filter as fallback
    this.profanityFilter = {
      isProfane: (text: string) => {
        // Simple profanity detection - basic bad words list
        const badWords = /\b(bad|damn|hell|shit|fuck|ass|bitch|bastard|crap|piss|dick|pussy|cock|cunt|whore|slut)\b/gi;
        return badWords.test(text);
      },
      clean: (text: string) => {
        return text.replace(/\b(bad|damn|hell|shit|fuck|ass|bitch|bastard|crap|piss|dick|pussy|cock|cunt|whore|slut)\b/gi, (match) => {
          return '*'.repeat(match.length);
        });
      }
    };
    
    // Patterns for detecting contact information
    this.suspiciousPatterns = [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
      /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b/g, // URLs
      /\b(?:whatsapp|telegram|signal|wechat|line)\b/gi, // Messaging apps
      /\b(?:cashapp|venmo|paypal|zelle)\b/gi, // Payment apps
    ];
    
    // Common spam keywords
    this.spamKeywords = [
      'click here',
      'buy now',
      'limited time',
      'act fast',
      'guaranteed',
      'free money',
      'make money fast',
      'work from home',
      'viagra',
      'cialis',
      'casino',
      'lottery',
      'winner',
      'congratulations you won',
    ];
  }

  /**
   * Moderate text content for profanity, spam, and suspicious patterns
   */
  moderateText(text: string): ModerationResult {
    const reasons: string[] = [];
    let approved = true;

    // Check for profanity
    if (this.profanityFilter.isProfane(text)) {
      reasons.push('Contains profanity or inappropriate language');
      approved = false;
    }

    // Check for contact information
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(text)) {
        reasons.push('Contains contact information (phone, email, or external links)');
        approved = false;
        break;
      }
    }

    // Check for spam keywords
    const lowerText = text.toLowerCase();
    for (const keyword of this.spamKeywords) {
      if (lowerText.includes(keyword)) {
        reasons.push('Contains spam keywords');
        approved = false;
        break;
      }
    }

    // Check for excessive capitalization (potential shouting/spam)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (text.length > 20 && capsRatio > 0.5) {
      reasons.push('Excessive use of capital letters');
      approved = false;
    }

    // Check for repeated characters (potential spam)
    if (/(.)\1{4,}/.test(text)) {
      reasons.push('Contains excessive repeated characters');
      approved = false;
    }

    const result: ModerationResult = {
      approved,
      reasons,
      originalText: text,
    };

    if (!approved) {
      this.logger.warn(`Content flagged for moderation: ${reasons.join(', ')}`);
    }

    return result;
  }

  /**
   * Clean text by removing profanity (for display purposes)
   */
  cleanText(text: string): string {
    return this.profanityFilter.clean(text);
  }

  /**
   * Moderate a listing title
   */
  moderateListingTitle(title: string): ModerationResult {
    const result = this.moderateText(title);
    
    // Additional checks for listing titles
    if (title.length < 5) {
      result.approved = false;
      result.reasons.push('Title too short (minimum 5 characters)');
    }
    
    if (title.length > 100) {
      result.approved = false;
      result.reasons.push('Title too long (maximum 100 characters)');
    }

    return result;
  }

  /**
   * Moderate a listing description
   */
  moderateListingDescription(description: string): ModerationResult {
    const result = this.moderateText(description);
    
    // Additional checks for descriptions
    if (description.length < 20) {
      result.approved = false;
      result.reasons.push('Description too short (minimum 20 characters)');
    }
    
    if (description.length > 5000) {
      result.approved = false;
      result.reasons.push('Description too long (maximum 5000 characters)');
    }

    return result;
  }

  /**
   * Moderate a user review
   */
  moderateReview(reviewText: string, rating: number): ModerationResult {
    const result = this.moderateText(reviewText);
    
    // Check for rating/text mismatch (potential spam/fake review)
    const lowerText = reviewText.toLowerCase();
    const hasPositiveWords = /\b(great|excellent|amazing|wonderful|fantastic|perfect|love)\b/gi.test(lowerText);
    const hasNegativeWords = /\b(terrible|awful|horrible|worst|hate|never|disaster)\b/gi.test(lowerText);
    
    if (rating >= 4 && hasNegativeWords && !hasPositiveWords) {
      result.approved = false;
      result.reasons.push('Rating does not match review content');
    }
    
    if (rating <= 2 && hasPositiveWords && !hasNegativeWords) {
      result.approved = false;
      result.reasons.push('Rating does not match review content');
    }

    return result;
  }

  /**
   * Moderate a message (more lenient than listings)
   */
  moderateMessage(message: string): ModerationResult {
    const reasons: string[] = [];
    let approved = true;

    // Only check for severe profanity and obvious spam
    if (this.profanityFilter.isProfane(message)) {
      reasons.push('Contains inappropriate language');
      approved = false;
    }

    // Allow contact info in messages (users need to communicate)
    // but flag excessive spam patterns
    const lowerMessage = message.toLowerCase();
    let spamCount = 0;
    for (const keyword of this.spamKeywords) {
      if (lowerMessage.includes(keyword)) {
        spamCount++;
      }
    }
    
    if (spamCount >= 3) {
      reasons.push('Contains multiple spam indicators');
      approved = false;
    }

    return {
      approved,
      reasons,
      originalText: message,
    };
  }

  /**
   * Batch moderate multiple texts
   */
  async moderateBatch(texts: string[]): Promise<ModerationResult[]> {
    return texts.map(text => this.moderateText(text));
  }
}
