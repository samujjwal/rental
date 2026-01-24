import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationFlag } from './content-moderation.service';

@Injectable()
export class TextModerationService {
  private readonly logger = new Logger(TextModerationService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Moderate text content for inappropriate material
   * In production: Use OpenAI Moderation API, Perspective API, or similar
   */
  async moderateText(text: string): Promise<{
    flags: ModerationFlag[];
    confidence: number;
  }> {
    const flags: ModerationFlag[] = [];

    // 1. Check profanity
    const profanityCheck = this.checkProfanity(text);
    if (profanityCheck) {
      flags.push(profanityCheck);
    }

    // 2. Check for hate speech patterns
    const hateCheck = this.checkHateSpeech(text);
    if (hateCheck) {
      flags.push(hateCheck);
    }

    // 3. Check for spam patterns
    const spamCheck = this.checkSpam(text);
    if (spamCheck) {
      flags.push(spamCheck);
    }

    // 4. Check for external contact info
    const contactCheck = this.checkExternalContact(text);
    if (contactCheck) {
      flags.push(contactCheck);
    }

    // 5. Check for scam patterns
    const scamCheck = this.checkScamPatterns(text);
    if (scamCheck) {
      flags.push(scamCheck);
    }

    const confidence = flags.length > 0 ? 0.8 : 1;
    return { flags, confidence };
  }

  /**
   * Detect personally identifiable information (PII)
   */
  async detectPII(text: string): Promise<{
    flags: ModerationFlag[];
    maskedText: string;
  }> {
    const flags: ModerationFlag[] = [];
    let maskedText = text;

    // Email detection
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails) {
      flags.push({
        type: 'EMAIL_DETECTED',
        severity: 'HIGH',
        confidence: 1,
        description: 'Email address detected in message',
        details: { count: emails.length },
      });
      maskedText = maskedText.replace(emailRegex, '[EMAIL REMOVED]');
    }

    // Phone number detection (various formats)
    const phoneRegex =
      /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/g;
    const phones = text.match(phoneRegex);
    if (phones) {
      flags.push({
        type: 'PHONE_DETECTED',
        severity: 'HIGH',
        confidence: 0.9,
        description: 'Phone number detected in message',
        details: { count: phones.length },
      });
      maskedText = maskedText.replace(phoneRegex, '[PHONE REMOVED]');
    }

    // Social media handles
    const socialRegex = /@[\w.]+|(?:instagram|facebook|twitter|whatsapp|telegram)\.com\/[\w.]+/gi;
    const socials = text.match(socialRegex);
    if (socials) {
      flags.push({
        type: 'SOCIAL_MEDIA_DETECTED',
        severity: 'MEDIUM',
        confidence: 0.85,
        description: 'Social media handle/link detected',
        details: { count: socials.length },
      });
      maskedText = maskedText.replace(socialRegex, '[CONTACT REMOVED]');
    }

    // URLs (non-platform)
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = text.match(urlRegex);
    if (urls) {
      const externalUrls = urls.filter(
        (url) => !url.includes(this.config.get('PLATFORM_DOMAIN', 'rentalportal.com')),
      );
      if (externalUrls.length > 0) {
        flags.push({
          type: 'EXTERNAL_URL_DETECTED',
          severity: 'MEDIUM',
          confidence: 1,
          description: 'External URL detected',
          details: { count: externalUrls.length },
        });
        maskedText = maskedText.replace(urlRegex, '[LINK REMOVED]');
      }
    }

    return { flags, maskedText };
  }

  /**
   * Check for profanity
   */
  private checkProfanity(text: string): ModerationFlag | null {
    // Basic profanity list (in production, use comprehensive profanity filter)
    const profanityPatterns = [
      /\b(fuck|shit|damn|bitch|asshole|bastard|cunt|dick)\b/gi,
      /\b(f+u+c+k+|s+h+i+t+|a+s+s+h+o+l+e+)\b/gi, // Leetspeak variants
    ];

    for (const pattern of profanityPatterns) {
      if (pattern.test(text)) {
        return {
          type: 'PROFANITY',
          severity: 'MEDIUM',
          confidence: 0.9,
          description: 'Profanity detected',
        };
      }
    }

    return null;
  }

