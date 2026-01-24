# Integration Example: Listing Creation Flow

This document demonstrates how the new modules (Organizations, Fraud Detection, Tax, Moderation, Insurance) integrate with existing features in a real-world scenario.

## Scenario: Creating a New Vehicle Listing

### Flow Diagram

```
User Submits Listing
      ↓
[1] Fraud Detection Check
      ↓
[2] Content Moderation
      ↓
[3] Insurance Requirement Check
      ↓
[4] Tax Configuration
      ↓
[5] Create Listing
      ↓
[6] Send Notifications
      ↓
Listing Published/Pending
```

---

## Complete Implementation

### API Endpoint: POST /api/listings

```typescript
// apps/api/src/modules/listings/listings.controller.ts

@Post()
@UseGuards(JwtAuthGuard)
async createListing(
  @CurrentUser('sub') userId: string,
  @Body() createListingDto: CreateListingDto,
) {
  // [1] FRAUD DETECTION: Check user risk
  const fraudCheck = await this.fraudDetectionService.checkUserRisk(userId);
  
  if (fraudCheck.riskLevel === 'CRITICAL') {
    throw new ForbiddenException('Account flagged for suspicious activity');
  }

  if (fraudCheck.riskLevel === 'HIGH') {
    // Require additional verification
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.emailVerified || !user.phoneVerified) {
      throw new BadRequestException(
        'Please verify your email and phone before creating listings'
      );
    }
  }

  // [2] CONTENT MODERATION: Check listing content
  const moderationResult = await this.moderationService.moderateListing({
    title: createListingDto.title,
    description: createListingDto.description,
    photos: createListingDto.photos,
    userId,
  });

  if (moderationResult.status === 'REJECTED') {
    throw new BadRequestException(
      `Listing blocked: ${moderationResult.blockedReasons?.join(', ')}`
    );
  }

  // Listings flagged for review are created but not published
  const listingStatus =
    moderationResult.status === 'APPROVED' ? 'ACTIVE' : 'PENDING_REVIEW';

  // [3] INSURANCE: Check if insurance required
  const category = await this.categoriesService.findOne(
    createListingDto.categoryId,
  );
  
  const insuranceRequirement =
    await this.insuranceService.checkInsuranceRequirement({
      category: category.name,
      pricePerDay: createListingDto.pricePerDay,
    });

  if (insuranceRequirement.required) {
    // Listing can be created but not activated until insurance verified
    await this.notificationService.sendNotification({
      userId,
      type: 'listing.insurance_required',
      title: 'Insurance Required',
      message: `Your listing requires ${insuranceRequirement.type} insurance with minimum coverage of $${insuranceRequirement.minimumCoverage}`,
      data: { insuranceRequirement },
      channels: ['email', 'in-app'],
    });
  }

  // [4] TAX CONFIGURATION: Set up tax calculation for listing
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { country: true, state: true, city: true },
  });

  const taxConfig = {
    country: user.country,
    state: user.state,
    // Tax will be calculated per-booking based on listing location
  };

  // [5] CREATE LISTING
  const listing = await this.prisma.listing.create({
    data: {
      ...createListingDto,
      ownerId: userId,
      status: listingStatus,
      metadata: {
        moderationStatus: moderationResult.status,
        moderationFlags: moderationResult.flags,
        insuranceRequired: insuranceRequirement.required,
        insuranceType: insuranceRequirement.type,
        minimumCoverage: insuranceRequirement.minimumCoverage,
        taxConfig,
        fraudRiskLevel: fraudCheck.riskLevel,
      },
    },
  });

  // [6] SEND NOTIFICATIONS
  if (listingStatus === 'ACTIVE') {
    // Listing approved and live
    await this.notificationService.sendNotification({
      userId,
      type: 'listing.published',
      title: 'Listing Published!',
      message: `Your listing "${listing.title}" is now live`,
      data: { listingId: listing.id },
      channels: ['email', 'push', 'in-app'],
    });
  } else if (listingStatus === 'PENDING_REVIEW') {
    // Listing flagged for manual review
    await this.notificationService.sendNotification({
      userId,
      type: 'listing.pending_review',
      title: 'Listing Under Review',
      message: `Your listing "${listing.title}" is being reviewed by our team`,
      data: { listingId: listing.id },
      channels: ['email', 'in-app'],
    });
  }

  // Emit event for analytics
  this.eventEmitter.emit('listing.created', {
    listing,
    moderationResult,
    insuranceRequirement,
    fraudCheck,
  });

  return {
    listing,
    status: listingStatus,
    requiresInsurance: insuranceRequirement.required,
    insuranceRequirement: insuranceRequirement.required
      ? insuranceRequirement
      : undefined,
  };
}
```

