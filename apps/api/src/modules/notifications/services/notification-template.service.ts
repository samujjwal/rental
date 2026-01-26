import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationTemplateService {
  /**
   * Get email template for notification type
   */
  async getTemplate(notificationType: string, channel: string): Promise<string> {
    // In production: Load from template files or database
    const templates: Record<string, string> = {
      'booking.request': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>{{title}}</h2>
          <p>Hi {{userName}},</p>
          <p>{{message}}</p>
          <a href="{{bookingUrl}}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            View Booking
          </a>
          <p>Best regards,<br/>Rental Portal Team</p>
        </div>
      `,
      'booking.confirmed': `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10B981;">✓ {{title}}</h2>
          <p>Hi {{userName}},</p>
          <p>{{message}}</p>
          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Details:</strong></p>
            <p>Item: {{itemName}}</p>
            <p>Dates: {{startDate}} - {{endDate}}</p>
          </div>
          <a href="{{bookingUrl}}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Details
          </a>
        </div>
      `,
      default: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>{{title}}</h2>
          <p>{{message}}</p>
        </div>
      `,
    };

    return templates[notificationType] || templates.default;
  }

  /**
   * Render template with data
   */
  renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(data)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
    }

    return rendered;
  }
}
