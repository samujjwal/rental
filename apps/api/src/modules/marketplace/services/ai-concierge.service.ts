import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AI_PROVIDER_PORT,
  type AiProviderPort,
} from '../../ai/ports/ai-provider.port';
import {
  PROMPT_CONCIERGE_INTENT_CLASSIFY,
  PROMPT_CONCIERGE_GENERATE_RESPONSE,
} from '../../ai/prompts/prompt-registry';

/**
 * AI Concierge Agent System (V5 Prompt 3)
 *
 * Provides AI-powered assistance for renters and hosts:
 * - Personalized listing discovery
 * - Booking assistance
 * - Dynamic recommendations
 * - Automated dispute guidance
 */
@Injectable()
export class AiConciergeService {
  private readonly logger = new Logger(AiConciergeService.name);
  private readonly supportedAgentTypes = new Set([
    'GENERAL',
    'BOOKING_ASSISTANT',
    'HOST_ADVISOR',
    'DISPUTE_GUIDE',
    'CONCIERGE',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(AI_PROVIDER_PORT) private readonly aiProvider: AiProviderPort,
  ) {}

  /**
   * Start a new AI conversation session.
   */
  async startSession(
    userId: string,
    agentType: string = 'GENERAL',
    initialContext: Record<string, any> = {},
  ) {
    const sessionId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const normalizedAgentType = this.supportedAgentTypes.has(agentType)
      ? agentType
      : 'GENERAL';

    const conversation = await this.prisma.aiConversation.create({
      data: {
        userId,
        sessionId,
        agentType: normalizedAgentType as any,
        context: initialContext,
        status: 'ACTIVE',
        messageCount: 0,
      },
    });

    this.eventEmitter.emit('ai.session.started', {
      conversationId: conversation.id,
      userId,
      agentType: normalizedAgentType,
    });

    return conversation;
  }

  /**
   * Process a user message and generate an AI response.
   */
  async processMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<{
    response: string;
    intent: string | null;
    confidence: number;
    suggestions: string[];
  }> {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { sessionId },
      include: { turns: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Save user turn
    await this.prisma.aiConversationTurn.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: userMessage,
      },
    });

    // Classify intent (LLM-powered when available)
    const intent = await this.classifyIntent(userMessage);

    // Generate response based on intent and context
    const response = await this.generateResponse(
      intent,
      userMessage,
      conversation.context as Record<string, any>,
      conversation.turns.map((t) => ({ role: t.role, content: t.content })),
    );