---

## Scenario 2: Processing a Booking

### Flow Diagram

```
Renter Creates Booking
      ↓
[1] Fraud Detection (Booking Risk)
      ↓
[2] Insurance Validation
      ↓
[3] Tax Calculation
      ↓
[4] Payment Authorization
      ↓
[5] Create Booking
      ↓
[6] State Machine: PENDING_OWNER_APPROVAL
      ↓
[7] Notifications (Owner + Renter)
      ↓
Booking Created
```

### Implementation

```typescript
// apps/api/src/modules/bookings/bookings.controller.ts

@Post()
@UseGuards(JwtAuthGuard)
async createBooking(
  @CurrentUser('sub') renterId: string,
  @Body() createBookingDto: CreateBookingDto,
) {
  const { listingId, startDate, endDate, message } = createBookingDto;

  // Get listing details
  const listing = await this.prisma.listing.findUnique({
    where: { id: listingId },
    include: { owner: true, category: true },
  });

  if (!listing) {
    throw new NotFoundException('Listing not found');
  }

  // Calculate price
  const days = differenceInDays(new Date(endDate), new Date(startDate));
  const subtotal = listing.pricePerDay * days;

  // [1] FRAUD DETECTION: Check booking risk
  const fraudCheck = await this.fraudDetectionService.checkBookingRisk({
    userId: renterId,
    listingId,
    totalPrice: subtotal,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  if (!fraudCheck.allowBooking) {
    await this.notificationService.sendNotification({
      userId: renterId,
      type: 'booking.blocked',
      title: 'Booking Blocked',
      message: 'This booking could not be processed. Please contact support.',
      channels: ['email', 'in-app'],
    });

    throw new ForbiddenException('Booking blocked due to risk assessment');
  }

  if (fraudCheck.riskLevel === 'HIGH') {
    // Require additional verification or deposit
    const user = await this.prisma.user.findUnique({ where: { id: renterId } });
    if (!user.idVerified) {
      throw new BadRequestException('ID verification required for this booking');
    }
  }

  // [2] INSURANCE VALIDATION
  const insuranceMetadata = listing.metadata as any;
  if (insuranceMetadata?.insuranceRequired) {
    const hasValidInsurance = await this.insuranceService.hasValidInsurance(
      listingId,
    );

    if (!hasValidInsurance) {
      throw new BadRequestException(
        'Owner must provide valid insurance before bookings can be accepted',
      );
    }
  }

  // [3] TAX CALCULATION
  const taxBreakdown = await this.taxService.calculateTax({
    amount: subtotal,
    currency: 'USD',
    listingId,
    country: listing.country,
    state: listing.state,
    city: listing.city,
  });

  const totalPrice = taxBreakdown.total;

  // [4] PAYMENT AUTHORIZATION
  const paymentIntent = await this.stripeService.createPaymentIntent({
    amount: Math.round(totalPrice * 100), // cents
    currency: 'usd',
    customerId: renterId,
    metadata: {
      bookingType: 'rental',
      listingId,
      ownerId: listing.ownerId,
      subtotal,
      tax: taxBreakdown.totalTax,
    },
  });

  // [5] CREATE BOOKING
  const booking = await this.prisma.booking.create({
    data: {
      listingId,
      renterId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      pricePerDay: listing.pricePerDay,
      numberOfDays: days,
      subtotal,
      taxAmount: taxBreakdown.totalTax,
      taxBreakdown: taxBreakdown.taxLines,
      totalPrice,
      status: 'DRAFT',
      paymentIntentId: paymentIntent.id,
      message,
      metadata: {
        fraudRiskLevel: fraudCheck.riskLevel,
        fraudRiskScore: fraudCheck.riskScore,
        insuranceVerified: insuranceMetadata?.insuranceVerified || false,
      },
    },
  });

  // [6] STATE MACHINE: Transition to PENDING_OWNER_APPROVAL
  await this.bookingStateMachine.transition(
    booking.id,
    'SUBMIT_FOR_APPROVAL',
    renterId,
  );

  // [7] NOTIFICATIONS
  // Notify owner
  await this.notificationService.sendNotification({
    userId: listing.ownerId,
    type: 'booking.request',
    title: 'New Booking Request',
    message: `You have a booking request for "${listing.title}"`,
    data: {
      bookingId: booking.id,
      renterName: (await this.prisma.user.findUnique({ where: { id: renterId } }))
        .firstName,
      startDate,
      endDate,
      totalPrice,
    },
    channels: ['email', 'push', 'in-app'],
    priority: 'high',
  });

  // Notify renter
  await this.notificationService.sendNotification({
    userId: renterId,
    type: 'booking.created',
    title: 'Booking Request Submitted',
    message: `Your booking request for "${listing.title}" has been sent to the owner`,
    data: { bookingId: booking.id },
    channels: ['email', 'in-app'],
  });

  // Emit event
  this.eventEmitter.emit('booking.created', {
    booking,
    listing,
    owner: listing.owner,
    fraudCheck,
    taxBreakdown,
  });

  return {
    booking: {
      ...booking,
      status: 'PENDING_OWNER_APPROVAL',
      paymentStatus: 'PENDING',
    },
    taxBreakdown,
    fraudCheck: {
      riskLevel: fraudCheck.riskLevel,
      requiresVerification: fraudCheck.riskLevel === 'HIGH',
    },
  };
}
```

