import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SendMessageDto, CreateConversationDto } from './messaging.dto';

describe('Messaging DTOs', () => {
  describe('SendMessageDto', () => {
    const validData = {
      conversationId: 'conv-123',
      content: 'Hello, is this item still available?',
    };

    it('passes with valid data', async () => {
      const dto = plainToInstance(SendMessageDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional attachments', async () => {
      const dto = plainToInstance(SendMessageDto, {
        ...validData,
        attachments: ['https://files.co/img1.jpg', 'https://files.co/img2.jpg'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when conversationId is missing', async () => {
      const dto = plainToInstance(SendMessageDto, { content: 'message' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'conversationId')).toBe(true);
    });

    it('fails when conversationId is empty string', async () => {
      const dto = plainToInstance(SendMessageDto, { conversationId: '', content: 'message' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'conversationId')).toBe(true);
    });

    it('fails when content is missing', async () => {
      const dto = plainToInstance(SendMessageDto, { conversationId: 'conv-1' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('fails when content exceeds 2000 chars', async () => {
      const dto = plainToInstance(SendMessageDto, {
        conversationId: 'conv-1',
        content: 'M'.repeat(2001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('passes when content is exactly 2000 chars', async () => {
      const dto = plainToInstance(SendMessageDto, {
        conversationId: 'conv-1',
        content: 'M'.repeat(2000),
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when attachments contain non-strings', async () => {
      const dto = plainToInstance(SendMessageDto, {
        ...validData,
        attachments: [123, true],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'attachments')).toBe(true);
    });

    it('passes with empty attachments array', async () => {
      const dto = plainToInstance(SendMessageDto, { ...validData, attachments: [] });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('CreateConversationDto', () => {
    const validData = {
      listingId: 'listing-abc',
      participantId: 'user-xyz',
    };

    it('passes with valid data', async () => {
      const dto = plainToInstance(CreateConversationDto, validData);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when listingId is missing', async () => {
      const dto = plainToInstance(CreateConversationDto, { participantId: 'user-1' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingId')).toBe(true);
    });

    it('fails when listingId is empty string', async () => {
      const dto = plainToInstance(CreateConversationDto, {
        listingId: '',
        participantId: 'user-1',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'listingId')).toBe(true);
    });

    it('fails when participantId is missing', async () => {
      const dto = plainToInstance(CreateConversationDto, { listingId: 'listing-1' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'participantId')).toBe(true);
    });

    it('fails when participantId is empty string', async () => {
      const dto = plainToInstance(CreateConversationDto, {
        listingId: 'listing-1',
        participantId: '',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'participantId')).toBe(true);
    });
  });
});