    // Save assistant turn
    await this.prisma.aiConversationTurn.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.text,
        intent: intent.name,
        confidence: intent.confidence,
      },
    });

    // Update conversation
    await this.prisma.aiConversation.update({
      where: { sessionId },
      data: {
        messageCount: { increment: 2 },
        resolvedIntent: intent.name,
      },
    });

    return {
      response: response.text,
      intent: intent.name,
      confidence: intent.confidence,
      suggestions: response.suggestions,
    };
  }

  /**
   * Classify user intent from message text.
   * Uses AI provider when available, falls back to keyword pattern matching.
   */
  async classifyIntent(message: string): Promise<{ name: string; confidence: number }> {
    const { promptId, version: promptVersion, systemPrompt } = PROMPT_CONCIERGE_INTENT_CLASSIFY;

    const result = await this.aiProvider.complete({
      promptId,
      promptVersion,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      maxTokens: 60,
      temperature: 0,
    });

    if (result.fromProvider && result.content) {
      try {
        const parsed = JSON.parse(result.content) as { intent?: string; confidence?: number };
        if (parsed.intent) {
          return { name: parsed.intent, confidence: parsed.confidence ?? 0.9 };
        }
      } catch {
        this.logger.warn(
          `LLM intent response not valid JSON [${promptId}@${promptVersion}]: ${result.content}`,
        );
      }
    }

    return this.classifyIntentWithPatterns(message);
  }

  /**
   * Keyword-based intent classification fallback.
   */
  private classifyIntentWithPatterns(message: string): { name: string; confidence: number } {
    const lower = message.toLowerCase();

    const intentPatterns: Array<{ name: string; patterns: string[]; confidence: number }> = [
      { name: 'SEARCH_LISTING', patterns: ['find', 'search', 'looking for', 'show me', 'available'], confidence: 0.85 },
      { name: 'BOOKING_HELP', patterns: ['book', 'reserve', 'how to book', 'booking'], confidence: 0.85 },
      { name: 'PRICE_INQUIRY', patterns: ['price', 'cost', 'how much', 'rate', 'fee'], confidence: 0.80 },
      { name: 'DISPUTE_HELP', patterns: ['dispute', 'complaint', 'problem', 'issue', 'refund'], confidence: 0.80 },
      { name: 'HOST_ADVICE', patterns: ['host', 'list my', 'become a host', 'listing tips'], confidence: 0.75 },
      { name: 'RECOMMENDATION', patterns: ['recommend', 'suggest', 'best', 'top rated'], confidence: 0.75 },
      { name: 'ACCOUNT_HELP', patterns: ['account', 'profile', 'password', 'login', 'verify'], confidence: 0.70 },
    ];

    for (const intent of intentPatterns) {
      if (intent.patterns.some((p) => lower.includes(p))) {
        return { name: intent.name, confidence: intent.confidence };
      }
    }

    return { name: 'GENERAL', confidence: 0.5 };
  }

  /**
   * Generate an AI response using the AI provider with conversation history.
   * Falls back to template responses when the provider is unavailable.
   */
  async generateResponse(
    intent: { name: string; confidence: number },
    message: string,
    context: Record<string, any>,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ text: string; suggestions: string[] }> {
    const { promptId, version: promptVersion, systemPrompt } = PROMPT_CONCIERGE_GENERATE_RESPONSE;

    // Build messages: base system prompt + dynamic context + history + user message
    const dynamicContext =
      `Current intent: ${intent.name} (confidence: ${intent.confidence})\n` +
      `User context: ${JSON.stringify(context)}\n\n` +
      `Also provide exactly 3 short suggested follow-up actions. ` +
      `Respond ONLY with valid JSON: {"text":"your response","suggestions":["action1","action2","action3"]}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: dynamicContext },
      // Last 10 conversation turns
      ...history.slice(-10).map((t) => ({
        role: (t.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: t.content,
      })),
      { role: 'user', content: message },
    ];

    const result = await this.aiProvider.complete({
      promptId,
      promptVersion,
      messages,
      maxTokens: 300,
      temperature: 0.7,
    });

    if (result.fromProvider && result.content) {
      try {
        const parsed = JSON.parse(result.content) as { text?: string; suggestions?: string[] };
        return {
          text: parsed.text || result.content,
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        };
      } catch {
        // JSON parse failed; use raw content as plain text
        return { text: result.content, suggestions: [] };
      }
    }

    return this.generateTemplateResponse(intent);
  }

  /**
   * Template-based response fallback (no LLM required).
   */
  private generateTemplateResponse(
    intent: { name: string; confidence: number },
  ): { text: string; suggestions: string[] } {
    const responses: Record<string, { text: string; suggestions: string[] }> = {
      SEARCH_LISTING: {
        text: 'I can help you find the perfect rental! Could you tell me your preferred location, dates, and budget?',
        suggestions: ['Search by location', 'Filter by price', 'Show me recommendations'],
      },
      BOOKING_HELP: {
        text: 'I\'d be happy to help with your booking. You can select dates on any listing page and proceed to checkout. Would you like me to walk you through the process?',
        suggestions: ['View my bookings', 'How to cancel', 'Payment options'],
      },
      PRICE_INQUIRY: {
        text: 'Pricing varies by location, season, and property type. I can help you find options within your budget. What\'s your price range?',
        suggestions: ['Budget options', 'Premium listings', 'Price comparison'],
      },
      DISPUTE_HELP: {
        text: 'I\'m sorry to hear you\'re experiencing an issue. I can guide you through our dispute resolution process. What happened?',
        suggestions: ['File a dispute', 'Check dispute status', 'Contact support'],
      },
      HOST_ADVICE: {
        text: 'Becoming a host is a great way to earn! I can help you optimize your listing. What would you like to know?',
        suggestions: ['Listing tips', 'Pricing strategy', 'Host requirements'],
      },
      RECOMMENDATION: {
        text: 'Based on your preferences, I can suggest some great options. Let me check what\'s available in your preferred areas.',
        suggestions: ['Top rated', 'New listings', 'Popular this week'],
      },
      ACCOUNT_HELP: {
        text: 'I can help with your account. What do you need assistance with?',
        suggestions: ['Update profile', 'Verify identity', 'Change password'],
      },
      GENERAL: {
        text: 'I\'m here to help! I can assist with finding rentals, booking questions, hosting advice, or resolving issues. What would you like help with?',
        suggestions: ['Find a rental', 'My bookings', 'Become a host', 'Get help'],
      },
    };

    return responses[intent.name] || responses.GENERAL;
  }

  /**
   * Get personalized listing recommendations for a user.
   */
  async getRecommendations(userId: string, limit: number = 10) {
    // Get user search profile
    const profile = await this.prisma.userSearchProfile.findUnique({
      where: { userId },
    });

    // Get recent bookings for preference signals
    const recentBookings = await this.prisma.booking.findMany({
      where: { renterId: userId },
      include: { listing: { select: { categoryId: true, country: true, city: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const preferredCategories = recentBookings
      .map((b) => b.listing?.categoryId)
      .filter(Boolean);
    const preferredCities = recentBookings
      .map((b) => b.listing?.city)
      .filter(Boolean);

    // Find matching listings
    return this.prisma.listing.findMany({
      where: {
        status: 'AVAILABLE',
        deletedAt: null,
        ...(preferredCategories.length
          ? { categoryId: { in: preferredCategories as string[] } }
          : {}),
        ...(preferredCities.length
          ? { city: { in: preferredCities as string[] } }
          : {}),
      },
      orderBy: [{ averageRating: 'desc' }, { viewCount: 'desc' }],
      take: limit,
    });
  }

  /**
   * End a conversation session.
   */
  async endSession(sessionId: string, satisfaction?: number) {
    const updated = await this.prisma.aiConversation.update({
      where: { sessionId },
      data: {
        status: 'RESOLVED',
        satisfaction,
      },
    });

    this.eventEmitter.emit('ai.session.ended', {
      conversationId: updated.id,
      satisfaction,
    });

    return updated;
  }

  /**
   * Get conversation history for a session.
   */
  async getConversationHistory(sessionId: string) {
    return this.prisma.aiConversation.findUnique({
      where: { sessionId },
      include: { turns: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