---

## Scenario 3: Message Exchange (Real-time Moderation)

### Implementation

```typescript
// apps/api/src/modules/messaging/messaging.gateway.ts

@SubscribeMessage('send_message')
async handleSendMessage(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string; content: string },
) {
  const userId = client.data.userId;

  // [1] CONTENT MODERATION: Check message in real-time
  const moderationResult = await this.moderationService.moderateMessage(
    data.content,
  );

  if (moderationResult.status === 'REJECTED') {
    // Block message and notify user
    client.emit('message_blocked', {
      reason: moderationResult.blockedReasons?.join(', '),
      flags: moderationResult.flags,
    });

    // Log violation
    await this.prisma.auditLog.create({
      data: {
        action: 'MESSAGE_BLOCKED',
        entityType: 'MESSAGE',
        userId,
        metadata: {
          conversationId: data.conversationId,
          moderationResult,
        },
      },
    });

    return { success: false, blocked: true };
  }

  // If message contains PII, use masked version
  let messageContent = data.content;
  if (moderationResult.flags.some((f) => f.type.includes('DETECTED'))) {
    const textModeration = await this.textModerationService.detectPII(
      data.content,
    );
    messageContent = textModeration.maskedText;

    // Warn user about PII
    client.emit('message_warning', {
      message: 'Personal contact information was automatically removed',
      flags: textModeration.flags,
    });
  }

  // [2] FRAUD DETECTION: Check for suspicious messaging patterns
  const messagingRisk = await this.fraudDetectionService.checkMessagingRisk({
    userId,
    conversationId: data.conversationId,
    messageContent,
  });

  if (messagingRisk.riskLevel === 'HIGH') {
    // Log for review but still allow message
    await this.moderationQueueService.addToQueue({
      entityType: 'MESSAGE',
      entityId: `${userId}-${Date.now()}`,
      flags: messagingRisk.flags,
      priority: 'MEDIUM',
    });
  }

  // [3] CREATE MESSAGE
  const message = await this.prisma.message.create({
    data: {
      conversationId: data.conversationId,
      senderId: userId,
      content: messageContent,
      metadata: {
        originalBlocked: moderationResult.status === 'REJECTED',
        piiMasked: messageContent !== data.content,
        moderationFlags: moderationResult.flags,
      },
    },
    include: { sender: { select: { firstName: true, avatar: true } } },
  });

  // [4] SEND TO RECIPIENT(S)
  const conversation = await this.prisma.conversation.findUnique({
    where: { id: data.conversationId },
    include: { participants: true },
  });

  // Emit to all participants
  conversation.participants.forEach((participant) => {
    if (participant.userId !== userId) {
      this.server.to(`user:${participant.userId}`).emit('new_message', message);

      // [5] PUSH NOTIFICATION if recipient offline
      if (!this.connectedUsers.has(participant.userId)) {
        this.notificationService.sendNotification({
          userId: participant.userId,
          type: 'message.received',
          title: `New message from ${message.sender.firstName}`,
          message: messageContent.substring(0, 100),
          data: { conversationId: data.conversationId, messageId: message.id },
          channels: ['push'],
        });
      }
    }
  });

  return { success: true, message };
}
```

