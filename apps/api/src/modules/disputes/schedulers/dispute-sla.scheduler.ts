import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DisputeEscalationService } from '../services/dispute-escalation.service';

/**
 * Runs SLA auto-escalation every 15 minutes.
 * Without this scheduler the only trigger is the admin HTTP endpoint POST /disputes/admin/check-sla,
 * meaning SLAs would expire silently.
 */
@Injectable()
export class DisputeSlaScheduler {
  private readonly logger = new Logger(DisputeSlaScheduler.name);

  constructor(private readonly escalationService: DisputeEscalationService) {}

  @Cron('*/15 * * * *', { name: 'dispute-sla-check' })
  async runSlaCheck(): Promise<void> {
    try {
      const result = await this.escalationService.processAutoEscalations();
      this.logger.debug(`SLA check complete: ${JSON.stringify(result)}`);
    } catch (err) {
      this.logger.error('SLA auto-escalation failed', err);
    }
  }
}
