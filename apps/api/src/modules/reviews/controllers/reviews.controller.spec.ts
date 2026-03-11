import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from '../services/reviews.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: jest.Mocked<ReviewsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: {
            create: jest.fn(),
            getReview: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            getListingReviews: jest.fn(),
            getUserReviews: jest.fn(),
            getPublicUserReviews: jest.fn(),
            getBookingReviews: jest.fn(),
            canUserReviewBooking: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ReviewsController);
    service = module.get(ReviewsService) as jest.Mocked<ReviewsService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create ──

  describe('create', () => {
    it('passes userId and dto to service', async () => {
      const dto = { bookingId: 'b1', rating: 5, comment: 'Great!' };
      service.create.mockResolvedValue({ id: 'r1', ...dto } as any);
      const result = await controller.create('u1', dto as any);
      expect(service.create).toHaveBeenCalledWith('u1', dto);
      expect(result.id).toBe('r1');
    });

    it('propagates validation error', async () => {
      service.create.mockRejectedValue(new Error('Booking not completed'));
      await expect(controller.create('u1', {} as any)).rejects.toThrow('Booking not completed');
    });
  });

  // ── getReview ──

  describe('getReview', () => {
    it('returns review by id', async () => {
      service.getReview.mockResolvedValue({ id: 'r1', rating: 4 } as any);
      const result = await controller.getReview('r1');
      expect(result).toEqual({ id: 'r1', rating: 4 });
    });

    it('propagates not-found error', async () => {
      service.getReview.mockRejectedValue(new Error('Not found'));
      await expect(controller.getReview('999')).rejects.toThrow('Not found');
    });
  });

  // ── update ──

  describe('update', () => {
    it('passes id, userId and dto', async () => {
      const dto = { comment: 'Updated' };
      service.update.mockResolvedValue({ id: 'r1', comment: 'Updated' } as any);
      await controller.update('r1', 'u1', dto as any);
      expect(service.update).toHaveBeenCalledWith('r1', 'u1', dto);
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('passes id and userId', async () => {
      await controller.delete('r1', 'u1');
      expect(service.delete).toHaveBeenCalledWith('r1', 'u1');
    });
  });

  // ── getListingReviews ──

  describe('getListingReviews', () => {
    it('delegates to service with pagination', async () => {
      service.getListingReviews.mockResolvedValue({ data: [] as any[], total: 0 } as any);
      await controller.getListingReviews('l1', 2, 10);
      expect(service.getListingReviews).toHaveBeenCalledWith('l1', 2, 10);
    });
  });

  // ── getUserReviews ──

  describe('getUserReviews', () => {
    it('passes type (received) to service', async () => {
      service.getUserReviews.mockResolvedValue({ data: [] as any[] } as any);
      await controller.getUserReviews('u1', { id: 'u1', role: 'USER' }, 'received', 1, 20);
      expect(service.getUserReviews).toHaveBeenCalledWith('u1', 'received', 1, 20, undefined);
    });

    it('passes type (given) to service', async () => {
      service.getUserReviews.mockResolvedValue({ data: [] as any[] } as any);
      await controller.getUserReviews('u1', { id: 'u1', role: 'USER' }, 'given');
      expect(service.getUserReviews).toHaveBeenCalledWith('u1', 'given', undefined, undefined, undefined);
    });

    it('passes rating filter to service', async () => {
      service.getUserReviews.mockResolvedValue({ data: [] as any[] } as any);
      await controller.getUserReviews('u1', { id: 'u1', role: 'USER' }, 'received', 1, 10, 5);
      expect(service.getUserReviews).toHaveBeenCalledWith('u1', 'received', 1, 10, 5);
    });

    it('throws ForbiddenException when non-admin requests another user reviews', async () => {
      await expect(
        controller.getUserReviews('u2', { id: 'u1', role: 'USER' }, 'received'),
      ).rejects.toThrow('You can only view your own reviews');
    });

    it('allows admin to view any user reviews', async () => {
      service.getUserReviews.mockResolvedValue({ data: [] as any[] } as any);
      await controller.getUserReviews('u2', { id: 'u1', role: 'ADMIN' }, 'received');
      expect(service.getUserReviews).toHaveBeenCalledWith('u2', 'received', undefined, undefined, undefined);
    });
  });

  // ── getPublicUserReviews ──

  describe('getPublicUserReviews', () => {
    it('delegates to service', async () => {
      service.getPublicUserReviews.mockResolvedValue({ data: [] as any[] } as any);
      await controller.getPublicUserReviews('u1', 1, 10);
      expect(service.getPublicUserReviews).toHaveBeenCalledWith('u1', 1, 10);
    });
  });

  // ── getBookingReviews ──

  describe('getBookingReviews', () => {
    it('delegates to service', async () => {
      service.getBookingReviews.mockResolvedValue([{ id: 'r1' }] as any);
      await controller.getBookingReviews('b1', 'u1');
      expect(service.getBookingReviews).toHaveBeenCalledWith('b1', 'u1');
    });
  });

  // ── canReviewBooking ──

  describe('canReviewBooking', () => {
    it('checks eligibility', async () => {
      service.canUserReviewBooking.mockResolvedValue({ canReview: true, reason: null } as any);
      const result = await controller.canReviewBooking('b1', 'u1');
      expect(service.canUserReviewBooking).toHaveBeenCalledWith('u1', 'b1');
      expect(result).toEqual({ canReview: true, reason: null });
    });
  });
});