  /**
   * Check for hate speech
   */
  private checkHateSpeech(text: string): ModerationFlag | null {
    const hateSpeechPatterns = [
      /\b(racist|sexist|homophobic|transphobic|xenophobic)\b/gi,
      /\b(kill yourself|kys)\b/gi,
      // Add more patterns based on your moderation policy
    ];

    for (const pattern of hateSpeechPatterns) {
      if (pattern.test(text)) {
        return {
          type: 'HATE_SPEECH',
          severity: 'CRITICAL',
          confidence: 0.85,
          description: 'Potential hate speech detected',
        };
      }
    }

    return null;
  }

  /**
   * Check for spam patterns
   */
  private checkSpam(text: string): ModerationFlag | null {
    const spamPatterns = [
      /\b(click here|buy now|limited time|act fast|winner|congratulations)\b/gi,
      /\$\$\$|\$\$\$/g, // Multiple dollar signs
      /(!{3,})/g, // Multiple exclamation marks
      /\b(viagra|cialis|crypto|bitcoin|forex)\b/gi,
    ];

    let spamScore = 0;
    for (const pattern of spamPatterns) {
      if (pattern.test(text)) {
        spamScore++;
      }
    }

    if (spamScore >= 2) {
      return {
        type: 'SPAM',
        severity: 'HIGH',
        confidence: 0.8,
        description: 'Spam content detected',
        details: { spamScore },
      };
    }

    return null;
  }

  /**
   * Check for external contact encouragement
   */
  private checkExternalContact(text: string): ModerationFlag | null {
    const contactPatterns = [
      /\b(text me|call me|reach me|contact me outside|off platform|direct message)\b/gi,
      /\b(whatsapp|telegram|wechat|signal|viber)\b/gi,
    ];

    for (const pattern of contactPatterns) {
      if (pattern.test(text)) {
        return {
          type: 'EXTERNAL_CONTACT',
          severity: 'HIGH',
          confidence: 0.75,
          description: 'Attempt to move communication off platform',
        };
      }
    }

    return null;
  }

  /**
   * Check for scam patterns
   */
  private checkScamPatterns(text: string): ModerationFlag | null {
    const scamPatterns = [
      /\b(wire transfer|western union|moneygram|gift card|bitcoin payment)\b/gi,
      /\b(send money first|pay outside platform|direct payment)\b/gi,
      /\b(too good to be true|guaranteed|no risk|100% safe)\b/gi,
    ];

    for (const pattern of scamPatterns) {
      if (pattern.test(text)) {
        return {
          type: 'SCAM_PATTERN',
          severity: 'CRITICAL',
          confidence: 0.7,
          description: 'Potential scam detected',
        };
      }
    }

    return null;
  }

  /**
   * Integration with OpenAI Moderation API (production)
   */
  async moderateWithOpenAI(text: string): Promise<any> {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return null;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: text }),
      });

      const data = await response.json();
      return data.results[0];
    } catch (error) {
      this.logger.error('OpenAI moderation error', error);
      return null;
    }
  }

  /**
   * Integration with Perspective API (production)
   */
  async moderateWithPerspective(text: string): Promise<any> {
    const apiKey = this.config.get('PERSPECTIVE_API_KEY');
    if (!apiKey) {
      this.logger.warn('Perspective API key not configured');
      return null;
    }

    try {
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: { text },
            requestedAttributes: {
              TOXICITY: {},
              SEVERE_TOXICITY: {},
              IDENTITY_ATTACK: {},
              INSULT: {},
              PROFANITY: {},
              THREAT: {},
            },
          }),
        },
      );

      const data = await response.json();
      return data.attributeScores;
    } catch (error) {
      this.logger.error('Perspective API error', error);
      return null;
    }
  }
}
