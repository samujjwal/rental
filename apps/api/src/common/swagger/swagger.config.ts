import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Universal Rental Portal API')
    .setDescription(
      'API documentation for the Universal Rental Portal platform. This API enables users to list, search, book, and manage rental items across various categories.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication and authorization endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('categories', 'Category management endpoints')
    .addTag('listings', 'Listing management endpoints')
    .addTag('bookings', 'Booking management endpoints')
    .addTag('payments', 'Payment processing endpoints')
    .addTag('search', 'Search and filtering endpoints')
    .addTag('reviews', 'Review and rating endpoints')
    .addTag('notifications', 'Notification endpoints')
    .addTag('messages', 'Messaging endpoints')
    .addTag('disputes', 'Dispute resolution endpoints')
    .addTag('admin', 'Admin panel endpoints')
    .addTag('upload', 'File upload endpoints')
    .addTag('webhooks', 'Webhook endpoints')
    .addTag('health', 'Health check endpoints')
    .addServer('http://localhost:3000', 'Local development server')
    .addServer('https://api-staging.rentalportal.com', 'Staging server')
    .addServer('https://api.rentalportal.com', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Universal Rental Portal API Documentation',
  });
}
