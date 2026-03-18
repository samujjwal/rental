import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
   * Uses LLM-based classification when OPENAI_API_KEY is available,
   * falls back to keyword pattern matching.
   */
  async classifyIntent(message: string): Promise<{ name: string; confidence: number }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (apiKey) {
      return this.classifyIntentWithLLM(message, apiKey);
    }

    return this.classifyIntentWithPatterns(message);
  }

  /**
   * LLM-based intent classification using OpenAI function calling.
   */
  private async classifyIntentWithLLM(
    message: string,
    apiKey: string,
  ): Promise<{ name: string; confidence: number }> {
    try {
      const model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-3.5-turbo';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Classify the user message into exactly one of these intents: SEARCH_LISTING, BOOKING_HELP, PRICE_INQUIRY, DISPUTE_HELP, HOST_ADVICE, RECOMMENDATION, ACCOUNT_HELP, GENERAL. Respond with JSON: {"intent":"...","confidence":0.0-1.0}',
            },
            { role: 'user', content: message },
          ],
          max_tokens: 60,
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        this.logger.warn(`OpenAI intent classification failed: ${response.status}`);
        return this.classifyIntentWithPatterns(message);
      }

      const data = await response.json();
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
      if (parsed.intent) {
        return { name: parsed.intent, confidence: parsed.confidence ?? 0.9 };
      }
    } catch (error) {
      this.logger.warn('LLM intent classification error, falling back to patterns', error);
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
   * Generate an AI response using OpenAI LLM with conversation history.
   * Falls back to template responses when no API key is configured.
   */
  async generateResponse(
    intent: { name: string; confidence: number },
    message: string,
    context: Record<string, any>,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ text: string; suggestions: string[] }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (apiKey) {
      return this.generateResponseWithLLM(intent, message, context, history, apiKey);
    }

    return this.generateTemplateResponse(intent);
  }

  /**
   * LLM-powered response generation with full conversation context.
   */
  private async generateResponseWithLLM(
    intent: { name: string; confidence: number },
    message: string,
    context: Record<string, any>,
    history: Array<{ role: string; content: string }>,
    apiKey: string,
  ): Promise<{ text: string; suggestions: string[] }> {
    try {
      const model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-3.5-turbo';

      const systemPrompt = `You are a helpful AI concierge for a global rental platform (like Airbnb). 
Your role is to assist users with finding rentals, booking help, pricing questions, dispute resolution, hosting advice, and general platform guidance.

Current intent: ${intent.name} (confidence: ${intent.confidence})
User context: ${JSON.stringify(context)}

Guidelines:
- Be concise, warm, and professional
- Provide actionable information
- If the user asks about specific listings, guide them to search
- For disputes, be empathetic and guide through the resolution process
- For pricing, explain factors that affect pricing (location, season, demand)
- Always end with a helpful suggestion or next step
- Keep responses under 150 words

Also provide exactly 3 short suggested follow-up actions as a JSON array in this format:
Respond ONLY with valid JSON: {"text":"your response","suggestions":["action1","action2","action3"]}`;

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history (last 10 turns)
      const recentHistory = history.slice(-10);
      for (const turn of recentHistory) {
        messages.push({
          role: turn.role === 'user' ? 'user' : 'assistant',
          content: turn.content,
        });
      }

      // Add current message
      messages.push({ role: 'user', content: message });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 300,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        this.logger.warn(`OpenAI response generation failed: ${response.status}`);
        return this.generateTemplateResponse(intent);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();

      if (content) {
        try {
          const parsed = JSON.parse(content);
          return {
            text: parsed.text || content,
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          };
        } catch {
          // If JSON parsing fails, use raw text
          return { text: content, suggestions: [] };
        }
      }
    } catch (error) {
      this.logger.error('LLM response generation failed', error);
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
