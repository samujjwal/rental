import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { SkipCsrf } from '@/common/guards/csrf.guard';

@ApiTags('webhooks')
@SkipCsrf()
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('stripe')
  @ApiOperation({ summary: 'Handle Stripe webhooks' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw i18nBadRequest('payment.missingSignatureHeader');
    }

    // Get raw body for signature verification
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw i18nBadRequest('payment.missingRequestBody');
    }

    try {
      await this.webhookService.handleStripeWebhook(rawBody, signature);
      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      // Signature verification failures → 400 (permanent, don't retry)
      // Processing errors → 500 (transient, Stripe will retry)
      if (error.message?.includes('signature') || error.message?.includes('Webhook')) {
        throw new BadRequestException(error.message);
      }
      throw error; // Let NestJS return 500 for transient failures
    }
  }
}