---

## Scenario 4: Organization Listing Creation

When a business account (organization) creates a listing:

```typescript
@Post()
@UseGuards(JwtAuthGuard, OrganizationGuard)
async createOrganizationListing(
  @CurrentUser('sub') userId: string,
  @OrganizationContext() org: { id: string; role: string },
  @Body() createListingDto: CreateListingDto,
) {
  // [1] CHECK ORGANIZATION PERMISSIONS
  if (!['OWNER', 'ADMIN', 'MANAGER'].includes(org.role)) {
    throw new ForbiddenException('Insufficient permissions to create listings');
  }

  // [2] FRAUD DETECTION: Check organization risk
  const orgFraudCheck = await this.fraudDetectionService.checkOrganizationRisk({
    organizationId: org.id,
    userId,
  });

  // [3] STANDARD LISTING FLOW
  // ... (same as individual listing creation)

  const listing = await this.prisma.listing.create({
    data: {
      ...createListingDto,
      ownerId: userId,
      organizationId: org.id, // Link to organization
      status: 'ACTIVE',
      metadata: {
        createdBy: userId,
        organizationRole: org.role,
        // ... other metadata
      },
    },
  });

  // [4] AUDIT LOG for organization
  await this.prisma.auditLog.create({
    data: {
      action: 'ORGANIZATION_LISTING_CREATED',
      entityType: 'LISTING',
      entityId: listing.id,
      userId,
      metadata: {
        organizationId: org.id,
        role: org.role,
      },
    },
  });

  return listing;
}
```

---

## Key Integration Points Summary

### 1. Fraud Detection Integration
- **Listing Creation**: User risk check before allowing listing
- **Booking Creation**: Booking risk check with velocity/pattern analysis
- **Message Sending**: Real-time suspicious activity detection
- **Payment Processing**: Transaction risk scoring

### 2. Content Moderation Integration
- **Listing Creation**: Text + image moderation before publish
- **Profile Updates**: Bio and photo moderation
- **Messaging**: Real-time PII detection and blocking
- **Reviews**: Content validation before publication

### 3. Tax Calculation Integration
- **Booking Creation**: Calculate taxes per jurisdiction
- **Payment Processing**: Tax line items in invoices
- **Payout Processing**: Net amounts after tax withholding
- **Reporting**: Generate 1099 forms for owners

### 4. Insurance Integration
- **Listing Creation**: Check if insurance required
- **Listing Activation**: Block activation without valid insurance
- **Booking Creation**: Verify insurance before accepting booking
- **Booking Confirmation**: Include insurance details in confirmation

### 5. Notification Integration
- **All Domain Events**: Automatic notifications via event listeners
- **Fraud Alerts**: High-risk activity notifications
- **Moderation Results**: Approval/rejection notifications
- **Insurance Expiration**: Reminder notifications
- **Tax Deadlines**: 1099 generation reminders

### 6. Organizations Integration
- **Multi-User Listings**: Team members can manage listings
- **Role-Based Access**: Owners/admins/managers/members permissions
- **Audit Trail**: Track which team member performed actions
- **Revenue Sharing**: Split payments across organization

---

## Error Handling Example

