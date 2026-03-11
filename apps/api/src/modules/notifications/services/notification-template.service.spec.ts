import { NotificationTemplateService } from './notification-template.service';

describe('NotificationTemplateService', () => {
  let service: NotificationTemplateService;

  beforeEach(() => {
    service = new NotificationTemplateService();
  });

  describe('getTemplate', () => {
    it('returns booking.request template', async () => {
      const tmpl = await service.getTemplate('booking.request', 'email');
      expect(tmpl).toContain('{{title}}');
      expect(tmpl).toContain('{{userName}}');
      expect(tmpl).toContain('{{bookingUrl}}');
      expect(tmpl).toContain('View Booking');
    });

    it('returns booking.confirmed template with booking details block', async () => {
      const tmpl = await service.getTemplate('booking.confirmed', 'email');
      expect(tmpl).toContain('{{itemName}}');
      expect(tmpl).toContain('{{startDate}}');
      expect(tmpl).toContain('{{endDate}}');
      expect(tmpl).toContain('Booking Details');
    });

    it('falls back to default template for unknown type', async () => {
      const tmpl = await service.getTemplate('some.unknown.type', 'email');
      expect(tmpl).toContain('{{title}}');
      expect(tmpl).toContain('{{message}}');
      expect(tmpl).not.toContain('{{bookingUrl}}');
    });
  });

  describe('renderTemplate', () => {
    it('replaces all placeholders', () => {
      const template = '<h2>{{title}}</h2><p>{{message}}</p>';
      const rendered = service.renderTemplate(template, {
        title: 'Hello',
        message: 'World',
      });
      expect(rendered).toBe('<h2>Hello</h2><p>World</p>');
    });

    it('replaces multiple occurrences of the same placeholder', () => {
      const template = '{{name}} said hi to {{name}}';
      const rendered = service.renderTemplate(template, { name: 'Sam' });
      expect(rendered).toBe('Sam said hi to Sam');
    });

    it('leaves unreferenced placeholders intact', () => {
      const template = 'Hello {{name}}, your booking is {{status}}';
      const rendered = service.renderTemplate(template, { name: 'Sam' });
      // status is not provided → placeholder stays
      expect(rendered).toBe('Hello Sam, your booking is {{status}}');
    });

    it('converts non-string values to strings', () => {
      const template = 'Amount: {{amount}}';
      const rendered = service.renderTemplate(template, { amount: 1500 });
      expect(rendered).toBe('Amount: 1500');
    });

    it('handles empty data gracefully', () => {
      const template = '{{title}}';
      const rendered = service.renderTemplate(template, {});
      expect(rendered).toBe('{{title}}'); // no keys → no replacement
    });

    it('handles null/undefined values', () => {
      const template = 'Val: {{val}}';
      const rendered = service.renderTemplate(template, { val: null });
      expect(rendered).toBe('Val: ');
    });
  });
});
