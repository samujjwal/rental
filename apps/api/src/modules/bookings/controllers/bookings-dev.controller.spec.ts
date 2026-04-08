import { Test, TestingModule } from '@nestjs/testing';
import { BookingsDevController } from './bookings-dev.controller';
import { BookingStateMachineService } from '../services/booking-state-machine.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JwtAuthGuard } from '@/common/auth';
import { ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@rental-portal/database';

// Mock types for testing
interface MockStateMachineResult {
  success: boolean;
  newState: BookingStatus;
  message: string;
  errors?: string[];
}

describe('BookingsDevController', () => {
  let controller: BookingsDevController;
  let stateMachine: jest.Mocked<BookingStateMachineService>;
  let prisma: any;

  const mockUser = {
    id: 'user-123',
    role: 'USER',
    email: 'test@example.com',
  };

  const mockAdmin = {
    id: 'admin-123',
    role: 'ADMIN',
    email: 'admin@example.com',
  };

  const mockBooking = {
    id: 'booking-123',
    renterId: 'user-123',
    listing: { ownerId: 'owner-123' },
    status: BookingStatus.PENDING_PAYMENT,
  };

  beforeEach(async () => {
    const mockStateMachine = {
      transition: jest.fn(),
    };

    const mockPrisma = {
      booking: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsDevController],
      providers: [
        { provide: BookingStateMachineService, useValue: mockStateMachine },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BookingsDevController>(BookingsDevController);
    stateMachine = module.get(BookingStateMachineService) as jest.Mocked<BookingStateMachineService>;
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bypassConfirm', () => {
    it('should successfully bypass confirm booking for authorized renter', async () => {
      // Arrange
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      const mockResult: MockStateMachineResult = {
        success: true,
        newState: BookingStatus.CONFIRMED,
        message: 'Booking confirmed successfully'
      };
      stateMachine.transition.mockResolvedValue(mockResult);

      // Act
      const result = await controller.bypassConfirm('booking-123', mockUser.id, mockUser.role);

      // Assert
      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        include: { listing: { select: { ownerId: true } } },
      });
      expect(stateMachine.transition).toHaveBeenCalledWith(
        'booking-123',
        'COMPLETE_PAYMENT',
        'user-123',
        'RENTER'
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw ForbiddenException when booking does not exist', async () => {
      // Arrange
      prisma.booking.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        controller.bypassConfirm('non-existent-booking', mockUser.id, mockUser.role)
      ).rejects.toThrow('You are not authorized for this booking action');

      expect(stateMachine.transition).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not the renter', async () => {
      // Arrange
      const otherUserBooking = {
        ...mockBooking,
        renterId: 'other-user-456',
      };
      prisma.booking.findUnique.mockResolvedValue(otherUserBooking);

      // Act & Assert
      await expect(
        controller.bypassConfirm('booking-123', mockUser.id, mockUser.role)
      ).rejects.toThrow('You are not authorized for this booking action');

      expect(stateMachine.transition).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when admin tries to bypass confirm', async () => {
      // Arrange
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      // Act & Assert
      await expect(
        controller.bypassConfirm('booking-123', mockAdmin.id, mockAdmin.role)
      ).rejects.toThrow('You are not authorized for this booking action');

      expect(stateMachine.transition).not.toHaveBeenCalled();
    });

    it('should handle state machine transition errors', async () => {
      // Arrange
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      stateMachine.transition.mockRejectedValue(new Error('Invalid transition'));

      // Act & Assert
      await expect(
        controller.bypassConfirm('booking-123', mockUser.id, mockUser.role)
      ).rejects.toThrow('Invalid transition');

      expect(stateMachine.transition).toHaveBeenCalledWith(
        'booking-123',
        'COMPLETE_PAYMENT',
        'user-123',
        'RENTER'
      );
    });

    it('should handle database connection errors', async () => {
      // Arrange
      prisma.booking.findUnique.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(
        controller.bypassConfirm('booking-123', mockUser.id, mockUser.role)
      ).rejects.toThrow('Database connection failed');

      expect(stateMachine.transition).not.toHaveBeenCalled();
    });
  });

  describe('devReset', () => {
    it('should successfully reset all non-final bookings for admin', async () => {
      // Arrange
      prisma.booking.updateMany.mockResolvedValue({ count: 5 });

      // Act
      const result = await controller.devReset(mockAdmin.role);

      // Assert
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
        },
        data: { status: BookingStatus.CANCELLED },
      });
      expect(result).toEqual({ cancelled: 5 });
    });

    it('should successfully reset for SUPER_ADMIN', async () => {
      // Arrange
      const superAdmin = { ...mockAdmin, role: 'SUPER_ADMIN' };
      prisma.booking.updateMany.mockResolvedValue({ count: 3 });

      // Act
      const result = await controller.devReset(superAdmin.role);

      // Assert
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
        },
        data: { status: BookingStatus.CANCELLED },
      });
      expect(result).toEqual({ cancelled: 3 });
    });

    it('should successfully reset for OPERATIONS_ADMIN', async () => {
      // Arrange
      const opsAdmin = { ...mockAdmin, role: 'OPERATIONS_ADMIN' };
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await controller.devReset(opsAdmin.role);

      // Assert
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
        },
        data: { status: BookingStatus.CANCELLED },
      });
      expect(result).toEqual({ cancelled: 1 });
    });

    it('should throw ForbiddenException for non-admin users', async () => {
      // Act & Assert
      await expect(controller.devReset(mockUser.role)).rejects.toThrow(
        'dev-reset requires an admin session'
      );

      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for users with no role', async () => {
      // Act & Assert
      await expect(controller.devReset('')).rejects.toThrow(
        'dev-reset requires an admin session'
      );

      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it('should handle database errors during reset', async () => {
      // Arrange
      prisma.booking.updateMany.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(controller.devReset(mockAdmin.role)).rejects.toThrow(
        'Database connection failed'
      );

      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
        },
        data: { status: BookingStatus.CANCELLED },
      });
    });

    it('should return zero when no bookings to reset', async () => {
      // Arrange
      prisma.booking.updateMany.mockResolvedValue({ count: 0 });

      // Act
      const result = await controller.devReset(mockAdmin.role);

      // Assert
      expect(result).toEqual({ cancelled: 0 });
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
        },
        data: { status: BookingStatus.CANCELLED },
      });
    });
  });

  describe('Role Validation Edge Cases', () => {
    it('should handle lowercase admin role', async () => {
      // Arrange
      const lowercaseAdmin = { ...mockAdmin, role: 'admin' };
      prisma.booking.updateMany.mockResolvedValue({ count: 2 });

      // Act
      const result = await controller.devReset(lowercaseAdmin.role);

      // Assert
      expect(result).toEqual({ cancelled: 2 });
    });

    it('should handle mixed case admin role', async () => {
      // Arrange
      const mixedCaseAdmin = { ...mockAdmin, role: 'AdMiN' };
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await controller.devReset(mixedCaseAdmin.role);

      // Assert
      expect(result).toEqual({ cancelled: 1 });
    });

    it('should handle undefined role', async () => {
      // Act & Assert
      await expect(controller.devReset(undefined)).rejects.toThrow(
        'dev-reset requires an admin session'
      );
    });

    it('should handle null role', async () => {
      // Act & Assert
      await expect(controller.devReset(null)).rejects.toThrow(
        'dev-reset requires an admin session'
      );
    });
  });

  describe('Booking Status Edge Cases', () => {
    it('should bypass confirm regardless of current booking status', async () => {
      // Arrange
      const differentStatusBooking = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      };
      prisma.booking.findUnique.mockResolvedValue(differentStatusBooking);
      const mockResult: MockStateMachineResult = {
        success: true,
        newState: BookingStatus.CONFIRMED,
        message: 'Booking confirmed successfully'
      };
      stateMachine.transition.mockResolvedValue(mockResult);

      // Act
      const result = await controller.bypassConfirm('booking-123', mockUser.id, mockUser.role);

      // Assert
      expect(stateMachine.transition).toHaveBeenCalledWith(
        'booking-123',
        'COMPLETE_PAYMENT',
        'user-123',
        'RENTER'
      );
      expect(result).toEqual(mockResult);
    });

    it('should not include already cancelled bookings in dev reset', async () => {
      // Arrange
      prisma.booking.updateMany.mockResolvedValue({ count: 3 });

      // Act
      const result = await controller.devReset(mockAdmin.role);

      // Assert
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
        },
        data: { status: BookingStatus.CANCELLED },
      });
      expect(result).toEqual({ cancelled: 3 });
    });
  });
});