```typescript
try {
  // Create booking with all checks
  const booking = await this.createBooking(userId, dto);
  return { success: true, booking };
} catch (error) {
  // Log error with context
  this.logger.error('Booking creation failed', {
    userId,
    listingId: dto.listingId,
    error: error.message,
    stack: error.stack,
  });

  // Fraud-related errors
  if (error.message.includes('risk assessment')) {
    // Already notified user, just log
    await this.prisma.auditLog.create({
      data: {
        action: 'BOOKING_BLOCKED_FRAUD',
        userId,
        metadata: { dto, reason: error.message },
      },
    });
  }

  // Insurance-related errors
  if (error.message.includes('insurance')) {
    // Send helpful notification
    await this.notificationService.sendNotification({
      userId,
      type: 'booking.insurance_required',
      title: 'Insurance Required',
      message: error.message,
      channels: ['email', 'in-app'],
    });
  }

  throw error; // Re-throw for controller error handling
}
```

---

## Testing the Integration

### Unit Tests

```typescript
// Test fraud check integration
describe('Listing Creation with Fraud Check', () => {
  it('should block listing creation for high-risk users', async () => {
    // Mock high-risk fraud check
    jest.spyOn(fraudDetectionService, 'checkUserRisk').mockResolvedValue({
      riskLevel: 'CRITICAL',
      riskScore: 95,
      flags: [{ type: 'MULTIPLE_VIOLATIONS', severity: 'CRITICAL' }],
    });

    await expect(
      listingsController.createListing(userId, dto),
    ).rejects.toThrow('Account flagged for suspicious activity');
  });
});

// Test moderation integration
describe('Listing Creation with Moderation', () => {
  it('should create listing with PENDING status if flagged', async () => {
    jest.spyOn(moderationService, 'moderateListing').mockResolvedValue({
      status: 'FLAGGED',
      confidence: 0.7,
      flags: [{ type: 'SPAM', severity: 'MEDIUM' }],
      requiresHumanReview: true,
    });

    const result = await listingsController.createListing(userId, dto);
    expect(result.status).toBe('PENDING_REVIEW');
  });
});
```

### Integration Tests

```bash
# Test full booking flow
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "listingId": "listing-123",
    "startDate": "2026-02-01",
    "endDate": "2026-02-05",
    "message": "Looking forward to renting your car!"
  }'

# Expected response includes:
# - booking object
# - taxBreakdown with line items
# - fraudCheck.riskLevel
# - insurance validation result
# - notifications sent confirmation
```

---

## Monitoring and Alerts

### Metrics to Track

```typescript
// Prometheus metrics
export const fraudCheckCounter = new Counter({
  name: 'fraud_checks_total',
  help: 'Total fraud checks performed',
  labelNames: ['entity_type', 'risk_level'],
});

export const moderationCounter = new Counter({
  name: 'moderation_checks_total',
  help: 'Total moderation checks performed',
  labelNames: ['entity_type', 'status'],
});

export const notificationCounter = new Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications sent',
  labelNames: ['type', 'channel', 'success'],
});

// Usage
fraudCheckCounter.inc({ entity_type: 'booking', risk_level: 'HIGH' });
moderationCounter.inc({ entity_type: 'listing', status: 'FLAGGED' });
notificationCounter.inc({ type: 'booking.request', channel: 'email', success: 'true' });
```

### Alert Rules

```yaml
# Grafana alerts
groups:
  - name: fraud_alerts
    rules:
      - alert: HighFraudRate
        expr: sum(rate(fraud_checks_total{risk_level="HIGH"}[5m])) > 10
        annotations:
          summary: High fraud rate detected
          description: More than 10 high-risk checks per minute

  - name: moderation_alerts
    rules:
      - alert: ModerationQueueBacklog
        expr: moderation_queue_depth > 100
        annotations:
          summary: Moderation queue growing
          description: Queue has {{ $value }} items pending review

  - name: notification_alerts
    rules:
      - alert: NotificationFailureRate
        expr: sum(rate(notifications_sent_total{success="false"}[5m])) / sum(rate(notifications_sent_total[5m])) > 0.05
        annotations:
          summary: High notification failure rate
          description: {{ $value }}% of notifications failing
```

---

This integration example demonstrates how all the new systems work together seamlessly in production workflows!
