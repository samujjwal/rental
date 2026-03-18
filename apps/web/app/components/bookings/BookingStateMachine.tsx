import React from 'react';
import { cn } from '~/lib/utils';
import type { Booking } from '~/types/booking';
import { 
  CheckCircle, 
  Clock, 
  Package, 
  CreditCard, 
  Calendar,
  AlertCircle,
  ArrowRight,
  Loader2,
  XCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type BookingStatusType = Booking['status'];

interface BookingStateStep {
  id: string;
  status: BookingStatusType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isCompleted: boolean;
  isCurrent: boolean;
  isPending: boolean;
  actions?: {
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }[];
}

interface BookingStateMachineProps {
  currentStatus: BookingStatusType;
  userRole: 'renter' | 'owner' | 'admin';
  className?: string;
  onStateAction?: (action: string, bookingId: string) => void;
  bookingId?: string;
  showInlineActions?: boolean;
}

export function BookingStateMachine({ 
  currentStatus, 
  userRole, 
  className,
  onStateAction,
  bookingId,
  showInlineActions = true,
}: BookingStateMachineProps) {
  const { t } = useTranslation();

  const getBookingSteps = (): BookingStateStep[] => {
    const steps: BookingStateStep[] = [
      {
        id: 'requested',
        status: 'PENDING_OWNER_APPROVAL',
        label: t('booking.steps.requested', 'Requested'),
        description: t('booking.steps.requestedDesc', 'Waiting for owner approval'),
        icon: Clock,
        isCompleted: [
          'CONFIRMED',
          'IN_PROGRESS',
          'COMPLETED',
          'SETTLED',
          'CANCELLED'
        ].includes(currentStatus),
        isCurrent: currentStatus === 'PENDING_OWNER_APPROVAL',
        isPending: false,
        actions: userRole === 'owner' ? [
          {
            label: t('booking.actions.approve', 'Approve'),
            action: () => onStateAction?.('approve', bookingId!),
            variant: 'primary'
          },
          {
            label: t('booking.actions.reject', 'Reject'),
            action: () => onStateAction?.('reject', bookingId!),
            variant: 'secondary'
          }
        ] : userRole === 'renter' ? [
          {
            label: t('booking.actions.cancel', 'Cancel'),
            action: () => onStateAction?.('cancel', bookingId!),
            variant: 'secondary'
          }
        ] : undefined
      },
      {
        id: 'payment',
        status: 'PENDING_PAYMENT',
        label: t('booking.steps.payment', 'Payment'),
        description: t('booking.steps.paymentDesc', 'Complete payment to confirm'),
        icon: CreditCard,
        isCompleted: [
          'CONFIRMED',
          'IN_PROGRESS',
          'COMPLETED',
          'SETTLED'
        ].includes(currentStatus),
        isCurrent: currentStatus === 'PENDING_PAYMENT',
        isPending: [
          'PENDING_OWNER_APPROVAL'
        ].includes(currentStatus),
        actions: userRole === 'renter' && currentStatus === 'PENDING_PAYMENT' ? [
          {
            label: t('booking.actions.payNow', 'Pay Now'),
            action: () => onStateAction?.('pay', bookingId!),
            variant: 'primary'
          }
        ] : undefined
      },
      {
        id: 'confirmed',
        status: 'CONFIRMED',
        label: t('booking.steps.confirmed', 'Confirmed'),
        description: t('booking.steps.confirmedDesc', 'Booking confirmed and ready'),
        icon: CheckCircle,
        isCompleted: [
          'IN_PROGRESS',
          'COMPLETED',
          'SETTLED'
        ].includes(currentStatus),
        isCurrent: currentStatus === 'CONFIRMED',
        isPending: [
          'PENDING_OWNER_APPROVAL',
          'PENDING_PAYMENT'
        ].includes(currentStatus),
        actions: userRole === 'owner' && currentStatus === 'CONFIRMED' ? [
          {
            label: t('booking.actions.startRental', 'Start Rental'),
            action: () => onStateAction?.('start', bookingId!),
            variant: 'primary'
          }
        ] : userRole === 'renter' && currentStatus === 'CONFIRMED' ? [
          {
            label: t('booking.actions.cancel', 'Cancel'),
            action: () => onStateAction?.('cancel', bookingId!),
            variant: 'secondary'
          }
        ] : undefined
      },
      {
        id: 'active',
        status: 'IN_PROGRESS',
        label: t('booking.steps.active', 'Active'),
        description: t('booking.steps.activeDesc', 'Rental is in progress'),
        icon: Package,
        isCompleted: [
          'COMPLETED',
          'SETTLED'
        ].includes(currentStatus),
        isCurrent: currentStatus === 'IN_PROGRESS',
        isPending: [
          'PENDING_OWNER_APPROVAL',
          'PENDING_PAYMENT',
          'CONFIRMED'
        ].includes(currentStatus),
        actions: userRole === 'renter' && currentStatus === 'IN_PROGRESS' ? [
          {
            label: t('booking.actions.requestReturn', 'Request Return'),
            action: () => onStateAction?.('requestReturn', bookingId!),
            variant: 'primary'
          }
        ] : undefined
      },
      {
        id: 'completed',
        status: 'COMPLETED',
        label: t('booking.steps.completed', 'Completed'),
        description: t('booking.steps.completedDesc', 'Rental completed successfully'),
        icon: CheckCircle,
        isCompleted: currentStatus === 'SETTLED',
        isCurrent: currentStatus === 'COMPLETED',
        isPending: [
          'PENDING_OWNER_APPROVAL',
          'PENDING_PAYMENT',
          'CONFIRMED',
          'IN_PROGRESS'
        ].includes(currentStatus),
        actions: userRole === 'renter' && currentStatus === 'COMPLETED' ? [
          {
            label: t('booking.actions.leaveReview', 'Leave Review'),
            action: () => onStateAction?.('review', bookingId!),
            variant: 'primary'
          }
        ] : undefined
      },
      {
        id: 'settled',
        status: 'SETTLED',
        label: t('booking.steps.settled', 'Settled'),
        description: t('booking.steps.settledDesc', 'Payment settled and booking closed'),
        icon: CheckCircle,
        isCompleted: currentStatus === 'SETTLED',
        isCurrent: false,
        isPending: true
      }
    ];

    // Handle special states
    if (currentStatus === 'CANCELLED') {
      return steps.map(step => ({
        ...step,
        isCompleted: false,
        isCurrent: false,
        isPending: false
      }));
    }

    if (currentStatus === 'DISPUTED') {
      return steps.map(step => ({
        ...step,
        isCompleted: step.status === 'COMPLETED' || step.status === 'SETTLED',
        isCurrent: false,
        isPending: false
      }));
    }

    return steps;
  };

  const steps = getBookingSteps();
  const currentStepIndex = steps.findIndex(step => step.isCurrent);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* Progress Line */}
        <div className="pointer-events-none absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <div 
            className="h-full bg-success transition-all duration-500 ease-out"
            style={{ 
              width: `${currentStepIndex >= 0 ? (currentStepIndex / (steps.length - 1)) * 100 : 0}%` 
            }}
          />
        </div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = step.isCompleted;
            const isCurrent = step.isCurrent;
            const isPending = step.isPending;

            return (
              <div key={step.id} className="flex flex-col items-center group">
                {/* Step Circle */}
                <div
                  className={cn(
                    "relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                    isCompleted && "bg-success border-success text-success-foreground",
                    isCurrent && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                    isPending && "bg-muted border-muted text-muted-foreground",
                    !isCompleted && !isCurrent && !isPending && "bg-background border-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Step Content */}
                <div className="mt-3 text-center max-w-[120px]">
                  <div className={cn(
                    "text-sm font-medium transition-colors",
                    isCompleted && "text-success",
                    isCurrent && "text-primary",
                    isPending && "text-muted-foreground",
                    !isCompleted && !isCurrent && !isPending && "text-muted-foreground"
                  )}>
                    {step.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 hidden sm:block">
                    {step.description}
                  </div>
                </div>

                {/* Actions Dropdown */}
                {showInlineActions && step.actions && step.actions.length > 0 && (
                  <div className="absolute top-12 left-1/2 z-20 hidden -translate-x-1/2 transform group-hover:block">
                    <div className="bg-popover border rounded-md shadow-lg p-2 min-w-[140px]">
                      {step.actions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          onClick={action.action}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm rounded transition-colors",
                            action.variant === 'primary' 
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connector Arrow */}
                {index < steps.length - 1 && (
                  <div className="pointer-events-none absolute top-5 left-12 right-[-12px] flex items-center justify-center">
                    <ArrowRight 
                      className={cn(
                        "w-4 h-4 transition-colors",
                        isCompleted ? "text-success" : "text-muted-foreground"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Status Alert */}
      {currentStatus === 'DISPUTED' && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900">
                {t('booking.disputeTitle', 'Dispute in Progress')}
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                {t('booking.disputeDesc', 'This booking is currently under dispute resolution.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStatus === 'CANCELLED' && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">
                {t('booking.cancelledTitle', 'Booking Cancelled')}
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {t('booking.cancelledDesc', 'This booking has been cancelled.')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
