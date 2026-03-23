/**
 * MarketplaceOperationsModule
 *
 * Owns core transactional and operational runtime capabilities:
 *   - Checkout Orchestrator
 *   - Payment Orchestration
 *   - Availability Graph (real-time slot management)
 *   - Inventory Graph (stock tracking)
 *   - Observability (operational metrics + health aggregation)
 *   - Bulk Operations (batch mutation pipelines)
 *   - AvailabilityGateway (WebSocket real-time updates)
 */
import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../../common/storage/storage.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { BookingsModule } from '../../bookings/bookings.module';
import { MarketplaceComplianceModule } from './marketplace-compliance.module';
import { MarketplacePricingModule } from './marketplace-pricing.module';

// Services
import { CheckoutOrchestratorService } from '../services/checkout-orchestrator.service';
import { PaymentOrchestrationService } from '../services/payment-orchestration.service';
import { AvailabilityGraphService } from '../services/availability-graph.service';
import { InventoryGraphService } from '../services/inventory-graph.service';
import { ObservabilityService } from '../services/observability.service';
import { BulkOperationsService } from '../services/bulk-operations.service';

// Controllers
import { CheckoutController } from '../controllers/checkout.controller';
import { PaymentOrchestrationController } from '../controllers/payment-orchestration.controller';
import { AvailabilityController } from '../controllers/availability.controller';
import { InventoryGraphController } from '../controllers/inventory-graph.controller';
import { ObservabilityController } from '../controllers/observability.controller';
import { BulkOperationsController } from '../controllers/bulk-operations.controller';

// Gateways
import { AvailabilityGateway } from '../gateways/availability.gateway';

const SERVICES = [
  CheckoutOrchestratorService,
  PaymentOrchestrationService,
  AvailabilityGraphService,
  InventoryGraphService,
  ObservabilityService,
  BulkOperationsService,
];

const CONTROLLERS = [
  CheckoutController,
  PaymentOrchestrationController,
  AvailabilityController,
  InventoryGraphController,
  ObservabilityController,
  BulkOperationsController,
];

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    NotificationsModule,
    forwardRef(() => BookingsModule),
    forwardRef(() => MarketplaceComplianceModule),
    MarketplacePricingModule,
  ],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES, AvailabilityGateway],
  exports: [...SERVICES, forwardRef(() => MarketplaceComplianceModule)],
})
export class MarketplaceOperationsModule {}
